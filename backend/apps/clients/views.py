from django.db.models import Count, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import HasActiveSubscription
from apps.audit import service as audit
from apps.core.tenancy import FirmScopedQuerysetMixin

from .models import Client
from .serializers import ClientSerializer, RevealSsnSerializer


@extend_schema_view(
    list=extend_schema(
        parameters=[OpenApiParameter("search", OpenApiTypes.STR, description="Name, email or SSN last 4")]
    )
)
class ClientViewSet(FirmScopedQuerysetMixin, viewsets.ModelViewSet):
    """SCR-04 / SCR-05: create, search and edit clients (REQ-CLI-001)."""

    queryset = Client.objects.annotate(return_count=Count("returns")).order_by("last_name", "first_name")
    serializer_class = ClientSerializer
    permission_classes = [HasActiveSubscription]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = super().get_queryset()
        if search := self.request.query_params.get("search", "").strip():
            query = (
                Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(email__icontains=search)
            )
            if search.isdigit() and len(search) == 4:
                query |= Q(ssn_last4=search)
            qs = qs.filter(query)
        return qs

    def perform_create(self, serializer):
        client = serializer.save(firm=self.request.user.firm, created_by=self.request.user)
        audit.record(self.request, "client.create", client)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        audit.record(request, "client.view", self.get_object())
        return response

    def perform_update(self, serializer):
        client = serializer.save()
        changed = sorted(key for key in serializer.validated_data if key != "ssn")
        if "ssn" in serializer.validated_data:
            changed.append("ssn")
        audit.record(self.request, "client.update", client, fields=changed)

    def perform_destroy(self, instance):
        audit.record(self.request, "client.delete", instance)
        instance.delete()

    @extend_schema(operation_id="clients_reveal_ssn", request=None, responses=RevealSsnSerializer)
    @action(detail=True, methods=["post"], url_path="reveal-ssn")
    def reveal_ssn(self, request, pk=None):
        """Show the full SSN. Owner and Preparer only; always audit logged."""
        client = self.get_object()
        audit.record(request, "client.ssn_revealed", client)
        return Response({"ssn": client.ssn})
