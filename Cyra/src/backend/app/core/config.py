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
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    chat_history_turns: int = 6

    aliyun_access_key_id: str = ""
    aliyun_access_key_secret: str = ""
    aliyun_nls_app_key: str = ""
    aliyun_nls_token: str = ""
    aliyun_nls_region: str = "cn-shanghai"
    aliyun_nls_ws_url: str = "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1"

    tts_voice: str = "xiaogang"
    tts_format: str = "mp3"
    tts_sample_rate: int = 16000

    mock_ai: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
