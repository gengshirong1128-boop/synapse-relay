from __future__ import annotations

from backend.core.executors.base import BaseExporter
from backend.schemas import ExecutionPackage


class CodexExporter(BaseExporter):
    executor_type = "codex"

    def build_prompt(self, package: ExecutionPackage) -> str:
        file_lines = []
        for index, item in enumerate(package.relevant_files, start=1):
            snippet = item.get("snippet", "")
            file_lines.append(
                f"{index}. path: {item.get('path')}\n"
                f"   reason: {item.get('reason', '')}\n"
                f"   snippet: {snippet[:800]}"
            )
        step_lines = "\n".join(f"{idx}. {step}" for idx, step in enumerate(package.modification_steps, start=1))
        validation_lines = "\n".join(f"- {cmd}" for cmd in package.validation_commands)
        constraint_lines = "\n".join(f"- {item}" for item in package.constraints)
        return (
            "你正在接手一个本地项目，请根据以下方案修改代码。\n\n"
            f"项目路径：\n{package.project_path}\n\n"
            f"用户目标：\n{package.task_goal}\n\n"
            f"当前结论：\n{package.final_plan}\n\n"
            "相关文件：\n"
            f"{chr(10).join(file_lines) if file_lines else '无'}\n\n"
            "具体修改步骤：\n"
            f"{step_lines if step_lines else '1. 根据最终方案进行最小改动实现。'}\n\n"
            "验证方式：\n"
            f"{validation_lines if validation_lines else '- 运行对应测试命令并检查关键路径。'}\n\n"
            "限制：\n"
            f"{constraint_lines if constraint_lines else '- 不要无关重构；不要删除用户代码；优先最小改动。'}\n"
        )
