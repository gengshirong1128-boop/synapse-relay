from __future__ import annotations

from typing import Protocol

from backend.core.council_models import Conversation, Message, Minister, MinisterOpinion, Verdict


class OpinionProvider(Protocol):
    def generate_opinion(self, *, minister: Minister, memorial: Message, conversation: Conversation, context: dict) -> MinisterOpinion: ...

    def generate_verdict(self, *, chief_minister: Minister, memorial: Message, opinions: list[MinisterOpinion], conversation: Conversation) -> Verdict: ...


class ProviderBase:
    """Base class for council provider stubs. Implementations override generate_opinion/generate_verdict."""

    def generate_opinion(self, payload: dict) -> dict:
        raise NotImplementedError

    def generate_verdict(self, payload: dict) -> dict:
        raise NotImplementedError
