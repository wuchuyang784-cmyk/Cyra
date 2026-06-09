from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Cyra AI Guide"
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen-plus"
    dashscope_api_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    dashscope_embedding_model: str = "text-embedding-v3"
    dashscope_embedding_dimension: int = 1024
    chroma_persist_dir: str = "../../chroma_db"
    dashscope_tts_model: str = "cosyvoice-v3-flash"
    dashscope_tts_voice: str = "Chelsie"
    dashscope_tts_format: str = "mp3"
    dashscope_tts_sample_rate: int = 24000
    dashscope_tts_api_url: str = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
    dashscope_tts_ws_url: str = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
    whisper_model: str = "base"
    whisper_language: str = "Chinese"
    whisper_device: str = "cpu"
    whisper_max_audio_mb: int = 20


@lru_cache
def get_settings() -> Settings:
    return Settings()
