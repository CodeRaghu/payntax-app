"""Load synthetic firms, users, clients and documents. Never real data (development-setup §4)."""

from io import BytesIO

from django.core.management.base import BaseCommand
from django.db import transaction
from django_otp.plugins.otp_totp.models import TOTPDevice
from reportlab.pdfgen import canvas

from apps.accounts.models import Firm, Role, User
from apps.billing.models import Subscription, SubscriptionStatus
from apps.clients.models import Client, FilingStatus
from apps.core.providers import get_provider
from apps.documents.models import Document
from apps.documents.pipeline import process_document
from apps.returns.models import TaxReturn

from ._guard import refuse_outside_local

PASSWORD = "local-demo-password"  # noqa: S105 - synthetic local account
TOTP_KEY_HEX = "3132333435363738393031323334353637383930"  # base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ

CLIENTS = [
    ("Jane", "Sample", "900-12-6789", FilingStatus.SINGLE),
    ("Marcus", "Example", "912-34-1111", FilingStatus.MARRIED_JOINT),
    ("Priya", "Testcase", "923-45-2222", FilingStatus.HEAD_OF_HOUSEHOLD),
]


def _synthetic_pdf(title: str) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(72, 760, title)
    pdf.drawString(72, 740, "SYNTHETIC TEST DOCUMENT - NOT A REAL TAX FORM")
    pdf.save()
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Create a demo firm with synthetic clients. Safe to run more than once."

    def handle(self, *args, **options):
        refuse_outside_local()
        with transaction.atomic():
            firm, _ = Firm.objects.get_or_create(name="Demo CPA Firm")
            Subscription.objects.get_or_create(
                firm=firm, defaults={"plan": "solo", "status": SubscriptionStatus.TRIALING}
            )
            users = []
            for email, name, role in [
                ("owner@payntax.test", "Olivia Owner", Role.OWNER),
                ("preparer@payntax.test", "Pat Preparer", Role.PREPARER),
            ]:
                user = User.objects.filter(email=email).first() or User.objects.create_user(
                    email=email, password=PASSWORD, full_name=name, firm=firm, role=role
                )
                TOTPDevice.objects.get_or_create(
                    user=user, defaults={"name": "Seeded", "key": TOTP_KEY_HEX, "confirmed": True}
                )
                users.append(user)

            returns = []
            for first, last, ssn, status in CLIENTS:
                client = Client.objects.filter(firm=firm, first_name=first, last_name=last).first()
                if client is None:
                    client = Client.objects.create(
                        firm=firm, first_name=first, last_name=last, ssn=ssn, filing_status=status,
                        email=f"{first.lower()}@example.com", city="Austin", state="TX", zip_code="78701",
                        created_by=users[0],
                    )  # fmt: skip
                tax_return, _ = TaxReturn.objects.get_or_create(
                    firm=firm, client=client, tax_year=2026, defaults={"created_by": users[0]}
                )
                returns.append(tax_return)

        storage = get_provider("STORAGE_BACKEND")
        first_return = returns[0]
        for filename in ["acme_w2.pdf", "stub_dec.pdf"]:
            if first_return.documents.filter(filename=filename).exists():
                continue
            content = _synthetic_pdf(filename)
            document = Document(
                firm=firm, tax_return=first_return, filename=filename, content_type="application/pdf",
                size=len(content), uploaded_by=users[0], status="uploaded",
            )  # fmt: skip
            document.storage_key = f"firms/{firm.pk}/returns/{first_return.pk}/{document.pk}"
            try:
                storage.put(document.storage_key, content, "application/pdf")
            except Exception as exc:  # storage not running: keep the rest of the seed
                self.stderr.write(f"Skipped sample documents ({exc.__class__.__name__}).")
                break
            document.save()
            process_document(document)

        self.stdout.write(self.style.SUCCESS("Seeded synthetic data."))
        self.stdout.write(f"  Sign in: owner@payntax.test or preparer@payntax.test / {PASSWORD}")
        self.stdout.write("  MFA secret (base32): GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ  — or run `make totp`")
