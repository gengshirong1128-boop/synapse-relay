from __future__ import annotations

from uuid import uuid4

from backend.schemas import Mode, SessionRecord


class SessionStore:
    """In-memory store for the MVP. Swap with DB/Redis later if needed."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}

    def create(self, mode: Mode, user_goal: str, agents, max_rounds: int, budget_tokens: int) -> SessionRecord:
        session = SessionRecord(
            session_id=str(uuid4()),
            mode=mode,
            user_goal=user_goal,
            agents=agents,
            max_rounds=max_rounds,
            budget_tokens=budget_tokens,
        )
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> SessionRecord:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Unknown session_id: {session_id}")
        return session

    def save(self, session: SessionRecord) -> SessionRecord:
        self._sessions[session.session_id] = session
        return session


session_store = SessionStore()
