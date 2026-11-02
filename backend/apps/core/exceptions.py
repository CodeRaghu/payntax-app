from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Always return {"detail": ..., "errors": {...}} so the UI has one error shape to handle."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(data, dict) and set(data) == {"detail"}:
        detail = data["detail"]
        text = " ".join(str(item) for item in detail) if isinstance(detail, list) else str(detail)
        response.data = {"detail": text, "errors": {}}
    elif isinstance(data, dict) and set(data) == {"non_field_errors"}:
        response.data = {"detail": " ".join(str(item) for item in data["non_field_errors"]), "errors": {}}
    elif isinstance(data, dict):
        response.data = {"detail": "Please correct the highlighted fields.", "errors": data}
    else:
        response.data = {"detail": " ".join(str(item) for item in data), "errors": {}}
    return response
