from pydantic import BaseModel


class AsrResponse(BaseModel):
    text: str
    language: str | None = None
    duration: float | None = None
    model: str
    provider: str = "whisper"
