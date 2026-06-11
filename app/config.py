import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_draft_dir() -> Path:
    if os.getenv("VERCEL"):
        return Path("/tmp/drafts")
    return Path("data/drafts")


class Settings(BaseSettings):
    nvidia_api_key: str = ""
    nvidia_model: str = "meta/llama-3.3-70b-instruct"
    nvidia_max_tokens: int = 16384
    nvidia_enable_thinking: bool = False
    nvidia_reasoning_budget: int = 8192
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_completion_tokens: int = 8000
    draft_dir: Path = Field(default_factory=_default_draft_dir)
    save_drafts: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
