from django.conf import settings
from django.core.management.base import CommandError


def refuse_outside_local() -> None:
    if settings.DJANGO_ENV not in {"local", "test", "dev"}:
        raise CommandError(f"Refusing to run in {settings.DJANGO_ENV}: synthetic data and dev helpers only.")
