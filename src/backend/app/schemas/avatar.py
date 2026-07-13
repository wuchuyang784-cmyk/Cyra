from pydantic import BaseModel, Field


class AvatarDisplayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    role: str | None = Field(default=None, max_length=160)
    maxScale: float | None = Field(default=None, ge=0.02, le=1.0)
    stageWidthRatio: float | None = Field(default=None, ge=0.1, le=1.0)
    stageHeightRatio: float | None = Field(default=None, ge=0.1, le=1.0)
    anchorX: float | None = Field(default=None, ge=0.0, le=1.0)
    anchorY: float | None = Field(default=None, ge=0.0, le=1.0)
    offsetX: float | None = Field(default=None, ge=-2000.0, le=2000.0)
    offsetY: float | None = Field(default=None, ge=-2000.0, le=2000.0)
