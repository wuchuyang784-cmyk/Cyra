import json
from types import SimpleNamespace

from app.services import arkit_expression_service


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        values = {channel: 0.0 for channel in arkit_expression_service.ARKIT_FACE_CHANNELS}
        values["jawOpen"] = 0.42
        values["mouthFunnel"] = 0.2
        payload = {
            "frame_rate": 30,
            "channels": arkit_expression_service.ARKIT_FACE_CHANNELS,
            "frames": [
                {"time_ms": 0, "values": values},
                {"time_ms": 33, "values": values},
            ],
        }
        return json.dumps(payload).encode("utf-8")


arkit_expression_service.get_settings = lambda: SimpleNamespace(
    lam_expression_api_url="http://127.0.0.1:8091/api/lam/audio2expression",
    lam_expression_timeout_seconds=3,
)
arkit_expression_service.urllib.request.urlopen = lambda request, timeout: FakeResponse()

clip = arkit_expression_service.generate_lam_expression_clip(b"fake-audio", "audio/wav")

assert clip.frame_rate == 30
assert len(clip.channels) == 52
assert len(clip.frames) == 2
assert clip.frames[0].values["jawOpen"] == 0.42
assert clip.frames[0].values["mouthFunnel"] == 0.2

print("LAM expression service contract passed")
