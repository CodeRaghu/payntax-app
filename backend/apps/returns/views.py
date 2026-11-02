import uuid

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, viewsets
from rest_framework.response import Response

from apps.accounts.permissions import HasActiveSubscription
from apps.audit import service as audit
from apps.core.tenancy import FirmScopedQuerysetMixin

from .models import TaxReturn
from .serializers import TaxReturnSerializer, TaxReturnUpdateSerializer


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("client", OpenApiTypes.UUID)]))
class TaxReturnViewSet(
    FirmScopedQuerysetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """SCR-06: open a return for a client and tax year (REQ-CLI-002)."""

    queryset = TaxReturn.objects.select_related("client")
    permission_classes = [HasActiveSubscription]
    http_method_names = ["get", "post", "patch"]

    def get_serializer_class(self):
        return TaxReturnUpdateSerializer if self.request.method == "PATCH" else TaxReturnSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if client := self.request.query_params.get("client"):
            try:
                qs = qs.filter(client_id=uuid.UUID(client))
            except ValueError:
                return qs.none()
        return qs

    def perform_create(self, serializer):
        tax_return = serializer.save(firm=self.request.user.firm, created_by=self.request.user)
        audit.record(self.request, "return.create", tax_return, tax_year=tax_return.tax_year)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        audit.record(request, "return.view", self.get_object())
        return response

    @extend_schema(request=TaxReturnUpdateSerializer, responses=TaxReturnSerializer)
    def partial_update(self, request, *args, **kwargs):
        super().partial_update(request, *args, **kwargs)
        tax_return = self.get_object()
        audit.record(request, "return.status_change", tax_return, status=tax_return.status)
        return Response(TaxReturnSerializer(tax_return, context=self.get_serializer_context()).data)
