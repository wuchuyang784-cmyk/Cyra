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
assert(html.includes("immersive-stage"), "tourist page should use an immersive full-screen stage");
assert(html.includes("tourist-composer"), "tourist page should expose a bottom composer");
assert(html.includes("avatarSelect"), "tourist page should include an avatar selector");
assert(html.includes("backgroundUpload"), "tourist page should include a background upload control");
assert(html.includes("imageUpload"), "tourist page should include an image upload control");
assert(html.includes("conversation"), "tourist page should include a dialogue area");
assert(html.includes("backgroundImage"), "tourist page should include a dedicated background image layer");
assert(!html.includes("quick-dock"), "tourist page should not show the old quick action dock");
assert(!html.includes("quickQuestions"), "tourist page should not show scenic quick questions");
assert(!html.includes("routeActions"), "tourist page should not show route recommendation shortcuts");
assert(!html.includes("feedbackPanel"), "tourist page should not show the feedback panel");
assert(html.includes("tourist-live2d.js"), "tourist page should load its Live2D controller");
assert(html.includes("live2dcubismcore.min.js"), "tourist page should load Live2D Cubism Core before the display plugin");
assert(html.includes("pixi.js@6.5.10"), "tourist page should use a Pixi version compatible with pixi-live2d-display");

const script = read("src/frontend/scripts/tourist-live2d.js");
assert(script.includes("PIXI"), "Live2D controller should initialize through Pixi");
assert(script.includes("Live2DModel"), "Live2D controller should load Live2D models");
assert(script.includes("function hasLive2DRuntime"), "Live2D controller should detect whether the browser runtime loaded");
assert(script.includes("function startFallbackGuideRenderer"), "tourist page should keep a local animated digital-human fallback when CDN runtime is unavailable");
assert(script.includes("本地演示数字人"), "runtime fallback should tell operators that the local demo avatar is active");
assert(script.includes("fallbackGuideBottomY"), "fallback digital human should also stand above the bottom composer");
assert(script.includes("characters.json"), "Live2D controller should read the character manifest");
assert(script.includes("backgroundImage"), "tourist page should bind uploaded backgrounds to the image layer");
assert(!script.includes("--custom-background-image"), "uploaded backgrounds should not use a separate blurred backing layer");
assert(script.includes("imageUpload"), "tourist page should bind the image upload control");
assert(script.includes("function appendImageMessage"), "tourist page should preview uploaded images in the conversation");
assert(script.includes("pendingImageDataUrl"), "tourist page should keep the uploaded image for the next guide question");
assert(script.includes("function prepareChatImageDataUrl"), "tourist page should prepare uploaded images for multimodal chat");
assert(script.includes("CHAT_IMAGE_MAX_EDGE"), "tourist page should resize uploaded images before sending them to the backend");
assert(script.includes("image_data_url: imageDataUrl"), "tourist page should send uploaded images with chat requests");
assert(script.includes("canvasElement.toDataURL(\"image/jpeg\""), "tourist page should send a browser-safe image data URL to the backend");
assert(script.includes("VOICE_RECORDING_PLACEHOLDER"), "recording state should move the timer text into the input placeholder");
assert(script.includes("messageInput.placeholder = formatRecordingPlaceholder"), "recording duration should update inside the input field");
assert(script.includes("function autoFitModel"), "Live2D controller should auto-fit model bounds to the stage");
assert(script.includes("COMPOSER_SAFE_AREA_HEIGHT"), "Live2D fitting should reserve space above the bottom composer");
assert(script.includes("availableStageHeight"), "Live2D fitting should use the visible area above the composer");
assert(script.includes("modelBottomY"), "Live2D fitting should place the model bottom above the composer");
assert(script.includes("scaledModelHeight"), "Live2D fitting should account for the scaled model height");
assert(script.includes("getLocalBounds"), "Live2D controller should compute model scale from its rendered bounds");
assert(script.includes("autoInteract: false"), "Live2D loading should disable default mouse-follow focus interaction");
assert(script.includes("function disableGuidePointerTracking"), "Live2D controller should explicitly disable pointer tracking on the guide model");
assert(script.includes("function applyForwardGaze"), "Live2D controller should keep the guide looking forward");
assert(script.includes('setModelParameter("ParamEyeBallX", 0)'), "guide gaze should keep horizontal eye movement centered");
assert(script.includes('setModelParameter("ParamEyeBallY", 0)'), "guide gaze should keep vertical eye movement centered");
assert(script.includes("function applySpeakingMotion"), "guide speech should add subtle non-mouse-driven motion while talking");
assert(script.includes("function readGuideGestureState"), "guide speech should schedule visible hand gestures while talking");
assert(script.includes("function applyGuideGestureState"), "guide speech should apply procedural arm and hand gestures");
assert(script.includes('setModelParameter("ParamArmRA01"'), "guide gestures should drive the right arm for waving");
assert(script.includes('setModelParameter("ParamHandRA"'), "guide gestures should drive the right hand during waving");
assert(script.includes('setModelParameter("ParamArmLA01"'), "guide gestures should drive the left arm for presentation gestures");
assert(script.includes("function mixMouthWithAudioEnergy"), "timestamp lip sync should be reinforced by audio energy so the mouth visibly moves");
assert(script.includes("buildTimestampLipSyncClip(ttsTimestamps, audioBuffer, envelopeClip)"), "timestamp lip sync should carry the decoded audio envelope as a fallback");
assert(script.includes("decodeAudioData"), "TTS playback should decode audio through Web Audio for same-clock lip sync");
assert(script.includes("createBufferSource"), "TTS playback should use an AudioBufferSourceNode for lip sync");
assert(script.includes("function prepareDecodedGuideAudio"), "TTS audio should be downloaded and decoded as soon as synthesis returns");
assert(script.includes("preparedAudio.audioBuffer"), "queued TTS playback should reuse predecoded audio buffers when available");
assert(script.includes("playPreparedAudioBuffer"), "queued TTS playback should avoid decoding the next audio clip after the previous clip ends");
assert(script.includes("function buildLipSyncEnvelope"), "Live2D controller should precompute a mouth envelope from decoded TTS audio");
assert(script.includes("activeLipSyncClip"), "Live2D controller should keep a scheduled lip-sync clip while Web Audio is playing");
assert(script.includes("function readScheduledLipSyncMouthValue"), "mouth movement should be sampled from the scheduled audio clip");
assert(script.includes("function readSpeechMouthPulse"), "speech playback should have a visible mouth-motion fallback pulse");
assert(script.includes("function normalizeMouthState"), "mouth state should keep a minimum visible opening while speech is active");
assert(script.includes("function applyMouthState"), "mouth state should be applied through one shared parameter writer");
assert(script.includes("function buildTimestampLipSyncClip"), "Live2D controller should convert TTS timestamps into a lip-sync clip");
assert(script.includes("function pickVisemeForText"), "Live2D controller should map Chinese timestamp text to Mao Pro visemes");
assert(script.includes("function readTimestampLipSyncMouthState"), "mouth state should be sampled from TTS word timestamps");
assert(script.includes("function extractSpeakableSegments"), "streamed guide replies should be split into short speakable TTS segments");
assert(script.includes("SPEECH_SOFT_BREAKS"), "TTS segmentation should use Chinese clause punctuation before a full sentence ends");
{
  const segmentationStart = script.indexOf("const SPEECH_HARD_BREAKS");
  const segmentationEnd = script.indexOf("async function answerQuestion");
  assert(segmentationStart !== -1 && segmentationEnd !== -1, "speech segmentation helpers should live before answerQuestion");
  const segmentationSource = script.slice(segmentationStart, segmentationEnd);
  const { extractSpeakableSegments } = new Function(`${segmentationSource}; return { extractSpeakableSegments };`)();

  const shortClauseResult = extractSpeakableSegments("这里是灵山胜境，你可以得到很好的游览体验");
  assert.deepStrictEqual(shortClauseResult.sentences, [], "TTS should not synthesize short comma fragments that cause choppy playback");
  assert.strictEqual(
    shortClauseResult.rest,
    "这里是灵山胜境，你可以得到很好的游览体验",
    "short comma clauses should remain buffered until the audio chunk is more natural",
  );

  const naturalClauseResult = extractSpeakableSegments("游客可以先到九龙灌浴广场观看演出，再沿主轴线前往灵山大佛");
  assert.deepStrictEqual(
    naturalClauseResult.sentences,
    ["游客可以先到九龙灌浴广场观看演出，"],
    "TTS should still start preparing audio when a comma clause is long enough to sound natural",
  );
  assert.strictEqual(
    naturalClauseResult.rest,
    "再沿主轴线前往灵山大佛",
    "TTS segmentation should keep the unfinished following clause for later streaming chunks",
  );

  const shortResult = extractSpeakableSegments("你好，");
  assert.deepStrictEqual(shortResult.sentences, [], "TTS should not synthesize tiny comma fragments");
  assert.strictEqual(shortResult.rest, "你好，", "short fragments should remain buffered until more text arrives");

  const longResult = extractSpeakableSegments(
    "游客可以沿着主轴线依次参观九龙灌浴灵山大佛梵宫五印坛城也可以继续前往禅意小径体验更安静的园林步道和观景平台最后回到出口区域",
  );
  assert(longResult.sentences.length >= 1, "very long streamed text should be queued before waiting indefinitely for punctuation");
  assert(longResult.sentences[0].length >= 40, "length fallback should avoid tiny TTS chunks that create audible gaps");
  assert(longResult.sentences[0].length <= 64, "length fallback should keep early TTS chunks responsive");
}
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
assert(css.includes("position: fixed"), "tourist controls should be layered over the full-screen stage");
assert(css.includes("bottom: max(18px"), "tourist composer should sit at the bottom of the viewport");
assert(css.includes("place-items: center"), "tourist stage should center the digital human");
assert(css.includes("object-fit: cover"), "uploaded backgrounds should cover the full viewport");
assert(!css.includes("object-fit: contain"), "uploaded backgrounds should not leave letterboxed empty bands");
assert(!css.includes(".live2d-stage.has-custom-background::before"), "uploaded backgrounds should not create a blurred band around the real image");
assert(!css.includes("transform: scale(1.01)"), "uploaded backgrounds should not be enlarged beyond cover sizing");
assert(css.includes("#live2dCanvas"), "Live2D canvas styles should be defined");
assert(css.includes("z-index: 1"), "Live2D canvas should render above the background layer");
assert(css.includes("grid-template-columns: 46px 46px minmax(0, 1fr) 84px"), "recording timer should not need a wide mic button column");
assert(css.includes("border-radius: 999px"), "composer icon buttons should be circular");
assert(!css.includes(".quick-dock"), "tourist CSS should not keep the old quick action dock");

const manifest = JSON.parse(read("src/frontend/assets/live2d/characters.json"));
assert(Array.isArray(manifest.characters), "character manifest should expose a characters array");
assert(manifest.characters.some((character) => character.id === "mao_pro"), "Mao Pro should be listed as a switchable character");
const maoPro = manifest.characters.find((character) => character.id === "mao_pro");
assert(maoPro.maxScale <= 0.115, "Mao Pro should be scaled down enough to fit fully above the composer");
assert(maoPro.stageHeightRatio <= 0.62, "Mao Pro should leave vertical room for the bottom composer");
assert(maoPro.offsetY <= -20, "Mao Pro should be moved upward above the bottom composer");

console.log("Tourist Live2D contract passed");
