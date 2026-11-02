import uuid

from django.db import models


class BaseModel(models.Model):
    """UUID primary key plus timestamps. IDs are never sequential, so they can't be guessed across firms."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class FirmScopedModel(BaseModel):
    """Every row of client data belongs to exactly one firm (tenant)."""

    firm = models.ForeignKey("accounts.Firm", on_delete=models.CASCADE, related_name="+")

    class Meta:
        abstract = True
