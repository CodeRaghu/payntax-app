"""One call to record an audit event: audit.record(request, "client.view", client)."""

from .models import AuditEvent


def record(request, action: str, obj=None, *, user=None, firm=None, **metadata) -> AuditEvent:
    user = user or (request.user if request and request.user.is_authenticated else None)
    firm = firm or getattr(user, "firm", None)
    meta = request.META if request else {}
    return AuditEvent.objects.create(
        firm=firm,
        user=user,
        action=action,
        object_type=obj._meta.model_name if obj is not None else "",
        object_id=str(obj.pk) if obj is not None else "",
        metadata=metadata,
        ip_address=meta.get("REMOTE_ADDR"),
        user_agent=meta.get("HTTP_USER_AGENT", "")[:300],
    )
