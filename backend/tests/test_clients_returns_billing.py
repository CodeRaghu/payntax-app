import pytest
from rest_framework.test import APIClient

from .conftest import make_firm, make_user, signed_in


@pytest.mark.django_db
def test_create_search_and_edit_client(api):
    created = api.post(
        "/api/clients",
        {
            "first_name": "Marcus",
            "last_name": "Example",
            "ssn": "912341111",
            "filing_status": "married_joint",
        },
    )
    assert created.status_code == 201
    client_id = created.json()["id"]
    assert created.json()["ssn_masked"] == "***-**-1111"
    assert api.get("/api/clients?search=exam").json()["count"] == 1
    assert api.get("/api/clients?search=1111").json()["count"] == 1
    assert api.get("/api/clients?search=nobody").json()["count"] == 0
    assert api.patch(f"/api/clients/{client_id}", {"city": "Austin"}).json()["city"] == "Austin"
    assert api.post("/api/clients", {"first_name": "A", "last_name": "B", "ssn": "12"}).status_code == 400


@pytest.mark.django_db
def test_open_return_once_per_year(api, client_record):
    payload = {"client": str(client_record.pk), "tax_year": 2026}
    assert api.post("/api/returns", payload).status_code == 201
    assert api.post("/api/returns", payload).status_code == 400
    assert api.post("/api/returns", payload | {"tax_year": 1999}).status_code == 400
    returns = api.get(f"/api/returns?client={client_record.pk}").json()["results"]
    assert returns[0]["document_counts"]["total"] == 0


@pytest.mark.django_db
def test_fake_checkout_starts_trial():
    firm = make_firm("Unpaid", subscribed=False)
    api = signed_in(make_user(firm, "o@unpaid.test"))
    assert api.get("/api/clients").status_code == 403
    assert len(api.get("/api/billing/plans").json()) >= 1
    url = api.post("/api/billing/checkout", {"plan": "solo"}).json()["url"]
    session = url.split("session=")[1]
    assert api.post("/api/billing/fake/complete", {"session": session}).json()["status"] == "trialing"
    assert api.get("/api/clients").status_code == 200


@pytest.mark.django_db
def test_checkout_session_cannot_be_used_by_other_firm():
    firm_a = make_firm("A", subscribed=False)
    api_a = signed_in(make_user(firm_a, "o@a2.test"))
    session = api_a.post("/api/billing/checkout", {"plan": "solo"}).json()["url"].split("session=")[1]
    api_b = signed_in(make_user(make_firm("B", subscribed=False), "o@b2.test"))
    assert api_b.post("/api/billing/fake/complete", {"session": session}).status_code == 400


@pytest.mark.django_db
def test_health_is_public():
    assert APIClient().get("/api/health").json() == {"status": "ok"}
