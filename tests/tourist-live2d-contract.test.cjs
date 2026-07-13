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
assert(!html.includes("stage-toolbar"), "tourist page should not expose avatar/background management controls");
assert(!html.includes("avatarSelect"), "tourist page should not expose avatar switching to visitors");
assert(!html.includes("backgroundUpload"), "tourist page should not expose background uploads to visitors");
assert(!html.includes("clearBackground"), "tourist page should not expose background reset to visitors");
assert(html.includes("imageUpload"), "tourist page should include an image upload control");
assert(html.includes("conversation"), "tourist page should include a dialogue area");
assert(html.includes("clearConversationButton"), "tourist page should include a clear conversation button");
assert(html.includes("commentPanel"), "tourist page should reserve a left-side panel for future scenic spot comments");
assert(html.includes("tourist-comment-panel"), "tourist page should expose the comment panel layout hook");
assert(html.includes("spotSelector"), "scenic comment panel should include a spot switcher");
assert(html.includes('id="spotImage"'), "scenic comment panel should include the current spot image");
assert(html.includes("spotTitle"), "scenic comment panel should expose the current spot title");
assert(html.includes("spotDescription"), "scenic comment panel should expose the current spot description");
assert(html.includes("spotCommentList"), "scenic comment panel should include a visitor comment list");
assert(html.includes("spotCommentForm"), "scenic comment panel should include a visitor comment form");
assert(html.includes("spotCommentInput"), "scenic comment panel should include a visitor comment input");
assert(html.includes("backgroundImage"), "tourist page should include a dedicated background image layer");
assert(!html.includes("quick-dock"), "tourist page should not show the old quick action dock");
assert(!html.includes("quickQuestions"), "tourist page should not show scenic quick questions");
assert(!html.includes("routeActions"), "tourist page should not show route recommendation shortcuts");
assert(!html.includes("feedbackPanel"), "tourist page should not show the feedback panel");
assert(html.includes("tourist-live2d.js"), "tourist page should load its Live2D controller");
assert(html.includes("live2dcubismcore.min.js"), "tourist page should load Live2D Cubism Core before the display plugin");
assert(html.includes("pixi.js@6.5.10"), "tourist page should use a Pixi version compatible with pixi-live2d-display");

const script = read("src/frontend/scripts/tourist-live2d.js");
const mojibakePattern = /[璇鏆鍙杩斿洖闊抽]/;
assert(!mojibakePattern.test(script), "tourist Live2D script should not contain mojibake Chinese text");
assert(script.includes("PIXI"), "Live2D controller should initialize through Pixi");
assert(script.includes("Live2DModel"), "Live2D controller should load Live2D models");
assert(script.includes("function hasLive2DRuntime"), "Live2D controller should detect whether the browser runtime loaded");
assert(script.includes("function startFallbackGuideRenderer"), "tourist page should keep a local animated digital-human fallback when CDN runtime is unavailable");
assert(script.includes("本地演示数字人"), "runtime fallback should tell operators that the local demo avatar is active");
assert(script.includes("fallbackGuideBottomY"), "fallback digital human should also stand above the bottom composer");
assert(script.includes("characters.json"), "Live2D controller should read the character manifest");
assert(script.includes("if (avatarSelect)"), "Live2D controller should tolerate visitor pages without an avatar selector");
assert(script.includes("if (backgroundUpload)"), "Live2D controller should tolerate visitor pages without background upload controls");
assert(script.includes("if (clearBackground)"), "Live2D controller should tolerate visitor pages without background reset controls");
assert(script.includes("backgroundImage"), "tourist page should bind uploaded backgrounds to the image layer");
assert(!script.includes("--custom-background-image"), "uploaded backgrounds should not use a separate blurred backing layer");
assert(script.includes("imageUpload"), "tourist page should bind the image upload control");
assert(script.includes("function appendImageMessage"), "tourist page should preview uploaded images in the conversation");
assert(script.includes("CONVERSATION_HISTORY_STORAGE_KEY"), "tourist page should store conversation history locally");
assert(script.includes("SCENIC_SPOTS"), "tourist page should define lightweight scenic spot comment data");
assert(script.includes("/api/comments"), "scenic comments should use the backend moderation API");
assert(script.includes("spotSelector"), "scenic comments should bind the spot selector");
assert(script.includes("spotCommentForm"), "scenic comments should bind the comment form");
assert(script.includes("spotCommentInput"), "scenic comments should bind the comment input");
assert(script.includes("function loadSpotComments"), "scenic comments should load stored visitor comments");
assert(script.includes("function loadApprovedSpotComments"), "scenic comments should load approved visitor comments from backend");
assert(script.includes("function renderCurrentSpot"), "scenic comments should rerender the selected spot intro and comments");
assert(script.includes("async function submitSpotComment"), "scenic comments should submit new visitor comments for moderation");
assert(script.includes("spotSelector.addEventListener(\"change\""), "spot selector should update the active comment list");
assert(script.includes("spotCommentForm.addEventListener(\"submit\""), "comment form should publish a visitor comment");
assert(script.includes("function saveConversationHistory"), "tourist page should persist completed dialogue records");
assert(script.includes("function restoreConversationHistory"), "tourist page should restore previous dialogue records into the conversation list");
assert(script.includes("function clearConversationHistory"), "tourist page should clear stored dialogue records on request");
assert(script.includes("localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY)"), "clearing dialogue should remove browser history storage");
assert(script.includes("localStorage.setItem(CONVERSATION_HISTORY_STORAGE_KEY"), "tourist page should save dialogue history to localStorage");
assert(script.includes("localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY"), "tourist page should read dialogue history from localStorage");
assert(script.includes("restoreConversationHistory();"), "tourist page should restore conversation history on startup");
assert(script.includes("function isConversationPinnedToBottom"), "conversation list should know whether the user is already viewing the latest messages");
assert(script.includes("function scrollConversationToBottomIfPinned"), "conversation list should avoid dragging users away from older chat history");
assert(script.includes("appendMessage(author, text, type = \"guide\", { forceScroll = true } = {})"), "message appends should support controlled WeChat-style auto-scroll");
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
assert(script.includes("function describeLive2DLoadError"), "Live2D loading failures should be translated into operator-readable messages");
assert(script.includes("moc3 v6"), "Live2D load errors should identify unsupported Cubism 5.3 moc3 packages");
assert(
  !script.includes("setStatus(error.message);"),
  "tourist page should not surface empty or generic Live2D loader errors directly",
);
assert(script.includes("function disableGuidePointerTracking"), "Live2D controller should explicitly disable pointer tracking on the guide model");
assert(script.includes("function applyForwardGaze"), "Live2D controller should keep the guide looking forward");
assert(script.includes('setModelParameter("ParamEyeBallX", 0)'), "guide gaze should keep horizontal eye movement centered");
assert(script.includes('setModelParameter("ParamEyeBallY", 0)'), "guide gaze should keep vertical eye movement centered");
assert(script.includes("function writeModelParameterValue"), "Live2D parameter writes should fall back to index-based Cubism writes when needed");
assert(script.includes("getParameterIndex"), "parameter writer should support Cubism's index-based parameter API");
assert(script.includes("setParameterValueByIndex"), "parameter writer should set parameters by index when string-id writes are ignored");
assert(script.includes("addParameterValueById"), "parameter writer should also reinforce supported string-id parameters");
assert(script.includes("function applySpeakingMotion"), "guide speech should add subtle non-mouse-driven motion while talking");
assert(script.includes("function readGuideGestureState"), "guide speech should schedule visible hand gestures while talking");
assert(script.includes("function applyGuideGestureState"), "guide speech should apply procedural arm and hand gestures");
assert(script.includes('setModelParameter("ParamArmRA01"'), "guide gestures should drive the right arm for waving");
assert(script.includes('setModelParameter("ParamHandRA"'), "guide gestures should drive the right hand during waving");
assert(script.includes('setModelParameter("ParamArmLA01"'), "guide gestures should drive the left arm for presentation gestures");
assert(script.includes("function readContinuousSpeechMouthState"), "speech playback should keep mouth opening and closing continuously while audio is playing");
assert(
  script.includes("return readContinuousSpeechMouthState(elapsed);"),
  "visible mouth state should use continuous speech animation instead of depending on lip-sync alignment",
);
assert(script.includes("function readFallbackMouthState"), "speech playback should keep an audio-energy fallback when timestamps are unavailable");
assert(script.includes("buildTimestampLipSyncClip(ttsTimestamps, audioBuffer, envelopeClip)"), "timestamp lip sync should carry the decoded audio envelope as a fallback");
assert(script.includes("decodeAudioData"), "TTS playback should decode audio through Web Audio for same-clock lip sync");
assert(script.includes("createBufferSource"), "TTS playback should use an AudioBufferSourceNode for lip sync");
assert(script.includes("function prepareDecodedGuideAudio"), "TTS audio should be downloaded and decoded as soon as synthesis returns");
assert(script.includes("preparedAudio.audioBuffer"), "queued TTS playback should reuse predecoded audio buffers when available");
assert(script.includes("playPreparedAudioBuffer"), "queued TTS playback should avoid decoding the next audio clip after the previous clip ends");
assert(script.includes("function buildLipSyncEnvelope"), "Live2D controller should precompute a mouth envelope from decoded TTS audio");
assert(script.includes("activeLipSyncClip"), "Live2D controller should keep a scheduled lip-sync clip while Web Audio is playing");
assert(script.includes("function readScheduledLipSyncMouthValue"), "mouth movement should be sampled from the scheduled audio clip");
assert(script.includes("!activeLipSyncClip.values"), "scheduled lip sync should tolerate timestamp clips without a decoded audio envelope");
assert(script.includes("function scaleAudioEnergyToMouthOpen"), "decoded audio energy should be converted into a mouth-open amount");
assert(script.includes("function gateMouthStateWithAudioEnergy"), "timestamp visemes should be shaped by same-clock audio energy");
assert(
  script.includes("function keepMinimumMouthShapeWhenAudioEnergyIsMissing"),
  "local ARKit/timestamp lip sync should keep a minimum mouth shape when decoded audio energy is temporarily missing",
);
assert(
  script.includes("keepMinimumMouthShapeWhenAudioEnergyIsMissing(mouthState)"),
  "audio-energy gating should not force local ARKit or timestamp mouth shapes fully closed during audible playback",
);
assert(script.includes("LIP_SYNC_VOICE_ACTIVITY_THRESHOLD"), "real audio lip sync should use a voice activity threshold");
assert(script.includes("function hasActiveAudioEnergy"), "real audio lip sync should gate mouth movement by decoded audio energy");
assert(script.includes("if (!hasActiveAudioEnergy(audioEnergy))"), "low decoded-audio energy should use the no-energy mouth-shape branch");
assert(script.includes("function readVisibleMouthState"), "a single mouth-state selector should decide the current lip-sync source");
assert(script.includes("function applyMouthState"), "mouth state should be applied through one shared parameter writer");
assert(script.includes('setModelParameter("ParamA", mouthOpen)'), "Mao Pro declares ParamA as its LipSync parameter, so continuous speech must drive ParamA directly");
assert(script.includes("function buildTimestampLipSyncClip"), "Live2D controller should convert TTS timestamps into a lip-sync clip");
assert(script.includes("function pickVisemeForText"), "Live2D controller should map Chinese timestamp text to Mao Pro visemes");
assert(script.includes("function readTimestampLipSyncMouthState"), "mouth state should be sampled from TTS word timestamps");
{
  const updateStart = script.indexOf("function updateGuidePerformance");
  const updateEnd = script.indexOf("function startGuidePerformance");
  assert(updateStart !== -1 && updateEnd !== -1, "guide performance update loop should be present");
  const updateSource = script.slice(updateStart, updateEnd);
  assert(
    updateSource.includes("readVisibleMouthState"),
    "guide performance should select one visible mouth-state source",
  );
}
assert(script.includes("function extractSpeakableSegments"), "streamed guide replies should be split into short speakable TTS segments");
assert(script.includes("function startSpeechSyncedTextReveal"), "guide text should be revealed by speech playback progress");
assert(
  script.includes("onTextProgress") &&
    script.includes("item.onTextProgress") &&
    script.includes("startSpeechSyncedTextReveal("),
  "queued speech should drive text reveal while audio is playing",
);
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
assert(!script.includes("displayedReply = appendGuideTextChunk"), "streaming chunks should not outrun speech playback");
assert(script.includes("function revealQueuedGuideText"), "queued speech should own when guide text becomes visible");
assert(
  !script.includes("replyText.textContent = fullReply"),
  "streamed guide replies should be incrementally appended instead of replaced only after completion",
);
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
assert(css.includes(".tourist-comment-panel"), "tourist page should style the left-side future comments area");
assert(css.includes(".spot-card"), "scenic comment panel should style the spot intro card");
assert(css.includes(".spot-image-frame"), "scenic comment panel should style the real spot image");
assert(css.includes(".spot-selector"), "scenic comment panel should style the spot switcher");
assert(css.includes(".spot-comment-list"), "scenic comment panel should style the visitor comment list");
assert(css.includes(".spot-comment-form"), "scenic comment panel should style the visitor comment input area");
assert(css.includes("overflow-y: auto"), "comment and conversation panels should scroll when content overflows");
assert(!css.includes(".stage-toolbar"), "visitor UI should not keep avatar/background management toolbar styles");
assert(!css.includes(".field select"), "visitor UI should not keep avatar selector styles");
assert(!css.includes("#clearBackground"), "visitor UI should not keep background reset button styles");
assert(css.includes("left: 22px"), "left-side future comments area should keep breathing room from the viewport edge");
assert(css.includes("top: max(22px, env(safe-area-inset-top))"), "left-side future comments area should keep top spacing from the viewport edge");
assert(css.includes("width: min(500px, 87vw)"), "left-side future comments area should be large enough for upcoming visitor reviews");
assert(css.includes("border-radius: 8px"), "left-side future comments area should look like a reserved panel instead of touching the viewport");
assert(css.includes("width: min(520px, 32vw)"), "right-side conversation area should be wider than the old narrow chat stack");
assert(css.includes("max-width: 720px"), "bottom composer should be smaller and centered");
assert(css.includes("--composer-reserved-height"), "tourist page should reserve a shared bottom area for the composer");
assert(css.includes("--conversation-top"), "conversation history should have a stable top edge for a taller right panel");
assert(css.includes("top: var(--conversation-top)"), "conversation history should extend from near the top instead of only showing a short bottom stack");
assert(css.includes("bottom: var(--composer-reserved-height)"), "conversation history should stop above the composer");
assert(css.includes("overflow-y: auto"), "conversation history should scroll vertically when messages overflow");
assert(css.includes("overscroll-behavior: contain"), "conversation history scrolling should not drag the full page");
assert(css.includes("grid-auto-rows: max-content"), "conversation history should behave like a vertical chat message list");
assert(!css.includes("align-content: end"), "conversation history should not pin all messages into one bottom stack");
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
