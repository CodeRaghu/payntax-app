from rest_framework import serializers


class FormLineSerializer(serializers.Serializer):
    line = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]  # DRF pops declared fields
    section = serializers.CharField()
    editable = serializers.BooleanField()
    value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    computed_value = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    source = serializers.ChoiceField(choices=["w2", "computed", "cpa", "missing"])  # type: ignore[assignment]


class Form1040Serializer(serializers.Serializer):
    tax_return = serializers.UUIDField()
    tax_year = serializers.IntegerField()
    lines = FormLineSerializer(many=True)
    warnings = serializers.ListField(child=serializers.CharField())


class FormLineUpdateSerializer(serializers.Serializer):
    value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        help_text="null resets the line to the computed value",
    )
