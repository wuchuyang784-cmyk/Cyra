const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

const service = read("src/backend/app/services/arkit_expression_service.py");
assert(service.includes("ARKIT_FACE_CHANNELS"), "ARKit expression service should define the 52 ARKit channels");
assert(service.includes("def generate_arkit_expression_clip"), "ARKit expression service should expose a clip generator");
assert(service.includes("def generate_lam_expression_clip"), "ARKit expression service should call the LAM audio2expression service");
assert(service.includes("lam_expression_api_url"), "ARKit expression service should use the configured LAM expression API URL");
assert(service.includes("jawOpen"), "ARKit expression output should include jawOpen for mouth opening");
assert(service.includes("mouthFunnel"), "ARKit expression output should include mouthFunnel for rounded vowels");
assert(service.includes("mouthSmileLeft"), "ARKit expression output should include mouthSmileLeft for natural speech shape");
assert(service.includes("len(ARKIT_FACE_CHANNELS) == 52"), "ARKit channel list should be guarded at 52 dimensions");

const config = read("src/backend/app/core/config.py");
assert(config.includes("lam_expression_api_url"), "settings should expose the LAM expression service URL");
assert(config.includes("lam_expression_timeout_seconds"), "settings should expose the LAM expression service timeout");

const envExample = read("src/backend/.env.example");
assert(envExample.includes("LAM_EXPRESSION_API_URL="), ".env.example should document the LAM expression service URL");

const schemas = read("src/backend/app/schemas/tts.py");
assert(schemas.includes("class ArkitExpressionFrame"), "TTS schema should include ARKit expression frames");
assert(schemas.includes("arkit_expressions"), "TTS response should carry optional ARKit expression clips");

const ttsService = read("src/backend/app/services/tts_service.py");
assert(ttsService.includes("ArkitExpressionClipResult"), "TTS service should carry optional ARKit expression clips");
assert(ttsService.includes("generate_lam_expression_clip"), "TTS service should prefer LAM expression clips from cached audio");
assert(ttsService.includes("generate_arkit_expression_clip"), "TTS service should keep the local ARKit generator as a fallback");
assert(ttsService.includes("fetch_remote_audio"), "Qwen TTS URL responses should be downloaded and cached for expression generation");

const ttsApi = read("src/backend/app/api/tts.py");
assert(ttsApi.includes("ArkitExpressionFrame"), "TTS API should serialize ARKit expression frames");
assert(ttsApi.includes("arkit_expressions="), "TTS API response should include ARKit expression clips");

const frontend = read("src/frontend/scripts/tourist-live2d.js");
assert(frontend.includes("arkitExpressions"), "frontend should read ARKit expression clips from TTS responses");
assert(frontend.includes("buildArkitExpressionLipSyncClip"), "frontend should convert ARKit expression frames into a lip-sync clip");
assert(frontend.includes("readArkitExpressionMouthState"), "frontend should sample ARKit expressions during playback");
assert(frontend.includes("activeLipSyncClip?.arkitFrames"), "frontend should prefer ARKit expression clips when available");
assert(frontend.includes("readActiveLipSyncPosition"), "frontend should use one shared playback clock for lip-sync sampling");
assert(frontend.includes("outputLatency"), "frontend should compensate browser audio output latency");
assert(frontend.includes("LIP_SYNC_OFFSET_STORAGE_KEY"), "frontend should expose a local lip-sync offset tuning hook");

console.log("ARKit expression contract passed");
