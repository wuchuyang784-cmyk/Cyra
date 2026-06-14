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
assert(envExample.includes("GPT_SOVITS_API_URL="), ".env.example should document the GPT-SoVITS API URL");
assert(envExample.includes("GPT_SOVITS_REF_AUDIO_PATH="), ".env.example should document the GPT-SoVITS reference audio path");
assert(envExample.includes("GPT_SOVITS_PROMPT_TEXT="), ".env.example should document the GPT-SoVITS prompt text");

const ttsService = read("src/backend/app/services/tts_service.py");
assert(ttsService.includes("def _synthesize_speech_with_gpt_sovits"), "TTS service should support GPT-SoVITS");
assert(ttsService.includes('settings.tts_provider.strip().lower() == "gpt_sovits"'), "TTS service should select GPT-SoVITS by provider config");
assert(ttsService.includes('f"{api_url}/tts"'), "GPT-SoVITS provider should call the /tts endpoint");
assert(ttsService.includes('"ref_audio_path"'), "GPT-SoVITS request should include the reference audio path");
assert(ttsService.includes('"prompt_text"'), "GPT-SoVITS request should include prompt text");
assert(ttsService.includes('"text_lang"'), "GPT-SoVITS request should include text language");
assert(ttsService.includes('"streaming_mode": False'), "Cyra should request non-streaming audio bytes from GPT-SoVITS");
assert(ttsService.includes("get_cached_audio_media_type"), "cached TTS audio should preserve the synthesized media type");

const ttsRouter = read("src/backend/app/api/tts.py");
assert(ttsRouter.includes("get_cached_audio_media_type"), "TTS router should serve cached audio with its media type");

console.log("GPT-SoVITS TTS contract passed");
