from django.conf import settings
from django.core import signing
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsFirmOwner, IsMfaVerified
from apps.audit import service as audit
from apps.core.providers import get_provider

from .models import Subscription
from .plans import PLANS, get_plan
from .serializers import (
    CheckoutRequestSerializer,
    FakeCompleteSerializer,
    PlanSerializer,
    RedirectSerializer,
    SubscriptionSerializer,
)


class PlanList(APIView):
    @extend_schema(operation_id="billing_plans", responses=PlanSerializer(many=True))
    def get(self, request):
        return Response(PlanSerializer(PLANS, many=True).data)


class SubscriptionView(APIView):
    permission_classes = [IsMfaVerified]

    @extend_schema(operation_id="billing_subscription", responses={200: SubscriptionSerializer})
    def get(self, request):
        subscription = Subscription.objects.filter(firm=request.user.firm).first()
        if subscription is None:
            raise Http404("No subscription yet.")
        return Response(SubscriptionSerializer(subscription).data)


class CheckoutView(APIView):
    """SCR-03: start hosted checkout. The browser is redirected; card data never reaches us."""

    permission_classes = [IsFirmOwner]

    @extend_schema(
        operation_id="billing_checkout", request=CheckoutRequestSerializer, responses=RedirectSerializer
    )
    def post(self, request):
        data = CheckoutRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        plan = get_plan(data.validated_data["plan"])
        if plan is None:
            raise ValidationError({"plan": ["Unknown plan."]})
        url = get_provider("BILLING_PROVIDER").create_checkout_url(request.user.firm, plan)
        audit.record(request, "billing.checkout_started", plan=plan.id)
        return Response({"url": url})


class PortalView(APIView):
    """SCR-10: the owner manages billing in the provider's portal (REQ-BIL-003)."""

    permission_classes = [IsFirmOwner]

    @extend_schema(operation_id="billing_portal", request=None, responses=RedirectSerializer)
    def post(self, request):
        return Response({"url": get_provider("BILLING_PROVIDER").create_portal_url(request.user.firm)})


class FakeCheckoutCompleteView(APIView):
    """Local/dev only: stands in for the Stripe webhook that activates the subscription."""

    permission_classes = [IsFirmOwner]

    @extend_schema(
        operation_id="billing_fake_complete", request=FakeCompleteSerializer, responses=SubscriptionSerializer
    )
    def post(self, request):
        if not settings.BILLING_PROVIDER.endswith("FakeBillingProvider"):
            raise Http404
        data = FakeCompleteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            subscription = get_provider("BILLING_PROVIDER").complete_checkout(
                request.user.firm, data.validated_data["session"]
            )
        except signing.BadSignature as exc:
            raise ValidationError({"session": ["Checkout session is invalid or expired."]}) from exc
        audit.record(request, "billing.subscription_started", subscription, plan=subscription.plan)
        return Response(SubscriptionSerializer(subscription).data)
