from pydantic import BaseModel, Field


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class TtsTimestamp(BaseModel):
    text: str
    begin_time: int = Field(ge=0)
    end_time: int = Field(ge=0)


class ArkitExpressionFrame(BaseModel):
    time_ms: int = Field(ge=0)
    values: dict[str, float]


class ArkitExpressionClip(BaseModel):
    frame_rate: int = Field(gt=0)
    channels: list[str]
    frames: list[ArkitExpressionFrame]


class TtsResponse(BaseModel):
    audio_url: str | None = None
    audio_src: str
    timestamps: list[TtsTimestamp] = []
    arkit_expressions: ArkitExpressionClip | None = None
    provider: str = "dashscope"
