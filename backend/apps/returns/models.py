from django.conf import settings
from django.db import models

from apps.core.models import FirmScopedModel


class ReturnStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_REVIEW = "in_review", "In review"
    READY = "ready", "Ready"
    COMPLETE = "complete", "Complete"


class TaxReturn(FirmScopedModel):
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="returns")
    tax_year = models.PositiveSmallIntegerField()
    form_type = models.CharField(max_length=10, default="1040")
    status = models.CharField(max_length=20, choices=ReturnStatus.choices, default=ReturnStatus.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-tax_year"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "tax_year", "form_type"], name="one_return_per_client_year"
            )
        ]

    def __str__(self) -> str:
        return f"{self.client} {self.tax_year} {self.form_type}"

    def refresh_status(self) -> None:
        """Derive the status from document states, unless a CPA marked the return complete."""
        if self.status == ReturnStatus.COMPLETE:
            return
        statuses = list(self.documents.values_list("status", flat=True))
        if not statuses:
            new = ReturnStatus.DRAFT
        elif all(status in ("reviewed", "rejected") for status in statuses):
            new = ReturnStatus.READY
        else:
            new = ReturnStatus.IN_REVIEW
        if new != self.status:
            self.status = new
            self.save(update_fields=["status", "updated_at"])
