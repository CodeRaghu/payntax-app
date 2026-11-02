from django.apps import AppConfig


class Config(AppConfig):
    name = "apps.billing"
    label = "billing"
    default_auto_field = "django.db.models.BigAutoField"
