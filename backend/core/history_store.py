from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from backend.schemas import ChatRoom


class HistoryStore:
    def __init__(self, base_dir: Path | None = None) -> None:
        root = (base_dir or Path(".synapse")).resolve()
        self.base_dir = root
        self.rooms_dir = root / "rooms"
        self.indexes_dir = root / "indexes"
        self.execution_dir = root / "execution"
        self.logs_dir = root / "logs"
        self.index_file = self.indexes_dir / "rooms_index.json"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        self.rooms_dir.mkdir(parents=True, exist_ok=True)
        self.indexes_dir.mkdir(parents=True, exist_ok=True)
        self.execution_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        if not self.index_file.exists():
            self._write_json(self.index_file, {"items": []})

    @staticmethod
    def _read_json(path: Path, default: Any) -> Any:
        try:
            import json

            if not path.exists():
                return default
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return default

    @staticmethod
    def _write_json(path: Path, payload: Any) -> None:
        import json

        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _trim_preview(text: str, limit: int = 80) -> str:
        compact = " ".join((text or "").split())
        return compact[:limit]

    @staticmethod
    def _safe_project_name(room: ChatRoom) -> str | None:
        if room.attached_project_name:
            return room.attached_project_name
        if room.attached_project_path:
            return Path(room.attached_project_path).name
        return None

    @staticmethod
    def _auto_title(room: ChatRoom) -> str:
        title = (room.title or "").strip()
        if title and title not in {"Synapse Relay Workspace", "内阁 Workspace", "Synapse Relay Demo Room"}:
            return title
        first_user = next((m for m in room.messages if m.sender_type.value == "user"), None)
        if first_user and first_user.content.strip():
            return first_user.content.strip()[:20]
        if title == "Synapse Relay Demo Room":
            return "演示房间"
        return "新对话"

    def _make_tags(self, room: ChatRoom) -> list[str]:
        tags: list[str] = []
        if room.attached_project_id:
            tags.append("Project")
        if any(r.mode == "panel" for r in room.rounds):
            tags.append("Panel")
        if any(r.mode == "debate" for r in room.rounds):
            tags.append("Debate")
        if room.final_plan:
            tags.append("Final")
        return tags

    def _room_file(self, room_id: str) -> Path:
        return self.rooms_dir / f"{room_id}.json"

    def _load_index(self) -> list[dict[str, Any]]:
        data = self._read_json(self.index_file, {"items": []})
        return list(data.get("items", []))

    def _save_index(self, items: list[dict[str, Any]]) -> None:
        def sort_key(item: dict[str, Any]):
            return (not item.get("pinned", False), item.get("updated_at", ""))

        items_sorted = sorted(items, key=sort_key, reverse=False)
        items_sorted.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        pinned = [x for x in items_sorted if x.get("pinned", False)]
        normal = [x for x in items_sorted if not x.get("pinned", False)]
        self._write_json(self.index_file, {"items": pinned + normal})

    def save_room(self, room: ChatRoom, execution_log_summary: str | None = None) -> None:
        room.title = self._auto_title(room)
        room_payload = room.model_dump(mode="json")
        room_path = self._room_file(room.room_id)

        history_payload = self._read_json(room_path, {})
        execution_logs_summary = list(history_payload.get("execution_logs_summary", []))
        if execution_log_summary:
            execution_logs_summary.append({"at": datetime.utcnow().isoformat(), "summary": self._trim_preview(execution_log_summary, 300)})
            execution_logs_summary = execution_logs_summary[-20:]

        payload = {
            "room_id": room.room_id,
            "title": room.title,
            "created_at": room.created_at.isoformat(),
            "updated_at": room.updated_at.isoformat(),
            "mode": room.mode.value,
            "owner_user": room.owner_user,
            "host_agent_id": room.host_agent_id,
            "members": room_payload.get("members", []),
            "messages": room_payload.get("messages", []),
            "rounds": room_payload.get("rounds", []),
            "shared_briefs": room_payload.get("shared_briefs", []),
            "project_id": room.attached_project_id,
            "project_name": self._safe_project_name(room),
            "final_plan": room.final_plan,
            "execution_logs_summary": execution_logs_summary,
            "room": room_payload,
        }
        self._write_json(room_path, payload)

        index = self._load_index()
        prev = next((x for x in index if x.get("room_id") == room.room_id), {})
        index_items = [x for x in index if x.get("room_id") != room.room_id]
        last_message = room.messages[-1].content if room.messages else ""
        index_items.append(
            {
                "room_id": room.room_id,
                "title": room.title,
                "created_at": room.created_at.isoformat(),
                "updated_at": room.updated_at.isoformat(),
                "last_message_preview": self._trim_preview(last_message),
                "member_count": len([m for m in room.members if m.status.value != "removed"]),
                "round_count": len(room.rounds),
                "project_name": self._safe_project_name(room),
                "tags": self._make_tags(room),
                "archived": prev.get("archived", False),
                "pinned": room.pinned or prev.get("pinned", False),
            }
        )
        self._save_index(index_items)

    def list_rooms(self, include_archived: bool = False, limit: int = 20) -> list[dict[str, Any]]:
        items = self._load_index()
        if not include_archived:
            items = [x for x in items if not x.get("archived", False)]
        return items[: max(limit, 1)]

    def load_room(self, room_id: str) -> ChatRoom:
        payload = self._read_json(self._room_file(room_id), None)
        if not payload:
            raise KeyError(f"Unknown room_id: {room_id}")
        room_data = payload.get("room")
        if not room_data:
            raise KeyError(f"Corrupted room record: {room_id}")
        return ChatRoom.model_validate(room_data)

    def rename_room(self, room_id: str, new_title: str) -> dict[str, Any]:
        room = self.load_room(room_id)
        room.title = new_title.strip() or room.title
        room.updated_at = datetime.utcnow()
        self.save_room(room)
        return {"room_id": room.room_id, "title": room.title}

    def archive_room(self, room_id: str, archived: bool = True) -> dict[str, Any]:
        items = self._load_index()
        found = False
        for item in items:
            if item.get("room_id") == room_id:
                item["archived"] = archived
                item["updated_at"] = datetime.utcnow().isoformat()
                found = True
                break
        if not found:
            raise KeyError(f"Unknown room_id: {room_id}")
        self._save_index(items)
        return {"room_id": room_id, "archived": archived}

    def pin_room(self, room_id: str, pinned: bool = True) -> dict[str, Any]:
        items = self._load_index()
        found = False
        for item in items:
            if item.get("room_id") == room_id:
                item["pinned"] = pinned
                item["updated_at"] = datetime.utcnow().isoformat()
                found = True
                break
        if not found:
            raise KeyError(f"Unknown room_id: {room_id}")
        self._save_index(items)
        try:
            room = self.load_room(room_id)
            room.pinned = pinned
            self.save_room(room)
        except Exception:  # noqa: BLE001
            pass
        return {"room_id": room_id, "pinned": pinned}

    def delete_room(self, room_id: str) -> dict[str, Any]:
        room_file = self._room_file(room_id)
        if room_file.exists():
            room_file.unlink()
        items = [x for x in self._load_index() if x.get("room_id") != room_id]
        self._save_index(items)
        return {"room_id": room_id, "deleted": True}

    def search(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        q = (query or "").strip().lower()
        if not q:
            return self.list_rooms(limit=limit)
        matched: list[dict[str, Any]] = []
        for item in self._load_index():
            if item.get("archived"):
                continue
            rid = item.get("room_id")
            payload = self._read_json(self._room_file(rid), {})
            room_data = payload.get("room", {})
            title = str(item.get("title", "")).lower()
            final_plan = str(payload.get("final_plan", "")).lower()
            project_name = str(payload.get("project_name", "")).lower()
            members = " ".join(str(m.get("display_name", "")) for m in room_data.get("members", [])).lower()
            messages = " ".join(str(m.get("content", "")) for m in room_data.get("messages", [])[-30:]).lower()
            if q in " ".join([title, final_plan, project_name, members, messages]):
                matched.append(item)
        matched.sort(key=lambda x: (not x.get("pinned", False), x.get("updated_at", "")), reverse=False)
        return matched[: max(limit, 1)]

    def export_transcript_markdown(self, room_id: str) -> str:
        room = self.load_room(room_id)
        lines = [
            f"# {room.title}",
            "",
            f"Created: {room.created_at.isoformat()}",
            f"Updated: {room.updated_at.isoformat()}",
            f"Mode: {room.mode.value}",
            f"Project: {room.attached_project_name or room.attached_project_path or '-'}",
            "",
            "## Members",
            "",
        ]
        for member in room.members:
            if member.status.value == "removed":
                continue
            lines.append(f"- {member.display_name or member.name} / {member.position_name or member.role.value}")
        lines.extend(["", "## Messages", ""])
        for msg in room.messages:
            lines.append(f"### {msg.sender_type.value.capitalize()}")
            lines.append(msg.content)
            if msg.imperial_review:
                lines.append(f"- 朱批: {msg.imperial_review.get('label')} {msg.imperial_review.get('instruction')}")
            lines.append("")
        lines.extend(["## Rounds", ""])
        for rnd in room.rounds:
            lines.append(f"### Round {rnd.round_number}")
            lines.append("Specialist Outputs:")
            for out in rnd.specialist_outputs:
                lines.append(f"- {out.display_name}: {out.claim}")
            lines.append("")
            lines.append("Coordinator Summary:")
            lines.append(rnd.coordinator_output.summary_for_user if rnd.coordinator_output else "-")
            lines.append("")
            lines.append("Shared Brief:")
            lines.append(rnd.shared_brief.compact_summary_for_next_round if rnd.shared_brief else "-")
            lines.append("")
        lines.extend(["## Final Plan", "", room.final_plan or "-"])
        return "\n".join(lines)


history_store = HistoryStore()
