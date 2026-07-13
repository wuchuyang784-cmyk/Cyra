from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


def default_cors_origins() -> list[str]:
    origins: list[str] = []
    for port in range(5173, 5193):
        origins.append(f"http://localhost:{port}")
        origins.append(f"http://127.0.0.1:{port}")
    return origins


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Cyra AI Guide"
    cors_origins: List[str] = Field(default_factory=default_cors_origins)
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen3.7-plus"
    dashscope_api_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    dashscope_embedding_model: str = "text-embedding-v4"
    dashscope_embedding_dimension: int = 1024
    chroma_persist_dir: str = "src/backend/chroma_db"
    tts_provider: str = "dashscope"
    dashscope_tts_model: str = "cosyvoice-v3-flash"
    dashscope_tts_voice: str = "longyingmu"
    dashscope_tts_format: str = "mp3"
    dashscope_tts_sample_rate: int = 24000
    dashscope_tts_api_url: str = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
    dashscope_tts_ws_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
    lam_expression_api_url: str = ""
    lam_expression_timeout_seconds: int = 30
    gpt_sovits_api_url: str = "http://127.0.0.1:9880"
    gpt_sovits_api_key: str = ""
    gpt_sovits_ref_audio_path: str = ""
    gpt_sovits_prompt_text: str = ""
    gpt_sovits_prompt_lang: str = "zh"
    gpt_sovits_text_lang: str = "zh"
    gpt_sovits_media_type: str = "wav"
    gpt_sovits_timeout_seconds: int = 60
    whisper_model: str = "base"
    whisper_language: str = "Chinese"
    whisper_device: str = "cpu"
    whisper_max_audio_mb: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()
