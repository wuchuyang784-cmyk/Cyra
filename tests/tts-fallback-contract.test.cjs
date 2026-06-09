const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "src/frontend/scripts/tourist-live2d.js"), "utf8");

assert(script.includes("speechSynthesis"), "tourist speech should fall back to browser speech synthesis when backend TTS fails");
assert(script.includes("SpeechSynthesisUtterance"), "tourist speech fallback should synthesize utterances in the browser");
assert(script.includes("function playBrowserSpeechFallback"), "tourist speech should expose a browser TTS fallback path");
assert(script.includes("browserSpeechActive"), "browser TTS fallback should mark guide speech as active for mouth animation");
assert(script.includes("speechFallback"), "queued speech should be able to fall back when backend TTS is unavailable");
assert(script.includes("BROWSER_TTS_VOICE_NAME = \"Chelsie\""), "browser TTS fallback should prefer the Chelsie voice");
assert(script.includes("findBrowserTtsVoice"), "browser TTS fallback should choose a matching installed voice when available");

console.log("TTS fallback contract passed");
