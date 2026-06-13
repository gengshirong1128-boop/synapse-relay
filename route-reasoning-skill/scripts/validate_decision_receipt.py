from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_SECTIONS = [
    "## Decision",
    "## Objective Function",
    "## Confirmed Facts",
    "## Assumptions",
    "## Options Considered",
    "## Strongest Dissent",
    "## Veto Record",
    "## Reason Chain",
    "## First Action",
    "## Validation Criteria",
    "## Flip Conditions",
    "## Review Date",
]


def collect_failures(text: str) -> list[str]:
    failures: list[str] = []
    if "# DecisionReceipt" not in text:
        failures.append("missing # DecisionReceipt")
    for section in REQUIRED_SECTIONS:
        if section not in text:
            failures.append(f"missing section: {section}")

    option_count = len(re.findall(r"^###\s+Option\s+[A-Z0-9]+", text, re.MULTILINE | re.IGNORECASE))
    if option_count < 3:
        failures.append(f"Options Considered must contain at least 3 options, found {option_count}")

    for field in ["Status:", "Basis:", "Impact:", "Unblock Condition:"]:
        if field not in text:
            failures.append(f"Veto Record missing field: {field}")

    for field in ["Observable Signal:", "Threshold:", "Action When Triggered:"]:
        if field not in text:
            failures.append(f"Flip Conditions missing field: {field}")

    if not re.search(r"Status:\s*(clear|vetoed|conditionally-cleared)", text, re.IGNORECASE):
        failures.append("Veto Record Status must be clear, vetoed, or conditionally-cleared")

    for field in ["Claim:", "Evidence:", "Why Overruled:"]:
        if field not in text:
            failures.append(f"Strongest Dissent missing field: {field}")

    for field in ["Objective:", "Constraints:", "Evidence:", "Counterexample:", "Why This Route:"]:
        if field not in text:
            failures.append(f"Reason Chain missing field: {field}")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a Route Reasoning DecisionReceipt.")
    parser.add_argument("path", help="Path to DecisionReceipt Markdown.")
    args = parser.parse_args()

    try:
        text = Path(args.path).read_text(encoding="utf-8")
    except OSError as error:
        print(f"DecisionReceipt validation failed: {error}", file=sys.stderr)
        return 1

    failures = collect_failures(text)
    if failures:
        print("DecisionReceipt validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    option_count = len(re.findall(r"^###\s+Option\s+[A-Z0-9]+", text, re.MULTILINE | re.IGNORECASE))
    print("DecisionReceipt validation passed.")
    print(f"Options: {option_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
