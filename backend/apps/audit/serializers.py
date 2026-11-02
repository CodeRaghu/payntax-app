from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None, allow_null=True)

    class Meta:
        model = AuditEvent
        fields = ["id", "at", "user_email", "action", "object_type", "object_id", "metadata", "ip_address"]
        read_only_fields = fields
