const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

const docs = [
  "README.md",
  "src/backend/README.md",
  "src/frontend/README.md",
  "docs/项目技术说明-当前版本.md",
].map(read).join("\n");

for (const stale of [
  "src/frontend/index.html",
  "scripts/app.js",
  "scripts/api-client.js",
  "scripts/audio-recorder.js",
  "scripts/avatar-controller.js",
  "scripts/lip-sync.js",
  "styles/xuanzang-avatar.css",
  "api/knowledge.py",
  "services/chat_service.py",
  "services/aliyun_nls.py",
  "services/expression.py",
  "FastAPI 后端只提供管理后台数据接口",
]) {
  assert(!docs.includes(stale), `docs should not reference missing file ${stale}`);
}

assert(docs.includes("tourist.html"), "docs should mention current tourist page");
assert(docs.includes("tourist-live2d.js"), "docs should mention current tourist script");
assert(docs.includes("/api/chat/stream"), "docs should mention current streaming chat endpoint");
assert(docs.includes("/api/asr"), "docs should mention current ASR endpoint");
assert(docs.includes("/api/tts"), "docs should mention current TTS endpoint");
assert(docs.includes("/api/tts/audio"), "docs should mention current TTS audio proxy endpoint");
assert(docs.includes("Live2D"), "docs should describe current Live2D frontend");
assert(docs.includes("Whisper"), "docs should describe current Whisper ASR path");
assert(docs.includes("CosyVoice"), "docs should describe current CosyVoice TTS path");
assert(docs.includes("字级时间戳"), "docs should describe current timestamp-driven lip sync");
assert(docs.includes("ParamA/I/U/E/O"), "docs should mention Mao Pro viseme parameters");

console.log("Documentation contract passed");
