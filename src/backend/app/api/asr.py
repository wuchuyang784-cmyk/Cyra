import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.asr import AsrResponse
from app.services.asr_service import transcribe_audio

router = APIRouter(prefix="/api", tags=["asr"])

ALLOWED_AUDIO_TYPES = {
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "audio/x-m4a": ".m4a",
    "audio/x-wav": ".wav",
}

CHUNK_SIZE = 1024 * 1024


def _upload_suffix(file: UploadFile) -> str:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    return ALLOWED_AUDIO_TYPES.get(content_type, ".webm")


async def _save_upload(file: UploadFile, max_bytes: int) -> Path:
    total = 0
    suffix = _upload_suffix(file)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = Path(temp_file.name)
        while chunk := await file.read(CHUNK_SIZE):
            total += len(chunk)
            if total > max_bytes:
                temp_file.close()
                temp_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="ASR audio is too large")
            temp_file.write(chunk)

    if total == 0:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="ASR audio is empty")
    return temp_path


@router.post("/asr", response_model=AsrResponse)
async def asr(file: UploadFile = File(...)) -> AsrResponse:
    settings = get_settings()
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported ASR audio type")

    audio_path = await _save_upload(file, settings.whisper_max_audio_mb * 1024 * 1024)
    try:
        result = transcribe_audio(audio_path)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Local Whisper ASR is unavailable. Check openai-whisper, PyTorch, and FFmpeg.",
        ) from exc
    finally:
        audio_path.unlink(missing_ok=True)

    return AsrResponse(
        text=result.text,
        language=result.language,
        duration=result.duration,
        model=result.model,
    )
