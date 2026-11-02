import secrets
from datetime import timedelta
from typing import ClassVar

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


class Role(models.TextChoices):
    OWNER = "owner", "Owner"
    PREPARER = "preparer", "Preparer"


class Firm(BaseModel):
    name = models.CharField(max_length=200)

    def __str__(self) -> str:
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200, blank=True)
    firm = models.ForeignKey(Firm, null=True, blank=True, on_delete=models.CASCADE, related_name="users")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PREPARER)
    is_active = models.BooleanField(default=True)  # type: ignore[misc]
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    def __str__(self) -> str:
        return self.email

    @property
    def is_owner(self) -> bool:
        return self.role == Role.OWNER


def _invite_token() -> str:
    return secrets.token_urlsafe(32)


def _invite_expiry():
    return timezone.now() + timedelta(days=7)


class Invitation(BaseModel):
    firm = models.ForeignKey(Firm, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PREPARER)
    token = models.CharField(max_length=64, unique=True, default=_invite_token)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="+")
    expires_at = models.DateTimeField(default=_invite_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_usable(self) -> bool:
        return self.accepted_at is None and self.expires_at > timezone.now()
