import sys
import types
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "src" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import tts_service


class FakeQwenSpeechSynthesizer:
    @staticmethod
    def call(**kwargs):
        return SimpleNamespace(
            status_code=200,
            code="",
            message="",
            output=SimpleNamespace(
                audio={
                    "data": "",
                    "url": "https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com/demo.wav",
                    "id": "audio-demo",
                    "expires_at": 1782583489,
                }
            ),
        )


fake_dashscope = types.ModuleType("dashscope")
fake_qwen_tts = types.ModuleType("dashscope.audio.qwen_tts")
fake_qwen_tts.SpeechSynthesizer = FakeQwenSpeechSynthesizer
sys.modules["dashscope"] = fake_dashscope
sys.modules["dashscope.audio.qwen_tts"] = fake_qwen_tts

tts_service.get_settings = lambda: SimpleNamespace(
    dashscope_api_key="test-key",
    dashscope_tts_model="qwen-tts",
    dashscope_tts_voice="Cherry",
    dashscope_tts_format="mp3",
)

result = tts_service._synthesize_speech_with_qwen_tts("测试一下语音合成")

assert result.audio_id is None, "URL-based qwen-tts responses should not create a cached audio id"
assert (
    result.audio_url == "https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com/demo.wav"
), "qwen-tts should return the remote audio URL when the SDK response stores audio as a dict"
assert result.timestamps == [], "URL-based qwen-tts responses should keep empty timestamps"

print("Qwen TTS response shape contract passed")
