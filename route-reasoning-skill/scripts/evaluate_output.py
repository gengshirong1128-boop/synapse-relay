from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_ROUTEPLAN_SECTIONS = [
    "## 1. Situation",
    "## 2. Goal",
    "## 3. Constraints",
    "## 4. Options",
    "## 5. Recommended Route",
    "## 6. First Action",
    "## 7. Validation Criteria",
    "## 8. Risks",
]

REQUIRED_TASKSPEC_SECTIONS = [
    "## Background",
    "## Objective",
    "## Scope",
    "## Non-goals",
    "## Steps",
    "## Acceptance Criteria",
    "## Restrictions",
    "## Output Required",
]


def read_input(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return sys.stdin.read()


def has_heading(text: str, heading: str) -> bool:
    return re.search(rf"^{re.escape(heading)}\s*$", text, re.MULTILINE) is not None


def count_option_headings(text: str) -> int:
    patterns = [
        r"^###\s+Option\s+[A-Z0-9]+[:：]",
        r"^###\s+路线\s*[A-Z0-9一二三四五六七八九十]+[:：]",
        r"^###\s+方案\s*[A-Z0-9一二三四五六七八九十]+[:：]",
    ]
    return sum(len(re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)) for pattern in patterns)


def recommendation_count(text: str) -> int:
    recommended_section = re.search(
        r"^## 5\. Recommended Route\s*(.*?)(?=^##\s+\d+\.|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not recommended_section:
        return 0
    section = recommended_section.group(1)
    explicit = len(re.findall(r"\bRecommend(?:ed)?\s+Option\s+[A-Z0-9]+", section, re.IGNORECASE))
    explicit += len(re.findall(r"推荐(?:路线|方案)?\s*[：:]\s*(?:Option\s+)?[A-Z0-9一二三四五六七八九十]+", section))
    if explicit:
        return explicit
    return 1 if section.strip() else 0


def collect_failures(text: str) -> list[str]:
    failures: list[str] = []

    if not has_heading(text, "# RoutePlan"):
        failures.append("missing # RoutePlan")
    for section in REQUIRED_ROUTEPLAN_SECTIONS:
        if section not in text:
            failures.append(f"missing RoutePlan section: {section}")

    options = count_option_headings(text)
    if options < 3:
        failures.append(f"RoutePlan must contain at least 3 options, found {options}")

    recs = recommendation_count(text)
    if recs != 1:
        failures.append(f"Recommended Route must recommend exactly 1 route, found {recs}")

    for required in ["Benefit:", "Cost:", "Risk:", "Best For:", "Not For:"]:
        if text.count(required) < 3:
            failures.append(f"each option should include {required}")

    for score in ["Goal Fit", "Constraint Fit", "Verifiability", "Incentive Fit"]:
        if score not in text:
            failures.append(f"missing score dimension: {score}")

    if "Reason Chain" not in text:
        failures.append("missing Reason Chain")
    for chain_item in ["Objective Function", "Hard Constraints", "Score Signal", "Why This Executor"]:
        if chain_item not in text:
            failures.append(f"missing reason-chain item: {chain_item}")

    if "Distilled Rules Used" not in text:
        failures.append("missing Distilled Rules Used")
    for domain in ["Logic", "Game Theory", "Operations Research"]:
        if domain not in text:
            failures.append(f"missing distilled domain: {domain}")

    if not has_heading(text, "# TaskSpec"):
        failures.append("missing # TaskSpec")
    for section in REQUIRED_TASKSPEC_SECTIONS:
        if section not in text:
            failures.append(f"missing TaskSpec section: {section}")

    if "# HandoffBrief" not in text:
        failures.append("missing # HandoffBrief")

    if any(term in text for term in ["显而易见", "综合考虑", "多管齐下", "全面提升"]) and "Validation Criteria" not in text:
        failures.append("possible fluff without validation criteria")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate a Route Reasoning Skill output.")
    parser.add_argument("path", nargs="?", help="Markdown output file. Reads stdin when omitted.")
    args = parser.parse_args()

    text = read_input(args.path)
    failures = collect_failures(text)

    if failures:
        print("Output evaluation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("Output evaluation passed.")
    print(f"Options: {count_option_headings(text)}")
    print(f"Recommendations: {recommendation_count(text)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
