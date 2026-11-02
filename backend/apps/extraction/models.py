from django.conf import settings
from django.db import models

from apps.core.crypto import EncryptedTextField
from apps.core.models import BaseModel


class ExtractedField(BaseModel):
    """One value read from a document. Values are encrypted; the original is kept (REQ-REV-003)."""

    document = models.ForeignKey("documents.Document", on_delete=models.CASCADE, related_name="fields")
    name = models.CharField(max_length=60)
    label = models.CharField(max_length=100)
    kind = models.CharField(max_length=20, default="text")  # text | money | ssn | ein | date
    value = EncryptedTextField(blank=True)
    original_value = EncryptedTextField(blank=True)
    confidence = models.FloatField()
    rule_issue = models.CharField(max_length=300, blank=True)
    acknowledged = models.BooleanField(default=False)
    corrected = models.BooleanField(default=False)
    sensitive = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    bbox = models.JSONField(null=True, blank=True)  # [x, y, width, height] as fractions of the page

    class Meta:
        ordering = ["order"]
        constraints = [models.UniqueConstraint(fields=["document", "name"], name="one_value_per_field")]

    @property
    def low_confidence(self) -> bool:
        return self.confidence < settings.EXTRACTION_CONFIDENCE_THRESHOLD and not self.corrected

    @property
    def needs_attention(self) -> bool:
        return (self.low_confidence or bool(self.rule_issue)) and not self.acknowledged


class FieldCorrection(BaseModel):
    field = models.ForeignKey(ExtractedField, on_delete=models.CASCADE, related_name="corrections")
    old_value = EncryptedTextField(blank=True)
    new_value = EncryptedTextField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["created_at"]
