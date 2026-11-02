"""Billing provider interface. FakeBillingProvider is for local/dev; a StripeBillingProvider (TODO S6)
implements the same three methods with Stripe Checkout, the customer portal and webhooks."""

from datetime import timedelta
from typing import Protocol

from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import Subscription, SubscriptionStatus
from .plans import Plan


class BillingProvider(Protocol):
    def create_checkout_url(self, firm, plan: Plan) -> str: ...

    def create_portal_url(self, firm) -> str: ...

    def complete_checkout(self, firm, session_token: str) -> Subscription: ...


class FakeBillingProvider:
    """Simulates Stripe hosted checkout with a signed token and a local confirmation page."""

    salt = "payntax.fake-checkout"

    def create_checkout_url(self, firm, plan: Plan) -> str:
        token = signing.dumps({"firm": str(firm.pk), "plan": plan.id}, salt=self.salt)
        return f"{settings.FRONTEND_URL}/billing/fake-checkout?session={token}"

    def create_portal_url(self, firm) -> str:
        return f"{settings.FRONTEND_URL}/settings?tab=billing&portal=fake"

    def complete_checkout(self, firm, session_token: str) -> Subscription:
        from .plans import get_plan

        data = signing.loads(session_token, salt=self.salt, max_age=3600)
        plan = get_plan(data["plan"])
        if plan is None or data["firm"] != str(firm.pk):
            raise signing.BadSignature("Checkout session does not belong to this firm")
        subscription, _ = Subscription.objects.update_or_create(
            firm=firm,
            defaults={
                "plan": plan.id,
                "status": SubscriptionStatus.TRIALING,
                "trial_ends_at": timezone.now() + timedelta(days=plan.trial_days),
                "provider_customer_id": f"fake_cus_{data['firm'][:8]}",
            },
        )
        return subscription
