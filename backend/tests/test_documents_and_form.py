"""Upload → process → review → 1040, using in-memory storage and the synthetic extractor."""

from decimal import Decimal

import pytest

from apps.documents.models import Document
from apps.documents.storage import InMemoryStorage
from apps.extraction.models import ExtractedField

PDF = b"%PDF-1.4 synthetic test document"


def upload(api, tax_return, filename="acme_w2.pdf", content=PDF, capture=None):
    created = api.post(
        "/api/documents",
        {
            "tax_return": str(tax_return.pk),
            "filename": filename,
            "content_type": "application/pdf",
            "size": len(content),
        },
    )
    assert created.status_code == 201, created.json()
    body = created.json()
    assert body["upload"]["method"] == "PUT"
    document = Document.objects.get(pk=body["document"]["id"])
    InMemoryStorage.objects[document.storage_key] = content  # what the browser's PUT would do
    with capture(execute=True):
        assert api.post(f"/api/documents/{document.pk}/complete").status_code == 200
    document.refresh_from_db()
    return document


@pytest.mark.django_db
def test_upload_rejects_wrong_type_and_size(api, tax_return):
    base = {"tax_return": str(tax_return.pk), "filename": "a.exe", "size": 10}
    assert api.post("/api/documents", base | {"content_type": "application/x-msdownload"}).status_code == 400
    too_big = base | {"content_type": "application/pdf", "size": 21 * 1024 * 1024}
    assert api.post("/api/documents", too_big).status_code == 400


@pytest.mark.django_db
def test_mismatched_content_is_rejected(api, tax_return, django_capture_on_commit_callbacks):
    document = upload(api, tax_return, content=b"MZ not a pdf", capture=django_capture_on_commit_callbacks)
    assert document.status == "rejected"
    assert document.storage_key not in InMemoryStorage.objects


@pytest.mark.django_db
def test_w2_flow_to_form_1040(api, tax_return, django_capture_on_commit_callbacks):
    document = upload(api, tax_return, capture=django_capture_on_commit_callbacks)
    assert document.doc_type == "w2"
    assert document.status in {"needs_review", "ready_for_review"}

    detail = api.get(f"/api/documents/{document.pk}").json()
    assert detail["file_url"].startswith("https://storage.test/")
    fields = {f["name"]: f for f in detail["extracted_fields"]}
    assert fields["employee_ssn"]["value"].startswith("***-**-")

    # Make the document correct: fix box 4 / box 6 to match the rules, then acknowledge low confidence.
    wages = Decimal(fields["box3_ss_wages"]["value"].replace(",", ""))
    medicare = Decimal(fields["box5_medicare_wages"]["value"].replace(",", ""))
    for name, value in [
        ("box4_ss_tax", wages * Decimal("0.062")),
        ("box6_medicare_tax", medicare * Decimal("0.0145")),
    ]:
        api.patch(
            f"/api/documents/{document.pk}/fields/{fields[name]['id']}",
            {"value": f"{value:,.2f}"},
            format="json",
        )

    detail = api.get(f"/api/documents/{document.pk}").json()
    attention = [f for f in detail["extracted_fields"] if f["needs_attention"]]
    if attention:
        blocked = api.post(f"/api/documents/{document.pk}/mark-reviewed")
        assert blocked.status_code == 400 and "need attention" in blocked.json()["detail"]
    for field in attention:
        api.patch(f"/api/documents/{document.pk}/fields/{field['id']}", {"acknowledged": True}, format="json")

    reviewed = api.post(f"/api/documents/{document.pk}/mark-reviewed")
    assert reviewed.status_code == 200 and reviewed.json()["status"] == "reviewed"

    # Original value kept alongside the correction (REQ-REV-003)
    box4 = ExtractedField.objects.get(document=document, name="box4_ss_tax")
    assert box4.corrections.exists() or box4.value == box4.original_value

    form = api.get(f"/api/returns/{tax_return.pk}/form-1040").json()
    lines = {line["line"]: line for line in form["lines"]}
    assert Decimal(lines["1a"]["value"]) == Decimal(fields["box1_wages"]["value"].replace(",", ""))
    assert lines["12"]["value"] == "16100.00"  # 2026 single
    assert lines["16"]["source"] == "missing"

    updated = api.patch(
        f"/api/returns/{tax_return.pk}/form-1040/lines/16", {"value": "5000.00"}, format="json"
    ).json()
    lines = {line["line"]: line for line in updated["lines"]}
    assert lines["16"]["source"] == "cpa" and lines["24"]["value"] == "5000.00"
    total_payments = Decimal(lines["33"]["value"])
    assert Decimal(lines["34"]["value"]) == max(Decimal("0"), total_payments - Decimal("5000"))

    assert (
        api.patch(
            f"/api/returns/{tax_return.pk}/form-1040/lines/15", {"value": "1"}, format="json"
        ).status_code
        == 404
    )

    pdf = api.get(f"/api/returns/{tax_return.pk}/form-1040.pdf")
    assert (
        pdf.status_code == 200
        and pdf["Content-Type"] == "application/pdf"
        and pdf.content.startswith(b"%PDF")
    )

    tax_return.refresh_from_db()
    assert tax_return.status == "ready"


@pytest.mark.django_db
def test_unrecognized_document_needs_review(api, tax_return, django_capture_on_commit_callbacks):
    document = upload(api, tax_return, filename="scan_003.pdf", capture=django_capture_on_commit_callbacks)
    assert document.doc_type == "other" and document.status == "needs_review"
    assert api.post(f"/api/documents/{document.pk}/mark-reviewed").status_code == 200


@pytest.mark.django_db
def test_editing_reviewed_document_reopens_it(api, tax_return, django_capture_on_commit_callbacks):
    document = upload(api, tax_return, capture=django_capture_on_commit_callbacks)
    for field in document.fields.all():
        api.patch(f"/api/documents/{document.pk}/fields/{field.pk}", {"acknowledged": True}, format="json")
    assert api.post(f"/api/documents/{document.pk}/mark-reviewed").status_code == 200
    field = document.fields.get(name="employer_name")
    response = api.patch(
        f"/api/documents/{document.pk}/fields/{field.pk}", {"value": "Renamed Co"}, format="json"
    )
    assert response.json()["status"] in {"ready_for_review", "needs_review"}
