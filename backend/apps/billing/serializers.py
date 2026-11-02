from rest_framework import serializers

from .models import Subscription


class PlanSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    monthly_price_cents = serializers.IntegerField()
    description = serializers.CharField()
    features = serializers.ListField(child=serializers.CharField())
    trial_days = serializers.IntegerField()


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ["plan", "status", "trial_ends_at", "current_period_end"]
        read_only_fields = fields


class CheckoutRequestSerializer(serializers.Serializer):
    plan = serializers.CharField()


class RedirectSerializer(serializers.Serializer):
    url = serializers.URLField()


class FakeCompleteSerializer(serializers.Serializer):
    session = serializers.CharField()
