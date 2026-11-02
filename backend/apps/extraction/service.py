from django.db import transaction

from apps.documents.models import Document, DocumentStatus

from .models import ExtractedField, FieldCorrection
from .providers import ExtractedValue
from .validation import validate


def save_extraction(document: Document, values: list[ExtractedValue]) -> None:
    with transaction.atomic():
        document.fields.all().delete()
        ExtractedField.objects.bulk_create(
            ExtractedField(
                document=document,
                name=item.spec.name,
                label=item.spec.label,
                kind=item.spec.kind,
                sensitive=item.spec.sensitive,
                value=item.value,
                original_value=item.value,
                confidence=item.confidence,
                bbox=item.bbox,
                order=index,
            )
            for index, item in enumerate(values)
        )
        apply_rules(document)


def apply_rules(document: Document) -> int:
    """Re-run validation across all fields; return how many fields still need attention."""
    fields = list(document.fields.all())
    issues = validate(document.doc_type, {f.name: f.value for f in fields}, document.tax_return.tax_year)
    for field in fields:
        issue = issues.get(field.name, "")
        if issue != field.rule_issue:
            field.rule_issue = issue
            field.acknowledged = False if issue else field.acknowledged
            field.save(update_fields=["rule_issue", "acknowledged", "updated_at"])
    attention = sum(field.needs_attention for field in fields)
    if document.status in {
        DocumentStatus.NEEDS_REVIEW,
        DocumentStatus.READY_FOR_REVIEW,
        DocumentStatus.EXTRACTING,
    }:
        new_status = (
            DocumentStatus.NEEDS_REVIEW if attention or not fields else DocumentStatus.READY_FOR_REVIEW
        )
        if new_status != document.status:
            document.set_status(new_status)
    return attention


def correct_field(field: ExtractedField, user, *, value: str | None, acknowledged: bool | None) -> None:
    """Save a CPA correction, keeping the original value and a correction history (REQ-REV-003)."""
    with transaction.atomic():
        if value is not None and value != field.value:
            FieldCorrection.objects.create(field=field, old_value=field.value, new_value=value, user=user)
            field.value = value
            field.corrected = True
            field.acknowledged = False
        if acknowledged is not None:
            field.acknowledged = acknowledged
        field.save()
        apply_rules(field.document)
