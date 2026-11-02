"""Object storage for uploaded documents. Uploads and downloads go browser ↔ S3 through short-lived
pre-signed URLs, so files never pass through the API servers."""

from typing import Protocol

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from django.conf import settings


class DocumentStorage(Protocol):
    def presign_upload(self, key: str, content_type: str) -> tuple[str, dict[str, str]]: ...

    def presign_download(self, key: str) -> str: ...

    def put(self, key: str, content: bytes, content_type: str) -> None: ...

    def size(self, key: str) -> int | None: ...

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None: ...


class S3Storage:
    def __init__(self) -> None:
        config = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        common = {"region_name": settings.S3_REGION, "config": config}
        self.client = boto3.client("s3", endpoint_url=settings.S3_ENDPOINT_URL, **common)
        # Locally the browser reaches MinIO on a different host than the containers do.
        self.public = boto3.client(
            "s3", endpoint_url=settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL, **common
        )
        self.bucket = settings.S3_BUCKET

    def presign_upload(self, key: str, content_type: str) -> tuple[str, dict[str, str]]:
        params = {"Bucket": self.bucket, "Key": key, "ContentType": content_type}
        headers = {"Content-Type": content_type}
        if settings.S3_KMS_KEY_ID:
            params |= {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": settings.S3_KMS_KEY_ID}
            headers |= {
                "x-amz-server-side-encryption": "aws:kms",
                "x-amz-server-side-encryption-aws-kms-key-id": settings.S3_KMS_KEY_ID,
            }
        url = self.public.generate_presigned_url(
            "put_object", Params=params, ExpiresIn=settings.S3_PRESIGN_SECONDS
        )
        return url, headers

    def presign_download(self, key: str) -> str:
        return self.public.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key, "ResponseContentDisposition": "inline"},
            ExpiresIn=settings.S3_PRESIGN_SECONDS,
        )

    def put(self, key: str, content: bytes, content_type: str) -> None:
        extra = (
            {"ServerSideEncryption": "aws:kms", "SSEKMSKeyId": settings.S3_KMS_KEY_ID}
            if settings.S3_KMS_KEY_ID
            else {}
        )
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type, **extra)

    def size(self, key: str) -> int | None:
        try:
            return self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"]
        except ClientError:
            return None

    def read(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


class InMemoryStorage:
    """For tests: behaves like S3Storage without a network."""

    objects: dict[str, bytes] = {}

    def presign_upload(self, key: str, content_type: str) -> tuple[str, dict[str, str]]:
        return f"https://storage.test/{key}?upload", {"Content-Type": content_type}

    def presign_download(self, key: str) -> str:
        return f"https://storage.test/{key}"

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = content

    def size(self, key: str) -> int | None:
        data = self.objects.get(key)
        return None if data is None else len(data)

    def read(self, key: str) -> bytes:
        return self.objects[key]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)
