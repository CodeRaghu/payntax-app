from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import Firm, Invitation, Role, User


class FirmSerializer(serializers.ModelSerializer):
    class Meta:
        model = Firm
        fields = ["id", "name", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    mfa_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "is_active", "mfa_enrolled", "last_login"]
        read_only_fields = ["id", "email", "full_name", "mfa_enrolled", "last_login"]

    def get_mfa_enrolled(self, user: User) -> bool:
        from django_otp import devices_for_user

        return any(True for _ in devices_for_user(user, confirmed=True))


class SessionSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField()
    mfa_enrolled = serializers.BooleanField()
    mfa_verified = serializers.BooleanField()
    subscription_status = serializers.CharField(allow_null=True)
    user = UserSerializer(allow_null=True)
    firm = FirmSerializer(allow_null=True)


class PasswordField(serializers.CharField):
    def __init__(self, **kwargs):
        super().__init__(write_only=True, trim_whitespace=False, style={"input_type": "password"}, **kwargs)


class SignupSerializer(serializers.Serializer):
    firm_name = serializers.CharField(max_length=200)
    full_name = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    password = PasswordField()

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        password_validation.validate_password(attrs["password"], User(email=attrs["email"]))
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = PasswordField()


class MfaSetupSerializer(serializers.Serializer):
    otpauth_url = serializers.CharField()
    secret = serializers.CharField()
    qr_svg = serializers.CharField()


class MfaVerifySerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})


class InvitationSerializer(serializers.ModelSerializer):
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["id", "email", "role", "expires_at", "accepted_at", "created_at", "invite_url"]
        read_only_fields = ["id", "expires_at", "accepted_at", "created_at", "invite_url"]

    def get_invite_url(self, invitation: Invitation) -> str | None:
        # Shown to the owner until email delivery is wired up (SES). Never exposed once accepted.
        from django.conf import settings

        return None if invitation.accepted_at else f"{settings.FRONTEND_URL}/invite/{invitation.token}"

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This person already has an account.")
        return value.lower()


class InvitationPreviewSerializer(serializers.Serializer):
    email = serializers.EmailField()
    firm_name = serializers.CharField()
    role = serializers.ChoiceField(choices=Role.choices)


class AcceptInvitationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200)
    password = PasswordField()


class FirmUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["role", "is_active"]
