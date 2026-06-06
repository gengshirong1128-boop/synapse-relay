from __future__ import annotations

from backend.core.ai_websites import get_ai_website
from backend.core.council_models import Conversation, Message, Minister, MinisterOpinion, Verdict, now_iso
from backend.core.web_ai_adapters import ai_website_registry


class WebAIProvider:
    provider_name = "webai"

    def _site_id(self, minister: Minister) -> str:
        profile_id = getattr(minister, "apiProfileId", "") or ""
        if profile_id.startswith("webai:"):
            return profile_id.split(":", 1)[1]
        return "chatgpt"

    def _prompt_for_opinion(self, *, minister: Minister, memorial: Message) -> str:
        return "\n".join(
            [
                minister.systemPrompt or f"你是{minister.title}，请基于职责给出简明会审意见。",
                f"职位: {minister.title}",
                f"职责: {minister.duty}",
                "",
                f"用户问题: {memorial.content}",
                "",
                "请输出：",
                "1. 你的判断",
                "2. 关键理由",
                "3. 风险或下一步",
            ]
        )

    def _prompt_for_verdict(self, *, chief_minister: Minister, memorial: Message, opinions: list[MinisterOpinion]) -> str:
        opinion_text = "\n".join(f"- {item.ministerId}: {item.content}" for item in opinions)
        return "\n".join(
            [
                chief_minister.systemPrompt or "你是首辅，请综合诸臣意见给出最终朱批。",
                f"用户问题: {memorial.content}",
                "",
                "诸臣意见:",
                opinion_text or "无",
                "",
                "请给出简洁最终结论和下一步。",
            ]
        )

    def _call_site(self, *, site_id: str, prompt: str) -> dict:
        try:
            get_ai_website(site_id)
        except KeyError:
            return {
                "success": False,
                "error": "unknown_web_ai_site",
                "message": f"Unknown web AI site: {site_id}",
            }
        adapter = ai_website_registry.adapter_for(site_id)
        return adapter.call(prompt)

    def generate_opinion(
        self,
        *,
        minister: Minister,
        memorial: Message,
        conversation: Conversation,
        context: dict,
    ) -> MinisterOpinion:
        site_id = self._site_id(minister)
        result = self._call_site(site_id=site_id, prompt=self._prompt_for_opinion(minister=minister, memorial=memorial))
        content = str(result.get("responseText") or "").strip()
        status = "done" if result.get("success") and content else "error"
        if not content:
            error = result.get("error") or result.get("status") or "web_ai_call_failed"
            message = result.get("message") or ""
            content = f"{minister.title} 网页版调用失败：{error}。{message}".strip()
        return MinisterOpinion(
            id=f"op_{minister.id}_{now_iso()}",
            conversationId=conversation.id,
            messageId=memorial.id,
            ministerId=minister.id,
            content=content,
            status=status,  # type: ignore[arg-type]
            createdAt=now_iso(),
        )

    def generate_verdict(
        self,
        *,
        chief_minister: Minister,
        memorial: Message,
        opinions: list[MinisterOpinion],
        conversation: Conversation,
    ) -> Verdict:
        site_id = self._site_id(chief_minister)
        result = self._call_site(
            site_id=site_id,
            prompt=self._prompt_for_verdict(chief_minister=chief_minister, memorial=memorial, opinions=opinions),
        )
        content = str(result.get("responseText") or "").strip()
        decision = "approved" if result.get("success") and content else "reconsider"
        if not content:
            error = result.get("error") or result.get("status") or "web_ai_call_failed"
            message = result.get("message") or ""
            content = f"网页版首辅朱批生成失败：{error}。{message}".strip()
        return Verdict(
            id=f"verdict_{conversation.id}_{len(conversation.messages)}",
            conversationId=conversation.id,
            messageId=memorial.id,
            content=content,
            decision=decision,  # type: ignore[arg-type]
            createdAt=now_iso(),
        )
