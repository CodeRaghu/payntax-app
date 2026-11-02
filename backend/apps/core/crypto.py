"""Field-level encryption for SSN, EIN and extracted document values (NFR-SEC-001).

Values are encrypted with Fernet (AES-128-CBC + HMAC). FIELD_ENCRYPTION_KEYS is a comma-separated list:
the first key encrypts, every key can decrypt, so keys can be rotated. In AWS the keys come from Secrets
Manager; swapping to KMS envelope encryption only changes this module.
"""

from functools import cache

from cryptography.fernet import Fernet, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


@cache
def _fernet() -> MultiFernet:
    keys = settings.FIELD_ENCRYPTION_KEYS
    if not keys:
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS is empty")
    return MultiFernet([Fernet(key.encode()) for key in keys])


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


class EncryptedTextField(models.TextField):
    """Stores ciphertext in the database and exposes plaintext in Python. Not searchable or sortable."""

    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        return decrypt(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return encrypt(str(value))


def mask_ssn(ssn: str | None) -> str:
    digits = "".join(ch for ch in (ssn or "") if ch.isdigit())
    return f"***-**-{digits[-4:]}" if len(digits) >= 4 else ""


def mask_ein(ein: str | None) -> str:
    digits = "".join(ch for ch in (ein or "") if ch.isdigit())
    return f"**-***{digits[-4:]}" if len(digits) >= 4 else ""
