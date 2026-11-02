"""Django settings. Every environment-specific value comes from environment variables (see .env.example)."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise ImproperlyConfigured(f"Missing required environment variable {name}")
    return value


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


DJANGO_ENV = env("DJANGO_ENV", "local")  # local | test | dev | staging | prod
DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:3000")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "apps.core",
    "apps.accounts",
    "apps.audit",
    "apps.billing",
    "apps.clients",
    "apps.returns",
    "apps.documents",
    "apps.extraction",
    "apps.forms",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "payntax"),
        "USER": env("POSTGRES_USER", "payntax"),
        "PASSWORD": env("POSTGRES_PASSWORD", ""),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Security -----------------------------------------------------------------------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 8  # one working day
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
APPEND_SLASH = False  # API paths have no trailing slash (the Next.js proxy strips them)
if DJANGO_ENV in {"dev", "staging", "prod"}:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Fernet keys for field-level encryption (SSN, EIN, extracted values). First key encrypts; all decrypt.
FIELD_ENCRYPTION_KEYS = env_list("FIELD_ENCRYPTION_KEYS")

OTP_TOTP_ISSUER = "PayNTax"

# --- API ----------------------------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["apps.accounts.permissions.IsMfaVerified"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {"auth": "10/min"},
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "PayNTax API",
    "DESCRIPTION": "Contract between the PayNTax web app and API. Source of truth: contract/openapi.yaml.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "DocumentStatusEnum": "apps.documents.models.DocumentStatus",
        "DocumentTypeEnum": "apps.documents.models.DocumentType",
        "FilingStatusEnum": "apps.clients.models.FilingStatus",
        "RoleEnum": "apps.accounts.models.Role",
        "ReturnStatusEnum": "apps.returns.models.ReturnStatus",
        "SubscriptionStatusEnum": "apps.billing.models.SubscriptionStatus",
    },
}

# --- Background jobs ----------------------------------------------------------------------------------
CELERY_BROKER_URL = env("REDIS_URL", "redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_IGNORE_RESULT = True

# --- Document storage (S3; MinIO locally) -------------------------------------------------------------
S3_BUCKET = env("S3_BUCKET", "payntax-documents")
S3_REGION = env("AWS_REGION", "us-east-2")
S3_ENDPOINT_URL = env("S3_ENDPOINT_URL", "") or None  # server-side calls; empty on AWS
S3_PUBLIC_ENDPOINT_URL = env("S3_PUBLIC_ENDPOINT_URL", "") or None  # host the browser can reach
S3_PRESIGN_SECONDS = 300
S3_KMS_KEY_ID = env("S3_KMS_KEY_ID", "") or None
DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
DOCUMENT_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"]

# --- Pluggable providers (swap without touching views or the UI) --------------------------------------
STORAGE_BACKEND = env("STORAGE_BACKEND", "apps.documents.storage.S3Storage")
VIRUS_SCANNER = env("VIRUS_SCANNER", "apps.documents.scanning.SignatureScanner")
EXTRACTION_PROVIDER = env("EXTRACTION_PROVIDER", "apps.extraction.providers.SyntheticExtractor")
FORM_RENDERER = env("FORM_RENDERER", "apps.forms.renderers.SummaryPdfRenderer")
BILLING_PROVIDER = env("BILLING_PROVIDER", "apps.billing.providers.FakeBillingProvider")
BILLING_REQUIRED = env_bool("BILLING_REQUIRED", True)

EXTRACTION_CONFIDENCE_THRESHOLD = float(env("EXTRACTION_CONFIDENCE_THRESHOLD", "0.90"))
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:3000")

# --- Logging: never log request bodies; scrub SSN/EIN patterns -----------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"scrub_pii": {"()": "apps.core.logging.ScrubPiiFilter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "filters": ["scrub_pii"]}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
