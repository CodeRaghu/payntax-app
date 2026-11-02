from django.urls import path

from . import views

urlpatterns = [path("audit-events", views.AuditEventList.as_view(), name="audit-events")]
