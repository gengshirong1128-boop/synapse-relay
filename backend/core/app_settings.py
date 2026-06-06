from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from backend.config import ROOT_DIR


Theme = Literal["light", "dark"]
Language = Literal["zh", "en"]
FontSize = Literal["sm", "md", "lg", "xl"]
VisualMode = Literal["cabinet", "un"]

DATA_DIR = Path(os.getenv("NEIGE_DATA_DIR", ROOT_DIR / ".synapse" / "runtime"))


@dataclass
class AppSettings:
    theme: Theme = "dark"
    language: Language = "zh"
    fontSize: FontSize = "md"
    visualMode: VisualMode = "cabinet"
    backendUrl: str = "http://127.0.0.1:8000"


class AppSettingsStore:
    def __init__(self) -> None:
        self._settings = AppSettings()
        self._load()

    @property
    def _path(self) -> Path:
        return DATA_DIR / "app_settings.json"

    def _load(self) -> None:
        path = self._path
        if not path.exists():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if isinstance(raw, dict):
            self.patch(raw, save=False)

    def _save(self) -> None:
        path = self._path
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(self.get(), ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def get(self) -> dict:
        return asdict(self._settings)

    def patch(self, payload: dict, save: bool = True) -> dict:
        if "theme" in payload:
            theme = str(payload["theme"])
            if theme not in {"light", "dark"}:
                raise ValueError("invalid_theme")
            self._settings.theme = theme  # type: ignore[assignment]

        if "language" in payload:
            language = str(payload["language"])
            if language not in {"zh", "en"}:
                raise ValueError("invalid_language")
            self._settings.language = language  # type: ignore[assignment]

        if "fontSize" in payload:
            font_size = str(payload["fontSize"])
            if font_size not in {"sm", "md", "lg", "xl"}:
                raise ValueError("invalid_font_size")
            self._settings.fontSize = font_size  # type: ignore[assignment]

        if "visualMode" in payload:
            visual_mode = str(payload["visualMode"])
            if visual_mode not in {"cabinet", "un"}:
                raise ValueError("invalid_visual_mode")
            self._settings.visualMode = visual_mode  # type: ignore[assignment]

        if "backendUrl" in payload:
            backend_url = str(payload["backendUrl"] or "").strip()
            if backend_url and not (backend_url.startswith("http://") or backend_url.startswith("https://")):
                raise ValueError("invalid_backend_url")
            self._settings.backendUrl = backend_url or "http://127.0.0.1:8000"

        if save:
            self._save()
        return self.get()


app_settings_store = AppSettingsStore()
