from __future__ import annotations

from backend.core.executors.base import BaseExporter
from backend.schemas import ExecutionPackage


class ClaudeCodeExporter(BaseExporter):
    executor_type = "claude_code"

    def build_prompt(self, package: ExecutionPackage) -> str:
        files = []
        for item in package.relevant_files:
            files.append(
                f"- {item.get('path')} | reason: {item.get('reason', '')}\n"
                f"  snippet: {item.get('snippet', '')[:800]}"
            )
        steps = "\n".join(f"{idx}. {step}" for idx, step in enumerate(package.modification_steps, start=1))
        checks = "\n".join(f"- {cmd}" for cmd in package.validation_commands)
        return (
            "Please inspect the local project and implement the following plan with minimal changes.\n\n"
            f"Project path:\n{package.project_path}\n\n"
            f"Goal:\n{package.task_goal}\n\n"
            f"Plan:\n{package.final_plan}\n\n"
            "Relevant files:\n"
            f"{chr(10).join(files) if files else '- none'}\n\n"
            "Implementation steps:\n"
            f"{steps if steps else '1. Apply the smallest viable code changes according to the plan.'}\n\n"
            "Validation:\n"
            f"{checks if checks else '- Run existing tests and key workflows.'}\n\n"
            "Constraints:\n"
            "- No unrelated refactor.\n"
            "- Do not delete user code.\n"
            "- Explain plan before edits.\n"
            "- Run validation commands after edits.\n"
        )
