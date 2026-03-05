from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

PERIOD_DAYS = 14


@dataclass(slots=True)
class BudgetPeriod:
    """Domain model for one biweekly budget period."""

    start_date: date
    total_budget: float
    spent: float = 0.0

    @property
    def end_date(self) -> date:
        return self.start_date + timedelta(days=PERIOD_DAYS - 1)

    @property
    def remaining(self) -> float:
        return round(self.total_budget - self.spent, 2)

    @property
    def percent_remaining(self) -> float:
        if self.total_budget <= 0:
            return 0.0
        value = (self.remaining / self.total_budget) * 100
        return max(0.0, min(100.0, round(value, 2)))

    def add_spend(self, amount: float) -> None:
        if amount < 0:
            raise ValueError("Amount must be non-negative.")
        self.spent = round(self.spent + amount, 2)
