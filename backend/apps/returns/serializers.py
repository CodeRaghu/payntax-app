from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from apps.clients.models import Client
from apps.core.tenancy import FirmScopedPrimaryKeyRelatedField

from .models import TaxReturn


class DocumentCountsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    processing = serializers.IntegerField()
    needs_attention = serializers.IntegerField()
    reviewed = serializers.IntegerField()


class TaxReturnSerializer(serializers.ModelSerializer):
    client = FirmScopedPrimaryKeyRelatedField(queryset=Client.objects.all())
    client_name = serializers.SerializerMethodField()
    document_counts = serializers.SerializerMethodField()

    class Meta:
        model = TaxReturn
        fields = [
            "id", "client", "client_name", "tax_year", "form_type", "status", "document_counts",
            "created_at", "updated_at",
        ]  # fmt: skip
        read_only_fields = ["id", "form_type", "status", "created_at", "updated_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=TaxReturn.objects.all(),
                fields=["client", "tax_year"],
                message="This client already has a return for that year.",
            )
        ]

    def get_client_name(self, tax_return: TaxReturn) -> str:
        return str(tax_return.client)

    @extend_schema_field(DocumentCountsSerializer)
    def get_document_counts(self, tax_return: TaxReturn) -> dict:
        statuses = list(tax_return.documents.values_list("status", flat=True))
        processing = {"uploading", "uploaded", "scanning", "classifying", "extracting"}
        return {
            "total": len(statuses),
            "processing": sum(s in processing for s in statuses),
            "needs_attention": sum(s in {"needs_review", "failed"} for s in statuses),
            "reviewed": sum(s == "reviewed" for s in statuses),
        }

    def validate_tax_year(self, value: int) -> int:
        if not 2020 <= value <= timezone.now().year:
            raise serializers.ValidationError("Choose a tax year between 2020 and this year.")
        return value


class TaxReturnUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxReturn
        fields = ["status"]

    def validate_status(self, value: str) -> str:
        if value not in {"complete", "ready", "in_review", "draft"}:
            raise serializers.ValidationError("Unknown status.")
        return value
