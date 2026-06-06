from __future__ import annotations

from backend.core.executors.base import BaseExporter
from backend.schemas import ExecutionPackage


class GenericExporter(BaseExporter):
    executor_type = "generic"

    def build_prompt(self, package: ExecutionPackage) -> str:
        lines = [
            "Execution Package",
            f"Project Path: {package.project_path}",
            f"Goal: {package.task_goal}",
            f"Final Plan: {package.final_plan}",
            "Relevant Files:",
        ]
        for item in package.relevant_files:
            lines.append(f"- {item.get('path')} ({item.get('reason', '')})")
        lines.append("Modification Steps:")
        for step in package.modification_steps:
            lines.append(f"- {step}")
        lines.append("Validation Commands:")
        for cmd in package.validation_commands:
            lines.append(f"- {cmd}")
        lines.append("Constraints:")
        for item in package.constraints:
            lines.append(f"- {item}")
        return "\n".join(lines)
