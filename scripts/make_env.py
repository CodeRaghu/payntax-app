"""Create .env from .env.example with freshly generated local secrets. Never overwrites an existing .env."""

import base64
import os
import pathlib
import secrets
import sys

root = pathlib.Path(__file__).resolve().parent.parent
target = root / ".env"
if target.exists():
    sys.exit(".env already exists; leaving it alone.")
text = (root / ".env.example").read_text()
text = text.replace("DJANGO_SECRET_KEY=change-me", f"DJANGO_SECRET_KEY={secrets.token_urlsafe(50)}")
text = text.replace(
    "FIELD_ENCRYPTION_KEYS=change-me", f"FIELD_ENCRYPTION_KEYS={base64.urlsafe_b64encode(os.urandom(32)).decode()}"
)
target.write_text(text)
print("Created .env with new local keys.")
