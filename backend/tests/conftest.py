import pytest
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient

from apps.accounts.models import Firm, Role, User
from apps.billing.models import Subscription
from apps.clients.models import Client
from apps.core.providers import get_provider
from apps.documents.storage import InMemoryStorage
from apps.returns.models import TaxReturn

PASSWORD = "a-long-test-password-1"


@pytest.fixture(autouse=True)
def _isolated_providers(settings, monkeypatch):
    from django.core.cache import cache

    from apps.documents.tasks import process_document_task

    cache.clear()  # login throttling counters
    monkeypatch.setattr(process_document_task, "delay", process_document_task)  # run processing inline
    settings.STORAGE_BACKEND = "apps.documents.storage.InMemoryStorage"
    settings.BILLING_REQUIRED = True
    get_provider.cache_clear()
    InMemoryStorage.objects.clear()
    yield
    get_provider.cache_clear()


def current_code(user) -> str:
    device = TOTPDevice.objects.get(user=user, confirmed=True)
    return f"{TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift).token():06d}"


def make_firm(name="Firm A", *, subscribed=True) -> Firm:
    firm = Firm.objects.create(name=name)
    if subscribed:
        Subscription.objects.create(firm=firm, plan="solo", status="trialing")
    return firm


def make_user(firm, email, role=Role.OWNER, *, mfa=True) -> User:
    user = User.objects.create_user(email=email, password=PASSWORD, firm=firm, role=role, full_name=email)
    if mfa:
        TOTPDevice.objects.create(user=user, name="test", confirmed=True)
    return user


def signed_in(user, *, verify=True) -> APIClient:
    api = APIClient()
    assert api.post("/api/auth/login", {"email": user.email, "password": PASSWORD}).status_code == 200
    if verify:
        assert api.post("/api/auth/mfa/verify", {"code": current_code(user)}).status_code == 200
    return api


@pytest.fixture
def firm(db):
    return make_firm()


@pytest.fixture
def owner(firm):
    return make_user(firm, "owner@a.test")


@pytest.fixture
def preparer(firm):
    return make_user(firm, "preparer@a.test", Role.PREPARER)


@pytest.fixture
def api(owner):
    return signed_in(owner)


@pytest.fixture
def client_record(firm, owner):
    return Client.objects.create(
        firm=firm, first_name="Jane", last_name="Sample", ssn="900-12-6789", created_by=owner
    )


@pytest.fixture
def tax_return(firm, client_record):
    return TaxReturn.objects.create(firm=firm, client=client_record, tax_year=2026)
