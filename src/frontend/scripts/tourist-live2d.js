const stage = document.getElementById("live2d-stage");
const canvas = document.getElementById("live2dCanvas");
const backgroundImage = document.getElementById("backgroundImage");
const avatarSelect = document.getElementById("avatarSelect");
const backgroundUpload = document.getElementById("backgroundUpload");
const clearBackground = document.getElementById("clearBackground");
const stageStatus = document.getElementById("stageStatus");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const voiceInputButton = document.getElementById("voiceInputButton");
const imageUpload = document.getElementById("imageUpload");
const conversation = document.getElementById("conversation");
const clearConversationButton = document.getElementById("clearConversationButton");
const spotSelector = document.getElementById("spotSelector");
const spotTitle = document.getElementById("spotTitle");
const spotDescription = document.getElementById("spotDescription");
const spotImage = document.getElementById("spotImage");
const spotCommentList = document.getElementById("spotCommentList");
const spotCommentCount = document.getElementById("spotCommentCount");
const spotCommentForm = document.getElementById("spotCommentForm");
const spotCommentInput = document.getElementById("spotCommentInput");
const spotCommentImage = document.getElementById("spotCommentImage");

let app;
let activeModel;
let fallbackRendererActive = false;
let fallbackAnimationFrame;
let fallbackStartedAt = 0;
let characters = [];
let activeAvatarId = "";
let chatHistory = [];
let preparedAudioQueue = [];
let isAudioQueuePlaying = false;
let activeTextRevealCancel = null;
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
let pendingImageDataUrl = null;
let pendingImageName = "";

const FACE_FORWARD_ANGLE_X = 0;
const FACE_FORWARD_ANGLE_Y = 0;
const LIP_SYNC_FRAME_RATE = 60;
const LIP_SYNC_START_DELAY_SECONDS = 0.04;
const LIP_SYNC_END_GRACE_SECONDS = 0.12;
const LIP_SYNC_DEFAULT_OUTPUT_DELAY_SECONDS = 0.06;
const LIP_SYNC_OFFSET_STORAGE_KEY = "cyra:tourist:lip-sync-offset-seconds";
const LIP_SYNC_VOICE_ACTIVITY_THRESHOLD = 0.045;
const MIN_SPEECH_MOUTH_OPEN = 0.34;
const SPEAKING_HEAD_SWAY_X = 0.8;
const SPEAKING_HEAD_SWAY_Y = 0.55;
const SPEAKING_HEAD_SWAY_Z = 0.7;
const SPEAKING_BODY_SWAY_X = 1.2;
const SPEAKING_BODY_SWAY_Y = 0.45;
const GUIDE_GESTURE_CYCLE_SECONDS = 5.4;
const GUIDE_WAVE_SECONDS = 1.7;
const GUIDE_PRESENT_START_SECONDS = 2.45;
const GUIDE_PRESENT_SECONDS = 1.55;
const VOICE_RECORDING_MAX_SECONDS = 12;
const CHAT_IMAGE_MAX_EDGE = 1280;
const CHAT_IMAGE_QUALITY = 0.82;
const BROWSER_TTS_VOICE_NAME = "Chelsie";
const VOICE_ICON = "🎙";
const DEFAULT_MESSAGE_PLACEHOLDER = messageInput.getAttribute("placeholder") || "";
const VOICE_RECORDING_PLACEHOLDER = "正在录音 {duration}，再次点击话筒结束";
const COMPOSER_SAFE_AREA_HEIGHT = 220;
const MODEL_COMPOSER_GAP = 18;
const SPEECH_HARD_BREAKS = "。！？!?；;";
const SPEECH_SOFT_BREAKS = "，,、：:";
const SPEECH_SOFT_BREAK_MIN_CHARS = 16;
const SPEECH_CHUNK_MIN_CHARS = 40;
const SPEECH_CHUNK_MAX_CHARS = 58;
const TEXT_REVEAL_CHARS_PER_SECOND = 5.8;
const EMPTY_MOUTH_STATE = Object.freeze({ a: 0, i: 0, u: 0, e: 0, o: 0 });
const CONVERSATION_HISTORY_STORAGE_KEY = "cyra:tourist:conversation-history";
const MAX_CONVERSATION_HISTORY_RECORDS = 24;
const INITIAL_GUIDE_MESSAGE = "您好，我可以介绍灵山大佛、九龙灌浴、梵宫，也可以帮您推荐游览路线。";
const SPOT_COMMENTS_STORAGE_KEY = "cyra:tourist:spot-comments";
const MAX_SPOT_COMMENTS_PER_SPOT = 30;
const SCENIC_SPOTS = [
  {
    id: "lingshan-buddha",
    name: "灵山大佛",
    image: "./assets/scenic-spots/lingshan-buddha.png",
    description: "灵山大佛是灵山胜境的核心景观，适合礼佛祈福、远眺湖山与拍摄主轴线景观。",
    comments: [
      "广场视野很开阔，沿着主轴线走过去很有仪式感。",
      "建议傍晚前去，光线柔和，拍照效果更好。",
    ],
  },
  {
    id: "jiulong",
    name: "九龙灌浴",
    image: "./assets/scenic-spots/jiulong.png",
    description: "九龙灌浴以动态演出和广场景观为特色，适合安排在入园后的第一段游览。",
    comments: ["演出时间要提前看好，站在广场中后段比较容易看全景。"],
  },
  {
    id: "fangong",
    name: "梵宫",
    image: "./assets/scenic-spots/fangong.png",
    description: "梵宫以建筑、壁画和室内空间体验为主，适合慢慢参观，也适合雨天游览。",
    comments: ["室内细节很多，留足时间会更舒服。"],
  },
  {
    id: "wuyin",
    name: "五印坛城",
    image: "./assets/scenic-spots/wuyin.png",
    description: "五印坛城具有鲜明的建筑风格，适合了解文化主题，也适合拍摄建筑细节。",
    comments: ["建筑颜色很醒目，晴天拍出来层次感很好。"],
  },
];

let conversationRecords = [];
let spotCommentsById = {};

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
  voiceInputButton.textContent = busy ? "..." : VOICE_ICON;
  voiceInputButton.disabled = busy;
  voiceInputButton.classList.toggle("recording", recording);
  if (!recording) {
    messageInput.placeholder = DEFAULT_MESSAGE_PLACEHOLDER;
  }
}

function formatRecordingDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatRecordingPlaceholder(seconds) {
  return VOICE_RECORDING_PLACEHOLDER.replace("{duration}", formatRecordingDuration(seconds));
}

function updateVoiceRecordingDuration() {
  if (!isVoiceRecording) return;
  const elapsed = (performance.now() - voiceRecordingStartedAt) / 1000;
  messageInput.placeholder = formatRecordingPlaceholder(elapsed);
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

function writeModelParameterValue(coreModel, id, value) {
  let wrote = false;
  try {
    if (coreModel?.setParameterValueById) {
      coreModel.setParameterValueById(id, value);
      wrote = true;
    }
  } catch (error) {
    // Different Live2D models may omit optional guide-motion parameters.
  }
  try {
    if (coreModel?.addParameterValueById) {
      coreModel.addParameterValueById(id, value, 1);
      wrote = true;
    }
  } catch (error) {
    // Some runtimes only expose index-based writes.
  }
  try {
    if (coreModel?.getParameterIndex && coreModel?.setParameterValueByIndex) {
      const index = coreModel.getParameterIndex(id);
      if (Number.isInteger(index) && index >= 0) {
        coreModel.setParameterValueByIndex(index, value, 1);
        wrote = true;
      }
    }
  } catch (error) {
    // Ignore unsupported parameter APIs.
  }
  return wrote;
}

function setModelParameter(id, value) {
  const coreModel = activeModel?.internalModel?.coreModel;
  if (!coreModel) return;
  writeModelParameterValue(coreModel, id, value);
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

function resetGuideGestureParameters() {
  applyGuideGestureState({});
}

function resetGuideParameters() {
  resetMouthParameters();
  applyForwardGaze();
  resetGuideGestureParameters();
}

function applyForwardGaze({
  headX = FACE_FORWARD_ANGLE_X,
  headY = FACE_FORWARD_ANGLE_Y,
  headZ = 0,
  bodyX = 0,
  bodyY = 0,
  bodyZ = 0,
  breath = 0,
} = {}) {
  setModelParameter("ParamAngleX", headX);
  setModelParameter("ParamAngleY", headY);
  setModelParameter("ParamAngleZ", headZ);
  setModelParameter("ParamEyeBallX", 0);
  setModelParameter("ParamEyeBallY", 0);
  setModelParameter("ParamBodyAngleX", bodyX);
  setModelParameter("ParamBodyAngleY", bodyY);
  setModelParameter("ParamBodyAngleZ", bodyZ);
  setModelParameter("ParamBreath", breath);
}

function applySpeakingMotion(elapsed) {
  applyForwardGaze({
    headX: FACE_FORWARD_ANGLE_X + Math.sin(elapsed * 0.85) * SPEAKING_HEAD_SWAY_X,
    headY: FACE_FORWARD_ANGLE_Y + Math.sin(elapsed * 0.65 + 0.5) * SPEAKING_HEAD_SWAY_Y,
    headZ: Math.sin(elapsed * 0.72 + 1.2) * SPEAKING_HEAD_SWAY_Z,
    bodyX: Math.sin(elapsed * 0.5) * SPEAKING_BODY_SWAY_X,
    bodyY: Math.sin(elapsed * 0.46 + 0.9) * SPEAKING_BODY_SWAY_Y,
    breath: 0.45 + Math.sin(elapsed * 1.25) * 0.12,
  });
  applyGuideGestureState(readGuideGestureState(elapsed));
}

function gestureEnvelope(progress) {
  return Math.sin(Math.PI * clamp01(progress));
}

function readGuideGestureState(elapsed) {
  const cycle = elapsed % GUIDE_GESTURE_CYCLE_SECONDS;
  if (cycle < GUIDE_WAVE_SECONDS) {
    const progress = cycle / GUIDE_WAVE_SECONDS;
    const envelope = gestureEnvelope(progress);
    const wave = Math.sin(progress * Math.PI * 6) * envelope;
    return {
      rightArm1: 22 * envelope,
      rightArm2: -28 * envelope + wave * 10,
      rightArm3: -12 * envelope + wave * 8,
      rightHand: wave * 24,
      rightShoulder: 10 * envelope,
    };
  }

  const presentProgress = (cycle - GUIDE_PRESENT_START_SECONDS) / GUIDE_PRESENT_SECONDS;
  if (presentProgress >= 0 && presentProgress <= 1) {
    const envelope = gestureEnvelope(presentProgress);
    return {
      rightArm1: 10 * envelope,
      rightArm2: -12 * envelope,
      rightArm3: 8 * envelope,
      rightHand: 12 * envelope,
      leftArm1: -14 * envelope,
      leftArm2: 16 * envelope,
      leftArm3: -8 * envelope,
      leftHand: -10 * envelope,
    };
  }

  return {};
}

function applyGuideGestureState(state) {
  setModelParameter("ParamRightShoulderUp", state.rightShoulder ?? 0);
  setModelParameter("ParamArmRA01", state.rightArm1 ?? 0);
  setModelParameter("ParamArmRA02", state.rightArm2 ?? 0);
  setModelParameter("ParamArmRA03", state.rightArm3 ?? 0);
  setModelParameter("ParamHandRA", state.rightHand ?? 0);
  setModelParameter("ParamArmLA01", state.leftArm1 ?? 0);
  setModelParameter("ParamArmLA02", state.leftArm2 ?? 0);
  setModelParameter("ParamArmLA03", state.leftArm3 ?? 0);
  setModelParameter("ParamHandLA", state.leftHand ?? 0);
}

function disableGuidePointerTracking(model) {
  if (!model) return;
  model.interactive = false;
  model.buttonMode = false;
  model.eventMode = "none";
  model.cursor = "default";
  model.removeAllListeners?.("pointermove");
  model.removeAllListeners?.("pointerover");
  model.removeAllListeners?.("pointerout");
  model.removeAllListeners?.("mousemove");
  model.removeAllListeners?.("mouseover");
  model.removeAllListeners?.("mouseout");
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

function readLipSyncManualOffsetSeconds() {
  try {
    const stored = Number(window.localStorage?.getItem(LIP_SYNC_OFFSET_STORAGE_KEY));
    return Number.isFinite(stored) ? Math.max(-0.25, Math.min(0.25, stored)) : 0;
  } catch {
    return 0;
  }
}

function readAudioOutputDelaySeconds() {
  const latency = Number(audioContext?.outputLatency || audioContext?.baseLatency);
  const safeLatency = Number.isFinite(latency) ? Math.max(0, Math.min(0.18, latency)) : 0;
  return Math.max(LIP_SYNC_DEFAULT_OUTPUT_DELAY_SECONDS, safeLatency);
}

function readActiveLipSyncPosition() {
  if (!activeLipSyncClip || !audioContext) return null;
  const rawPosition = audioContext.currentTime - activeLipSyncClip.startedAt;
  return rawPosition - readAudioOutputDelaySeconds() + readLipSyncManualOffsetSeconds();
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
  if (!activeLipSyncClip.values || activeLipSyncClip.values.length === 0) return 0;
  const position = readActiveLipSyncPosition();
  if (position === null) return 0;
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

function buildTimestampLipSyncClip(ttsTimestamps, audioBuffer, envelopeClip) {
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
    frameRate: envelopeClip?.frameRate ?? LIP_SYNC_FRAME_RATE,
    values: envelopeClip?.values ?? null,
    startedAt: 0,
    endsAt: 0,
  };
}

function buildArkitExpressionLipSyncClip(arkitExpressions, audioBuffer, envelopeClip) {
  const frames = (arkitExpressions?.frames ?? [])
    .map((frame) => {
      const time = Number(frame.time_ms) / 1000;
      const values = frame.values ?? {};
      if (!Number.isFinite(time)) return null;
      return {
        time,
        jawOpen: clamp01(Number(values.jawOpen) || 0),
        mouthFunnel: clamp01(Number(values.mouthFunnel) || 0),
        mouthPucker: clamp01(Number(values.mouthPucker) || 0),
        mouthSmileLeft: clamp01(Number(values.mouthSmileLeft) || 0),
        mouthSmileRight: clamp01(Number(values.mouthSmileRight) || 0),
        mouthStretchLeft: clamp01(Number(values.mouthStretchLeft) || 0),
        mouthStretchRight: clamp01(Number(values.mouthStretchRight) || 0),
        mouthClose: clamp01(Number(values.mouthClose) || 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.time - right.time);

  if (frames.length === 0) return null;
  return {
    duration: audioBuffer.duration,
    arkitFrames: frames,
    frameRate: Number(arkitExpressions?.frame_rate) || envelopeClip?.frameRate || LIP_SYNC_FRAME_RATE,
    values: envelopeClip?.values ?? null,
    startedAt: 0,
    endsAt: 0,
  };
}

function readArkitExpressionMouthState() {
  if (!activeLipSyncClip?.arkitFrames || !audioContext) return EMPTY_MOUTH_STATE;
  const position = readActiveLipSyncPosition();
  if (position === null) return EMPTY_MOUTH_STATE;
  if (position < 0 || position > activeLipSyncClip.duration) return EMPTY_MOUTH_STATE;

  const frames = activeLipSyncClip.arkitFrames;
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (frames[mid].time <= position) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  const lowerIndex = low;
  const lower = frames[lowerIndex];
  const upper = frames[Math.min(frames.length - 1, lowerIndex + 1)];
  const span = Math.max(0.001, upper.time - lower.time);
  const weight = clamp01((position - lower.time) / span);
  const blend = (field) => clamp01((lower[field] || 0) + ((upper[field] || 0) - (lower[field] || 0)) * weight);
  const jawOpen = blend("jawOpen");
  const rounded = Math.max(blend("mouthFunnel"), blend("mouthPucker"));
  const smile = Math.max(blend("mouthSmileLeft"), blend("mouthSmileRight"));
  const stretch = Math.max(blend("mouthStretchLeft"), blend("mouthStretchRight"));
  const close = blend("mouthClose");
  const open = clamp01(Math.max(0, jawOpen - close * 0.25));
  return {
    a: clamp01(Math.max(open * 0.85, stretch * 0.48, smile * 0.22)),
    i: clamp01(stretch * 0.68 + smile * 0.2),
    u: clamp01(rounded * 0.72),
    e: clamp01(stretch * 0.48 + smile * 0.28),
    o: clamp01(rounded * 0.82 + open * 0.18),
  };
}

function readTimestampLipSyncMouthState() {
  if (!activeLipSyncClip?.words || !audioContext) return EMPTY_MOUTH_STATE;
  const position = readActiveLipSyncPosition();
  if (position === null) return EMPTY_MOUTH_STATE;
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

function hasActiveAudioEnergy(audioEnergy) {
  return Number.isFinite(audioEnergy) && audioEnergy >= LIP_SYNC_VOICE_ACTIVITY_THRESHOLD;
}

function scaleAudioEnergyToMouthOpen(audioEnergy) {
  if (!hasActiveAudioEnergy(audioEnergy)) return 0;
  return clamp01(Math.max(audioEnergy * 1.04, MIN_SPEECH_MOUTH_OPEN * 0.58));
}

function keepMinimumMouthShapeWhenAudioEnergyIsMissing(mouthState) {
  const state = {
    a: clamp01(mouthState.a || 0),
    i: clamp01(mouthState.i || 0),
    u: clamp01(mouthState.u || 0),
    e: clamp01(mouthState.e || 0),
    o: clamp01(mouthState.o || 0),
  };
  const strongest = Math.max(state.a, state.i, state.u, state.e, state.o);
  if (strongest <= 0) {
    return EMPTY_MOUTH_STATE;
  }

  const open = Math.max(MIN_SPEECH_MOUTH_OPEN * 0.52, Math.min(strongest, MIN_SPEECH_MOUTH_OPEN * 0.82));
  const scale = open / strongest;
  return {
    a: Math.max(state.a * scale, open * 0.35),
    i: state.i * scale,
    u: state.u * scale,
    e: state.e * scale,
    o: state.o * scale,
  };
}

function gateMouthStateWithAudioEnergy(mouthState, audioEnergy) {
  if (!hasActiveAudioEnergy(audioEnergy)) {
    return keepMinimumMouthShapeWhenAudioEnergyIsMissing(mouthState);
  }

  const open = scaleAudioEnergyToMouthOpen(audioEnergy);
  const state = {
    a: clamp01(mouthState.a || 0),
    i: clamp01(mouthState.i || 0),
    u: clamp01(mouthState.u || 0),
    e: clamp01(mouthState.e || 0),
    o: clamp01(mouthState.o || 0),
  };
  const strongest = Math.max(state.a, state.i, state.u, state.e, state.o);
  if (strongest <= 0) {
    state.a = open;
    return state;
  }

  const visemeScale = open / strongest;
  state.a = Math.max(state.a * visemeScale, open * 0.38);
  state.i *= visemeScale;
  state.u *= visemeScale;
  state.e *= visemeScale;
  state.o *= visemeScale;
  if (open < MIN_SPEECH_MOUTH_OPEN * 0.7) {
    state.a *= 0.7;
  }
  return state;
}

function readDrivenMouthState(shapeState) {
  return gateMouthStateWithAudioEnergy(shapeState, readScheduledLipSyncMouthValue());
}

function readFallbackMouthState(elapsed) {
  const audioEnergy = activeLipSyncClip
    ? readScheduledLipSyncMouthValue()
    : lipSyncFallback
    ? 0.2 + Math.abs(Math.sin(elapsed * 9.5)) * 0.55
    : readLipSyncMouthValue();
  if (activeLipSyncClip && !hasActiveAudioEnergy(audioEnergy)) {
    return EMPTY_MOUTH_STATE;
  }
  const pulse = readSpeechMouthPulse(elapsed);
  const target = Math.max(audioEnergy, pulse * 0.72);
  const open = clamp01(Math.max(target * 0.82, MIN_SPEECH_MOUTH_OPEN * 0.5));
  return {
    a: open,
    i: 0,
    u: 0,
    e: 0,
    o: 0,
  };
}

function readContinuousSpeechMouthState(elapsed) {
  const primary = Math.abs(Math.sin(elapsed * 10.5));
  const secondary = Math.abs(Math.sin(elapsed * 16.2 + 0.7));
  const open = clamp01(MIN_SPEECH_MOUTH_OPEN * 0.55 + Math.max(primary * 0.42, secondary * 0.22));
  return {
    a: open,
    i: 0,
    u: 0,
    e: 0,
    o: 0,
  };
}

function readVisibleMouthState(elapsed) {
  return readContinuousSpeechMouthState(elapsed);
}

function applyMouthState(mouthState) {
  const mouthOpen = Math.max(mouthState.a, mouthState.i, mouthState.u, mouthState.e, mouthState.o);
  setModelParameter("ParamA", mouthOpen);
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
  const visibleMouthState = readVisibleMouthState(elapsed);

  resetMouthParameters();
  applyMouthState(visibleMouthState);
  applySpeakingMotion(elapsed);
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
  const fallbackGuideBottomY = Math.max(logicalHeight - COMPOSER_SAFE_AREA_HEIGHT, logicalHeight * 0.56) - MODEL_COMPOSER_GAP;
  const scale = Math.min(logicalWidth / 760, fallbackGuideBottomY / 640, 1.02);
  const centerY = fallbackGuideBottomY - 334 * scale;
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
  const selectedCharacterId = avatarSelect?.value || characters[0]?.id;
  const character = characters.find((item) => item.id === selectedCharacterId);
  const stageRect = stage.getBoundingClientRect();
  const bounds = model.getLocalBounds();
  const availableStageHeight = Math.max(stageRect.height - COMPOSER_SAFE_AREA_HEIGHT, stageRect.height * 0.56);
  const widthRatio = character?.stageWidthRatio ?? 0.58;
  const heightRatio = character?.stageHeightRatio ?? 0.82;
  const maxScale = character?.maxScale ?? 0.16;
  const widthScale = (stageRect.width * widthRatio) / Math.max(bounds.width, 1);
  const heightScale = (availableStageHeight * heightRatio) / Math.max(bounds.height, 1);
  const scale = Math.min(widthScale, heightScale, maxScale);
  const anchorX = character?.anchorX ?? 0.5;
  const anchorY = character?.anchorY ?? 0.55;
  const scaledModelHeight = bounds.height * scale;
  const scaledModelBottom = (bounds.y + bounds.height) * scale;
  const composerTop = Math.max(stageRect.height - COMPOSER_SAFE_AREA_HEIGHT, stageRect.height * 0.56);
  const modelBottomY = composerTop - MODEL_COMPOSER_GAP;
  model.scale.set(scale);
  model.anchor?.set(anchorX, anchorY);
  model.x = stageRect.width / 2 + (character?.offsetX ?? 0);
  model.y = modelBottomY - scaledModelBottom + (character?.offsetY ?? 0);
}

async function loadBackendCharacters() {
  const response = await fetch("http://127.0.0.1:8001/api/avatar/manifest", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("avatar manifest unavailable");
  }
  return response.json();
}

async function loadStaticCharacters() {
  const response = await fetch("./assets/live2d/characters.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取数字人角色配置");
  }
  return response.json();
}

function applyCharacterManifest(manifest) {
  characters = manifest.characters ?? manifest.avatars ?? [];
  activeAvatarId = manifest.active_avatar_id ?? manifest.active_avatar?.id ?? characters[0]?.id ?? "";
  if (characters.length === 0) {
    throw new Error("角色配置为空");
  }
  if (avatarSelect) {
    avatarSelect.replaceChildren(
      ...characters.map((character) => {
        const option = document.createElement("option");
        option.value = character.id;
        option.textContent = character.name;
        return option;
      }),
    );
    if (activeAvatarId && characters.some((character) => character.id === activeAvatarId)) {
      avatarSelect.value = activeAvatarId;
    }
  }
}

function selectInitialCharacterId() {
  if (activeAvatarId && characters.some((character) => character.id === activeAvatarId)) {
    return activeAvatarId;
  }
  return characters[0]?.id;
}

function describeLive2DLoadError(error, character) {
  const message = String(error?.message || error || "");
  const modelName = character?.name || "当前形象";
  if (/moc3|Core unsupport|unsupported|version/i.test(message)) {
    return `${modelName} 模型版本不兼容：moc3 v6 / Cubism 5.3 导出包无法被当前游客端运行时解析，请用兼容的 Cubism 版本重新导出运行时包。`;
  }
  if (/fetch|network|404|not found|load/i.test(message)) {
    return `${modelName} 模型资源加载失败，请检查形象包内 model3、moc3、贴图和动作文件是否完整。`;
  }
  return `${modelName} 模型解析失败，请检查 Live2D 运行时包是否与当前游客端兼容。`;
}

async function loadCharacters() {
  try {
    applyCharacterManifest(await loadBackendCharacters());
  } catch {
    applyCharacterManifest(await loadStaticCharacters());
  }
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

  try {
    activeModel = await PIXI.live2d.Live2DModel.from(character.model, { autoInteract: false });
  } catch (error) {
    console.error("Live2D model load failed", {
      id: character.id,
      name: character.name,
      model: character.model,
      error,
    });
    throw new Error(describeLive2DLoadError(error, character));
  }
  disableGuidePointerTracking(activeModel);
  app.stage.addChild(activeModel);
  autoFitModel(activeModel);
  resetGuideParameters();
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
      } else {
        applyForwardGaze();
      }
    },
    undefined,
    PIXI.UPDATE_PRIORITY.LOW,
  );

  await loadCharacters();
  await loadModel(selectInitialCharacterId());
  window.addEventListener("resize", resizeRenderer);
}

function isConversationPinnedToBottom() {
  const distanceToBottom = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight;
  return distanceToBottom <= 36;
}

function scrollConversationToBottom() {
  conversation.scrollTop = conversation.scrollHeight;
}

function scrollConversationToBottomIfPinned(wasPinned, forceScroll = false) {
  if (forceScroll || wasPinned) {
    scrollConversationToBottom();
  }
}

function appendMessage(author, text, type = "guide", { forceScroll = true } = {}) {
  const wasPinned = isConversationPinnedToBottom();
  const item = document.createElement("div");
  item.className = `message ${type}`;
  item.innerHTML = `<strong>${author}</strong><p></p>`;
  item.querySelector("p").textContent = text;
  conversation.appendChild(item);
  scrollConversationToBottomIfPinned(wasPinned, forceScroll);
  return item;
}

function matchingScenicSpots(text) {
  return SCENIC_SPOTS.filter((spot) => text.includes(spot.name));
}

function appendScenicReferences(messageItem, text) {
  const matches = matchingScenicSpots(text);
  if (matches.length === 0 || messageItem.querySelector(".scenic-reference-list")) return;

  const list = document.createElement("div");
  list.className = "scenic-reference-list";
  matches.forEach((spot) => {
    const figure = document.createElement("figure");
    figure.className = "scenic-reference";
    const image = document.createElement("img");
    image.src = spot.image;
    image.alt = `${spot.name}景点参考插画`;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = `${spot.name} · 景点参考插画`;
    figure.append(image, caption);
    list.appendChild(figure);
  });
  messageItem.appendChild(list);
}

function getFallbackSpotComments() {
  return Object.fromEntries(
    SCENIC_SPOTS.map((spot) => [
      spot.id,
      spot.comments.map((content, index) => ({
        author: index === 0 ? "游客 A" : "游客 B",
        content,
      })),
    ]),
  );
}

function loadSpotComments() {
  try {
    const stored = JSON.parse(localStorage.getItem(SPOT_COMMENTS_STORAGE_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return getFallbackSpotComments();
    }

    const fallback = getFallbackSpotComments();
    return Object.fromEntries(
      SCENIC_SPOTS.map((spot) => {
        const records = Array.isArray(stored[spot.id]) ? stored[spot.id] : fallback[spot.id];
        return [
          spot.id,
          records
            .map((record, index) => ({
              author: String(record?.author || `游客 ${index + 1}`),
              content: String(record?.content || "").trim(),
            }))
            .filter((record) => record.content)
            .slice(-MAX_SPOT_COMMENTS_PER_SPOT),
        ];
      }),
    );
  } catch (error) {
    return getFallbackSpotComments();
  }
}

function saveSpotComments() {
  try {
    localStorage.setItem(SPOT_COMMENTS_STORAGE_KEY, JSON.stringify(spotCommentsById));
  } catch (error) {
    // Browsers may block localStorage in private or restricted contexts.
  }
}

function createSpotCommentElement(comment) {
  const item = document.createElement("article");
  item.className = "spot-comment";
  const author = document.createElement("strong");
  author.textContent = comment.author;
  const content = document.createElement("p");
  content.textContent = comment.content;
  item.append(author, content);
  if (comment.image_url) {
    const image = document.createElement("img");
    image.className = "spot-comment-photo";
    image.src = `http://127.0.0.1:8001${comment.image_url}`;
    image.alt = `${spotTitle?.textContent || "景点"}游客实拍`;
    image.loading = "lazy";
    item.appendChild(image);
  }
  return item;
}

function renderCurrentSpot() {
  if (!spotSelector || !spotTitle || !spotDescription || !spotCommentList) return;
  const selectedSpot = SCENIC_SPOTS.find((spot) => spot.id === spotSelector.value) ?? SCENIC_SPOTS[0];
  const comments = spotCommentsById[selectedSpot.id] ?? [];

  spotTitle.textContent = selectedSpot.name;
  spotDescription.textContent = selectedSpot.description;
  if (spotImage) {
    spotImage.src = selectedSpot.image;
    spotImage.alt = `${selectedSpot.name}景点参考插画`;
  }
  if (spotCommentCount) {
    spotCommentCount.textContent = `${comments.length} 条`;
  }

  if (comments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "spot-empty-comments";
    empty.textContent = "还没有游客评论，欢迎留下第一条感受。";
    spotCommentList.replaceChildren(empty);
    return;
  }

  spotCommentList.replaceChildren(...comments.map(createSpotCommentElement));
  spotCommentList.scrollTop = spotCommentList.scrollHeight;
}

async function submitSpotComment(content, imageFile) {
  if (!spotSelector) return;
  const selectedSpotId = spotSelector.value || SCENIC_SPOTS[0].id;
  const cleanContent = content.trim();
  if (!cleanContent) return;
  const formData = new FormData();
  formData.append("spot_id", selectedSpotId);
  formData.append("content", cleanContent);
  if (imageFile) formData.append("image", imageFile, imageFile.name);
  const response = await fetch("http://127.0.0.1:8001/api/comments", { method: "POST", body: formData });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "评论提交失败");
  }
  setStatus("评论已提交，管理员审核通过后将公开展示", true);
}

async function loadApprovedSpotComments() {
  try {
    const response = await fetch("http://127.0.0.1:8001/api/comments");
    if (!response.ok) throw new Error("评论服务不可用");
    const data = await response.json();
    const grouped = Object.fromEntries(SCENIC_SPOTS.map((spot) => [spot.id, []]));
    (data.items || []).forEach((comment) => {
      if (grouped[comment.spot_id]) grouped[comment.spot_id].push(comment);
    });
    spotCommentsById = grouped;
  } catch (error) {
    spotCommentsById = loadSpotComments();
  }
  renderCurrentSpot();
}

function initSpotComments() {
  if (!spotSelector || !spotCommentForm || !spotCommentInput) return;
  spotSelector.replaceChildren(
    ...SCENIC_SPOTS.map((spot) => {
      const option = document.createElement("option");
      option.value = spot.id;
      option.textContent = spot.name;
      return option;
    }),
  );
  spotCommentsById = loadSpotComments();
  renderCurrentSpot();
  loadApprovedSpotComments();
}

function saveConversationHistory() {
  try {
    localStorage.setItem(CONVERSATION_HISTORY_STORAGE_KEY, JSON.stringify(conversationRecords.slice(-MAX_CONVERSATION_HISTORY_RECORDS)));
  } catch (error) {
    // Browsers may block localStorage in private or restricted contexts.
  }
}

function clearConversationHistory() {
  if (!window.confirm("确定清空当前浏览器中的全部对话记录吗？")) return;
  stopGuideSpeech();
  conversationRecords = [];
  chatHistory = [];
  pendingImageDataUrl = null;
  pendingImageName = "";
  localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
  conversation.replaceChildren();
  appendMessage("数字人导游", INITIAL_GUIDE_MESSAGE, "guide", { forceScroll: false });
  setStatus("对话记录已清空", true);
}

function restoreConversationHistory() {
  let records = [];
  try {
    records = JSON.parse(localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY) || "[]");
  } catch (error) {
    records = [];
  }
  if (!Array.isArray(records) || records.length === 0) return;

  conversationRecords = records
    .map((record) => ({
      role: record?.role === "assistant" ? "assistant" : "user",
      content: String(record?.content ?? "").trim(),
    }))
    .filter((record) => record.content)
    .slice(-MAX_CONVERSATION_HISTORY_RECORDS);
  if (conversationRecords.length === 0) return;

  conversation.replaceChildren();
  conversationRecords.forEach((record) => {
    const isUser = record.role === "user";
    const item = appendMessage(isUser ? "游客" : "数字人导游", record.content, isUser ? "user" : "guide", { forceScroll: false });
    if (!isUser) appendScenicReferences(item, record.content);
  });
  scrollConversationToBottom();
  chatHistory = conversationRecords
    .map((record) => ({ role: record.role === "assistant" ? "assistant" : "user", content: record.content }))
    .slice(-8);
}

function rememberConversationTurn(question, answer) {
  const cleanQuestion = question.trim();
  const cleanAnswer = answer.trim();
  if (!cleanQuestion || !cleanAnswer) return;
  conversationRecords = [
    ...conversationRecords,
    { role: "user", content: cleanQuestion },
    { role: "assistant", content: cleanAnswer },
  ].slice(-MAX_CONVERSATION_HISTORY_RECORDS);
  chatHistory = conversationRecords
    .map((record) => ({ role: record.role === "assistant" ? "assistant" : "user", content: record.content }))
    .slice(-8);
  saveConversationHistory();
}

function appendImageMessage(file) {
  const imageUrl = URL.createObjectURL(file);
  const item = appendMessage("游客", "已上传图片：" + file.name, "user");
  const preview = document.createElement("img");
  preview.className = "image-preview";
  preview.src = imageUrl;
  preview.alt = file.name;
  preview.onload = () => URL.revokeObjectURL(imageUrl);
  item.appendChild(preview);
  setStatus("图片已添加，可继续输入问题", true);
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function prepareChatImageDataUrl(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("仅支持 PNG、JPG 或 WebP 图片");
  }
  const sourceDataUrl = await readFileAsDataUrl(file);
  const sourceImage = await loadImageElement(sourceDataUrl);
  const scale = Math.min(1, CHAT_IMAGE_MAX_EDGE / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const canvasElement = document.createElement("canvas");
  canvasElement.width = width;
  canvasElement.height = height;
  const context = canvasElement.getContext("2d");
  context.drawImage(sourceImage, 0, 0, width, height);
  return canvasElement.toDataURL("image/jpeg", CHAT_IMAGE_QUALITY);
}

function stopGuideSpeech() {
  cancelActiveTextReveal();
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

function cancelActiveTextReveal() {
  if (activeTextRevealCancel) {
    activeTextRevealCancel();
    activeTextRevealCancel = null;
  }
}

function estimateSpeechDurationSeconds(text) {
  const cleanText = text.replace(/\s+/g, "");
  return Math.max(0.9, cleanText.length / TEXT_REVEAL_CHARS_PER_SECOND);
}

function startSpeechSyncedTextReveal(onTextProgress, readDurationSeconds, readElapsedSeconds) {
  if (typeof onTextProgress !== "function") return null;
  cancelActiveTextReveal();

  let frameId = 0;
  let cancelled = false;
  const readDuration =
    typeof readDurationSeconds === "function"
      ? readDurationSeconds
      : () => Number(readDurationSeconds);
  const startedAt = performance.now();
  const readElapsed =
    typeof readElapsedSeconds === "function"
      ? readElapsedSeconds
      : () => (performance.now() - startedAt) / 1000;

  const tick = () => {
    if (cancelled) return;
    const duration = Math.max(0.1, Number(readDuration()) || 0);
    const elapsed = Math.max(0, Number(readElapsed()) || 0);
    const progress = clamp01(elapsed / duration);
    onTextProgress(progress);
    if (progress < 1) {
      frameId = requestAnimationFrame(tick);
    }
  };

  onTextProgress(0);
  frameId = requestAnimationFrame(tick);
  activeTextRevealCancel = () => {
    cancelled = true;
    if (frameId) cancelAnimationFrame(frameId);
  };
  return activeTextRevealCancel;
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
  const audioUrl = `http://127.0.0.1:8001${data.audio_src}`;
  const ttsTimestamps = data.timestamps ?? [];
  const arkitExpressions = data.arkit_expressions ?? null;
  const decodedAudio = await prepareDecodedGuideAudio(audioUrl, ttsTimestamps, arkitExpressions);
  return {
    audioUrl,
    ttsTimestamps,
    arkitExpressions,
    audioBuffer: decodedAudio?.audioBuffer ?? null,
    lipSyncClip: decodedAudio?.lipSyncClip ?? null,
  };
}

async function playBrowserSpeechFallback(text, onTextProgress = null) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) return;
  if (!canUseBrowserSpeechFallback()) {
    throw new Error("语音播报暂不可用");
  }

  let stopTextReveal = null;
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
      setStatus("数字人正在语音播报...", true);
      stopTextReveal = startSpeechSyncedTextReveal(
        onTextProgress,
        estimateSpeechDurationSeconds(cleanText),
      );
      startGuidePerformance();
    };
    utterance.onend = () => {
      stopTextReveal?.();
      onTextProgress?.(1);
      browserSpeechActive = false;
      stopGuidePerformance();
      resolve();
    };
    utterance.onerror = () => {
      stopTextReveal?.();
      browserSpeechActive = false;
      stopGuidePerformance();
      reject(new Error("browser speech fallback failed"));
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function playAudioUrl(audioUrl, ttsTimestamps = [], arkitExpressions = null, onTextProgress = null, text = "") {
  const context = ensureAudioContext();
  if (context) {
    const decodedAudio = await prepareDecodedGuideAudio(audioUrl, ttsTimestamps, arkitExpressions);
    if (decodedAudio) {
      await playPreparedAudioBuffer(decodedAudio.audioBuffer, context, decodedAudio.lipSyncClip, onTextProgress);
      return;
    }
  }

  let stopTextReveal = null;
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
      stopTextReveal = startSpeechSyncedTextReveal(
        onTextProgress,
        () => (Number.isFinite(activeAudio.duration) ? activeAudio.duration : estimateSpeechDurationSeconds(text)),
        () => activeAudio.currentTime,
      );
      startGuidePerformance();
    };
    activeAudio.onended = () => {
      stopTextReveal?.();
      onTextProgress?.(1);
      stopGuidePerformance();
      resolve();
    };
    activeAudio.onerror = (event) => {
      stopTextReveal?.();
      reject(event);
    };
    activeAudio.play().catch(reject);
  });
  activeAudio = null;
  activeAudioSource = null;
  stopGuidePerformance();
}

async function decodeGuideAudioUrl(audioUrl, context) {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error("语音音频加载失败");
  }
  return context.decodeAudioData(await response.arrayBuffer());
}

async function prepareDecodedGuideAudio(audioUrl, ttsTimestamps = [], arkitExpressions = null) {
  const context = ensureAudioContext();
  if (!context) return null;
  try {
    const audioBuffer = await decodeGuideAudioUrl(audioUrl, context);
    const envelopeClip = buildLipSyncEnvelope(audioBuffer);
    return {
      audioBuffer,
      lipSyncClip:
        buildArkitExpressionLipSyncClip(arkitExpressions, audioBuffer, envelopeClip) ??
        buildTimestampLipSyncClip(ttsTimestamps, audioBuffer, envelopeClip) ??
        envelopeClip,
    };
  } catch (error) {
    return null;
  }
}

async function playDecodedAudioBuffer(audioUrl, context, ttsTimestamps = [], arkitExpressions = null) {
  const audioBuffer = await decodeGuideAudioUrl(audioUrl, context);
  const envelopeClip = buildLipSyncEnvelope(audioBuffer);
  const lipSyncClip =
    buildArkitExpressionLipSyncClip(arkitExpressions, audioBuffer, envelopeClip) ??
    buildTimestampLipSyncClip(ttsTimestamps, audioBuffer, envelopeClip) ??
    envelopeClip;
  await playPreparedAudioBuffer(audioBuffer, context, lipSyncClip);
}

async function playPreparedAudioBuffer(audioBuffer, context, lipSyncClip, onTextProgress = null) {
  const source = context.createBufferSource();
  const analyser = setupLipSyncAnalyser();
  if (!analyser) {
    throw new Error("音频分析器不可用");
  }
  source.buffer = audioBuffer;
  source.connect(analyser);
  activeAudioSource = source;
  activeLipSyncClip = lipSyncClip ?? buildLipSyncEnvelope(audioBuffer);
  await context.resume?.();
  const startedAt = context.currentTime + LIP_SYNC_START_DELAY_SECONDS;
  activeLipSyncClip.startedAt = startedAt;
  activeLipSyncClip.endsAt = startedAt + audioBuffer.duration + LIP_SYNC_END_GRACE_SECONDS;
  let stopTextReveal = null;
  await new Promise((resolve) => {
    source.onended = () => {
      stopTextReveal?.();
      onTextProgress?.(1);
      stopGuidePerformance();
      activeAudioSource = null;
      activeLipSyncClip = null;
      resolve();
    };
    setStatus("数字人正在语音播报...", true);
    startGuidePerformance();
    source.start(startedAt);
    stopTextReveal = startSpeechSyncedTextReveal(
      onTextProgress,
      audioBuffer.duration,
      () => context.currentTime - startedAt,
    );
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
      const context = preparedAudio?.audioBuffer ? ensureAudioContext() : null;
      if (preparedAudio?.audioBuffer && context) {
        await playPreparedAudioBuffer(
          preparedAudio.audioBuffer,
          context,
          preparedAudio.lipSyncClip,
          item.onTextProgress,
        );
      } else if (preparedAudio?.audioUrl) {
        await playAudioUrl(
          preparedAudio.audioUrl,
          preparedAudio.ttsTimestamps,
          preparedAudio.arkitExpressions,
          item.onTextProgress,
          item.text,
        );
      } else if (preparedAudio?.speechFallback) {
        await playBrowserSpeechFallback(item.text, item.onTextProgress);
      }
      item.onTextProgress?.(1);
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

function queueGuideSpeech(text, onTextProgress = null) {
  const audioPromise = prepareGuideAudio(text).catch(() => ({ speechFallback: true }));
  preparedAudioQueue.push({ text, audioPromise, onTextProgress });
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

function findLengthFallbackEnd(segment) {
  if (segment.length <= SPEECH_CHUNK_MAX_CHARS) return -1;
  const windowEnd = Math.min(segment.length, SPEECH_CHUNK_MAX_CHARS);
  const naturalBreaks = " ，,、：:；;。！？!?";
  for (let index = windowEnd - 1; index >= SPEECH_CHUNK_MIN_CHARS; index -= 1) {
    if (naturalBreaks.includes(segment[index])) {
      return index + 1;
    }
  }
  return windowEnd;
}

function extractSpeakableSegments(buffer) {
  const sentences = [];
  let lastEnd = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    const segment = buffer.slice(lastEnd + 1, index + 1);
    const isHardBreak = SPEECH_HARD_BREAKS.includes(buffer[index]);
    const isUsefulSoftBreak =
      SPEECH_SOFT_BREAKS.includes(buffer[index]) && segment.trim().length >= SPEECH_SOFT_BREAK_MIN_CHARS;
    const fallbackEnd = findLengthFallbackEnd(buffer.slice(lastEnd + 1));

    if (isHardBreak || isUsefulSoftBreak) {
      sentences.push(segment.trim());
      lastEnd = index;
    } else if (fallbackEnd !== -1) {
      const end = lastEnd + fallbackEnd;
      sentences.push(buffer.slice(lastEnd + 1, end + 1).trim());
      lastEnd = end;
      index = end;
    }
  }
  return {
    sentences: sentences.filter(Boolean),
    rest: buffer.slice(lastEnd + 1),
  };
}

function extractCompletedSentences(buffer) {
  return extractSpeakableSegments(buffer);
}

function revealQueuedGuideText(replyText, currentText, text, progress) {
  const wasPinned = isConversationPinnedToBottom();
  const safeProgress = clamp01(Number(progress) || 0);
  const visibleLength = Math.min(text.length, Math.ceil(text.length * safeProgress));
  const nextText = `${currentText}${text.slice(0, visibleLength)}`;
  replyText.textContent = nextText;
  scrollConversationToBottomIfPinned(wasPinned);
  return nextText;
}

async function answerQuestion(question) {
  stopGuideSpeech();
  const imageDataUrl = pendingImageDataUrl;
  const imageName = pendingImageName;
  pendingImageDataUrl = null;
  pendingImageName = "";
  const userItem = appendMessage("游客", imageName ? `${question}\n已附图片：${imageName}` : question, "user");
  if (imageDataUrl) {
    const preview = document.createElement("img");
    preview.className = "image-preview";
    preview.src = imageDataUrl;
    preview.alt = imageName || "上传图片";
    userItem.appendChild(preview);
  }
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
        image_data_url: imageDataUrl,
      }),
    });

    if (!response.ok || !(response.body instanceof ReadableStream)) {
      throw new Error("导游服务暂时不可用");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullReply = "";
    let displayedReply = "";
    let queuedSpeechCount = 0;

    const createTextProgress = (segment) => {
      let committed = false;
      return (progress = 1) => {
        if (committed) return;
        const safeProgress = clamp01(Number(progress) || 0);
        revealQueuedGuideText(replyText, displayedReply, segment, safeProgress);
        if (safeProgress >= 1) {
          displayedReply += segment;
          committed = true;
        }
      };
    };

    const queueSpeechSegment = (segment) => {
      const cleanSegment = segment.trim();
      if (!cleanSegment) return;
      queuedSpeechCount += 1;
      queueGuideSpeech(cleanSegment, createTextProgress(cleanSegment));
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullReply += chunk;
      speechBuffer += chunk;
      const completed = extractSpeakableSegments(speechBuffer);
      completed.sentences.forEach(queueSpeechSegment);
      speechBuffer = completed.rest;
    }

    const finalReply = fullReply.trim() || "我在这里，您可以继续问我景区相关问题。";
    appendScenicReferences(replyItem, finalReply);
    if (speechBuffer.trim()) {
      queueSpeechSegment(speechBuffer);
    } else if (queuedSpeechCount === 0) {
      queueSpeechSegment(finalReply);
    }
    rememberConversationTurn(question, finalReply);
  } catch (error) {
    replyText.textContent = "导游服务暂时没有连接成功，请稍后再试。";
  }
}

if (avatarSelect) {
  avatarSelect.addEventListener("change", () => {
    loadModel(avatarSelect.value).catch((error) => setStatus(error.message || "数字人形象加载失败"));
  });
}

if (backgroundUpload) {
  backgroundUpload.addEventListener("change", () => {
    const [file] = backgroundUpload.files ?? [];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    backgroundImage.src = imageUrl;
    stage.classList.add("has-custom-background");
    setStatus("背景已更新", true);
  });
}

if (clearBackground) {
  clearBackground.addEventListener("click", () => {
    backgroundImage.removeAttribute("src");
    stage.classList.remove("has-custom-background");
    if (backgroundUpload) {
      backgroundUpload.value = "";
    }
    setStatus("已恢复默认背景", true);
  });
}

if (spotSelector) {
  spotSelector.addEventListener("change", renderCurrentSpot);
}

if (spotCommentForm) {
  spotCommentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = spotCommentInput?.value.trim() ?? "";
    if (!content) return;
    const [imageFile] = spotCommentImage?.files ?? [];
    try {
      await submitSpotComment(content, imageFile);
      spotCommentInput.value = "";
      if (spotCommentImage) spotCommentImage.value = "";
    } catch (error) {
      setStatus(error.message || "评论提交失败", false);
    }
  });
}

if (clearConversationButton) {
  clearConversationButton.addEventListener("click", clearConversationHistory);
}

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

imageUpload.addEventListener("change", async () => {
  const [file] = imageUpload.files ?? [];
  if (!file) return;
  try {
    pendingImageDataUrl = await prepareChatImageDataUrl(file);
    pendingImageName = file.name;
    appendImageMessage(file);
  } catch (error) {
    pendingImageDataUrl = null;
    pendingImageName = "";
    setStatus(error.message || "图片暂时无法读取", false);
  } finally {
    imageUpload.value = "";
  }
});

initSpotComments();
restoreConversationHistory();

initLive2D().catch((error) => {
  setStatus(error.message || "数字人形象加载失败");
});
