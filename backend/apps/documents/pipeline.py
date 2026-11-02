"""Document processing: scan → classify → extract → validate (sequence diagram in docs/screens)."""

import logging

from apps.core.providers import get_provider
from apps.extraction.service import save_extraction

from .models import Document, DocumentStatus, DocumentType

logger = logging.getLogger(__name__)


def process_document(document: Document) -> None:
    storage = get_provider("STORAGE_BACKEND")
    try:
        document.set_status(DocumentStatus.SCANNING)
        content = storage.read(document.storage_key)
        result = get_provider("VIRUS_SCANNER").scan(content, document.content_type)
        if not result.clean:
            storage.delete(document.storage_key)
            document.set_status(DocumentStatus.REJECTED, result.reason)
            return

        document.set_status(DocumentStatus.CLASSIFYING)
        extractor = get_provider("EXTRACTION_PROVIDER")
        document.doc_type = extractor.classify(document.filename, content)
        document.save(update_fields=["doc_type", "updated_at"])

        document.set_status(DocumentStatus.EXTRACTING)
        if document.doc_type == DocumentType.OTHER:
            document.fields.all().delete()
            document.set_status(
                DocumentStatus.NEEDS_REVIEW,
                "Not recognized as a W-2 or pay stub. Check it and mark it reviewed.",
            )
            return
        save_extraction(document, extractor.extract(document.doc_type, content, seed=str(document.pk)))
    except Exception:
        logger.exception("Processing failed for document %s", document.pk)
        document.set_status(DocumentStatus.FAILED, "We couldn't read this document. Try again.")
    finally:
        document.tax_return.refresh_status()
