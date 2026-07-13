const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

const config = read("src/backend/app/core/config.py");
assert(config.includes("tts_provider"), "settings should expose a selectable TTS provider");
assert(config.includes("gpt_sovits_api_url"), "settings should expose the GPT-SoVITS API URL");
assert(config.includes("gpt_sovits_api_key"), "settings should support an optional GPT-SoVITS API key");
assert(config.includes("gpt_sovits_ref_audio_path"), "settings should expose the GPT-SoVITS reference audio path");
assert(config.includes("gpt_sovits_prompt_text"), "settings should expose the GPT-SoVITS prompt text");
assert(config.includes("gpt_sovits_prompt_lang"), "settings should expose the GPT-SoVITS prompt language");
assert(config.includes("gpt_sovits_text_lang"), "settings should expose the GPT-SoVITS text language");
assert(config.includes("gpt_sovits_media_type"), "settings should expose the GPT-SoVITS output media type");

const envExample = read("src/backend/.env.example");
assert(envExample.includes("TTS_PROVIDER=dashscope"), ".env.example should document the default TTS provider");
assert(envExample.includes("DASHSCOPE_TTS_VOICE=longanyang"), ".env.example should use a verified DashScope fallback voice");
assert(envExample.includes("GPT_SOVITS_API_URL="), ".env.example should document the GPT-SoVITS API URL");
assert(envExample.includes("GPT_SOVITS_REF_AUDIO_PATH="), ".env.example should document the GPT-SoVITS reference audio path");
assert(envExample.includes("GPT_SOVITS_PROMPT_TEXT="), ".env.example should document the GPT-SoVITS prompt text");

const ttsService = read("src/backend/app/services/tts_service.py");
assert(ttsService.includes("def _synthesize_speech_with_gpt_sovits"), "TTS service should support GPT-SoVITS");
assert(ttsService.includes('settings.tts_provider.strip().lower() == "gpt_sovits"'), "TTS service should select GPT-SoVITS by provider config");
assert(ttsService.includes("def _synthesize_speech_with_dashscope"), "TTS service should expose DashScope as a reusable fallback provider");
assert(ttsService.includes("return _synthesize_speech_with_dashscope(text)"), "TTS service should call DashScope through the shared fallback helper");
assert(
  ttsService.includes("except RuntimeError") && ttsService.includes("_synthesize_speech_with_dashscope(text)"),
  "GPT-SoVITS failures should automatically fall back to DashScope TTS",
);
assert(ttsService.includes("def _is_qwen_tts_model"), "TTS service should detect Qwen TTS models");
assert(ttsService.includes("def _synthesize_speech_with_qwen_tts"), "TTS service should call the Qwen TTS SDK path for qwen-tts models");
assert(ttsService.includes("from dashscope.audio.qwen_tts import SpeechSynthesizer as QwenSpeechSynthesizer"), "Qwen TTS should not use the CosyVoice WebSocket SpeechSynthesizer");
assert(ttsService.includes("_is_qwen_tts_model(settings.dashscope_tts_model)"), "DashScope TTS dispatch should route qwen-tts models before CosyVoice fallback");
assert(ttsService.includes("timestamps=_estimate_timestamps_from_audio(text, audio_bytes, media_type)"), "Qwen TTS should estimate timestamps from returned audio bytes for lip sync");
assert(ttsService.includes('f"{api_url}/tts"'), "GPT-SoVITS provider should call the /tts endpoint");
assert(ttsService.includes("_QWEN_TTS_SUPPORTED_VOICES"), "Qwen TTS should document the currently supported voice whitelist");
assert(ttsService.includes("def _validate_qwen_tts_voice"), "Qwen TTS should validate unsupported voice names before sending the request");
assert(ttsService.includes('"ref_audio_path"'), "GPT-SoVITS request should include the reference audio path");
assert(ttsService.includes('"prompt_text"'), "GPT-SoVITS request should include prompt text");
assert(ttsService.includes('"text_lang"'), "GPT-SoVITS request should include text language");
assert(ttsService.includes('"streaming_mode": False'), "Cyra should request non-streaming audio bytes from GPT-SoVITS");
assert(ttsService.includes("get_cached_audio_media_type"), "cached TTS audio should preserve the synthesized media type");
assert(ttsService.includes("def _estimate_timestamps_from_audio"), "GPT-SoVITS audio should get estimated timestamps for lip sync");
assert(
  ttsService.includes("timestamps=_estimate_timestamps_from_audio(text, audio_bytes, media_type)"),
  "GPT-SoVITS should return non-empty estimated timestamps instead of forcing the frontend into audio-energy fallback",
);
{
  const gptSovitsStart = ttsService.indexOf("def _synthesize_speech_with_gpt_sovits");
  const gptSovitsEnd = ttsService.indexOf("def _synthesize_speech_with_dashscope", gptSovitsStart);
  assert(gptSovitsStart !== -1 && gptSovitsEnd !== -1, "GPT-SoVITS synthesis function should be present");
  const gptSovitsSource = ttsService.slice(gptSovitsStart, gptSovitsEnd);
  assert(!gptSovitsSource.includes("timestamps=[]"), "GPT-SoVITS should not return empty timestamps");
}

const ttsRouter = read("src/backend/app/api/tts.py");
assert(ttsRouter.includes("get_cached_audio_media_type"), "TTS router should serve cached audio with its media type");

console.log("GPT-SoVITS TTS contract passed");
