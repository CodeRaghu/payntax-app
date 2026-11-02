"""Print the current TOTP code for a local user (development and Playwright only)."""

from django.core.management.base import BaseCommand, CommandError
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice

from ._guard import refuse_outside_local


class Command(BaseCommand):
    help = "Print the current MFA code for a seeded user."

    def add_arguments(self, parser):
        parser.add_argument("email", nargs="?", default="owner@payntax.test")

    def handle(self, *args, email, **options):
        refuse_outside_local()
        device = TOTPDevice.objects.filter(user__email=email, confirmed=True).first()
        if device is None:
            raise CommandError(f"No confirmed MFA device for {email}")
        totp = TOTP(device.bin_key, device.step, device.t0, device.digits, device.drift)
        self.stdout.write(f"{totp.token():06d}")
