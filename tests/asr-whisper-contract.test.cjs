const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

assert(exists("src/backend/app/api/asr.py"), "ASR API router should exist");
assert(exists("src/backend/app/schemas/asr.py"), "ASR schemas should exist");
assert(exists("src/backend/app/services/asr_service.py"), "Whisper ASR service should exist");

const main = read("src/backend/app/main.py");
assert(main.includes("asr"), "backend should import the ASR router");
assert(main.includes("app.include_router(asr.router)"), "backend should expose ASR router");

const config = read("src/backend/app/core/config.py");
assert(config.includes('whisper_model: str = "base"'), "Whisper should default to the base model");
assert(config.includes("whisper_max_audio_mb"), "settings should cap ASR upload size");
assert(config.includes("whisper_language"), "settings should expose ASR language configuration");

const envExample = read("src/backend/.env.example");
assert(envExample.includes("WHISPER_MODEL=base"), ".env.example should document the default Whisper model");
assert(envExample.includes("WHISPER_LANGUAGE=Chinese"), ".env.example should document the ASR language");
assert(envExample.includes("WHISPER_MAX_AUDIO_MB="), ".env.example should document ASR upload size limit");

const asrRouter = read("src/backend/app/api/asr.py");
assert(asrRouter.includes('@router.post("/asr"'), "ASR router should expose POST /api/asr");
assert(asrRouter.includes("UploadFile"), "ASR router should accept uploaded browser audio");
assert(asrRouter.includes("File("), "ASR router should use multipart file uploads");
assert(asrRouter.includes("content_type"), "ASR router should validate uploaded audio type");
assert(asrRouter.includes("whisper_max_audio_mb"), "ASR router should enforce upload size limits");
assert(asrRouter.includes("transcribe_audio"), "ASR router should call the Whisper transcription service");
assert(asrRouter.includes("status_code=413"), "ASR router should reject oversized audio");
assert(asrRouter.includes("status_code=502"), "ASR router should report unavailable local Whisper runtime");

const asrService = read("src/backend/app/services/asr_service.py");
assert(asrService.includes("whisper.load_model"), "ASR service should load openai/whisper locally");
assert(asrService.includes("@lru_cache"), "ASR service should cache the Whisper model");
assert(asrService.includes("settings.whisper_model"), "ASR service should use the configured Whisper model");
assert(asrService.includes("model.transcribe"), "ASR service should transcribe local audio files");
assert(asrService.includes("fp16"), "ASR service should avoid CPU fp16 transcription issues");
assert(asrService.includes("imageio_ffmpeg"), "ASR service should support packaged FFmpeg fallback on Windows");
assert(asrService.includes("shutil.which(\"ffmpeg\")"), "ASR service should check for FFmpeg before transcription");
assert(asrService.includes("ffmpeg.exe"), "ASR service should expose packaged FFmpeg under the command name Whisper expects");
assert(asrService.includes("shutil.copy2"), "ASR service should create a stable FFmpeg command shim when needed");

const asrSchema = read("src/backend/app/schemas/asr.py");
assert(asrSchema.includes("AsrResponse"), "ASR schema should expose a response model");
assert(asrSchema.includes("provider: str = \"whisper\""), "ASR response should identify Whisper as provider");
assert(asrSchema.includes("model: str"), "ASR response should include the model name");

const requirements = read("requirements.txt");
assert(requirements.includes("openai-whisper"), "requirements should include openai-whisper");
assert(requirements.includes("python-multipart"), "requirements should include python-multipart for UploadFile form data");
assert(requirements.includes("imageio-ffmpeg"), "requirements should include packaged FFmpeg fallback");

const html = read("src/frontend/tourist.html");
assert(html.includes("voiceInputButton"), "tourist page should include a voice input button");
assert(!html.includes("speechToggle"), "voice input should not reintroduce a speech output toggle");

const script = read("src/frontend/scripts/tourist-live2d.js");
assert(script.includes("voiceInputButton"), "tourist script should bind the voice input button");
assert(script.includes("navigator.mediaDevices.getUserMedia"), "tourist script should request microphone access");
assert(script.includes("MediaRecorder"), "tourist script should record browser microphone audio");
assert(script.includes("FormData"), "tourist script should upload recorded audio as multipart form data");
assert(script.includes("/api/asr"), "tourist script should call the ASR endpoint");
assert(script.includes("submitVoiceRecording"), "tourist script should isolate ASR upload logic");
assert(script.includes("VOICE_RECORDING_MAX_SECONDS"), "voice input should cap recording length for a cleaner kiosk experience");
assert(script.includes("formatRecordingDuration"), "voice input should show recording duration feedback");
assert(script.includes("scheduleVoiceRecordingLimit"), "voice input should automatically stop long recordings");
assert(script.includes("answerQuestion(transcript)"), "recognized speech should enter the existing guide chat flow");

const backendReadme = read("src/backend/README.md");
assert(backendReadme.includes("POST /api/asr"), "backend README should document ASR endpoint");
assert(backendReadme.includes("Whisper"), "backend README should mention local Whisper ASR");

const projectReadme = read("README.md");
assert(projectReadme.includes("Whisper 语音输入"), "project README should list Whisper voice input as implemented");
assert(!projectReadme.includes("ASR 语音输入。"), "project README should not list ASR as unimplemented");

console.log("Whisper ASR contract passed");
