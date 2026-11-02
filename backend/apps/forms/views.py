from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasActiveSubscription
from apps.audit import service as audit
from apps.core.providers import get_provider
from apps.returns.models import TaxReturn

from . import form1040
from .models import FormLine
from .serializers import Form1040Serializer, FormLineUpdateSerializer


def _payload(tax_return: TaxReturn) -> dict:
    lines, warnings = form1040.compute(tax_return)
    return {
        "tax_return": tax_return.pk,
        "tax_year": tax_return.tax_year,
        "lines": [
            {
                "line": item.spec.line,
                "label": item.spec.label,
                "section": item.spec.section,
                "editable": item.spec.editable,
                "value": item.value,
                "computed_value": item.computed_value,
                "source": item.source,
            }
            for item in lines
        ],
        "warnings": warnings,
    }


class Form1040Base(APIView):
    permission_classes = [HasActiveSubscription]

    def get_return(self, pk) -> TaxReturn:
        firm = self.request.user.firm  # type: ignore[union-attr]  # permission guarantees a signed-in user
        return get_object_or_404(TaxReturn.objects.select_related("client"), pk=pk, firm=firm)


class Form1040View(Form1040Base):
    """SCR-09: 1040 lines computed from reviewed documents plus CPA edits."""

    @extend_schema(operation_id="form1040_retrieve", responses=Form1040Serializer)
    def get(self, request, pk):
        tax_return = self.get_return(pk)
        audit.record(request, "form1040.view", tax_return)
        return Response(Form1040Serializer(_payload(tax_return)).data)


class Form1040LineView(Form1040Base):
    @extend_schema(
        operation_id="form1040_update_line", request=FormLineUpdateSerializer, responses=Form1040Serializer
    )
    def patch(self, request, pk, line):
        tax_return = self.get_return(pk)
        if line not in form1040.EDITABLE:
            raise Http404("This line can't be edited.")
        data = FormLineUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        value = data.validated_data["value"]
        previous = FormLine.objects.filter(tax_return=tax_return, line=line).first()
        if value is None:
            FormLine.objects.filter(tax_return=tax_return, line=line).delete()
        else:
            FormLine.objects.update_or_create(
                tax_return=tax_return, line=line, defaults={"value": value, "updated_by": request.user}
            )
        audit.record(
            request,
            "form1040.line_update",
            tax_return,
            line=line,
            old=str(previous.value) if previous else None,
            new=str(value) if value is not None else None,
        )
        return Response(Form1040Serializer(_payload(tax_return)).data)


class Form1040PdfView(Form1040Base):
    @extend_schema(
        operation_id="form1040_pdf",
        responses={(200, "application/pdf"): OpenApiResponse(OpenApiTypes.BINARY)},
    )
    def get(self, request, pk):
        tax_return = self.get_return(pk)
        lines, _ = form1040.compute(tax_return)
        pdf = get_provider("FORM_RENDERER").render(tax_return, lines)
        audit.record(request, "form1040.download", tax_return)
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="1040-{tax_return.tax_year}-{tax_return.pk}.pdf"'
        )
        response["Cache-Control"] = "no-store"
        return response
