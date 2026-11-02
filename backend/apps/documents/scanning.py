"""Virus scanning (REQ-DOC-002). SignatureScanner checks that the bytes match the declared file type and
blocks the EICAR test file. Replace with ClamAV or GuardDuty Malware Protection for S3 before launch."""

from dataclasses import dataclass
from typing import Protocol

EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!"
MAGIC = {
    "application/pdf": (b"%PDF",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
}


@dataclass
class ScanResult:
    clean: bool
    reason: str = ""


class VirusScanner(Protocol):
    def scan(self, content: bytes, content_type: str) -> ScanResult: ...


class SignatureScanner:
    def scan(self, content: bytes, content_type: str) -> ScanResult:
        if EICAR in content:
            return ScanResult(False, "Virus found. The file was deleted.")
        signatures = MAGIC.get(content_type)
        if not signatures or not content.startswith(signatures):
            return ScanResult(False, "The file contents don't match its type. Upload a PDF, JPG or PNG.")
        return ScanResult(True)
