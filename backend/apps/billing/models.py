from django.db import models

from apps.core.models import BaseModel


class SubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past due"
    CANCELED = "canceled", "Canceled"


class Subscription(BaseModel):
    USABLE = [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE]

    firm = models.OneToOneField("accounts.Firm", on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=40)
    status = models.CharField(max_length=20, choices=SubscriptionStatus.choices)
    provider_customer_id = models.CharField(max_length=100, blank=True)
    provider_subscription_id = models.CharField(max_length=100, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
