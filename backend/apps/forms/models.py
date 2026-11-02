from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class FormLine(BaseModel):
    """A CPA-entered value for a 1040 line. Computed lines are not stored; only overrides are (REQ-FRM-002)."""

    tax_return = models.ForeignKey("returns.TaxReturn", on_delete=models.CASCADE, related_name="form_lines")
    line = models.CharField(max_length=10)
    value = models.DecimalField(max_digits=12, decimal_places=2)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tax_return", "line"], name="one_override_per_line")]
