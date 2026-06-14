from __future__ import annotations

import base64
import binascii
import re

from pydantic import BaseModel, Field, field_validator


MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_DATA_URL_RE = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$")


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=1000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=8)
    image_data_url: str | None = Field(default=None, max_length=7_100_000)

    @field_validator("image_data_url")
    @classmethod
    def validate_image_data_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        match = IMAGE_DATA_URL_RE.match(value)
        if not match:
            raise ValueError("image_data_url must be a png, jpeg, or webp data URL")
        try:
            image_bytes = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("image_data_url contains invalid base64") from error
        if not image_bytes:
            raise ValueError("image_data_url is empty")
        if len(image_bytes) > MAX_CHAT_IMAGE_BYTES:
            raise ValueError("image_data_url exceeds 5MB")
        return f"data:{match.group(1)};base64,{match.group(2).strip()}"


class ChatResponse(BaseModel):
    reply: str
    provider: str
    fallback: bool = False
