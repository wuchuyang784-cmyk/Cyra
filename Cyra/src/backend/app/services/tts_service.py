import json
import uuid

import websockets
from fastapi import HTTPException

from app.core.config import Settings
from app.services.aliyun_nls import get_nls_token, nls_command, nls_url


class TtsService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def synthesize(self, text: str) -> tuple[bytes, str]:
        if self.settings.mock_ai:
            return _mock_wav(), "audio/wav"

        task_id = uuid.uuid4().hex
        audio = bytearray()
        token = await get_nls_token(self.settings)
        async with websockets.connect(nls_url(self.settings, token), max_size=16 * 1024 * 1024) as nls:
            await nls.send(
                nls_command(
                    "SpeechSynthesizer",
                    "StartSynthesis",
                    self.settings.aliyun_nls_app_key,
                    task_id,
                    {
                        "text": text,
                        "voice": self.settings.tts_voice,
                        "format": self.settings.tts_format,
                        "sample_rate": self.settings.tts_sample_rate,
                        "volume": 50,
                        "speech_rate": 0,
                        "pitch_rate": 0,
                    },
                )
            )
            async for raw in nls:
                if isinstance(raw, bytes):
                    audio.extend(raw)
                    continue
                data = json.loads(raw)
                name = data.get("header", {}).get("name")
                if name == "SynthesisCompleted":
                    break
                if name and name.endswith("Failed"):
                    raise HTTPException(status_code=502, detail=data.get("header", {}).get("status_text", "TTS failed"))

        content_type = "audio/mpeg" if self.settings.tts_format == "mp3" else f"audio/{self.settings.tts_format}"
        return bytes(audio), content_type


def _mock_wav() -> bytes:
    sample_rate = 16000
    duration = 0.25
    samples = int(sample_rate * duration)
    data_size = samples * 2
    header = bytearray()
    header.extend(b"RIFF")
    header.extend((36 + data_size).to_bytes(4, "little"))
    header.extend(b"WAVEfmt ")
    header.extend((16).to_bytes(4, "little"))
    header.extend((1).to_bytes(2, "little"))
    header.extend((1).to_bytes(2, "little"))
    header.extend(sample_rate.to_bytes(4, "little"))
    header.extend((sample_rate * 2).to_bytes(4, "little"))
    header.extend((2).to_bytes(2, "little"))
    header.extend((16).to_bytes(2, "little"))
    header.extend(b"data")
    header.extend(data_size.to_bytes(4, "little"))
    header.extend(b"\x00\x00" * samples)
    return bytes(header)
