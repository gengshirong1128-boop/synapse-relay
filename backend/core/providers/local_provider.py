from __future__ import annotations

from backend.core.providers.base import ProviderBase


class LocalProvider(ProviderBase):
    def generate_opinion(self, payload: dict) -> dict:
        raise NotImplementedError("LocalProvider TODO: connect local model runtime")

    def generate_verdict(self, payload: dict) -> dict:
        raise NotImplementedError("LocalProvider TODO: connect local model runtime")
