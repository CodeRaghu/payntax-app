from celery import shared_task

from .models import Document
from .pipeline import process_document


@shared_task(name="documents.process")
def process_document_task(document_id: str) -> None:
    document = Document.objects.select_related("tax_return").filter(pk=document_id).first()
    if document is not None:
        process_document(document)
