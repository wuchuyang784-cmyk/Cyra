from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
import shutil
import tempfile
from typing import Any

from opencc import OpenCC

from app.core.config import get_settings


@dataclass(frozen=True)
class AsrResult:
    text: str
    language: str | None
    duration: float | None
    model: str


_TRADITIONAL_TO_SIMPLIFIED = OpenCC("t2s")


def _to_simplified_chinese(text: str) -> str:
    return _TRADITIONAL_TO_SIMPLIFIED.convert(text)


def _uses_cuda(device: str) -> bool:
    return device.lower().startswith("cuda")


def _ensure_ffmpeg_available() -> None:
    if shutil.which("ffmpeg"):
        return

    try:
        import imageio_ffmpeg
    except ModuleNotFoundError as exc:
        raise RuntimeError("FFmpeg is not available") from exc

    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    if not ffmpeg_path.exists():
        raise RuntimeError("Packaged FFmpeg executable is unavailable")

    shim_dir = Path(tempfile.gettempdir()) / "cyra-ffmpeg"
    shim_dir.mkdir(parents=True, exist_ok=True)
    shim_path = shim_dir / "ffmpeg.exe"
    if not shim_path.exists() or shim_path.stat().st_size != ffmpeg_path.stat().st_size:
        shutil.copy2(ffmpeg_path, shim_path)

    os.environ["PATH"] = f"{shim_dir}{os.pathsep}{os.environ.get('PATH', '')}"


@lru_cache(maxsize=2)
def _load_whisper_model(model_name: str, device: str) -> Any:
    try:
        import whisper
    except ModuleNotFoundError as exc:
        raise RuntimeError("openai-whisper is not installed") from exc

    try:
        return whisper.load_model(model_name, device=device)
    except Exception as exc:
        raise RuntimeError("Whisper model failed to load") from exc


def _read_duration(result: dict[str, Any]) -> float | None:
    segments = result.get("segments")
    if not isinstance(segments, list) or not segments:
        return None
    ends = [float(item.get("end", 0)) for item in segments if isinstance(item, dict)]
    return max(ends) if ends else None


def transcribe_audio(audio_path: str | Path) -> AsrResult:
    settings = get_settings()
    _ensure_ffmpeg_available()
    model = _load_whisper_model(settings.whisper_model, settings.whisper_device)
    try:
        result = model.transcribe(
            str(audio_path),
            language=settings.whisper_language or None,
            fp16=_uses_cuda(settings.whisper_device),
        )
    except Exception as exc:
        raise RuntimeError("Whisper transcription failed") from exc

    text = _to_simplified_chinese(str(result.get("text", "")).strip())
    language = result.get("language")
    return AsrResult(
        text=text,
        language=str(language) if language else None,
        duration=_read_duration(result),
        model=settings.whisper_model,
    )
