"""TC-SEC-001 tenant isolation, TC-SEC-002 encryption at rest and log scrubbing."""

import logging

import pytest
from django.db import connection

from apps.clients.models import Client
from apps.core.logging import ScrubPiiFilter
from apps.documents.models import Document

from .conftest import make_firm, make_user, signed_in


@pytest.fixture
def other_firm_api(db):
    firm_b = make_firm("Firm B")
    return signed_in(make_user(firm_b, "owner@b.test"))


@pytest.mark.django_db
def test_firm_b_gets_404_on_firm_a_data(other_firm_api, client_record, tax_return):
    document = Document.objects.create(
        firm=tax_return.firm, tax_return=tax_return, filename="w2.pdf", content_type="application/pdf",
        size=10, storage_key="k1",
    )  # fmt: skip
    for url in [
        f"/api/clients/{client_record.pk}",
        f"/api/returns/{tax_return.pk}",
        f"/api/documents/{document.pk}",
        f"/api/returns/{tax_return.pk}/form-1040",
        f"/api/returns/{tax_return.pk}/form-1040.pdf",
    ]:
        assert other_firm_api.get(url).status_code == 404, url
    assert other_firm_api.get("/api/clients").json()["count"] == 0
    assert other_firm_api.get(f"/api/documents?tax_return={tax_return.pk}").json() == []


@pytest.mark.django_db
def test_cannot_create_return_for_other_firms_client(other_firm_api, client_record):
    response = other_firm_api.post("/api/returns", {"client": str(client_record.pk), "tax_year": 2026})
    assert response.status_code == 400


@pytest.mark.django_db
def test_ssn_is_ciphertext_in_database(client_record):
    with connection.cursor() as cursor:
        cursor.execute("SELECT ssn FROM clients_client WHERE id = %s", [client_record.pk])
        stored = cursor.fetchone()[0]
    assert "900-12-6789" not in stored and stored.startswith("gAAAA")
    assert Client.objects.get(pk=client_record.pk).ssn == "900-12-6789"


@pytest.mark.django_db
def test_api_masks_ssn_and_reveal_is_audited(api, client_record):
    body = api.get(f"/api/clients/{client_record.pk}").json()
    assert body["ssn_masked"] == "***-**-6789" and "ssn" not in body
    assert api.post(f"/api/clients/{client_record.pk}/reveal-ssn").json()["ssn"] == "900-12-6789"
    actions = [e["action"] for e in api.get("/api/audit-events").json()["results"]]
    assert "client.ssn_revealed" in actions and "client.view" in actions


def test_logs_never_contain_ssn_or_ein():
    record = logging.LogRecord(
        "x", logging.INFO, __file__, 1, "ssn %s ein %s", ("900-12-6789", "12-3456789"), None
    )
    ScrubPiiFilter().filter(record)
    assert record.getMessage() == "ssn [SSN] ein [EIN]"
