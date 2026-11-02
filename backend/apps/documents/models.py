from django.conf import settings
from django.db import models

from apps.core.models import FirmScopedModel


class DocumentType(models.TextChoices):
    UNKNOWN = "unknown", "Not classified yet"
    W2 = "w2", "W-2"
    PAY_STUB = "pay_stub", "Pay stub"
    OTHER = "other", "Other"


class DocumentStatus(models.TextChoices):
    """Lifecycle from docs/screens: Uploaded → Scanning → Classifying → Extracting → (Needs) review → Reviewed."""

    UPLOADING = "uploading", "Uploading"
    UPLOADED = "uploaded", "Uploaded"
    SCANNING = "scanning", "Scanning"
    REJECTED = "rejected", "Rejected"
    CLASSIFYING = "classifying", "Classifying"
    EXTRACTING = "extracting", "Extracting"
    NEEDS_REVIEW = "needs_review", "Needs review"
    READY_FOR_REVIEW = "ready_for_review", "Ready for review"
    REVIEWED = "reviewed", "Reviewed"
    FAILED = "failed", "Extraction failed"


PROCESSING_STATUSES = {
    DocumentStatus.UPLOADING,
    DocumentStatus.UPLOADED,
    DocumentStatus.SCANNING,
    DocumentStatus.CLASSIFYING,
    DocumentStatus.EXTRACTING,
}


class Document(FirmScopedModel):
    tax_return = models.ForeignKey("returns.TaxReturn", on_delete=models.CASCADE, related_name="documents")
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    storage_key = models.CharField(max_length=300, unique=True)
    doc_type = models.CharField(max_length=20, choices=DocumentType.choices, default=DocumentType.UNKNOWN)
    status = models.CharField(max_length=20, choices=DocumentStatus.choices, default=DocumentStatus.UPLOADING)
    error_message = models.CharField(max_length=300, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.filename

    def set_status(self, status: str, error: str = "") -> None:
        self.status = status
        self.error_message = error[:300]
        self.save(update_fields=["status", "error_message", "updated_at"])
