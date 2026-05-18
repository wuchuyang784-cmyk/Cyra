from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.services.tts_service import TtsService

router = APIRouter(prefix="/api", tags=["tts"])


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.post("/tts")
async def tts(request: TtsRequest, settings: Settings = Depends(get_settings)) -> Response:
    audio, content_type = await TtsService(settings).synthesize(request.text)
    return Response(content=audio, media_type=content_type)
