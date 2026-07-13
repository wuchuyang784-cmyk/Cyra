import base64
import json
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
import wave
from dataclasses import dataclass
from io import BytesIO

from app.core.config import get_settings
from app.services.arkit_expression_service import (
    ArkitExpressionClipResult,
    generate_arkit_expression_clip,
    generate_lam_expression_clip,
)


@dataclass(frozen=True)
class TtsTimestampResult:
    text: str
    begin_time: int
    end_time: int


@dataclass(frozen=True)
class TtsSynthesisResult:
    audio_url: str | None
    audio_id: str | None
    timestamps: list[TtsTimestampResult]
    arkit_expressions: ArkitExpressionClipResult | None = None
    provider: str = "dashscope"


_AUDIO_CACHE: dict[str, tuple[bytes, str, float]] = {}
_AUDIO_CACHE_TTL_SECONDS = 600


def _cleanup_audio_cache() -> None:
    now = time.time()
    expired = [audio_id for audio_id, (_, _, expires_at) in _AUDIO_CACHE.items() if expires_at <= now]
    for audio_id in expired:
        _AUDIO_CACHE.pop(audio_id, None)


def cache_audio(audio_bytes: bytes, media_type: str = "audio/mpeg") -> str:
    _cleanup_audio_cache()
    audio_id = uuid.uuid4().hex
    _AUDIO_CACHE[audio_id] = (audio_bytes, media_type, time.time() + _AUDIO_CACHE_TTL_SECONDS)
    return audio_id


def get_cached_audio(audio_id: str) -> bytes | None:
    _cleanup_audio_cache()
    item = _AUDIO_CACHE.get(audio_id)
    if not item:
        return None
    return item[0]


def get_cached_audio_media_type(audio_id: str) -> str | None:
    _cleanup_audio_cache()
    item = _AUDIO_CACHE.get(audio_id)
    if not item:
        return None
    return item[1]


def fetch_remote_audio(audio_url: str) -> tuple[bytes, str]:
    try:
        with urllib.request.urlopen(audio_url, timeout=30) as response:
            audio_bytes = response.read()
            media_type = response.headers.get_content_type() or "audio/mpeg"
    except (TimeoutError, urllib.error.URLError) as exc:
        raise RuntimeError("TTS audio download failed") from exc
    if not audio_bytes:
        raise RuntimeError("TTS audio download returned empty audio")
    return audio_bytes, media_type


def _result_with_cached_audio(
    audio_bytes: bytes,
    media_type: str,
    timestamps: list[TtsTimestampResult] | None = None,
    provider: str = "dashscope",
) -> TtsSynthesisResult:
    try:
        arkit_expressions = generate_lam_expression_clip(audio_bytes, media_type)
    except RuntimeError:
        arkit_expressions = generate_arkit_expression_clip(audio_bytes, media_type)
    return TtsSynthesisResult(
        audio_url=None,
        audio_id=cache_audio(audio_bytes, media_type),
        timestamps=timestamps or [],
        arkit_expressions=arkit_expressions,
        provider=provider,
    )


def _sdk_audio_format(format_name: str, sample_rate: int):
    from dashscope.audio.tts_v2 import AudioFormat

    format_key = format_name.strip().lower()
    if format_key == "mp3":
        formats = {
            8000: AudioFormat.MP3_8000HZ_MONO_128KBPS,
            16000: AudioFormat.MP3_16000HZ_MONO_128KBPS,
            22050: AudioFormat.MP3_22050HZ_MONO_256KBPS,
            24000: AudioFormat.MP3_24000HZ_MONO_256KBPS,
            44100: AudioFormat.MP3_44100HZ_MONO_256KBPS,
            48000: AudioFormat.MP3_48000HZ_MONO_256KBPS,
        }
    elif format_key == "wav":
        formats = {
            8000: AudioFormat.WAV_8000HZ_MONO_16BIT,
            16000: AudioFormat.WAV_16000HZ_MONO_16BIT,
            22050: AudioFormat.WAV_22050HZ_MONO_16BIT,
            24000: AudioFormat.WAV_24000HZ_MONO_16BIT,
            44100: AudioFormat.WAV_44100HZ_MONO_16BIT,
            48000: AudioFormat.WAV_48000HZ_MONO_16BIT,
        }
    elif format_key == "pcm":
        formats = {
            8000: AudioFormat.PCM_8000HZ_MONO_16BIT,
            16000: AudioFormat.PCM_16000HZ_MONO_16BIT,
            22050: AudioFormat.PCM_22050HZ_MONO_16BIT,
            24000: AudioFormat.PCM_24000HZ_MONO_16BIT,
            44100: AudioFormat.PCM_44100HZ_MONO_16BIT,
            48000: AudioFormat.PCM_48000HZ_MONO_16BIT,
        }
    else:
        formats = {}
    return formats.get(sample_rate, AudioFormat.MP3_24000HZ_MONO_256KBPS)


def _normalize_word_timestamps(data: dict) -> list[TtsTimestampResult]:
    payload = data.get("payload", data)
    output = payload.get("output", payload)
    sentence = payload.get("sentence") or output.get("sentence") or {}
    words = sentence.get("words", [])
    timestamps: list[TtsTimestampResult] = []

    for word in words:
        text = str(word.get("text", "")).strip()
        if not text:
            continue
        try:
            begin_time = int(float(word.get("begin_time", 0)))
            end_time = int(float(word.get("end_time", begin_time)))
        except (TypeError, ValueError):
            continue
        if end_time < begin_time:
            continue
        timestamps.append(TtsTimestampResult(text=text, begin_time=begin_time, end_time=end_time))

    return timestamps


def _visible_tts_units(text: str) -> list[str]:
    return [char for char in text.strip() if not char.isspace()]


def _estimate_audio_duration_ms(audio_bytes: bytes, media_type: str, text: str) -> int:
    if "wav" in media_type.lower():
        try:
            with wave.open(BytesIO(audio_bytes), "rb") as audio_file:
                frame_rate = audio_file.getframerate()
                frame_count = audio_file.getnframes()
            if frame_rate > 0 and frame_count > 0:
                return max(1, round(frame_count / frame_rate * 1000))
        except (wave.Error, EOFError):
            pass

    units = _visible_tts_units(text)
    return max(700, min(30000, len(units) * 210))


def _estimate_timestamps_from_audio(text: str, audio_bytes: bytes, media_type: str) -> list[TtsTimestampResult]:
    units = _visible_tts_units(text)
    if not units:
        return []

    duration_ms = _estimate_audio_duration_ms(audio_bytes, media_type, text)
    unit_duration = duration_ms / len(units)
    timestamps: list[TtsTimestampResult] = []
    for index, unit in enumerate(units):
        begin_time = round(index * unit_duration)
        end_time = round((index + 1) * unit_duration)
        if index == len(units) - 1:
            end_time = duration_ms
        if end_time <= begin_time:
            end_time = begin_time + 1
        timestamps.append(TtsTimestampResult(text=unit, begin_time=begin_time, end_time=end_time))
    return timestamps


def _is_qwen_tts_model(model_name: str) -> bool:
    normalized = model_name.strip().lower()
    return normalized == "qwen-tts" or normalized.startswith("qwen3-tts")


def _qwen_tts_media_type(format_name: str) -> str:
    normalized = format_name.strip().lower()
    if normalized == "wav":
        return "audio/wav"
    if normalized == "pcm":
        return "audio/pcm"
    if normalized == "opus" or normalized == "ogg":
        return "audio/ogg"
    return "audio/mpeg"


_QWEN_TTS_SUPPORTED_VOICES = {"Cherry", "Serena", "Ethan", "Chelsie"}


def _validate_qwen_tts_voice(voice_name: str) -> None:
    if voice_name not in _QWEN_TTS_SUPPORTED_VOICES:
        supported = ", ".join(sorted(_QWEN_TTS_SUPPORTED_VOICES))
        raise RuntimeError(f"Qwen TTS voice '{voice_name}' is not supported. Supported voices: {supported}")


def _decode_qwen_tts_audio_data(audio_data: str) -> bytes:
    try:
        return base64.b64decode(audio_data)
    except (ValueError, TypeError) as exc:
        raise RuntimeError("Qwen TTS returned invalid audio data") from exc


def _qwen_tts_audio_field(audio: object, field_name: str) -> str | None:
    if isinstance(audio, dict):
        value = audio.get(field_name)
    else:
        value = getattr(audio, field_name, None)
    if value in (None, ""):
        return None
    return str(value)


def _synthesize_speech_with_qwen_tts(text: str) -> TtsSynthesisResult:
    try:
        import dashscope
        from dashscope.audio.qwen_tts import SpeechSynthesizer as QwenSpeechSynthesizer
    except ImportError as exc:
        raise RuntimeError("DashScope Qwen TTS SDK is not installed") from exc

    settings = get_settings()
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")

    _validate_qwen_tts_voice(settings.dashscope_tts_voice)
    dashscope.api_key = settings.dashscope_api_key
    response = QwenSpeechSynthesizer.call(
        model=settings.dashscope_tts_model,
        text=text.strip(),
        voice=settings.dashscope_tts_voice,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Qwen TTS error: {response.code} {response.message}".strip())

    audio = getattr(response.output, "audio", None)
    if not audio:
        raise RuntimeError("Qwen TTS returned no audio output")

    audio_data = _qwen_tts_audio_field(audio, "data")
    if audio_data:
        media_type = _qwen_tts_media_type(settings.dashscope_tts_format)
        audio_bytes = _decode_qwen_tts_audio_data(audio_data)
        return _result_with_cached_audio(
            audio_bytes,
            media_type,
            timestamps=_estimate_timestamps_from_audio(text, audio_bytes, media_type),
        )

    audio_url = _qwen_tts_audio_field(audio, "url")
    if audio_url:
        audio_bytes, media_type = fetch_remote_audio(audio_url)
        return _result_with_cached_audio(
            audio_bytes,
            media_type,
            timestamps=_estimate_timestamps_from_audio(text, audio_bytes, media_type),
        )
    raise RuntimeError("Qwen TTS returned neither audio data nor audio url")


def _synthesize_speech_with_sdk(text: str) -> TtsSynthesisResult:
    try:
        import dashscope
        from dashscope.audio.tts_v2 import ResultCallback, SpeechSynthesizer
    except ImportError as exc:
        raise RuntimeError("DashScope SDK is not installed") from exc

    settings = get_settings()
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")

    class TimestampCallback(ResultCallback):
        def __init__(self) -> None:
            self.audio_chunks: list[bytes] = []
            self.timestamps: list[TtsTimestampResult] = []
            self.error_message = ""

        def on_data(self, data: bytes) -> None:
            self.audio_chunks.append(data)

        def on_event(self, message) -> None:
            payload = getattr(message, "payload", message)
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    return
            if not isinstance(payload, dict):
                return
            self.timestamps.extend(_normalize_word_timestamps(payload))

        def on_error(self, message) -> None:
            self.error_message = str(message)

    callback = TimestampCallback()
    audio_format = _sdk_audio_format(settings.dashscope_tts_format, settings.dashscope_tts_sample_rate)
    dashscope.api_key = settings.dashscope_api_key
    synthesizer = SpeechSynthesizer(
        model=settings.dashscope_tts_model,
        voice=settings.dashscope_tts_voice,
        format=audio_format,
        callback=callback,
        url=settings.dashscope_tts_ws_url,
        additional_params={"word_timestamp_enabled": True},
    )
    synthesizer.streaming_call(text.strip())
    synthesizer.streaming_complete(60000)

    audio_bytes = b"".join(callback.audio_chunks)
    if callback.error_message:
        raise RuntimeError(f"SpeechSynthesizer SDK error: {callback.error_message[:500]}")
    if not audio_bytes:
        raise RuntimeError("SpeechSynthesizer returned empty audio data")
    return _result_with_cached_audio(audio_bytes, "audio/mpeg", timestamps=callback.timestamps)


def _synthesize_speech_with_http(text: str) -> TtsSynthesisResult:
    settings = get_settings()
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")

    payload = {
        "model": settings.dashscope_tts_model,
        "input": {
            "text": text.strip(),
            "voice": settings.dashscope_tts_voice,
            "format": settings.dashscope_tts_format,
            "sample_rate": settings.dashscope_tts_sample_rate,
            "word_timestamp_enabled": True,
        },
    }
    request = urllib.request.Request(
        settings.dashscope_tts_api_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.dashscope_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
        audio_url = data["output"]["audio"]["url"]
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"SpeechSynthesizer HTTP {exc.code}: {detail[:500]}") from exc
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
        raise RuntimeError("SpeechSynthesizer request failed") from exc

    if not audio_url:
        raise RuntimeError("SpeechSynthesizer returned an empty audio URL")
    audio_bytes, media_type = fetch_remote_audio(audio_url)
    return _result_with_cached_audio(audio_bytes, media_type, timestamps=_normalize_word_timestamps(data))


def _gpt_sovits_media_type(format_name: str) -> str:
    normalized = format_name.strip().lower()
    if normalized == "mp3":
        return "audio/mpeg"
    if normalized == "ogg":
        return "audio/ogg"
    if normalized == "aac":
        return "audio/aac"
    return "audio/wav"


def _synthesize_speech_with_gpt_sovits(text: str) -> TtsSynthesisResult:
    settings = get_settings()
    api_url = settings.gpt_sovits_api_url.rstrip("/")
    if not api_url:
        raise RuntimeError("GPT_SOVITS_API_URL is not configured")
    if not settings.gpt_sovits_ref_audio_path or not settings.gpt_sovits_prompt_text:
        raise RuntimeError("GPT-SoVITS reference audio and prompt text are required")

    payload = {
        "text": text.strip(),
        "text_lang": settings.gpt_sovits_text_lang,
        "ref_audio_path": settings.gpt_sovits_ref_audio_path,
        "prompt_text": settings.gpt_sovits_prompt_text,
        "prompt_lang": settings.gpt_sovits_prompt_lang,
        "media_type": settings.gpt_sovits_media_type,
        "streaming_mode": False,
    }
    headers = {"Content-Type": "application/json"}
    if settings.gpt_sovits_api_key:
        headers["Authorization"] = f"Bearer {settings.gpt_sovits_api_key}"
    request = urllib.request.Request(
        f"{api_url}/tts",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings.gpt_sovits_timeout_seconds) as response:
            audio_bytes = response.read()
            media_type = response.headers.get_content_type() or _gpt_sovits_media_type(settings.gpt_sovits_media_type)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GPT-SoVITS HTTP {exc.code}: {detail[:500]}") from exc
    except (TimeoutError, urllib.error.URLError) as exc:
        raise RuntimeError("GPT-SoVITS request failed") from exc

    if not audio_bytes:
        raise RuntimeError("GPT-SoVITS returned empty audio data")
    return _result_with_cached_audio(
        audio_bytes,
        media_type,
        timestamps=_estimate_timestamps_from_audio(text, audio_bytes, media_type),
        provider="gpt_sovits",
    )


def _synthesize_speech_with_dashscope(text: str) -> TtsSynthesisResult:
    settings = get_settings()
    if _is_qwen_tts_model(settings.dashscope_tts_model):
        return _synthesize_speech_with_qwen_tts(text)
    try:
        return _synthesize_speech_with_sdk(text)
    except RuntimeError:
        return _synthesize_speech_with_http(text)


def synthesize_speech(text: str) -> TtsSynthesisResult:
    settings = get_settings()
    if settings.tts_provider.strip().lower() == "gpt_sovits":
        try:
            return _synthesize_speech_with_gpt_sovits(text)
        except RuntimeError:
            return _synthesize_speech_with_dashscope(text)
    return _synthesize_speech_with_dashscope(text)
