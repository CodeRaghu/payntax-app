from rest_framework import serializers


class FirmScopedQuerysetMixin:
    """Restrict every query to the signed-in user's firm (NFR-SEC-004). Other firms' rows return 404."""

    def get_queryset(self):
        return super().get_queryset().filter(firm=self.request.user.firm)

    def perform_create(self, serializer):
        serializer.save(firm=self.request.user.firm)


class FirmScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """A foreign key in a request body may only point at rows from the caller's firm."""

    def get_queryset(self):
        request = self.context["request"]
        return super().get_queryset().filter(firm=request.user.firm)
