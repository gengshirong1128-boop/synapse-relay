from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

MinisterStatus = Literal["idle", "thinking", "done", "error"]
OpinionStatus = Literal["pending", "thinking", "done", "error"]
VerdictDecision = Literal["approved", "rejected", "reconsider"]


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class Attachment:
    id: str
    name: str
    type: str
    size: int
    localPath: str | None = None
    url: str | None = None
    createdAt: str = field(default_factory=now_iso)


@dataclass
class Minister:
    id: str
    title: str
    displayName: str
    office: str
    duty: str
    capabilityTags: list[str]
    provider: str = "mock"
    model: str = "mock-gpt"
    apiProfileId: str = "mock_default"
    systemPrompt: str = ""
    enabled: bool = True
    isChief: bool = False
    status: MinisterStatus = "idle"
    order: int = 0
    createdAt: str = field(default_factory=now_iso)
    updatedAt: str = field(default_factory=now_iso)


@dataclass
class Message:
    id: str
    conversationId: str
    role: Literal["user", "assistant", "minister", "system"]
    content: str
    attachments: list[Attachment] = field(default_factory=list)
    createdAt: str = field(default_factory=now_iso)
    status: str = "pending"


@dataclass
class MinisterOpinion:
    id: str
    conversationId: str
    messageId: str
    ministerId: str
    content: str
    status: OpinionStatus = "pending"
    createdAt: str = field(default_factory=now_iso)


@dataclass
class Verdict:
    id: str
    conversationId: str
    messageId: str
    content: str
    decision: VerdictDecision
    createdAt: str = field(default_factory=now_iso)


@dataclass
class ConversationSettings:
    enableZhupi: bool = True
    enableCouncil: bool = True
    chiefMinisterId: str = "chief"


@dataclass
class Conversation:
    id: str
    title: str
    mode: Literal["minimal", "court"] = "minimal"
    discussionMode: Literal["ask", "continue", "council", "final"] = "ask"
    createdAt: str = field(default_factory=now_iso)
    updatedAt: str = field(default_factory=now_iso)
    messages: list[Message] = field(default_factory=list)
    ministers: list[Minister] = field(default_factory=list)
    settings: ConversationSettings = field(default_factory=ConversationSettings)


@dataclass
class APIProfile:
    id: str
    name: str
    provider: str
    baseUrl: str
    apiKeyEnvName: str
    defaultModel: str
    enabled: bool = True


@dataclass
class AppSettings:
    theme: str = "system"
    language: str = "zh"
    defaultMode: str = "minimal"
    defaultChiefMinisterId: str = "chief"
