"""Validation rules for extracted values (REQ-EXT-003). Each rule returns {field_name: message}.

2026 constants: Social Security wage base $184,500 (SSA, Oct 2025). Verify yearly; golden tests pin them.
"""

import re
from decimal import Decimal, InvalidOperation

SS_RATE = Decimal("0.062")
MEDICARE_RATE = Decimal("0.0145")
ADDITIONAL_MEDICARE_RATE = Decimal("0.009")
ADDITIONAL_MEDICARE_THRESHOLD = Decimal("200000")
SS_WAGE_BASE = {2024: Decimal("168600"), 2025: Decimal("176100"), 2026: Decimal("184500")}
TOLERANCE = Decimal("1.00")

SSN_RE = re.compile(r"^\d{3}-\d{2}-\d{4}$")
EIN_RE = re.compile(r"^\d{2}-\d{7}$")


def parse_money(value: str | None) -> Decimal | None:
    if value is None or not value.strip():
        return None
    try:
        return Decimal(value.replace(",", "").replace("$", "").strip()).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def _fmt(amount: Decimal) -> str:
    return f"{amount:,.2f}"


def validate_w2(values: dict[str, str], tax_year: int) -> dict[str, str]:
    issues: dict[str, str] = {}
    if not SSN_RE.match(values.get("employee_ssn", "")):
        issues["employee_ssn"] = "SSN must look like 123-45-6789."
    if not EIN_RE.match(values.get("employer_ein", "")):
        issues["employer_ein"] = "EIN must look like 12-3456789."
    if not values.get("employer_name", "").strip():
        issues["employer_name"] = "Employer name is missing."

    parsed = {name: parse_money(values.get(name)) for name in values if name.startswith("box")}
    for name, amount in parsed.items():
        if amount is None or amount < 0:
            issues[name] = "Enter an amount like 85,000.00."
    if issues.keys() & parsed.keys():
        return issues
    money = {name: amount for name, amount in parsed.items() if amount is not None}

    box1, box2 = money["box1_wages"], money["box2_federal_tax"]
    box3, box4 = money["box3_ss_wages"], money["box4_ss_tax"]
    box5, box6 = money["box5_medicare_wages"], money["box6_medicare_tax"]

    if box2 > box1:
        issues["box2_federal_tax"] = "Federal tax withheld is more than wages (Box 1)."
    wage_base = SS_WAGE_BASE.get(tax_year, SS_WAGE_BASE[max(SS_WAGE_BASE)])
    if box3 > wage_base:
        issues["box3_ss_wages"] = f"Box 3 is above the {tax_year} wage base of {_fmt(wage_base)}."
    expected4 = (box3 * SS_RATE).quantize(Decimal("0.01"))
    if abs(box4 - expected4) > TOLERANCE:
        issues["box4_ss_tax"] = f"Box 4 should be 6.2% of Box 3 (expected {_fmt(expected4)})."
    expected6 = box5 * MEDICARE_RATE
    if box5 > ADDITIONAL_MEDICARE_THRESHOLD:
        expected6 += (box5 - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE
    expected6 = expected6.quantize(Decimal("0.01"))
    if abs(box6 - expected6) > TOLERANCE:
        issues["box6_medicare_tax"] = f"Box 6 should be 1.45% of Box 5 (expected {_fmt(expected6)})."
    return issues


def validate_pay_stub(values: dict[str, str], tax_year: int) -> dict[str, str]:
    issues: dict[str, str] = {}
    money_names = ["gross_pay", "federal_tax", "net_pay", "ytd_gross", "ytd_federal_tax"]
    parsed = {name: parse_money(values.get(name)) for name in money_names}
    for name, amount in parsed.items():
        if amount is None or amount < 0:
            issues[name] = "Enter an amount like 3,250.00."
    if issues:
        return issues
    money = {name: amount for name, amount in parsed.items() if amount is not None}
    if money["net_pay"] > money["gross_pay"]:
        issues["net_pay"] = "Net pay is more than gross pay."
    if money["ytd_gross"] < money["gross_pay"]:
        issues["ytd_gross"] = "Year-to-date gross is less than this period's gross."
    if money["ytd_federal_tax"] < money["federal_tax"]:
        issues["ytd_federal_tax"] = "Year-to-date federal tax is less than this period's."
    return issues


VALIDATORS = {"w2": validate_w2, "pay_stub": validate_pay_stub}


def validate(doc_type: str, values: dict[str, str], tax_year: int) -> dict[str, str]:
    validator = VALIDATORS.get(doc_type)
    return validator(values, tax_year) if validator else {}
