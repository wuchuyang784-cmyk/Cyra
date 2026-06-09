const stage = document.getElementById("live2d-stage");
const canvas = document.getElementById("live2dCanvas");
const avatarSelect = document.getElementById("avatarSelect");
const backgroundUpload = document.getElementById("backgroundUpload");
const clearBackground = document.getElementById("clearBackground");
const stageStatus = document.getElementById("stageStatus");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const voiceInputButton = document.getElementById("voiceInputButton");
const conversation = document.getElementById("conversation");
const quickQuestions = document.getElementById("quickQuestions");
const routeActions = document.getElementById("routeActions");
const feedbackPanel = document.getElementById("feedbackPanel");

let app;
let activeModel;
let fallbackRendererActive = false;
let fallbackAnimationFrame;
let fallbackStartedAt = 0;
let characters = [];
let chatHistory = [];
let preparedAudioQueue = [];
let isAudioQueuePlaying = false;
let activeAudio;
let guidePerformanceStartedAt = 0;
let guidePerformanceActive = false;
let audioContext;
let lipSyncAnalyser;
let lipSyncData;
let lipSyncFallback = false;
let activeAudioSource;
let activeLipSyncClip;
let browserSpeechActive = false;
let mediaRecorder;
let recordedAudioChunks = [];
let isVoiceRecording = false;
let voiceRecordingStartedAt = 0;
let voiceRecordingTimer;
let voiceRecordingLimitTimer;

const FACE_FORWARD_ANGLE_X = 0;
const FACE_FORWARD_ANGLE_Y = 0;
const LIP_SYNC_FRAME_RATE = 60;
const LIP_SYNC_START_DELAY_SECONDS = 0.04;
const LIP_SYNC_END_GRACE_SECONDS = 0.12;
const MIN_SPEECH_MOUTH_OPEN = 0.22;
const VOICE_RECORDING_MAX_SECONDS = 12;
const BROWSER_TTS_VOICE_NAME = "Chelsie";
const EMPTY_MOUTH_STATE = Object.freeze({ a: 0, i: 0, u: 0, e: 0, o: 0 });

function setStatus(message, ready = false) {
  stageStatus.textContent = message;
  stageStatus.classList.toggle("ready", ready);
}

function hasLive2DRuntime() {
  return Boolean(window.PIXI?.live2d?.Live2DModel);
}

function setVoiceInputState(recording, busy = false) {
  isVoiceRecording = recording;
  if (!recording) {
    clearInterval(voiceRecordingTimer);
    clearTimeout(voiceRecordingLimitTimer);
    voiceRecordingTimer = null;
    voiceRecordingLimitTimer = null;
  }
  voiceInputButton.textContent = busy ? "识别中" : recording ? "停止 00:00" : "语音";
  voiceInputButton.disabled = busy;
  voiceInputButton.classList.toggle("recording", recording);
}

function formatRecordingDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function updateVoiceRecordingDuration() {
  if (!isVoiceRecording) return;
  const elapsed = (performance.now() - voiceRecordingStartedAt) / 1000;
  voiceInputButton.textContent = `停止 ${formatRecordingDuration(elapsed)}`;
}

function scheduleVoiceRecordingLimit() {
  clearInterval(voiceRecordingTimer);
  clearTimeout(voiceRecordingLimitTimer);
  voiceRecordingTimer = setInterval(updateVoiceRecordingDuration, 250);
  voiceRecordingLimitTimer = setTimeout(() => {
    if (mediaRecorder?.state === "recording") {
      setStatus("已自动结束录音，正在识别...", true);
      stopVoiceRecording();
    }
  }, VOICE_RECORDING_MAX_SECONDS * 1000);
}

function setModelParameter(id, value) {
  const coreModel = activeModel?.internalModel?.coreModel;
  if (!coreModel?.setParameterValueById) return;
  try {
    coreModel.setParameterValueById(id, value);
  } catch (error) {
    // Different Live2D models may omit optional guide-motion parameters.
  }
}

function resetMouthParameters() {
  setModelParameter("ParamA", 0);
  setModelParameter("ParamI", 0);
  setModelParameter("ParamU", 0);
  setModelParameter("ParamE", 0);
  setModelParameter("ParamO", 0);
  setModelParameter("ParamMouthOpenY", 0);
  setModelParameter("ParamMouthUp", 0);
  setModelParameter("ParamMouthDown", 0);
  setModelParameter("ParamMouthAngry", 0);
  setModelParameter("ParamMouthAngryLine", 0);
}

function resetGuideParameters() {
  resetMouthParameters();
  setModelParameter("ParamAngleX", FACE_FORWARD_ANGLE_X);
  setModelParameter("ParamAngleY", FACE_FORWARD_ANGLE_Y);
  setModelParameter("ParamAngleZ", 0);
  setModelParameter("ParamBodyAngleX", 0);
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  audioContext ??= new AudioContextClass();
  return audioContext;
}

function setupLipSyncAnalyser() {
  const context = ensureAudioContext();
  lipSyncFallback = false;
  if (!context) {
    lipSyncFallback = true;
    return null;
  }

  lipSyncAnalyser = context.createAnalyser();
  lipSyncAnalyser.fftSize = 512;
  lipSyncData = new Uint8Array(lipSyncAnalyser.fftSize);
  lipSyncAnalyser.connect(context.destination);
  return lipSyncAnalyser;
}

function readLipSyncMouthValue() {
  if (!lipSyncAnalyser || !lipSyncData) return 0;
  lipSyncAnalyser.getByteTimeDomainData(lipSyncData);

  let sum = 0;
  for (const sample of lipSyncData) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }
  const rms = Math.sqrt(sum / lipSyncData.length);
  return Math.max(0, Math.min(1, rms * 5.8));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function buildLipSyncEnvelope(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate || 44100;
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const samplesPerFrame = Math.max(1, Math.floor(sampleRate / LIP_SYNC_FRAME_RATE));
  const frameCount = Math.max(1, Math.ceil(audioBuffer.length / samplesPerFrame));
  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  const rawValues = new Float32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * samplesPerFrame;
    const end = Math.min(audioBuffer.length, start + samplesPerFrame);
    let sum = 0;
    let count = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      let mixed = 0;
      for (const channel of channels) {
        mixed += channel[sampleIndex] || 0;
      }
      mixed /= channelCount;
      sum += mixed * mixed;
      count += 1;
    }

    rawValues[frameIndex] = Math.sqrt(sum / Math.max(count, 1));
  }

  const sorted = Array.from(rawValues).sort((left, right) => left - right);
  const speechPeak = sorted[Math.floor(sorted.length * 0.92)] || 0;
  const noiseFloor = Math.min(0.012, speechPeak * 0.35);
  const scale = Math.max(0.018, speechPeak - noiseFloor);
  const values = new Float32Array(frameCount);
  let smoothed = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const normalized = clamp01((rawValues[index] - noiseFloor) / scale);
    const target = Math.pow(normalized, 0.62) * 0.95;
    const smoothing = target > smoothed ? 0.72 : 0.34;
    smoothed += (target - smoothed) * smoothing;
    values[index] = smoothed < 0.035 ? 0 : smoothed;
  }

  return {
    duration: audioBuffer.duration,
    frameRate: LIP_SYNC_FRAME_RATE,
    values,
    startedAt: 0,
    endsAt: 0,
  };
}

function readScheduledLipSyncMouthValue() {
  if (!activeLipSyncClip || !audioContext) return 0;
  const position = audioContext.currentTime - activeLipSyncClip.startedAt;
  if (position < 0 || position > activeLipSyncClip.duration) return 0;

  const frame = position * activeLipSyncClip.frameRate;
  const lowerIndex = Math.max(0, Math.floor(frame));
  const upperIndex = Math.min(activeLipSyncClip.values.length - 1, lowerIndex + 1);
  const weight = frame - lowerIndex;
  const lower = activeLipSyncClip.values[lowerIndex] || 0;
  const upper = activeLipSyncClip.values[upperIndex] || lower;
  return clamp01(lower + (upper - lower) * weight);
}

function pickVisemeForText(text) {
  if (/[一以已衣依意义移伊宜仪艺忆疑益医]/.test(text)) return "i";
  if (/[乌无五午物吴舞误屋悟雾]/.test(text)) return "u";
  if (/[噢哦喔我窝握卧沃]/.test(text)) return "o";
  if (/[诶欸也叶业夜耶爷野]/.test(text)) return "e";
  if (/[啊阿安按岸昂奥爱哀矮]/.test(text)) return "a";
  if (/[aoo]/i.test(text)) return "o";
  if (/[iuüv]/i.test(text)) return "u";
  if (/[e]/i.test(text)) return "e";
  return "a";
}

function buildTimestampLipSyncClip(ttsTimestamps, audioBuffer) {
  const words = (ttsTimestamps ?? [])
    .map((item) => {
      const begin = Number(item.begin_time) / 1000;
      const end = Number(item.end_time) / 1000;
      if (!Number.isFinite(begin) || !Number.isFinite(end) || end <= begin) {
        return null;
      }
      return {
        text: String(item.text ?? ""),
        begin,
        end,
        viseme: pickVisemeForText(String(item.text ?? "")),
      };
    })
    .filter(Boolean);

  if (words.length === 0) return null;
  return {
    duration: audioBuffer.duration,
    words,
    startedAt: 0,
    endsAt: 0,
  };
}

function readTimestampLipSyncMouthState() {
  if (!activeLipSyncClip?.words || !audioContext) return EMPTY_MOUTH_STATE;
  const position = audioContext.currentTime - activeLipSyncClip.startedAt;
  const word = activeLipSyncClip.words.find((item) => position >= item.begin && position <= item.end);
  if (!word) return EMPTY_MOUTH_STATE;

  const duration = Math.max(0.08, word.end - word.begin);
  const local = clamp01((position - word.begin) / duration);
  const attack = clamp01(local / 0.22);
  const release = clamp01((1 - local) / 0.32);
  const strength = Math.max(0.18, Math.min(0.98, Math.min(attack, release) * 0.9 + 0.08));
  const state = { a: 0, i: 0, u: 0, e: 0, o: 0 };
  state[word.viseme] = strength;
  state.a = Math.max(state.a, strength * 0.45);
  return state;
}

function readSpeechMouthPulse(elapsed) {
  const primary = Math.abs(Math.sin(elapsed * 10.5));
  const secondary = Math.abs(Math.sin(elapsed * 16.2 + 0.7));
  return MIN_SPEECH_MOUTH_OPEN + Math.max(primary * 0.48, secondary * 0.28);
}

function normalizeMouthState(mouthState, elapsed) {
  const pulse = readSpeechMouthPulse(elapsed);
  const state = {
    a: clamp01(mouthState.a || 0),
    i: clamp01(mouthState.i || 0),
    u: clamp01(mouthState.u || 0),
    e: clamp01(mouthState.e || 0),
    o: clamp01(mouthState.o || 0),
  };
  const strongest = Math.max(state.a, state.i, state.u, state.e, state.o);
  if (strongest < MIN_SPEECH_MOUTH_OPEN) {
    state.a = pulse;
  }
  return state;
}

function applyMouthState(mouthState) {
  const mouthOpen = Math.max(mouthState.a, mouthState.i, mouthState.u, mouthState.e, mouthState.o);
  setModelParameter("ParamA", mouthState.a);
  setModelParameter("ParamI", mouthState.i);
  setModelParameter("ParamU", mouthState.u);
  setModelParameter("ParamE", mouthState.e);
  setModelParameter("ParamO", mouthState.o);
  setModelParameter("ParamMouthOpenY", mouthOpen);
}

function isGuideSpeechPlaying() {
  if (browserSpeechActive) {
    return true;
  }
  if (activeAudio && !activeAudio.paused && !activeAudio.ended) {
    return true;
  }
  if (activeLipSyncClip && audioContext) {
    return audioContext.currentTime <= activeLipSyncClip.endsAt;
  }
  return Boolean(activeAudioSource);
}

function updateGuidePerformance() {
  if (!isGuideSpeechPlaying()) {
    stopGuidePerformance();
    return;
  }

  const elapsed = (performance.now() - guidePerformanceStartedAt) / 1000;
  const mouth = activeLipSyncClip?.words
    ? 0
    : activeLipSyncClip
    ? readScheduledLipSyncMouthValue()
    : lipSyncFallback
    ? 0.2 + Math.abs(Math.sin(elapsed * 9.5)) * 0.55
    : readLipSyncMouthValue();
  const mouthState = activeLipSyncClip?.words
    ? readTimestampLipSyncMouthState()
    : { ...EMPTY_MOUTH_STATE, a: mouth };
  const visibleMouthState = normalizeMouthState(mouthState, elapsed);
  const headX = FACE_FORWARD_ANGLE_X + Math.sin(elapsed * 0.9) * 1.5;
  const headY = FACE_FORWARD_ANGLE_Y + Math.sin(elapsed * 0.7 + 0.6) * 1.2;
  const headZ = Math.sin(elapsed * 0.8 + 1.4) * 1.2;
  const bodyX = Math.sin(elapsed * 0.55) * 1.8;

  resetMouthParameters();
  applyMouthState(visibleMouthState);
  setModelParameter("ParamAngleX", headX);
  setModelParameter("ParamAngleY", headY);
  setModelParameter("ParamAngleZ", headZ);
  setModelParameter("ParamBodyAngleX", bodyX);
}

function startGuidePerformance() {
  if (!activeModel) return;
  guidePerformanceStartedAt = performance.now();
  guidePerformanceActive = true;
}

function stopGuidePerformance() {
  guidePerformanceActive = false;
  resetGuideParameters();
}

function resizeRenderer() {
  const { width, height } = stage.getBoundingClientRect();
  if (fallbackRendererActive) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(320, Math.floor(width * pixelRatio));
    canvas.height = Math.max(360, Math.floor(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return;
  }
  if (!app) return;
  app.renderer.resize(Math.max(320, width), Math.max(360, height));
  autoFitModel(activeModel);
}

function drawFallbackGuide(context, width, height, elapsed) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const logicalWidth = width / pixelRatio;
  const logicalHeight = height / pixelRatio;
  const centerX = logicalWidth / 2;
  const centerY = logicalHeight * 0.52;
  const scale = Math.min(logicalWidth / 760, logicalHeight / 760, 1.08);
  const speaking = guidePerformanceActive || isAudioQueuePlaying;
  const listening = isVoiceRecording;
  const breath = Math.sin(elapsed * 1.8) * 4;
  const mouthOpen = speaking ? 8 + Math.abs(Math.sin(elapsed * 12)) * 18 : listening ? 8 : 4;
  const eyeBlink = Math.sin(elapsed * 0.45) > 0.985 ? 0.18 : 1;

  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.translate(centerX, centerY + breath);
  context.scale(scale, scale);

  context.fillStyle = "rgba(15, 118, 110, 0.08)";
  context.beginPath();
  context.ellipse(0, 230, 190, 34, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#0f766e";
  context.beginPath();
  context.moveTo(-128, 92);
  context.bezierCurveTo(-170, 170, -162, 240, 0, 250);
  context.bezierCurveTo(162, 240, 170, 170, 128, 92);
  context.quadraticCurveTo(76, 126, 0, 128);
  context.quadraticCurveTo(-76, 126, -128, 92);
  context.fill();

  context.fillStyle = "#f5c7a7";
  context.beginPath();
  context.ellipse(0, -8, 118, 136, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#263238";
  context.beginPath();
  context.moveTo(-114, -20);
  context.bezierCurveTo(-110, -120, -64, -166, 8, -160);
  context.bezierCurveTo(110, -150, 134, -74, 112, 34);
  context.bezierCurveTo(88, -44, 34, -76, -34, -70);
  context.bezierCurveTo(-72, -66, -98, -46, -114, -20);
  context.fill();

  context.strokeStyle = "#2f3f43";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-54, -10);
  context.quadraticCurveTo(-34, -18, -14, -10);
  context.moveTo(20, -10);
  context.quadraticCurveTo(40, -18, 60, -10);
  context.stroke();

  context.fillStyle = "#1f2528";
  context.beginPath();
  context.ellipse(-36, 18, 9, 12 * eyeBlink, 0, 0, Math.PI * 2);
  context.ellipse(42, 18, 9, 12 * eyeBlink, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#b36b58";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(4, 28);
  context.quadraticCurveTo(-6, 56, 8, 62);
  context.stroke();

  context.fillStyle = speaking ? "#7f1d1d" : "#b45345";
  context.beginPath();
  context.ellipse(4, 92, 34, mouthOpen, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = listening ? "#a16207" : "#0b5f59";
  context.beginPath();
  context.roundRect(-130, 288, 260, 46, 18);
  context.fill();
  context.fillStyle = "#fff";
  context.font = "700 22px Microsoft YaHei, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(listening ? "正在聆听" : speaking ? "正在讲解" : "本地演示数字人", 0, 311);

  context.restore();
}

function startFallbackGuideRenderer() {
  fallbackRendererActive = true;
  fallbackStartedAt = performance.now();
  resizeRenderer();

  const context = canvas.getContext("2d");
  const tick = () => {
    drawFallbackGuide(context, canvas.width, canvas.height, (performance.now() - fallbackStartedAt) / 1000);
    fallbackAnimationFrame = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(fallbackAnimationFrame);
  tick();
}

function autoFitModel(model) {
  if (!model || !stage) return;
  const character = characters.find((item) => item.id === avatarSelect.value);
  const stageRect = stage.getBoundingClientRect();
  const bounds = model.getLocalBounds();
  const widthRatio = character?.stageWidthRatio ?? 0.58;
  const heightRatio = character?.stageHeightRatio ?? 0.82;
  const maxScale = character?.maxScale ?? 0.16;
  const widthScale = (stageRect.width * widthRatio) / Math.max(bounds.width, 1);
  const heightScale = (stageRect.height * heightRatio) / Math.max(bounds.height, 1);
  const scale = Math.min(widthScale, heightScale, maxScale);
  model.scale.set(scale);
  model.anchor?.set(character?.anchorX ?? 0.5, character?.anchorY ?? 0.55);
  model.x = stageRect.width / 2 + (character?.offsetX ?? 0);
  model.y = stageRect.height / 2 + (character?.offsetY ?? 40);
}

async function loadCharacters() {
  const response = await fetch("./assets/live2d/characters.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取数字人角色配置");
  }
  const manifest = await response.json();
  characters = manifest.characters ?? [];
  if (characters.length === 0) {
    throw new Error("角色配置为空");
  }
  avatarSelect.replaceChildren(
    ...characters.map((character) => {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name;
      return option;
    }),
  );
}

async function loadModel(characterId) {
  const character = characters.find((item) => item.id === characterId);
  if (!character) return;

  if (fallbackRendererActive) {
    setStatus(`本地演示数字人已切换为 ${character.name}`, true);
    return;
  }

  setStatus(`正在加载 ${character.name}...`);
  if (activeModel) {
    app.stage.removeChild(activeModel);
    activeModel.destroy();
    activeModel = null;
  }

  activeModel = await PIXI.live2d.Live2DModel.from(character.model);
  app.stage.addChild(activeModel);
  autoFitModel(activeModel);
  setStatus(`${character.name} 已就绪`, true);
}

async function initLive2D() {
  if (!hasLive2DRuntime()) {
    await loadCharacters();
    startFallbackGuideRenderer();
    setStatus("本地演示数字人已就绪（Live2D 运行库未加载）", true);
    window.addEventListener("resize", resizeRenderer);
    return;
  }

  app = new PIXI.Application({
    view: canvas,
    autoStart: true,
    backgroundAlpha: 0,
    antialias: true,
    resizeTo: stage,
  });
  app.ticker.add(
    () => {
      if (guidePerformanceActive) {
        updateGuidePerformance();
      }
    },
    undefined,
    PIXI.UPDATE_PRIORITY.LOW,
  );

  await loadCharacters();
  await loadModel(characters[0].id);
  window.addEventListener("resize", resizeRenderer);
}

function appendMessage(author, text, type = "guide") {
  const item = document.createElement("div");
  item.className = `message ${type}`;
  item.innerHTML = `<strong>${author}</strong><p></p>`;
  item.querySelector("p").textContent = text;
  conversation.appendChild(item);
  conversation.scrollTop = conversation.scrollHeight;
  return item;
}

function stopGuideSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  browserSpeechActive = false;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeAudioSource) {
    try {
      activeAudioSource.stop?.();
    } catch (error) {
      // The source may already have ended.
    }
    activeAudioSource.disconnect?.();
    activeAudioSource = null;
  }
  if (lipSyncAnalyser) {
    lipSyncAnalyser.disconnect?.();
    lipSyncAnalyser = null;
    lipSyncData = null;
  }
  activeLipSyncClip = null;
  stopGuidePerformance();
  preparedAudioQueue = [];
  isAudioQueuePlaying = false;
}

function canUseBrowserSpeechFallback() {
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

function findBrowserTtsVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return (
    voices.find((voice) => voice.name.toLowerCase().includes(BROWSER_TTS_VOICE_NAME.toLowerCase())) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("zh")) ||
    voices[0] ||
    null
  );
}

async function prepareGuideAudio(text) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) return null;

  const response = await fetch("http://127.0.0.1:8001/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleanText }),
  });
  if (!response.ok) {
    throw new Error("语音合成暂不可用");
  }

  const data = await response.json();
  if (!data.audio_src) {
    throw new Error("语音合成没有返回音频");
  }
  return {
    audioUrl: `http://127.0.0.1:8001${data.audio_src}`,
    ttsTimestamps: data.timestamps ?? [],
  };
}

async function playBrowserSpeechFallback(text) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) return;
  if (!canUseBrowserSpeechFallback()) {
    throw new Error("璇煶鎾姤鏆備笉鍙敤");
  }

  await new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.voice = findBrowserTtsVoice();
    lipSyncFallback = true;
    utterance.onstart = () => {
      browserSpeechActive = true;
      setStatus("鏁板瓧浜烘鍦ㄨ闊虫挱鎶?..", true);
      startGuidePerformance();
    };
    utterance.onend = () => {
      browserSpeechActive = false;
      stopGuidePerformance();
      resolve();
    };
    utterance.onerror = () => {
      browserSpeechActive = false;
      stopGuidePerformance();
      reject(new Error("browser speech fallback failed"));
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playAudioUrl(audioUrl, ttsTimestamps = []) {
  const context = ensureAudioContext();
  if (context) {
    await playDecodedAudioBuffer(audioUrl, context, ttsTimestamps);
    return;
  }

  await new Promise((resolve, reject) => {
    activeAudio = new Audio();
    activeAudio.crossOrigin = "anonymous";
    activeAudio.src = audioUrl;
    const context = ensureAudioContext();
    const analyser = setupLipSyncAnalyser();
    if (context && analyser) {
      activeAudioSource = context.createMediaElementSource(activeAudio);
      activeAudioSource.connect(analyser);
    }
    activeAudio.onplay = () => {
      setStatus("数字人正在语音播报...", true);
      audioContext?.resume?.();
      startGuidePerformance();
    };
    activeAudio.onended = () => {
      stopGuidePerformance();
      resolve();
    };
    activeAudio.onerror = reject;
    activeAudio.play().catch(reject);
  });
  activeAudio = null;
  activeAudioSource = null;
  stopGuidePerformance();
}

async function playDecodedAudioBuffer(audioUrl, context, ttsTimestamps = []) {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error("语音音频加载失败");
  }
  const audioBuffer = await context.decodeAudioData(await response.arrayBuffer());
  const source = context.createBufferSource();
  const analyser = setupLipSyncAnalyser();
  if (!analyser) {
    throw new Error("音频分析器不可用");
  }
  source.buffer = audioBuffer;
  source.connect(analyser);
  activeAudioSource = source;
  activeLipSyncClip = buildTimestampLipSyncClip(ttsTimestamps, audioBuffer) ?? buildLipSyncEnvelope(audioBuffer);
  await context.resume?.();
  const startedAt = context.currentTime + LIP_SYNC_START_DELAY_SECONDS;
  activeLipSyncClip.startedAt = startedAt;
  activeLipSyncClip.endsAt = startedAt + audioBuffer.duration + LIP_SYNC_END_GRACE_SECONDS;

  await new Promise((resolve) => {
    source.onended = () => {
      stopGuidePerformance();
      activeAudioSource = null;
      activeLipSyncClip = null;
      resolve();
    };
    setStatus("数字人正在语音播报...", true);
    startGuidePerformance();
    source.start(startedAt);
  });
  stopGuidePerformance();
}

async function playPreparedAudioQueue() {
  if (isAudioQueuePlaying) return;
  isAudioQueuePlaying = true;
  try {
    while (preparedAudioQueue.length > 0) {
      const item = preparedAudioQueue[0];
      const preparedAudio = await item.audioPromise;
      if (preparedAudio?.audioUrl) {
        await playAudioUrl(preparedAudio.audioUrl, preparedAudio.ttsTimestamps);
      } else if (preparedAudio?.speechFallback) {
        await playBrowserSpeechFallback(item.text);
      }
      preparedAudioQueue.shift();
    }
    setStatus("数字人已就绪", true);
  } catch (error) {
    preparedAudioQueue.shift();
    setStatus("语音播报暂不可用", false);
  } finally {
    isAudioQueuePlaying = false;
    if (preparedAudioQueue.length > 0) {
      playPreparedAudioQueue();
    }
  }
}

function queueGuideSpeech(text) {
  const audioPromise = prepareGuideAudio(text).catch(() => ({ speechFallback: true }));
  preparedAudioQueue.push({ text, audioPromise });
  playPreparedAudioQueue();
}

function pickRecorderMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function filenameForAudioBlob(audioBlob) {
  const type = audioBlob.type.toLowerCase();
  if (type.includes("mp4")) return "voice-input.m4a";
  if (type.includes("ogg")) return "voice-input.ogg";
  if (type.includes("wav")) return "voice-input.wav";
  return "voice-input.webm";
}

async function submitVoiceRecording(audioBlob) {
  if (!audioBlob.size) {
    setStatus("没有录到有效语音", false);
    return;
  }

  setVoiceInputState(false, true);
  setStatus("正在识别语音...", true);
  const formData = new FormData();
  formData.append("file", audioBlob, filenameForAudioBlob(audioBlob));

  try {
    const response = await fetch("http://127.0.0.1:8001/api/asr", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("语音识别暂不可用");
    }

    const data = await response.json();
    const transcript = String(data.text ?? "").trim();
    if (!transcript) {
      setStatus("没有识别到有效提问", false);
      return;
    }

    messageInput.value = "";
    setStatus("已识别语音，正在为您讲解...", true);
    answerQuestion(transcript);
  } catch (error) {
    setStatus(error.message || "语音识别暂不可用", false);
  } finally {
    setVoiceInputState(false, false);
  }
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus("当前浏览器不支持语音输入", false);
    return;
  }

  let stream;
  try {
    stopGuideSpeech();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedAudioChunks = [];
    const mimeType = pickRecorderMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) {
        recordedAudioChunks.push(event.data);
      }
    });
    mediaRecorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(recordedAudioChunks, { type: mediaRecorder?.mimeType || mimeType || "audio/webm" });
      mediaRecorder = null;
      setVoiceInputState(false, false);
      submitVoiceRecording(audioBlob);
    });
    mediaRecorder.start();
    voiceRecordingStartedAt = performance.now();
    setVoiceInputState(true, false);
    scheduleVoiceRecordingLimit();
    updateVoiceRecordingDuration();
    setStatus(`正在聆听游客提问，最长 ${VOICE_RECORDING_MAX_SECONDS} 秒，点击停止后识别...`, true);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    setVoiceInputState(false, false);
    setStatus("麦克风暂不可用", false);
  }
}

function stopVoiceRecording() {
  if (mediaRecorder?.state === "recording") {
    setStatus("正在识别语音...", true);
    mediaRecorder.stop();
  }
}

function extractCompletedSentences(buffer) {
  const sentences = [];
  let lastEnd = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    if ("。！？!?；;".includes(buffer[index])) {
      sentences.push(buffer.slice(lastEnd + 1, index + 1).trim());
      lastEnd = index;
    }
  }
  return {
    sentences: sentences.filter(Boolean),
    rest: buffer.slice(lastEnd + 1),
  };
}

async function answerQuestion(question) {
  stopGuideSpeech();
  appendMessage("游客", question, "user");
  const replyItem = appendMessage("数字人导游", "正在思考...", "guide");
  const replyText = replyItem.querySelector("p");
  resetGuideParameters();
  let speechBuffer = "";

  try {
    const response = await fetch("http://127.0.0.1:8001/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        history: chatHistory.slice(-8),
      }),
    });

    if (!response.ok || !(response.body instanceof ReadableStream)) {
      throw new Error("导游服务暂时不可用");
    }

    replyText.textContent = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullReply = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullReply += chunk;
      speechBuffer += chunk;
      replyText.textContent = fullReply;
      const completed = extractCompletedSentences(speechBuffer);
      completed.sentences.forEach(queueGuideSpeech);
      speechBuffer = completed.rest;
      conversation.scrollTop = conversation.scrollHeight;
    }

    const finalReply = fullReply.trim() || "我在这里，您可以继续问我景区相关问题。";
    replyText.textContent = finalReply;
    if (speechBuffer.trim()) {
      queueGuideSpeech(speechBuffer.trim());
    }
    chatHistory = [
      ...chatHistory,
      { role: "user", content: question },
      { role: "assistant", content: finalReply },
    ].slice(-8);
  } catch (error) {
    replyText.textContent = "导游服务暂时没有连接成功，请稍后再试。";
  }
}

avatarSelect.addEventListener("change", () => {
  loadModel(avatarSelect.value).catch((error) => setStatus(error.message));
});

backgroundUpload.addEventListener("change", () => {
  const [file] = backgroundUpload.files ?? [];
  if (!file) return;
  const imageUrl = URL.createObjectURL(file);
  stage.style.backgroundImage = `url("${imageUrl}")`;
  stage.classList.add("has-custom-background");
});

clearBackground.addEventListener("click", () => {
  stage.style.backgroundImage = "";
  stage.classList.remove("has-custom-background");
  backgroundUpload.value = "";
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = messageInput.value.trim();
  if (!question) return;
  messageInput.value = "";
  answerQuestion(question);
});

voiceInputButton.addEventListener("click", () => {
  if (isVoiceRecording) {
    stopVoiceRecording();
    return;
  }
  startVoiceRecording();
});

quickQuestions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-question]");
  if (!button) return;
  answerQuestion(button.dataset.question);
});

routeActions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-question]");
  if (!button) return;
  answerQuestion(button.dataset.question);
});

feedbackPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-feedback]");
  if (!button) return;
  appendMessage("系统", `已记录反馈：${button.dataset.feedback}`, "guide");
});

initLive2D().catch((error) => {
  setStatus(error.message);
});
