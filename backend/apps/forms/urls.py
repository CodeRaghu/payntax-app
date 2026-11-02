from django.urls import path

from . import views

urlpatterns = [
    path("returns/<uuid:pk>/form-1040", views.Form1040View.as_view(), name="form1040"),
    path(
        "returns/<uuid:pk>/form-1040/lines/<str:line>", views.Form1040LineView.as_view(), name="form1040-line"
    ),
    path("returns/<uuid:pk>/form-1040.pdf", views.Form1040PdfView.as_view(), name="form1040-pdf"),
]
