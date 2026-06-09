from pydantic import BaseModel, Field


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class TtsTimestamp(BaseModel):
    text: str
    begin_time: int = Field(ge=0)
    end_time: int = Field(ge=0)


class TtsResponse(BaseModel):
    audio_url: str | None = None
    audio_src: str
    timestamps: list[TtsTimestamp] = []
    provider: str = "dashscope"
