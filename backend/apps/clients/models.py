from django.conf import settings
from django.db import models

from apps.core.crypto import EncryptedTextField
from apps.core.models import FirmScopedModel


class FilingStatus(models.TextChoices):
    SINGLE = "single", "Single"
    MARRIED_JOINT = "married_joint", "Married filing jointly"
    MARRIED_SEPARATE = "married_separate", "Married filing separately"
    HEAD_OF_HOUSEHOLD = "head_of_household", "Head of household"
    QUALIFYING_SURVIVING_SPOUSE = "qualifying_surviving_spouse", "Qualifying surviving spouse"


class Client(FirmScopedModel):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    ssn = EncryptedTextField(blank=True)  # ciphertext at rest (NFR-SEC-001)
    ssn_last4 = models.CharField(max_length=4, blank=True)  # for search and masked display
    filing_status = models.CharField(max_length=40, choices=FilingStatus.choices, default=FilingStatus.SINGLE)
    street = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default="TX")
    zip_code = models.CharField(max_length=10, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["firm", "last_name"])]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        digits = "".join(ch for ch in (self.ssn or "") if ch.isdigit())
        self.ssn_last4 = digits[-4:]
        super().save(*args, **kwargs)
