from functools import cache

from django.conf import settings
from django.utils.module_loading import import_string


@cache
def get_provider(setting_name: str):
    """Instantiate the class named by a setting, e.g. EXTRACTION_PROVIDER. Lets us swap vendors by config."""
    return import_string(getattr(settings, setting_name))()
