"""Document AI provider interface (OCR provider is open decision D3 / ADR-0004).

SyntheticExtractor returns realistic, deterministic fake values so every screen and rule can be built and
tested before Textract or an LLM vision model is wired in. A real provider implements the same two methods.
"""

import random
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .schemas import FIELDS_BY_TYPE, FieldSpec


@dataclass
class ExtractedValue:
    spec: FieldSpec
    value: str
    confidence: float
    bbox: list[float] | None = None


class Extractor(Protocol):
    def classify(self, filename: str, content: bytes) -> str: ...

    def extract(self, doc_type: str, content: bytes, seed: str) -> list[ExtractedValue]: ...


EMPLOYERS = [
    "Lone Star Logistics LLC",
    "Bluebonnet Dental PA",
    "Pecan Street Software Inc",
    "Gulf Coast Supply Co",
]
FIRST = ["Avery", "Jordan", "Riley", "Casey", "Morgan", "Taylor"]
LAST = ["Sample", "Testcase", "Placeholder", "Example"]


def _money(amount: Decimal) -> str:
    return f"{amount:,.2f}"


class SyntheticExtractor:
    def classify(self, filename: str, content: bytes) -> str:
        name = filename.lower().replace("-", "").replace("_", "")
        if "w2" in name:
            return "w2"
        if "stub" in name or "pay" in name:
            return "pay_stub"
        return "other"

    def extract(self, doc_type: str, content: bytes, seed: str) -> list[ExtractedValue]:
        rng = random.Random(seed)
        values = self._w2(rng) if doc_type == "w2" else self._pay_stub(rng) if doc_type == "pay_stub" else {}
        specs = FIELDS_BY_TYPE.get(doc_type, ())
        shaky = set(rng.sample([s.name for s in specs], k=min(2, len(specs))))
        return [
            ExtractedValue(
                spec=spec,
                value=values[spec.name],
                confidence=round(
                    rng.uniform(0.62, 0.88) if spec.name in shaky else rng.uniform(0.93, 0.995), 3
                ),
                bbox=list(spec.bbox) if spec.bbox else None,
            )
            for spec in specs
        ]

    def _w2(self, rng: random.Random) -> dict[str, str]:
        wages = Decimal(rng.randrange(38_000, 160_000))
        ss_tax = (wages * Decimal("0.062")).quantize(Decimal("0.01"))
        if rng.random() < 0.4:  # simulate an OCR misread so the review rules have something to catch
            ss_tax = (ss_tax + Decimal(rng.choice([-450, 450]))).quantize(Decimal("0.01"))
        return {
            # 9xx area numbers are never issued as SSNs, so synthetic data can't belong to anyone.
            "employee_ssn": f"9{rng.randrange(10, 99)}-{rng.randrange(10, 99)}-{rng.randrange(1000, 9999)}",
            "employer_ein": f"{rng.randrange(10, 99)}-{rng.randrange(1_000_000, 9_999_999)}",
            "employer_name": rng.choice(EMPLOYERS),
            "employee_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            "box1_wages": _money(wages),
            "box2_federal_tax": _money((wages * Decimal(rng.uniform(0.09, 0.17))).quantize(Decimal("0.01"))),
            "box3_ss_wages": _money(wages),
            "box4_ss_tax": _money(ss_tax),
            "box5_medicare_wages": _money(wages),
            "box6_medicare_tax": _money((wages * Decimal("0.0145")).quantize(Decimal("0.01"))),
        }

    def _pay_stub(self, rng: random.Random) -> dict[str, str]:
        gross = Decimal(rng.randrange(1_500, 6_500))
        fed = (gross * Decimal("0.12")).quantize(Decimal("0.01"))
        periods = rng.randrange(6, 26)
        return {
            "employer_name": rng.choice(EMPLOYERS),
            "employee_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            "pay_period_end": f"2026-{rng.randrange(1, 12):02d}-15",
            "pay_date": f"2026-{rng.randrange(1, 12):02d}-20",
            "gross_pay": _money(gross),
            "federal_tax": _money(fed),
            "net_pay": _money((gross * Decimal("0.74")).quantize(Decimal("0.01"))),
            "ytd_gross": _money(gross * periods),
            "ytd_federal_tax": _money(fed * periods),
        }
