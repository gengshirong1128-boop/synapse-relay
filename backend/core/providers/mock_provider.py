from __future__ import annotations

import time

from backend.core.council_models import Conversation, Message, Minister, MinisterOpinion, Verdict, now_iso


class MockProvider:
    def _style_text(self, minister: Minister, memorial: Message) -> str:
        office = minister.office
        if office == "workflow":
            return "先将奏折拆解为 3 步：明确目标、收集约束、分派执行。当前议题建议先稳 service 层，再推进 UI。"
        if office == "engineering":
            return "建议先固定 API adapter 与 service 契约，避免界面重构牵连调用链。优先清理边界与错误处理。"
        if office == "ux":
            return "界面应保持入口分层：输入工具、会话菜单、设置与大臣管理分离。奏折与奏议应成为上朝主体。"
        if office == "review":
            return "风险点：删除/清空/移出必须二次确认；多臣并发输出需限流，防止信息噪声。"
        if office == "writing":
            return "可将多臣意见归并为可执行简报，并生成面向不同角色的摘要版本。"
        if office == "cost":
            return "建议控制每轮参与 3-5 位大臣，降低 token 与时间成本。"
        if office == "compliance":
            return "敏感配置应仅保留 apiKeyEnvName，严禁前端保存明文 key。"
        if office == "execution":
            return "落地顺序：先测试入口 -> 再接 provider -> 最后接持久化。每步都保留回滚点。"
        if office == "diagnose":
            return "建议增加健康检查与回归脚本，优先覆盖 submitMemorial 全链路。"
        return f"就奏折“{memorial.content[:30]}...”而言，建议先确保流程稳定，再拓展能力。"

    def generate_opinion(self, *, minister: Minister, memorial: Message, conversation: Conversation, context: dict) -> MinisterOpinion:
        return MinisterOpinion(
            id=f"op_{minister.id}_{int(time.time() * 1000)}",
            conversationId=conversation.id,
            messageId=memorial.id,
            ministerId=minister.id,
            content=self._style_text(minister, memorial),
            status="done",
            createdAt=now_iso(),
        )

    def generate_verdict(self, *, chief_minister: Minister, memorial: Message, opinions: list[MinisterOpinion], conversation: Conversation) -> Verdict:
        decision = "approved" if len(opinions) >= 1 else "reconsider"
        content = "朱批：先稳服务契约，再扩展会审与工具调度。"
        if any("风险" in op.content or "敏感" in op.content for op in opinions):
            content = "朱批：先补风险控制与配置边界，再行扩展。"
        return Verdict(
            id=f"verdict_{conversation.id}_{len(conversation.messages)}",
            conversationId=conversation.id,
            messageId=memorial.id,
            content=content,
            decision=decision,  # type: ignore[arg-type]
            createdAt=now_iso(),
        )
