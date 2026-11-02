import pytest
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient

from apps.accounts.models import Invitation, Role, User

from .conftest import PASSWORD, make_user, signed_in


@pytest.mark.django_db
def test_signup_creates_firm_and_owner_then_requires_mfa():
    api = APIClient()
    response = api.post(
        "/api/auth/signup",
        {"firm_name": "New Firm", "full_name": "Nia New", "email": "Nia@New.test", "password": PASSWORD},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["authenticated"] and not body["mfa_enrolled"] and not body["mfa_verified"]
    user = User.objects.get(email="nia@new.test")
    assert user.role == Role.OWNER and user.firm.name == "New Firm"

    # TC-ACC-001: no client data before MFA
    assert api.get("/api/clients").status_code == 403

    setup = api.post("/api/auth/mfa/setup").json()
    assert setup["otpauth_url"].startswith("otpauth://totp/") and "<svg" in setup["qr_svg"]
    device = TOTPDevice.objects.get(user=user)
    code = f"{TOTP(device.bin_key).token():06d}"
    verified = api.post("/api/auth/mfa/verify", {"code": code}).json()
    assert verified["mfa_enrolled"] and verified["mfa_verified"]
    assert verified["subscription_status"] is None
    # No subscription yet: client data still blocked until checkout (SCR-03)
    assert api.get("/api/clients").status_code == 403


@pytest.mark.django_db
def test_signup_rejects_weak_password_and_duplicate_email(owner):
    api = APIClient()
    weak = api.post(
        "/api/auth/signup", {"firm_name": "F", "full_name": "N", "email": "x@x.test", "password": "short"}
    )
    assert weak.status_code == 400
    dup = api.post(
        "/api/auth/signup", {"firm_name": "F", "full_name": "N", "email": owner.email, "password": PASSWORD}
    )
    assert dup.status_code == 400 and "email" in dup.json()["errors"]


@pytest.mark.django_db
def test_login_errors_are_generic(owner):
    response = APIClient().post("/api/auth/login", {"email": owner.email, "password": "wrong-password-123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Email or password is incorrect."


@pytest.mark.django_db
def test_wrong_mfa_code_is_rejected(owner):
    api = signed_in(owner, verify=False)
    assert api.post("/api/auth/mfa/verify", {"code": "000000"}).status_code == 400
    assert api.get("/api/clients").status_code == 403


@pytest.mark.django_db
def test_mfa_setup_refused_once_enrolled(api):
    assert api.post("/api/auth/mfa/setup").status_code == 403


@pytest.mark.django_db
def test_owner_invites_preparer_who_accepts(api, firm):
    created = api.post("/api/firm/invitations", {"email": "new@a.test", "role": "preparer"})
    assert created.status_code == 201
    token = Invitation.objects.get(email="new@a.test").token
    assert created.json()["invite_url"].endswith(token)

    guest = APIClient()
    assert guest.get(f"/api/auth/invitations/{token}").json()["firm_name"] == firm.name
    accepted = guest.post(
        f"/api/auth/invitations/{token}/accept", {"full_name": "New P", "password": PASSWORD}
    )
    assert accepted.status_code == 200
    assert User.objects.get(email="new@a.test").firm == firm
    assert guest.get(f"/api/auth/invitations/{token}").status_code == 400  # single use


@pytest.mark.django_db
def test_preparer_cannot_manage_firm(firm, preparer):
    api = signed_in(preparer)
    assert api.post("/api/firm/invitations", {"email": "x@a.test"}).status_code == 403
    assert api.patch("/api/firm", {"name": "Hacked"}).status_code == 403
    assert api.get("/api/audit-events").status_code == 403
    assert api.get("/api/firm/users").status_code == 200


@pytest.mark.django_db
def test_owner_cannot_demote_self(api, owner):
    assert api.patch(f"/api/firm/users/{owner.pk}", {"role": "preparer"}).status_code == 400


@pytest.mark.django_db
def test_owner_changes_preparer_role(api, firm):
    other = make_user(firm, "p2@a.test", Role.PREPARER)
    response = api.patch(f"/api/firm/users/{other.pk}", {"role": "owner"})
    assert response.status_code == 200 and response.json()["role"] == "owner"
