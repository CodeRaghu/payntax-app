import re

from rest_framework import serializers

from apps.core.crypto import mask_ssn

from .models import Client

SSN_RE = re.compile(r"^\d{3}-?\d{2}-?\d{4}$")


class ClientSerializer(serializers.ModelSerializer):
    ssn = serializers.CharField(write_only=True, required=False, allow_blank=True)
    ssn_masked = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    return_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Client
        fields = [
            "id", "first_name", "last_name", "full_name", "email", "phone", "ssn", "ssn_masked",
            "filing_status", "street", "city", "state", "zip_code", "notes", "return_count",
            "created_at", "updated_at",
        ]  # fmt: skip
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_ssn_masked(self, client: Client) -> str:
        return mask_ssn(client.ssn_last4)

    def get_full_name(self, client: Client) -> str:
        return f"{client.first_name} {client.last_name}"

    def validate_ssn(self, value: str) -> str:
        if value and not SSN_RE.match(value):
            raise serializers.ValidationError("Use the format 123-45-6789.")
        digits = value.replace("-", "")
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}" if digits else ""

    def validate_state(self, value: str) -> str:
        return value.upper()


class RevealSsnSerializer(serializers.Serializer):
    ssn = serializers.CharField()
