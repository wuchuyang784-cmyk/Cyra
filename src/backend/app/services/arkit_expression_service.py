import audioop
import base64
import json
import math
import urllib.error
import urllib.request
import wave
from dataclasses import dataclass
from io import BytesIO

from app.core.config import get_settings


ARKIT_FACE_CHANNELS = [
    "browDownLeft",
    "browDownRight",
    "browInnerUp",
    "browOuterUpLeft",
    "browOuterUpRight",
    "cheekPuff",
    "cheekSquintLeft",
    "cheekSquintRight",
    "eyeBlinkLeft",
    "eyeBlinkRight",
    "eyeLookDownLeft",
    "eyeLookDownRight",
    "eyeLookInLeft",
    "eyeLookInRight",
    "eyeLookOutLeft",
    "eyeLookOutRight",
    "eyeLookUpLeft",
    "eyeLookUpRight",
    "eyeSquintLeft",
    "eyeSquintRight",
    "eyeWideLeft",
    "eyeWideRight",
    "jawForward",
    "jawLeft",
    "jawOpen",
    "jawRight",
    "mouthClose",
    "mouthDimpleLeft",
    "mouthDimpleRight",
    "mouthFrownLeft",
    "mouthFrownRight",
    "mouthFunnel",
    "mouthLeft",
    "mouthLowerDownLeft",
    "mouthLowerDownRight",
    "mouthPressLeft",
    "mouthPressRight",
    "mouthPucker",
    "mouthRight",
    "mouthRollLower",
    "mouthRollUpper",
    "mouthShrugLower",
    "mouthShrugUpper",
    "mouthSmileLeft",
    "mouthSmileRight",
    "mouthStretchLeft",
    "mouthStretchRight",
    "mouthUpperUpLeft",
    "mouthUpperUpRight",
    "noseSneerLeft",
    "noseSneerRight",
    "tongueOut",
]

assert len(ARKIT_FACE_CHANNELS) == 52


@dataclass(frozen=True)
class ArkitExpressionFrameResult:
    time_ms: int
    values: dict[str, float]


@dataclass(frozen=True)
class ArkitExpressionClipResult:
    frame_rate: int
    channels: list[str]
    frames: list[ArkitExpressionFrameResult]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _decode_wav_samples(audio_bytes: bytes) -> tuple[list[float], int] | None:
    try:
        with wave.open(BytesIO(audio_bytes), "rb") as audio_file:
            channels = audio_file.getnchannels()
            sample_width = audio_file.getsampwidth()
            sample_rate = audio_file.getframerate()
            raw = audio_file.readframes(audio_file.getnframes())
    except (wave.Error, EOFError):
        return None

    if sample_width not in {1, 2, 4} or channels < 1 or sample_rate <= 0:
        return None

    mono = audioop.tomono(raw, sample_width, 0.5, 0.5) if channels > 1 else raw
    samples: list[float] = []
    max_value = float(1 << (sample_width * 8 - 1))
    for index in range(0, len(mono), sample_width):
        chunk = mono[index : index + sample_width]
        if len(chunk) != sample_width:
            continue
        value = int.from_bytes(chunk, byteorder="little", signed=sample_width > 1)
        if sample_width == 1:
            value -= 128
        samples.append(value / max_value)
    return samples, sample_rate


def _fallback_energy_series(audio_bytes: bytes, frame_rate: int) -> tuple[list[float], int]:
    pseudo_duration_seconds = max(0.7, min(30.0, len(audio_bytes) / 16000))
    frame_count = max(1, int(math.ceil(pseudo_duration_seconds * frame_rate)))
    values = []
    for index in range(frame_count):
        phase = index / max(1, frame_count - 1)
        pulse = abs(math.sin(phase * math.pi * frame_count / 3.0))
        values.append(0.25 + pulse * 0.45)
    return values, frame_count


def _audio_energy_series(audio_bytes: bytes, frame_rate: int) -> tuple[list[float], int]:
    decoded = _decode_wav_samples(audio_bytes)
    if decoded is None:
        return _fallback_energy_series(audio_bytes, frame_rate)

    samples, sample_rate = decoded
    samples_per_frame = max(1, int(sample_rate / frame_rate))
    frame_count = max(1, math.ceil(len(samples) / samples_per_frame))
    raw_values: list[float] = []
    for frame_index in range(frame_count):
        start = frame_index * samples_per_frame
        end = min(len(samples), start + samples_per_frame)
        frame = samples[start:end]
        if not frame:
            raw_values.append(0.0)
            continue
        rms = math.sqrt(sum(sample * sample for sample in frame) / len(frame))
        raw_values.append(rms)

    sorted_values = sorted(raw_values)
    peak = sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * 0.92))] or 0.001
    noise_floor = min(0.012, peak * 0.35)
    scale = max(0.018, peak - noise_floor)
    smoothed = 0.0
    values: list[float] = []
    for raw in raw_values:
        normalized = _clamp01((raw - noise_floor) / scale)
        target = math.pow(normalized, 0.62)
        smoothing = 0.72 if target > smoothed else 0.34
        smoothed += (target - smoothed) * smoothing
        values.append(0.0 if smoothed < 0.035 else smoothed)
    return values, frame_count


def _expression_values(energy: float, index: int, frame_rate: int) -> dict[str, float]:
    open_value = _clamp01(energy * 0.92)
    rounded = _clamp01(open_value * (0.35 + 0.35 * abs(math.sin(index * 0.31))))
    smile = _clamp01(0.08 + open_value * 0.18)
    stretch = _clamp01(open_value * (0.25 + 0.2 * abs(math.sin(index * 0.19))))
    values = {channel: 0.0 for channel in ARKIT_FACE_CHANNELS}
    values["jawOpen"] = open_value
    values["mouthFunnel"] = rounded
    values["mouthPucker"] = rounded * 0.72
    values["mouthClose"] = _clamp01((1.0 - open_value) * 0.18)
    values["mouthSmileLeft"] = smile
    values["mouthSmileRight"] = smile
    values["mouthStretchLeft"] = stretch
    values["mouthStretchRight"] = stretch
    values["mouthLowerDownLeft"] = open_value * 0.46
    values["mouthLowerDownRight"] = open_value * 0.46
    values["mouthUpperUpLeft"] = open_value * 0.22
    values["mouthUpperUpRight"] = open_value * 0.22
    values["jawForward"] = open_value * 0.06
    values["browInnerUp"] = 0.03 + 0.02 * math.sin(index / max(1, frame_rate) * math.pi * 2)
    return values


def _coerce_channel_names(channels: object) -> list[str]:
    if isinstance(channels, list):
        names = [str(channel) for channel in channels if str(channel)]
        if len(names) == 52:
            return names
    return ARKIT_FACE_CHANNELS.copy()


def _frame_from_values(time_ms: int, values: object, channels: list[str]) -> ArkitExpressionFrameResult | None:
    if isinstance(values, dict):
        return ArkitExpressionFrameResult(
            time_ms=time_ms,
            values={channel: _clamp01(float(values.get(channel, 0.0) or 0.0)) for channel in channels},
        )
    if isinstance(values, list):
        if len(values) != len(channels):
            return None
        return ArkitExpressionFrameResult(
            time_ms=time_ms,
            values={channel: _clamp01(float(value or 0.0)) for channel, value in zip(channels, values)},
        )
    return None


def _clip_from_lam_payload(payload: dict) -> ArkitExpressionClipResult:
    frame_rate = int(payload.get("frame_rate") or payload.get("sample_rate") or 30)
    channels = _coerce_channel_names(payload.get("channels") or payload.get("channel_names"))
    raw_frames = payload.get("frames")
    frames: list[ArkitExpressionFrameResult] = []

    if isinstance(raw_frames, list):
        for index, frame in enumerate(raw_frames):
            if isinstance(frame, dict):
                time_ms = int(frame.get("time_ms") if frame.get("time_ms") is not None else round(index * 1000 / frame_rate))
                values = frame.get("values", frame)
            else:
                time_ms = round(index * 1000 / frame_rate)
                values = frame
            parsed = _frame_from_values(time_ms, values, channels)
            if parsed is not None:
                frames.append(parsed)

    if not frames:
        arkit_face = payload.get("arkit_face") or payload.get("expression")
        if isinstance(arkit_face, list):
            for index, values in enumerate(arkit_face):
                parsed = _frame_from_values(round(index * 1000 / frame_rate), values, channels)
                if parsed is not None:
                    frames.append(parsed)

    if not frames:
        raise RuntimeError("LAM expression response did not include ARKit frames")
    return ArkitExpressionClipResult(frame_rate=frame_rate, channels=channels, frames=frames)


def generate_lam_expression_clip(audio_bytes: bytes, media_type: str = "audio/wav") -> ArkitExpressionClipResult:
    settings = get_settings()
    api_url = settings.lam_expression_api_url.strip()
    if not api_url:
        raise RuntimeError("LAM expression service is not configured")
    if not audio_bytes:
        raise RuntimeError("LAM expression service requires audio bytes")

    payload = {
        "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
        "media_type": media_type,
        "target_frame_rate": 30,
    }
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.lam_expression_timeout_seconds) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except (TimeoutError, urllib.error.URLError, json.JSONDecodeError) as exc:
        raise RuntimeError("LAM expression service is unavailable") from exc
    if not isinstance(response_payload, dict):
        raise RuntimeError("LAM expression response must be a JSON object")
    return _clip_from_lam_payload(response_payload)


def generate_arkit_expression_clip(
    audio_bytes: bytes,
    media_type: str = "audio/wav",
    frame_rate: int = 30,
) -> ArkitExpressionClipResult:
    if not audio_bytes:
        return ArkitExpressionClipResult(frame_rate=frame_rate, channels=ARKIT_FACE_CHANNELS.copy(), frames=[])

    energy_values, frame_count = _audio_energy_series(audio_bytes, frame_rate)
    frames = [
        ArkitExpressionFrameResult(
            time_ms=round(index * 1000 / frame_rate),
            values=_expression_values(energy_values[min(index, len(energy_values) - 1)], index, frame_rate),
        )
        for index in range(frame_count)
    ]
    return ArkitExpressionClipResult(frame_rate=frame_rate, channels=ARKIT_FACE_CHANNELS.copy(), frames=frames)
