from __future__ import annotations

from dataclasses import asdict, replace
from typing import Any

from backend.core.council_models import Attachment, Conversation, Message, Minister, MinisterOpinion, Verdict, now_iso
from backend.core.ai_member_settings import ai_member_settings_store
from backend.core.minister_registry import minister_presets
from backend.core.providers.base import OpinionProvider
from backend.core.providers.mock_provider import MockProvider


class CouncilService:
    def __init__(self, provider: OpinionProvider | None = None):
        self.provider = provider or MockProvider()
        self.conversations: dict[str, Conversation] = {}

    def create_conversation(self, conversation_id: str, title: str = "内阁会话") -> Conversation:
        presets = minister_presets()
        ministers = [
            Minister(
                id=item.id,
                title=item.title,
                displayName=item.display_name,
                office=item.office,
                duty=item.duty,
                capabilityTags=item.capability_tags,
                provider="mock",
                model="mock-gpt",
                apiProfileId="mock_default",
                systemPrompt=item.system_prompt,
                enabled=True,
                isChief=item.is_chief,
                status="idle",
                order=idx,
            )
            for idx, item in enumerate(presets["defaults"])
        ]
        convo = Conversation(id=conversation_id, title=title, ministers=ministers)
        self.conversations[conversation_id] = convo
        return convo

    def get_conversation(self, conversation_id: str) -> Conversation:
        if conversation_id not in self.conversations:
            return self.create_conversation(conversation_id)
        return self.conversations[conversation_id]

    def select_active_ministers(
        self,
        conversation: Conversation,
        mode: str = "ask",
        selected_ids: list[str] | None = None,
    ) -> list[Minister]:
        enabled = [m for m in conversation.ministers if m.enabled]
        chief = next((m for m in enabled if m.isChief), enabled[0] if enabled else None)
        if not conversation.settings.enableCouncil and chief:
            return [chief]
        if selected_ids:
            selected = [m for m in enabled if m.id in set(selected_ids)]
            if chief and chief not in selected:
                selected = [chief, *selected]
            return selected[:5]
        by_id = {m.id: m for m in enabled}
        if mode == "ask":
            return [chief] if chief else enabled[:1]
        if mode == "final":
            picked = [chief, by_id.get("hanlin"), by_id.get("censorate")]
            return [m for m in picked if m][:5]
        if mode == "council":
            picked = [by_id.get("silijian"), by_id.get("gongbu"), by_id.get("libu"), by_id.get("censorate"), chief]
            return [m for m in picked if m][:5]
        # continue/default
        picked = enabled[:5]
        if chief and chief not in picked:
            picked = [chief, *picked[:4]]
        return picked

    def _role_assignment_key(self, minister: Minister) -> str:
        if minister.isChief:
            return "chief"
        if minister.id in {"gongbu"}:
            return "code"
        if minister.id in {"censorate"}:
            return "review"
        if minister.id in {"hanlin", "silijian"}:
            return "summary"
        if minister.id in {"libu"}:
            return "translation"
        return "summary"

    def submit_memorial(self, payload: dict[str, Any], provider=None, provider_resolver=None) -> dict[str, Any]:
        _provider = provider or self.provider
        conversation = self.get_conversation(payload["conversationId"])
        content = payload.get("content", "").strip()
        attachments_input = payload.get("attachments", []) or []
        attachments = [
            Attachment(
                id=item.get("id") or f"att_{idx}_{conversation.id}",
                name=item.get("name", "file"),
                type=item.get("type", "unknown"),
                size=int(item.get("size", 0)),
                localPath=item.get("localPath"),
                url=item.get("url"),
            )
            for idx, item in enumerate(attachments_input)
        ]

        memorial = Message(
            id=f"mem_{conversation.id}_{len(conversation.messages) + 1}",
            conversationId=conversation.id,
            role="user",
            content=content,
            attachments=attachments,
            createdAt=now_iso(),
            status="pending",
        )
        conversation.messages.append(memorial)

        mode = payload.get("discussionMode") or payload.get("mode") or conversation.discussionMode
        conversation.discussionMode = mode
        active = self.select_active_ministers(conversation, mode, payload.get("selectedMinisterIds"))
        profile_id = payload.get("profileId", "")
        if profile_id:
            active = [replace(m, apiProfileId=profile_id) for m in active]
        else:
            assignments = ai_member_settings_store.get().get("roleAssignments", {})
            patched_active: list[Minister] = []
            for minister in active:
                assigned_profile = str(assignments.get(self._role_assignment_key(minister)) or "")
                if assigned_profile and assigned_profile != "mock_default_profile":
                    patched_active.append(replace(minister, apiProfileId=assigned_profile))
                else:
                    patched_active.append(minister)
            active = patched_active
        opinions: list[MinisterOpinion] = []
        for minister in active:
            minister.status = "thinking"
            minister_provider = provider_resolver(minister) if provider_resolver else _provider
            op = minister_provider.generate_opinion(minister=minister, memorial=memorial, conversation=conversation, context={})
            minister.status = "done" if op.status == "done" else "error"
            opinions.append(op)

        chief = next((m for m in active if m.isChief), active[0])
        chief_provider = provider_resolver(chief) if provider_resolver else _provider
        verdict = chief_provider.generate_verdict(chief_minister=chief, memorial=memorial, opinions=opinions, conversation=conversation)
        conversation.updatedAt = now_iso()

        return {
            "memorial": asdict(memorial),
            "activeMinisters": [asdict(m) for m in active],
            "opinions": [asdict(o) for o in opinions],
            "verdict": asdict(verdict),
            "conversation": asdict(conversation),
        }


council_service = CouncilService()
