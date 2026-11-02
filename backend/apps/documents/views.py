import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import HasActiveSubscription
from apps.audit import service as audit
from apps.core.providers import get_provider
from apps.core.tenancy import FirmScopedQuerysetMixin
from apps.extraction.models import ExtractedField
from apps.extraction.service import correct_field

from .models import Document, DocumentStatus
from .serializers import (
    DocumentDetailSerializer,
    DocumentSerializer,
    FieldUpdateSerializer,
    SensitiveValuesSerializer,
    UploadRequestSerializer,
    UploadResponseSerializer,
)
from .tasks import process_document_task


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("tax_return", OpenApiTypes.UUID, required=True)])
)
class DocumentViewSet(
    FirmScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """SCR-07 (upload and status) and SCR-08 (side-by-side review)."""

    queryset = Document.objects.select_related("tax_return", "uploaded_by", "reviewed_by").prefetch_related(
        Prefetch("fields", queryset=ExtractedField.objects.order_by("order"))
    )
    permission_classes = [HasActiveSubscription]
    pagination_class = None

    def get_serializer_class(self):
        return DocumentSerializer if self.action == "list" else DocumentDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            try:
                qs = qs.filter(tax_return_id=uuid.UUID(self.request.query_params.get("tax_return", "")))
            except ValueError:
                return qs.none()
        return qs

    def detail_response(self, document: Document, code: int = status.HTTP_200_OK) -> Response:
        document = self.get_queryset().get(pk=document.pk)  # fresh fields and prefetch
        return Response(
            DocumentDetailSerializer(document, context=self.get_serializer_context()).data, status=code
        )

    @extend_schema(
        operation_id="documents_create_upload",
        request=UploadRequestSerializer,
        responses={201: UploadResponseSerializer},
    )
    def create(self, request):
        """Step 1 of upload: register the file and get a pre-signed URL to PUT it to."""
        data = UploadRequestSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        tax_return = data.validated_data["tax_return"]
        document_id = uuid.uuid4()
        document = Document.objects.create(
            id=document_id,
            firm=request.user.firm,
            tax_return=tax_return,
            filename=data.validated_data["filename"],
            content_type=data.validated_data["content_type"],
            size=data.validated_data["size"],
            storage_key=f"firms/{request.user.firm_id}/returns/{tax_return.pk}/{document_id}",
            uploaded_by=request.user,
        )
        url, headers = get_provider("STORAGE_BACKEND").presign_upload(
            document.storage_key, document.content_type
        )
        audit.record(request, "document.upload_started", document)
        return Response(
            {
                "document": DocumentSerializer(document).data,
                "upload": {"url": url, "method": "PUT", "headers": headers},
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(operation_id="documents_complete_upload", request=None, responses=DocumentSerializer)
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Step 2 of upload: the browser finished the PUT; verify the object and queue processing."""
        document = self.get_object()
        if document.status != DocumentStatus.UPLOADING:
            raise ValidationError({"detail": "This upload was already completed."})
        storage = get_provider("STORAGE_BACKEND")
        size = storage.size(document.storage_key)
        if size is None:
            raise ValidationError({"detail": "The file hasn't arrived yet. Try the upload again."})
        if size > settings.DOCUMENT_MAX_BYTES:
            storage.delete(document.storage_key)
            document.set_status(DocumentStatus.REJECTED, "Files must be 20 MB or smaller.")
        else:
            document.size = size
            document.status = DocumentStatus.UPLOADED
            document.save(update_fields=["size", "status", "updated_at"])
            transaction.on_commit(lambda: process_document_task.delay(str(document.pk)))
        document.tax_return.refresh_status()
        audit.record(request, "document.uploaded", document)
        return Response(DocumentSerializer(document).data)

    def retrieve(self, request, *args, **kwargs):
        document = self.get_object()
        audit.record(request, "document.view", document)
        return self.detail_response(document)

    def perform_destroy(self, instance):
        get_provider("STORAGE_BACKEND").delete(instance.storage_key)
        audit.record(self.request, "document.delete", instance)
        tax_return = instance.tax_return
        instance.delete()
        tax_return.refresh_status()

    @extend_schema(operation_id="documents_retry", request=None, responses=DocumentSerializer)
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        document = self.get_object()
        if document.status != DocumentStatus.FAILED:
            raise ValidationError({"detail": "Only failed documents can be retried."})
        document.set_status(DocumentStatus.UPLOADED)
        transaction.on_commit(lambda: process_document_task.delay(str(document.pk)))
        audit.record(request, "document.retry", document)
        return Response(DocumentSerializer(document).data)

    @extend_schema(
        operation_id="documents_update_field",
        request=FieldUpdateSerializer,
        responses=DocumentDetailSerializer,
        parameters=[OpenApiParameter("field_id", OpenApiTypes.UUID, OpenApiParameter.PATH)],
    )
    @action(detail=True, methods=["patch"], url_path=r"fields/(?P<field_id>[0-9a-f-]{36})")
    def update_field(self, request, pk=None, field_id=None):
        """SCR-08: correct a value or acknowledge a warning. Every change is audit logged."""
        document = self.get_object()
        field = get_object_or_404(ExtractedField, pk=field_id, document=document)
        data = FieldUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if document.status == DocumentStatus.REVIEWED:  # editing re-opens the review
            document.reviewed_at, document.reviewed_by = None, None
            document.status = DocumentStatus.READY_FOR_REVIEW
            document.save(update_fields=["reviewed_at", "reviewed_by", "status", "updated_at"])
        correct_field(
            field,
            request.user,
            value=data.validated_data.get("value"),
            acknowledged=data.validated_data.get("acknowledged"),
        )
        audit.record(
            request,
            "document.field_update",
            document,
            field=field.name,
            corrected="value" in data.validated_data,
            acknowledged=data.validated_data.get("acknowledged"),
        )
        document.tax_return.refresh_status()
        return self.detail_response(document)

    @extend_schema(operation_id="documents_mark_reviewed", request=None, responses=DocumentDetailSerializer)
    @action(detail=True, methods=["post"], url_path="mark-reviewed")
    def mark_reviewed(self, request, pk=None):
        """REQ-REV-004: only reviewed documents feed the return."""
        document = self.get_object()
        if document.status not in {DocumentStatus.NEEDS_REVIEW, DocumentStatus.READY_FOR_REVIEW}:
            raise ValidationError({"detail": "This document isn't ready for review."})
        remaining = sum(field.needs_attention for field in document.fields.all())
        if remaining:
            raise ValidationError({"detail": f"{remaining} field(s) still need attention."})
        document.status = DocumentStatus.REVIEWED
        document.reviewed_by = request.user
        document.reviewed_at = timezone.now()
        document.error_message = ""
        document.save(update_fields=["status", "reviewed_by", "reviewed_at", "error_message", "updated_at"])
        document.tax_return.refresh_status()
        audit.record(request, "document.reviewed", document)
        return self.detail_response(document)

    @extend_schema(
        operation_id="documents_reveal_sensitive", request=None, responses=SensitiveValuesSerializer
    )
    @action(detail=True, methods=["post"], url_path="reveal-sensitive")
    def reveal_sensitive(self, request, pk=None):
        """Show masked values (SSN) in full. Audit logged."""
        document = self.get_object()
        values = {field.name: field.value for field in document.fields.all() if field.sensitive}
        audit.record(request, "document.sensitive_revealed", document, fields=sorted(values))
        return Response({"values": values})
