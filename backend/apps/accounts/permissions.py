from django.conf import settings
from rest_framework.permissions import BasePermission


def is_verified(user) -> bool:
    """django-otp's middleware adds user.is_verified(); a user set by login() mid-request doesn't have it yet."""
    check = getattr(user, "is_verified", None)
    return bool(check and check())


class IsMfaVerified(BasePermission):
    """Default for every endpoint: signed in, in a firm, and MFA verified this session (REQ-ACC-002)."""

    message = "Multi-factor authentication is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.firm_id and is_verified(user))


class IsFirmOwner(IsMfaVerified):
    message = "Only the firm owner can do this."

    def has_permission(self, request, view) -> bool:
        return super().has_permission(request, view) and request.user.is_owner


class HasActiveSubscription(IsMfaVerified):
    """Client data needs a trialing or active subscription (SCR-03 comes before the client list)."""

    message = "An active subscription is required."

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if not settings.BILLING_REQUIRED:
            return True
        from apps.billing.models import Subscription

        return Subscription.objects.filter(
            firm_id=request.user.firm_id, status__in=Subscription.USABLE
        ).exists()
