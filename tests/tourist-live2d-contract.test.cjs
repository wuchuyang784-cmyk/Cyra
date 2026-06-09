const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

assert(exists("src/frontend/tourist.html"), "tourist Live2D page should exist");
assert(exists("src/frontend/scripts/tourist-live2d.js"), "tourist Live2D controller should exist");
assert(exists("src/frontend/styles/tourist.css"), "tourist page styles should exist");
assert(exists("src/frontend/assets/live2d/characters.json"), "Live2D character manifest should exist");
assert(exists("src/frontend/assets/live2d/mao_pro/mao_pro.model3.json"), "Mao Pro Live2D model should be available to the static server");

const html = read("src/frontend/tourist.html");
assert(html.includes("live2d-stage"), "tourist page should expose a Live2D stage");
assert(html.includes("avatarSelect"), "tourist page should include an avatar selector");
assert(html.includes("backgroundUpload"), "tourist page should include a background upload control");
assert(html.includes("conversation"), "tourist page should include a dialogue area");
assert(html.includes("quickQuestions"), "tourist page should include scenic quick questions");
assert(html.includes("routeActions"), "tourist page should include route recommendation entry points");
assert(html.includes("feedbackPanel"), "tourist page should include a tourist feedback entry");
assert(html.includes("tourist-live2d.js"), "tourist page should load its Live2D controller");
assert(html.includes("live2dcubismcore.min.js"), "tourist page should load Live2D Cubism Core before the display plugin");
assert(html.includes("pixi.js@6.5.10"), "tourist page should use a Pixi version compatible with pixi-live2d-display");

const script = read("src/frontend/scripts/tourist-live2d.js");
assert(script.includes("PIXI"), "Live2D controller should initialize through Pixi");
assert(script.includes("Live2DModel"), "Live2D controller should load Live2D models");
assert(script.includes("function hasLive2DRuntime"), "Live2D controller should detect whether the browser runtime loaded");
assert(script.includes("function startFallbackGuideRenderer"), "tourist page should keep a local animated digital-human fallback when CDN runtime is unavailable");
assert(script.includes("本地演示数字人"), "runtime fallback should tell operators that the local demo avatar is active");
assert(script.includes("characters.json"), "Live2D controller should read the character manifest");
assert(script.includes("function autoFitModel"), "Live2D controller should auto-fit model bounds to the stage");
assert(script.includes("getLocalBounds"), "Live2D controller should compute model scale from its rendered bounds");
assert(script.includes("decodeAudioData"), "TTS playback should decode audio through Web Audio for same-clock lip sync");
assert(script.includes("createBufferSource"), "TTS playback should use an AudioBufferSourceNode for lip sync");
assert(script.includes("function buildLipSyncEnvelope"), "Live2D controller should precompute a mouth envelope from decoded TTS audio");
assert(script.includes("activeLipSyncClip"), "Live2D controller should keep a scheduled lip-sync clip while Web Audio is playing");
assert(script.includes("function readScheduledLipSyncMouthValue"), "mouth movement should be sampled from the scheduled audio clip");
assert(script.includes("function readSpeechMouthPulse"), "speech playback should have a visible mouth-motion fallback pulse");
assert(script.includes("function normalizeMouthState"), "mouth state should keep a minimum visible opening while speech is active");
assert(script.includes("function applyMouthState"), "mouth state should be applied through one shared parameter writer");
assert(script.includes("function buildTimestampLipSyncClip"), "Live2D controller should convert TTS timestamps into a lip-sync clip");
assert(script.includes("function pickVisemeForText"), "Live2D controller should map Chinese timestamp text to Mao Pro visemes");
assert(script.includes("function readTimestampLipSyncMouthState"), "mouth state should be sampled from TTS word timestamps");
assert(script.includes("ttsTimestamps"), "queued speech should carry timestamps together with audio");
assert(script.includes("function isGuideSpeechPlaying"), "guide performance should treat Web Audio playback as active speech");
assert(script.includes("if (!isGuideSpeechPlaying())"), "guide performance should not depend only on an HTMLAudioElement state");
assert(script.includes("function resetMouthParameters"), "Live2D controller should reset all Mao Pro mouth parameters");
assert(script.includes('setModelParameter("ParamI", 0)'), "Mao Pro I mouth parameter should be cleared during audio lip sync");
assert(script.includes('setModelParameter("ParamU", 0)'), "Mao Pro U mouth parameter should be cleared during audio lip sync");
assert(script.includes('setModelParameter("ParamE", 0)'), "Mao Pro E mouth parameter should be cleared during audio lip sync");
assert(script.includes('setModelParameter("ParamO", 0)'), "Mao Pro O mouth parameter should be cleared during audio lip sync");
assert(script.includes('setModelParameter("ParamMouthOpenY"'), "speech lip sync should also drive the common Live2D mouth-open parameter");
assert(
  !script.includes('activeModel.motion?.("",'),
  "guide speech should not start Mao Pro motions because they contain their own mouth curves",
);
assert(
  !script.includes('activeModel?.motion?.("Idle"'),
  "streaming answers should not start Idle motion because it contains Mao Pro mouth curves",
);
assert(
  !script.includes("if (!activeAudio || activeAudio.paused || activeAudio.ended)"),
  "decoded Web Audio playback has no active HTMLAudioElement, so this guard would stop lip sync immediately",
);

const runner = read("run_cyra_demo.py");
assert(runner.includes("Tourist Live2D page:"), "runner should advertise the tourist Live2D page");

const css = read("src/frontend/styles/tourist.css");
assert(css.includes("overflow-x: hidden"), "tourist page should prevent sidebar controls from creating horizontal overflow");
assert(css.includes("grid-template-columns: repeat(auto-fit"), "quick action buttons should wrap instead of clipping labels in narrow sidebars");

const manifest = JSON.parse(read("src/frontend/assets/live2d/characters.json"));
assert(Array.isArray(manifest.characters), "character manifest should expose a characters array");
assert(manifest.characters.some((character) => character.id === "mao_pro"), "Mao Pro should be listed as a switchable character");

console.log("Tourist Live2D contract passed");
