import urllib.parse
import urllib.request

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.tts import ArkitExpressionClip, ArkitExpressionFrame, TtsRequest, TtsResponse, TtsTimestamp
from app.services.tts_service import get_cached_audio, get_cached_audio_media_type, synthesize_speech

router = APIRouter(prefix="/api", tags=["tts"])


@router.post("/tts", response_model=TtsResponse)
async def tts(request: TtsRequest) -> TtsResponse:
    try:
        result = synthesize_speech(request.text)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail="TTS service is unavailable") from exc
    if result.audio_id:
        audio_src = f"/api/tts/audio/{result.audio_id}"
    elif result.audio_url:
        audio_src = f"/api/tts/audio?url={urllib.parse.quote(result.audio_url, safe='')}"
    else:
        raise HTTPException(status_code=502, detail="TTS audio is unavailable")
    timestamps = [
        TtsTimestamp(text=item.text, begin_time=item.begin_time, end_time=item.end_time)
        for item in result.timestamps
    ]
    arkit_expressions = None
    if result.arkit_expressions:
        arkit_expressions = ArkitExpressionClip(
            frame_rate=result.arkit_expressions.frame_rate,
            channels=result.arkit_expressions.channels,
            frames=[
                ArkitExpressionFrame(time_ms=frame.time_ms, values=frame.values)
                for frame in result.arkit_expressions.frames
            ],
        )
    return TtsResponse(
        audio_url=result.audio_url,
        audio_src=audio_src,
        timestamps=timestamps,
        arkit_expressions=arkit_expressions,
        provider=result.provider,
    )


@router.get("/tts/audio/{audio_id}")
async def tts_cached_audio(audio_id: str) -> StreamingResponse:
    audio_bytes = get_cached_audio(audio_id)
    if audio_bytes is None:
        raise HTTPException(status_code=404, detail="TTS audio has expired")
    media_type = get_cached_audio_media_type(audio_id) or "audio/mpeg"
    return StreamingResponse(iter([audio_bytes]), media_type=media_type)


@router.get("/tts/audio")
async def tts_audio(url: str = Query(min_length=1)) -> StreamingResponse:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc.endswith(".aliyuncs.com"):
        raise HTTPException(status_code=400, detail="Invalid TTS audio URL")

    try:
        response = urllib.request.urlopen(url, timeout=30)
    except OSError as exc:
        raise HTTPException(status_code=502, detail="TTS audio is unavailable") from exc

    return StreamingResponse(response, media_type="audio/mpeg")
