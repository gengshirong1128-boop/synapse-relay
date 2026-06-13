from __future__ import annotations

import time

from backend.core.council_models import Conversation, Message, Minister, MinisterOpinion, Verdict, now_iso


class MockProvider:
    def _style_text(self, minister: Minister, memorial: Message) -> str:
        office = minister.office
        # Legacy preset offices keep their tailored demo lines.
        legacy = {
            "workflow": "先将奏折拆解为 3 步：明确目标、收集约束、分派执行。当前议题建议先稳 service 层，再推进 UI。",
            "engineering": "建议先固定 API adapter 与 service 契约，避免界面重构牵连调用链。优先清理边界与错误处理。",
            "ux": "界面应保持入口分层：输入工具、会话菜单、设置与大臣管理分离。奏折与奏议应成为上朝主体。",
            "review": "风险点：删除/清空/移出必须二次确认；多臣并发输出需限流，防止信息噪声。",
            "writing": "可将多臣意见归并为可执行简报，并生成面向不同角色的摘要版本。",
            "cost": "建议控制每轮参与 3-5 位大臣，降低 token 与时间成本。",
            "compliance": "敏感配置应仅保留 apiKeyEnvName，严禁前端保存明文 key。",
            "execution": "落地顺序：先测试入口 -> 再接 provider -> 最后接持久化。每步都保留回滚点。",
            "diagnose": "建议增加健康检查与回归脚本，优先覆盖 submitMemorial 全链路。",
        }
        if office in legacy:
            return legacy[office]
        # Members built from the frontend roster: echo identity + skill so the
        # demo shows each member speaking in their own role.
        topic = (memorial.content or "").strip().replace("\n", " ")[:40]
        skill_hint = ""
        if minister.systemPrompt:
            first_line = next(
                (ln.strip() for ln in minister.systemPrompt.splitlines()
                 if ln.strip() and not ln.startswith("你是「")),
                "",
            )
            skill_hint = f" 依「{first_line[:24]}」之责，" if first_line else " "
        role_word = "统筹诸臣、形成结论" if minister.isChief else "提出本职意见"
        return f"（{minister.displayName}）就议题“{topic}…”，{skill_hint}{role_word}：建议先明确目标与约束，再给出可验证的下一步。"

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
