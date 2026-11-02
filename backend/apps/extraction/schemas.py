"""Fields extracted per document type, in review order. bbox = where the value sits on a standard form,
as [x, y, width, height] fractions of the page; providers may return better positions."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FieldSpec:
    name: str
    label: str
    kind: str = "money"
    sensitive: bool = False
    bbox: tuple[float, float, float, float] | None = None


W2_FIELDS = (
    FieldSpec("employee_ssn", "Employee SSN (a)", "ssn", True, (0.20, 0.03, 0.22, 0.06)),
    FieldSpec("employer_ein", "Employer EIN (b)", "ein", False, (0.02, 0.10, 0.45, 0.06)),
    FieldSpec("employer_name", "Employer name (c)", "text", False, (0.02, 0.17, 0.45, 0.14)),
    FieldSpec("employee_name", "Employee name (e)", "text", False, (0.02, 0.38, 0.45, 0.07)),
    FieldSpec("box1_wages", "Box 1 Wages, tips, other comp.", bbox=(0.50, 0.10, 0.24, 0.06)),
    FieldSpec("box2_federal_tax", "Box 2 Federal income tax withheld", bbox=(0.75, 0.10, 0.24, 0.06)),
    FieldSpec("box3_ss_wages", "Box 3 Social security wages", bbox=(0.50, 0.17, 0.24, 0.06)),
    FieldSpec("box4_ss_tax", "Box 4 Social security tax withheld", bbox=(0.75, 0.17, 0.24, 0.06)),
    FieldSpec("box5_medicare_wages", "Box 5 Medicare wages and tips", bbox=(0.50, 0.24, 0.24, 0.06)),
    FieldSpec("box6_medicare_tax", "Box 6 Medicare tax withheld", bbox=(0.75, 0.24, 0.24, 0.06)),
)

PAY_STUB_FIELDS = (
    FieldSpec("employer_name", "Employer", "text", bbox=(0.03, 0.03, 0.45, 0.07)),
    FieldSpec("employee_name", "Employee", "text", bbox=(0.55, 0.03, 0.42, 0.07)),
    FieldSpec("pay_period_end", "Pay period end", "date", bbox=(0.55, 0.12, 0.20, 0.05)),
    FieldSpec("pay_date", "Pay date", "date", bbox=(0.77, 0.12, 0.20, 0.05)),
    FieldSpec("gross_pay", "Gross pay (current)", bbox=(0.40, 0.25, 0.20, 0.05)),
    FieldSpec("federal_tax", "Federal income tax (current)", bbox=(0.40, 0.32, 0.20, 0.05)),
    FieldSpec("net_pay", "Net pay (current)", bbox=(0.40, 0.60, 0.20, 0.05)),
    FieldSpec("ytd_gross", "Gross pay (YTD)", bbox=(0.70, 0.25, 0.20, 0.05)),
    FieldSpec("ytd_federal_tax", "Federal income tax (YTD)", bbox=(0.70, 0.32, 0.20, 0.05)),
)

FIELDS_BY_TYPE = {"w2": W2_FIELDS, "pay_stub": PAY_STUB_FIELDS}
