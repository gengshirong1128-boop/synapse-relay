from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parent.parent
APP_NAME = "\u5185\u9601"
FRONTEND_DIR = ROOT_DIR / "frontend"
REACT_FRONTEND_DIR = ROOT_DIR / f"{APP_NAME}-ai-app"
REACT_FRONTEND_DIST = REACT_FRONTEND_DIR / "dist"


class Settings(BaseSettings):
    app_name: str = APP_NAME
    debug: bool = True
    default_max_debate_rounds: int = 3
    default_budget_tokens: int = 6000
    cost_per_1k_tokens: float = 0.002
    openai_api_key: str | None = None
    claude_api_key: str | None = None
    deepseek_api_key: str | None = None
    gemini_api_key: str | None = None
    qwen_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
