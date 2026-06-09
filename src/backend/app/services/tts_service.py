import json
import time
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.core.config import get_settings


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


_AUDIO_CACHE: dict[str, tuple[bytes, float]] = {}
_AUDIO_CACHE_TTL_SECONDS = 600


def _cleanup_audio_cache() -> None:
    now = time.time()
    expired = [audio_id for audio_id, (_, expires_at) in _AUDIO_CACHE.items() if expires_at <= now]
    for audio_id in expired:
        _AUDIO_CACHE.pop(audio_id, None)


def cache_audio(audio_bytes: bytes) -> str:
    _cleanup_audio_cache()
    audio_id = uuid.uuid4().hex
    _AUDIO_CACHE[audio_id] = (audio_bytes, time.time() + _AUDIO_CACHE_TTL_SECONDS)
    return audio_id


def get_cached_audio(audio_id: str) -> bytes | None:
    _cleanup_audio_cache()
    item = _AUDIO_CACHE.get(audio_id)
    if not item:
        return None
    return item[0]


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
    return TtsSynthesisResult(audio_url=None, audio_id=cache_audio(audio_bytes), timestamps=callback.timestamps)


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
    return TtsSynthesisResult(audio_url=audio_url, audio_id=None, timestamps=_normalize_word_timestamps(data))


def synthesize_speech(text: str) -> TtsSynthesisResult:
    try:
        return _synthesize_speech_with_sdk(text)
    except RuntimeError:
        return _synthesize_speech_with_http(text)
