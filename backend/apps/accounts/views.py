"""Authentication and firm management.

The UI only depends on the request/response shapes in contract/openapi.yaml. Swapping Django auth for
Cognito, Auth0 or Clerk (ADR-0003) means re-implementing these endpoints, not changing screens.
"""

from base64 import b32encode

import qrcode
import qrcode.image.svg
from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django_otp import devices_for_user
from django_otp import login as otp_login
from django_otp.plugins.otp_totp.models import TOTPDevice
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit import service as audit

from .models import Firm, Invitation, Role, User
from .permissions import IsFirmOwner, IsMfaVerified, is_verified
from .serializers import (
    AcceptInvitationSerializer,
    FirmSerializer,
    FirmUserUpdateSerializer,
    InvitationPreviewSerializer,
    InvitationSerializer,
    LoginSerializer,
    MfaSetupSerializer,
    MfaVerifySerializer,
    SessionSerializer,
    SignupSerializer,
    UserSerializer,
)


def session_payload(request) -> dict:
    from apps.billing.models import Subscription

    user = request.user
    if not user.is_authenticated:
        return {
            "authenticated": False,
            "mfa_enrolled": False,
            "mfa_verified": False,
            "subscription_status": None,
            "user": None,
            "firm": None,
        }
    subscription = Subscription.objects.filter(firm_id=user.firm_id).first()
    return {
        "authenticated": True,
        "mfa_enrolled": any(True for _ in devices_for_user(user, confirmed=True)),
        "mfa_verified": is_verified(user),
        "subscription_status": subscription.status if subscription else None,
        "user": UserSerializer(user).data,
        "firm": FirmSerializer(user.firm).data if user.firm else None,
    }


class ThrottledAuthView(APIView):
    """Sign-in endpoints are rate limited per client (10/min)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(APIView):
    """Who is signed in and which step of sign-in they are at. Also sets the CSRF cookie."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="auth_session", responses=SessionSerializer)
    def get(self, request):
        return Response(session_payload(request))


class SignupView(ThrottledAuthView):
    """SCR-01: a CPA creates a firm and becomes its owner (REQ-ACC-001)."""

    permission_classes = [AllowAny]

    @extend_schema(operation_id="auth_signup", request=SignupSerializer, responses={201: SessionSerializer})
    def post(self, request):
        data = SignupSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            firm = Firm.objects.create(name=data.validated_data["firm_name"])
            user = User.objects.create_user(
                email=data.validated_data["email"],
                password=data.validated_data["password"],
                full_name=data.validated_data["full_name"],
                firm=firm,
                role=Role.OWNER,
            )
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        audit.record(request, "auth.signup", firm, user=user)
        return Response(session_payload(request), status=status.HTTP_201_CREATED)


class LoginView(ThrottledAuthView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="auth_login", request=LoginSerializer, responses=SessionSerializer)
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(
            request, username=data.validated_data["email"].lower(), password=data.validated_data["password"]
        )
        if user is None or user.firm_id is None:
            audit.record(request, "auth.login_failed", None, user=None, firm=None)
            raise ValidationError({"detail": "Email or password is incorrect."})
        login(request, user)
        audit.record(request, "auth.login", None, user=user)
        return Response(session_payload(request))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="auth_logout", request=None, responses={204: None})
    def post(self, request):
        if request.user.is_authenticated:
            audit.record(request, "auth.logout")
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MfaSetupView(APIView):
    """SCR-02: start TOTP enrollment. Only allowed while the user has no confirmed device."""

    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="auth_mfa_setup", request=None, responses=MfaSetupSerializer)
    def post(self, request):
        user = request.user
        if any(True for _ in devices_for_user(user, confirmed=True)):
            raise PermissionDenied("MFA is already set up. Ask the firm owner to reset it.")
        TOTPDevice.objects.filter(user=user, confirmed=False).delete()
        device = TOTPDevice.objects.create(user=user, name="Authenticator app", confirmed=False)
        url = device.config_url
        svg = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage).to_string(encoding="unicode")
        return Response({"otpauth_url": url, "secret": b32encode(device.bin_key).decode(), "qr_svg": svg})


class MfaVerifyView(ThrottledAuthView):
    """SCR-02: confirm enrollment or answer the challenge at sign-in."""

    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="auth_mfa_verify", request=MfaVerifySerializer, responses=SessionSerializer)
    def post(self, request):
        data = MfaVerifySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = request.user
        device = (
            TOTPDevice.objects.filter(user=user, confirmed=True).first()
            or TOTPDevice.objects.filter(user=user, confirmed=False).first()
        )
        if device is None or not device.verify_token(data.validated_data["code"]):
            audit.record(request, "auth.mfa_failed")
            raise ValidationError({"code": ["That code didn't work. Check your authenticator app."]})
        if not device.confirmed:
            device.confirmed = True
            device.save(update_fields=["confirmed"])
            audit.record(request, "auth.mfa_enrolled")
        otp_login(request, device)
        audit.record(request, "auth.mfa_verified")
        return Response(session_payload(request))


def get_usable_invitation(token: str) -> Invitation:
    invitation = get_object_or_404(Invitation.objects.select_related("firm"), token=token)
    if not invitation.is_usable:
        raise ValidationError({"detail": "This invitation has expired or was already used."})
    return invitation


class InvitationPreviewView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(operation_id="auth_invitation_preview", responses=InvitationPreviewSerializer)
    def get(self, request, token: str):
        invitation = get_usable_invitation(token)
        return Response(
            {"email": invitation.email, "firm_name": invitation.firm.name, "role": invitation.role}
        )


class AcceptInvitationView(ThrottledAuthView):
    permission_classes = [AllowAny]

    @extend_schema(
        operation_id="auth_invitation_accept", request=AcceptInvitationSerializer, responses=SessionSerializer
    )
    def post(self, request, token: str):
        invitation = get_usable_invitation(token)
        data = AcceptInvitationSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        from django.contrib.auth import password_validation

        password_validation.validate_password(data.validated_data["password"], User(email=invitation.email))
        with transaction.atomic():
            user = User.objects.create_user(
                email=invitation.email,
                password=data.validated_data["password"],
                full_name=data.validated_data["full_name"],
                firm=invitation.firm,
                role=invitation.role,
            )
            invitation.accepted_at = timezone.now()
            invitation.save(update_fields=["accepted_at"])
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        audit.record(request, "auth.invitation_accepted", invitation, user=user)
        return Response(session_payload(request))


class FirmView(generics.RetrieveUpdateAPIView):
    """SCR-10: firm profile. Everyone can read it; only the owner can rename it."""

    serializer_class = FirmSerializer
    http_method_names = ["get", "patch"]

    def get_permissions(self):
        return [IsFirmOwner()] if self.request.method == "PATCH" else [IsMfaVerified()]

    def get_object(self):
        return self.request.user.firm

    def perform_update(self, serializer):
        firm = serializer.save()
        audit.record(self.request, "firm.update", firm)


class FirmUserViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """SCR-10: firm members. The owner changes roles or deactivates users (REQ-ACC-003)."""

    queryset = User.objects.all()
    http_method_names = ["get", "patch"]
    pagination_class = None

    def get_permissions(self):
        return [IsFirmOwner()] if self.request.method == "PATCH" else [IsMfaVerified()]

    def get_queryset(self):
        return User.objects.filter(firm=self.request.user.firm).order_by("full_name", "email")

    def get_serializer_class(self):
        return FirmUserUpdateSerializer if self.request.method == "PATCH" else UserSerializer

    def perform_update(self, serializer):
        if serializer.instance == self.request.user:
            raise ValidationError({"detail": "You can't change your own role or deactivate yourself."})
        user = serializer.save()
        audit.record(self.request, "firm.user_update", user, **serializer.validated_data)

    @extend_schema(responses=UserSerializer)
    def partial_update(self, request, *args, **kwargs):
        super().partial_update(request, *args, **kwargs)
        return Response(UserSerializer(self.get_object()).data)


class InvitationViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    queryset = Invitation.objects.all()
    serializer_class = InvitationSerializer
    permission_classes = [IsFirmOwner]
    pagination_class = None

    def get_queryset(self):
        return Invitation.objects.filter(firm=self.request.user.firm, accepted_at__isnull=True)

    def perform_create(self, serializer):
        invitation = serializer.save(firm=self.request.user.firm, invited_by=self.request.user)
        audit.record(self.request, "firm.invite", invitation, role=invitation.role)

    def perform_destroy(self, instance):
        audit.record(self.request, "firm.invite_revoked", instance)
        instance.delete()
