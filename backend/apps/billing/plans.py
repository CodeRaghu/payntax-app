"""Placeholder plans. Pricing model and trial length are open decision D5; change them here only."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    monthly_price_cents: int
    description: str
    features: tuple[str, ...]
    trial_days: int = 14


PLANS = (
    Plan(
        "solo",
        "Solo",
        4900,
        "One CPA, unlimited clients.",
        ("1 user", "W-2 and pay stub extraction", "Form 1040 PDF"),
    ),
    Plan(
        "practice",
        "Practice",
        12900,
        "A small firm with preparers.",
        ("Up to 5 users", "Everything in Solo", "Audit log export"),
    ),
)


def get_plan(plan_id: str) -> Plan | None:
    return next((plan for plan in PLANS if plan.id == plan_id), None)
