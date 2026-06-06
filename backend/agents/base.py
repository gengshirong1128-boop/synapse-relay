from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    """Unified abstraction for every model provider."""

    def __init__(self, name: str, provider: str, role: str) -> None:
        self.name = name
        self.provider = provider
        self.role = role

    @abstractmethod
    def call_model(self, prompt: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Produce a direct answer for the current task."""

    @abstractmethod
    def summarize_context(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        """Compress current context into a short relay packet."""

    @abstractmethod
    def critique(self, shared_brief: dict[str, Any]) -> dict[str, Any]:
        """React to the latest shared brief in a debate round."""

    @abstractmethod
    def vote(self, final_options: list[str]) -> dict[str, Any]:
        """Vote between final answer candidates."""
