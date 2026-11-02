"""Form 1040 line mapping for W-2-only returns (REQ-FRM-001).

Scope for the pilot: wages and withholding from reviewed W-2s, standard deduction, taxable income,
payments, refund or amount owed. Line 16 (tax) is entered by the CPA until the tax computation and
golden-return tests (test strategy §1) are built. Every computed line can be overridden by the CPA.

2026 standard deduction: IRS Rev. Proc. 2025-32. Verify each year; golden tests pin these numbers.
"""

from dataclasses import dataclass
from decimal import Decimal

from apps.documents.models import DocumentStatus, DocumentType
from apps.extraction.validation import parse_money

STANDARD_DEDUCTION = {
    2025: {"single": 15750, "married_joint": 31500, "married_separate": 15750, "head_of_household": 23625,
           "qualifying_surviving_spouse": 31500},
    2026: {"single": 16100, "married_joint": 32200, "married_separate": 16100, "head_of_household": 24150,
           "qualifying_surviving_spouse": 32200},
}  # fmt: skip


@dataclass(frozen=True)
class LineSpec:
    line: str
    label: str
    editable: bool = True
    section: str = "Income"


LINES = (
    LineSpec("1a", "Total amount from Form(s) W-2, box 1"),
    LineSpec("1z", "Add lines 1a through 1h", editable=False),
    LineSpec("9", "Total income", editable=False),
    LineSpec("11", "Adjusted gross income", editable=False),
    LineSpec("12", "Standard deduction", section="Deductions"),
    LineSpec("14", "Total deductions", editable=False, section="Deductions"),
    LineSpec("15", "Taxable income", editable=False, section="Deductions"),
    LineSpec("16", "Tax (from tax table; enter manually for now)", section="Tax and payments"),
    LineSpec("24", "Total tax", editable=False, section="Tax and payments"),
    LineSpec("25a", "Federal income tax withheld from Form(s) W-2", section="Tax and payments"),
    LineSpec("25d", "Total withholding", editable=False, section="Tax and payments"),
    LineSpec("33", "Total payments", editable=False, section="Tax and payments"),
    LineSpec("34", "Amount overpaid (refund)", editable=False, section="Refund or amount owed"),
    LineSpec("37", "Amount you owe", editable=False, section="Refund or amount owed"),
)
EDITABLE = {spec.line for spec in LINES if spec.editable}


@dataclass
class LineValue:
    spec: LineSpec
    value: Decimal | None
    computed_value: Decimal | None
    source: str  # "w2" | "computed" | "cpa" | "missing"


def _w2_totals(tax_return) -> tuple[Decimal, Decimal, int]:
    wages = withheld = Decimal("0")
    count = 0
    documents = tax_return.documents.filter(doc_type=DocumentType.W2, status=DocumentStatus.REVIEWED)
    for document in documents.prefetch_related("fields"):
        values = {field.name: field.value for field in document.fields.all()}
        wages += parse_money(values.get("box1_wages")) or Decimal("0")
        withheld += parse_money(values.get("box2_federal_tax")) or Decimal("0")
        count += 1
    return wages, withheld, count


def compute(tax_return) -> tuple[list[LineValue], list[str]]:
    overrides = {line.line: line.value for line in tax_return.form_lines.all()}
    wages, withheld, w2_count = _w2_totals(tax_return)
    deduction_table = STANDARD_DEDUCTION.get(tax_return.tax_year)
    results: dict[str, LineValue] = {}
    specs = {spec.line: spec for spec in LINES}

    def put(line: str, computed: Decimal | None, source: str) -> Decimal:
        override = overrides.get(line) if specs[line].editable else None
        value = override if override is not None else computed
        results[line] = LineValue(specs[line], value, computed, "cpa" if override is not None else source)
        return value if value is not None else Decimal("0")

    zero = Decimal("0")
    l1a = put("1a", wages, "w2")
    l1z = put("1z", l1a, "computed")
    l9 = put("9", l1z, "computed")
    l11 = put("11", l9, "computed")
    std = Decimal(deduction_table[tax_return.client.filing_status]) if deduction_table else None
    l12 = put("12", std, "computed" if std is not None else "missing")
    l14 = put("14", l12, "computed")
    put("15", max(zero, l11 - l14), "computed")
    l16 = put("16", None, "missing")
    l24 = put("24", l16, "computed")
    l25a = put("25a", withheld, "w2")
    l25d = put("25d", l25a, "computed")
    l33 = put("33", l25d, "computed")
    put("34", max(zero, l33 - l24), "computed")
    put("37", max(zero, l24 - l33), "computed")

    warnings = []
    pending = tax_return.documents.exclude(
        status__in=[DocumentStatus.REVIEWED, DocumentStatus.REJECTED]
    ).count()
    if pending:
        warnings.append(f"{pending} document(s) are not reviewed yet and are not included.")
    if w2_count == 0:
        warnings.append("No reviewed W-2s yet. Lines 1a and 25a are zero.")
    if deduction_table is None:
        warnings.append(f"Standard deduction for {tax_return.tax_year} isn't configured; enter line 12.")
    if results["16"].value is None:
        warnings.append("Enter line 16 (tax) from the IRS tax table.")
    return [results[spec.line] for spec in LINES], warnings
