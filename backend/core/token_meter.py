from __future__ import annotations

from typing import Any


def estimate_tokens_from_text(text: str) -> int:
    """Rough placeholder: 1 token ~= 4 chars, with a minimum of 1."""
    return max(1, len(text) // 4)


def estimate_payload_tokens(payload: Any) -> int:
    text = str(payload)
    return estimate_tokens_from_text(text)


def estimate_cost(tokens: int, cost_per_1k_tokens: float) -> float:
    return round((tokens / 1000) * cost_per_1k_tokens, 6)
