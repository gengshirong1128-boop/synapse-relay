from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def estimate(payload: dict) -> dict:
    pricing = payload.get("pricing", {})
    calls = payload.get("calls", [])
    results: list[dict] = []
    total = 0.0

    for index, call in enumerate(calls, start=1):
        alias = str(call.get("model_alias", ""))
        if alias not in pricing:
            raise ValueError(f"Missing pricing for model_alias: {alias}")

        rates = pricing[alias]
        input_tokens = int(call.get("input_tokens", 0))
        output_tokens = int(call.get("output_tokens", 0))
        if input_tokens < 0 or output_tokens < 0:
            raise ValueError("Token counts must be non-negative")

        input_cost = input_tokens / 1_000_000 * float(rates["input_per_million"])
        output_cost = output_tokens / 1_000_000 * float(rates["output_per_million"])
        call_total = input_cost + output_cost
        total += call_total
        results.append(
            {
                "call": index,
                "role": call.get("role", ""),
                "model_alias": alias,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost": round(call_total, 6),
            }
        )

    return {"currency": payload.get("currency", "USD"), "calls": results, "estimated_total": round(total, 6)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Estimate a ModelCabinetPlan from caller-supplied pricing.")
    parser.add_argument("path", help="Path to a JSON route estimate input.")
    args = parser.parse_args()

    try:
        result = estimate(load_json(args.path))
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(f"Cost estimation failed: {error}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
