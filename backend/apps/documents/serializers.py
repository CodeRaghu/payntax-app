from django.conf import settings
from rest_framework import serializers

from apps.core.crypto import mask_ssn
from apps.core.tenancy import FirmScopedPrimaryKeyRelatedField
from apps.extraction.models import ExtractedField
from apps.returns.models import TaxReturn

from .models import Document


def _display(field: ExtractedField, value: str) -> str:
    return mask_ssn(value) if field.sensitive else value


class ExtractedFieldSerializer(serializers.ModelSerializer):
    value = serializers.SerializerMethodField(method_name="display_value")
    original_value = serializers.SerializerMethodField()
    low_confidence = serializers.BooleanField(read_only=True)
    needs_attention = serializers.BooleanField(read_only=True)
    bbox = serializers.ListField(
        child=serializers.FloatField(),
        allow_null=True,
        read_only=True,
        help_text="[x, y, width, height] as fractions of the page",
    )

    class Meta:
        model = ExtractedField
        fields = [
            "id", "name", "label", "kind", "value", "original_value", "confidence", "low_confidence",
            "rule_issue", "acknowledged", "corrected", "needs_attention", "sensitive", "bbox",
        ]  # fmt: skip
        read_only_fields = fields

    def display_value(self, field: ExtractedField) -> str:
        return _display(field, field.value)

    def get_original_value(self, field: ExtractedField) -> str:
        return _display(field, field.original_value)


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.full_name", read_only=True, default="")
    attention_count = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id", "tax_return", "filename", "content_type", "size", "doc_type", "status", "error_message",
            "attention_count", "uploaded_by_name", "reviewed_at", "created_at", "updated_at",
        ]  # fmt: skip
        read_only_fields = fields

    def get_attention_count(self, document: Document) -> int:
        return sum(field.needs_attention for field in document.fields.all())


class DocumentDetailSerializer(DocumentSerializer):
    file_url = serializers.SerializerMethodField()
    extracted_fields = ExtractedFieldSerializer(source="fields", many=True, read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.full_name", read_only=True, default="")
    confidence_threshold = serializers.SerializerMethodField()

    class Meta(DocumentSerializer.Meta):
        fields = [
            *DocumentSerializer.Meta.fields,
            "file_url",
            "extracted_fields",
            "reviewed_by_name",
            "confidence_threshold",
        ]
        read_only_fields = fields

    def get_file_url(self, document: Document) -> str | None:
        from apps.core.providers import get_provider

        if document.status in {"uploading", "rejected"}:
            return None
        return get_provider("STORAGE_BACKEND").presign_download(document.storage_key)

    def get_confidence_threshold(self, document: Document) -> float:
        return settings.EXTRACTION_CONFIDENCE_THRESHOLD


class UploadRequestSerializer(serializers.Serializer):
    tax_return = FirmScopedPrimaryKeyRelatedField(queryset=TaxReturn.objects.all())
    filename = serializers.CharField(max_length=255)
    content_type = serializers.ChoiceField(choices=settings.DOCUMENT_CONTENT_TYPES)
    size = serializers.IntegerField(min_value=1)

    def validate_size(self, value: int) -> int:
        if value > settings.DOCUMENT_MAX_BYTES:
            raise serializers.ValidationError("Files must be 20 MB or smaller.")
        return value

    def validate_filename(self, value: str) -> str:
        return value.replace("/", "_").replace("\\", "_").strip()


class UploadInstructionsSerializer(serializers.Serializer):
    url = serializers.URLField()
    method = serializers.CharField()
    headers = serializers.DictField(child=serializers.CharField())


class UploadResponseSerializer(serializers.Serializer):
    document = DocumentSerializer()
    upload = UploadInstructionsSerializer()


class FieldUpdateSerializer(serializers.Serializer):
    value = serializers.CharField(required=False, allow_blank=True, max_length=200)
    acknowledged = serializers.BooleanField(required=False)


class SensitiveValuesSerializer(serializers.Serializer):
    values = serializers.DictField(child=serializers.CharField())
