from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED_SECTIONS = [
    "## Original Decision",
    "## Observed Outcome",
    "## Prediction Errors",
    "## Triggered Flip Conditions",
    "## Decision Quality",
    "## Execution Quality",
    "## Card Calibration",
    "## Next Decision",
]


def collect_failures(text: str) -> list[str]:
    failures: list[str] = []
    if "# OutcomeReview" not in text:
        failures.append("missing # OutcomeReview")
    for section in REQUIRED_SECTIONS:
        if section not in text:
            failures.append(f"missing section: {section}")

    for field in ["Triggered:", "Missed:", "Invalid or Unverifiable:"]:
        if field not in text:
            failures.append(f"Triggered Flip Conditions missing field: {field}")

    for field in ["Keep:", "Increase Weight:", "Decrease Weight:", "Rewrite:"]:
        if field not in text:
            failures.append(f"Card Calibration missing field: {field}")

    quality_count = text.count("pass | partial | fail")
    if quality_count < 2:
        failures.append("Decision Quality and Execution Quality must use pass | partial | fail")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a Route Reasoning OutcomeReview.")
    parser.add_argument("path", help="Path to OutcomeReview Markdown.")
    args = parser.parse_args()

    try:
        text = Path(args.path).read_text(encoding="utf-8")
    except OSError as error:
        print(f"OutcomeReview validation failed: {error}", file=sys.stderr)
        return 1

    failures = collect_failures(text)
    if failures:
        print("OutcomeReview validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("OutcomeReview validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
