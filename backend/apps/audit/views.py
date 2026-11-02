import uuid

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics

from apps.accounts.permissions import IsFirmOwner

from .models import AuditEvent
from .serializers import AuditEventSerializer


@extend_schema_view(
    get=extend_schema(
        operation_id="audit_events_list",
        parameters=[
            OpenApiParameter(
                "action", OpenApiTypes.STR, description="Filter by action prefix, e.g. 'client.'"
            ),
            OpenApiParameter("object_id", OpenApiTypes.STR),
            OpenApiParameter("user", OpenApiTypes.UUID),
        ],
    )
)
class AuditEventList(generics.ListAPIView):
    """SCR-11: the firm owner reads the firm's audit log."""

    serializer_class = AuditEventSerializer
    permission_classes = [IsFirmOwner]

    def get_queryset(self):
        qs = AuditEvent.objects.filter(firm=self.request.user.firm).select_related("user")
        params = self.request.query_params
        if action := params.get("action"):
            qs = qs.filter(action__startswith=action)
        if object_id := params.get("object_id"):
            qs = qs.filter(object_id=object_id)
        if user := params.get("user"):
            try:
                qs = qs.filter(user_id=uuid.UUID(user))
            except ValueError:
                return qs.none()
        return qs
