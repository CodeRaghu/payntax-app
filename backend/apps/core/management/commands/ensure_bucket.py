"""Create the local document bucket if it doesn't exist (local S3 stand-in only; Terraform owns AWS)."""

from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.core.providers import get_provider

from ._guard import refuse_outside_local


class Command(BaseCommand):
    help = "Create the S3 bucket on the local S3 stand-in."

    def handle(self, *args, **options):
        refuse_outside_local()
        storage = get_provider("STORAGE_BACKEND")
        try:
            storage.client.head_bucket(Bucket=settings.S3_BUCKET)
        except ClientError:
            storage.client.create_bucket(Bucket=settings.S3_BUCKET)
            self.stdout.write(f"Created bucket {settings.S3_BUCKET}")
