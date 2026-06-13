from __future__ import annotations

import re
import sys
from pathlib import Path

from validate_decision_receipt import collect_failures as collect_receipt_failures
from validate_outcome_review import collect_failures as collect_outcome_failures


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def count_sections(text: str, prefix: str) -> int:
    if prefix:
        return len(re.findall(rf"^##\s+\d+\.\s+{re.escape(prefix)}", text, re.MULTILINE))
    return len(re.findall(r"^##\s+\d+\.", text, re.MULTILINE))


def main() -> int:
    failures: list[str] = []

    skill = read("SKILL.md")
    readme = read("README.md")
    readme_zh = read("README.zh-CN.md")
    license_text = read("LICENSE")
    openai_yaml = read("agents/openai.yaml")
    decision_cards = read("cards/decision-cards.md")
    risk_cards = read("cards/risk-cards.md")
    scoring = read("cards/scoring-rules.md")
    route_prompt = read("prompts/route-planner.md")
    task_prompt = read("prompts/task-package-generator.md")
    model_cabinet_prompt = read("prompts/claude-model-cabinet-router.md")
    decision_cabinet_prompt = read("prompts/decision-cabinet.md")
    outcome_review_prompt = read("prompts/outcome-review.md")
    reviewer_prompt = read("prompts/agent-reviewer.md")
    route_template = read("templates/route-plan-template.md")
    model_cabinet_template = read("templates/model-cabinet-plan-template.md")
    decision_receipt_template = read("templates/decision-receipt-template.md")
    outcome_review_template = read("templates/outcome-review-template.md")
    rubric = read("tests/evaluation-rubric.md")
    test_cases = read("tests/test-cases.md")
    non_code_cases = read("tests/non-code-test-cases.md")
    passing_receipt = read("tests/fixtures/passing-decision-receipt.md")
    failing_receipt = read("tests/fixtures/failing-decision-receipt.md")
    passing_outcome = read("tests/fixtures/passing-outcome-review.md")
    failing_outcome = read("tests/fixtures/failing-outcome-review.md")

    require(skill.startswith("---\n"), "SKILL.md must start with YAML frontmatter", failures)
    require("name: route-reasoning-skill" in skill, "SKILL.md frontmatter must name the skill", failures)
    require("description:" in skill and "logic" in skill and "game theory" in skill and "operations research" in skill, "description must mention the distilled decision domains", failures)
    require("逻辑学" in skill and "博弈论" in skill and "运筹学" in skill, "SKILL.md must explain the three-domain distillation", failures)
    require("不输出理论课" in skill, "SKILL.md must prohibit theory dumping", failures)
    require(readme.startswith("# Route Reasoning Skill"), "README.md must start with the project title", failures)
    require(readme_zh.startswith("# Route Reasoning Skill"), "README.zh-CN.md must start with the project title", failures)
    require("[简体中文](./README.zh-CN.md)" in readme, "README.md must link to Simplified Chinese", failures)
    require("[English](./README.md)" in readme_zh, "README.zh-CN.md must link back to English", failures)
    require("gengshirong1128-boop/route-reasoning-skill" in readme, "README.md must contain independent repository install URL", failures)
    require("gengshirong1128-boop/route-reasoning-skill" in readme_zh, "README.zh-CN.md must contain independent repository install URL", failures)
    for readme_item in ["Quick Start", "Output Contract", "Validation", "License"]:
        require(f"## {readme_item}" in readme, f"README.md missing section: {readme_item}", failures)
    require("MIT. See [`LICENSE`](./LICENSE)." in readme, "README.md must call out the MIT license", failures)
    for term in ["Decision Cabinet", "DecisionReceipt", "OutcomeReview", "Flip Conditions"]:
        require(term in readme, f"README.md missing decision cabinet capability: {term}", failures)
    for term in ["决策内阁", "DecisionReceipt", "OutcomeReview", "翻案条件"]:
        require(term in readme_zh, f"README.zh-CN.md missing decision cabinet capability: {term}", failures)
    require(license_text.startswith("MIT License"), "LICENSE must be MIT", failures)
    require("Copyright (c) 2026" in license_text, "LICENSE must include copyright year", failures)
    require("display_name: \"Decision Cabinet\"" in openai_yaml, "agents/openai.yaml must define display_name", failures)
    require("$route-reasoning-skill" in openai_yaml, "agents/openai.yaml default_prompt must mention the skill", failures)

    required_cards = [
        "目标函数先定义",
        "硬约束不可违反",
        "事实和假设分离",
        "概念不清先定义",
        "推荐必须有理由链",
        "防止工具光环",
        "激励一致才委派",
        "最小后悔优先",
        "瓶颈优先",
    ]
    for card in required_cards:
        require(card in decision_cards, f"decision card missing: {card}", failures)

    for domain in ["逻辑学", "博弈论", "运筹学"]:
        require(domain in decision_cards, f"decision cards must include domain: {domain}", failures)

    decision_card_count = count_sections(decision_cards, "")
    require(decision_card_count >= 30, "decision-cards.md should contain at least 30 numbered cards", failures)
    require("理论堆砌风险" in risk_cards, "risk cards must include theory dumping risk", failures)
    require("代理人错配风险" in risk_cards, "risk cards must include agent mismatch risk", failures)
    require("策略反应风险" in risk_cards, "risk cards must include strategic reaction risk", failures)

    for dimension in ["Constraint Fit", "Incentive Fit", "Goal Fit", "Verifiability"]:
        require(dimension in scoring, f"scoring rules missing dimension: {dimension}", failures)
        require(dimension in route_prompt, f"route planner missing score dimension: {dimension}", failures)
        require(dimension in route_template, f"route template missing score dimension: {dimension}", failures)

    require("Reason Chain" in route_prompt, "route planner must require a Reason Chain", failures)
    require("Distilled Rules Used" in route_prompt, "route planner must require distilled rules", failures)
    require("Why This Executor" in task_prompt, "task package must explain executor fit", failures)
    require("Decision Rules To Preserve" in task_prompt, "task package must preserve decision rules", failures)
    for model in ["Fable 5", "Opus", "Sonnet"]:
        require(model in skill, f"SKILL.md missing Claude model cabinet role: {model}", failures)
        require(model in model_cabinet_prompt, f"model cabinet prompt missing role: {model}", failures)
        require(model in model_cabinet_template, f"model cabinet template missing role: {model}", failures)
    for gate in ["Execution Mode", "Invocation Status", "Escalate To Opus When", "Escalate To Fable 5 When", "Delegation Calls", "Downshift", "Review Checkpoint"]:
        require(gate in model_cabinet_prompt, f"model cabinet prompt missing gate: {gate}", failures)
        require(gate in model_cabinet_template, f"model cabinet template missing gate: {gate}", failures)
    for card in ["便宜模型先证伪", "贵模型只解瓶颈", "裁决后立即降级"]:
        require(card in decision_cards, f"model routing decision card missing: {card}", failures)
    for card in ["独立表态防从众", "否决必须可解除", "先写翻案条件", "结果校准而非结果论"]:
        require(card in decision_cards, f"decision cabinet card missing: {card}", failures)
    for term in ["Strongest Dissent", "Veto", "Flip Condition"]:
        require(term in decision_cabinet_prompt, f"decision cabinet prompt missing: {term}", failures)
        require(term in decision_receipt_template, f"decision receipt template missing: {term}", failures)
    for term in ["Decision Quality", "Execution Quality", "Card Calibration"]:
        require(term in outcome_review_prompt, f"outcome review prompt missing: {term}", failures)
        require(term in outcome_review_template, f"outcome review template missing: {term}", failures)
    require("Theory / Decision Quality" in reviewer_prompt, "reviewer must check theory and decision quality", failures)
    require("Agent Fit" in reviewer_prompt, "reviewer must check agent fit", failures)
    require("Dissent / Veto / Flip Conditions" in reviewer_prompt, "reviewer must check decision cabinet controls", failures)

    combined_cases = test_cases + "\n" + non_code_cases
    require(combined_cases.count("## Case ") >= 10, "tests should include at least 10 cases across code and non-code", failures)
    for trigger in ["目标函数先定义", "防止工具光环", "事实和假设分离", "最短闭环优先"]:
        require(trigger in combined_cases, f"test cases must cover trigger: {trigger}", failures)
    require("Fable 5 Delegates to Opus and Sonnet" in combined_cases, "tests must cover Claude model cabinet delegation", failures)
    require("High-Stakes Decision Cabinet" in combined_cases, "tests must cover high-stakes decision cabinet", failures)
    require(not collect_receipt_failures(passing_receipt), "passing DecisionReceipt fixture must pass validation", failures)
    require(bool(collect_receipt_failures(failing_receipt)), "failing DecisionReceipt fixture must fail validation", failures)
    require(not collect_outcome_failures(passing_outcome), "passing OutcomeReview fixture must pass validation", failures)
    require(bool(collect_outcome_failures(failing_outcome)), "failing OutcomeReview fixture must fail validation", failures)

    require("Theory / Decision Quality" in rubric or "Avoids Theory Dumping" in rubric, "rubric must evaluate theory dumping", failures)

    if failures:
        print("Skill validation failed:")
        for item in failures:
            print(f"- {item}")
        return 1

    print("Skill validation passed.")
    print("Root: route-reasoning-skill")
    print(f"Decision cards: {decision_card_count}")
    print(f"Test cases: {combined_cases.count('## Case ')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
