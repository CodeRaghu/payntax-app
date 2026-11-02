from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api: list[URLPattern | URLResolver] = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.billing.urls")),
    path("", include("apps.clients.urls")),
    path("", include("apps.returns.urls")),
    path("", include("apps.documents.urls")),
    path("", include("apps.forms.urls")),
    path("health", include("apps.core.urls")),
]

urlpatterns: list[URLPattern | URLResolver] = [
    path("api/", include(api)),
    path("admin/", admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += [
        path("api/schema", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
    ]
