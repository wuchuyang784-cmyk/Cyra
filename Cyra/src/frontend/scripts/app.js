import {
  createAsrSocket,
  fetchSpots,
  health,
  recommendRoute,
  streamChat,
  submitFeedback,
  synthesizeSpeech,
} from "./api-client.js";
import { PcmRecorder } from "./audio-recorder.js";
import { AvatarController } from "./avatar-controller.js";
import { LipSyncPlayer } from "./lip-sync.js";

const INTRO_MESSAGE = "贫僧玄奘，已接入灵山胜境官方资料包。施主可直接提问，也可点击景点或路线快捷入口。";
const COMMENT_STORAGE_KEY = "lingshan_spot_comments_v2";
const FALLBACK_SPOTS = [
  {
    id: "LS-010",
    name: "灵山大佛",
    summary: "灵山胜境核心地标，可登顶抱佛脚，俯瞰太湖全景。",
    question: "请根据官方资料包为我讲解灵山大佛，并给出游玩建议。",
    comments: ["通高88米，佛体79米，莲花瓣9米。", "可登顶抱佛脚，俯瞰太湖全景。", "216级登云道暗合108烦恼与108愿望。"],
  },
  {
    id: "LS-006",
    name: "九龙灌浴",
    summary: "灵山胜境标志性动态景观，展现花开见佛、九龙沐浴。",
    question: "请根据官方资料包为我讲解九龙灌浴，并提醒最佳观看方式。",
    comments: ["平日10:00、11:30、13:30、15:00演出。", "建议提前10分钟到场占位。", "表演结束后可接取祈福圣水。"],
  },
  {
    id: "LS-013",
    name: "灵山梵宫",
    summary: "佛教艺术殿堂，可观看《吉祥颂》演出。",
    question: "请根据官方资料包为我讲解灵山梵宫，并推荐参观重点。",
    comments: ["内部艺术细节丰富，适合慢慢参观。", "《吉祥颂》演出值得预留时间。", "穹顶、壁画和木雕都很适合讲解。"],
  },
  {
    id: "LS-014",
    name: "五印坛城",
    summary: "藏传佛教风格建筑，可体验转经文化。",
    question: "请根据官方资料包为我讲解五印坛城和转经体验。",
    comments: ["金顶红墙很适合拍照。", "顺时针绕行更有仪式感。", "适合了解藏传佛教文化。"],
  },
  {
    id: "NH-005",
    name: "五灯湖",
    summary: "拈花湾夜间灯光秀核心区域，湖光与禅意建筑相映。",
    question: "请根据官方资料包为我讲解拈花湾五灯湖夜游。",
    comments: ["夜间有《禅行》灯光秀。", "建议提前30分钟到场。", "雨天木栈道湿滑，注意安全。"],
  },
];

const PREFERRED_SPOTS = ["灵山大佛", "九龙灌浴", "灵山梵宫", "五印坛城", "五灯湖", "拈花广场"];

let currentSessionId = crypto.randomUUID();
let history = [];
let messages = [];
let recorder = null;
let asrSocket = null;
let isRecording = false;
let hasAutoPlayedIntro = false;
let introPlaybackPending = false;
let activeSpotId = FALLBACK_SPOTS[0].id;
let spots = FALLBACK_SPOTS;
let spotComments = loadComments();
let lastAssistantMessage = INTRO_MESSAGE;

const elements = {
  stage: document.querySelector(".avatar-stage"),
  eyeLayer: document.querySelector("#eyeLayer"),
  mouthLayer: document.querySelector("#mouthLayer"),
  newChatButton: document.querySelector("#newChatButton"),
  messageList: document.querySelector("#messageList"),
  recordButton: document.querySelector("#recordButton"),
  sendButton: document.querySelector("#sendButton"),
  stopButton: document.querySelector("#stopButton"),
  questionInput: document.querySelector("#questionInput"),
  asrText: document.querySelector("#asrText"),
  guideText: document.querySelector("#guideText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  expressionStatus: document.querySelector("#expressionStatus"),
  spotTabs: document.querySelector("#spotTabs"),
  activeSpotName: document.querySelector("#activeSpotName"),
  activeSpotSummary: document.querySelector("#activeSpotSummary"),
  commentsList: document.querySelector("#commentsList"),
  commentInput: document.querySelector("#commentInput"),
  publishCommentButton: document.querySelector("#publishCommentButton"),
  explainSpotButton: document.querySelector("#explainSpotButton"),
  openCommentsButton: document.querySelector("#openCommentsButton"),
  closeCommentsButton: document.querySelector("#closeCommentsButton"),
  commentsDrawer: document.querySelector("#commentsDrawer"),
  commentsBackdrop: document.querySelector("#commentsBackdrop"),
};

const avatar = new AvatarController({
  stage: elements.stage,
  eyeLayer: elements.eyeLayer,
  mouthLayer: elements.mouthLayer,
});
const lipSync = new LipSyncPlayer({ avatar });

bootstrap();

async function bootstrap() {
  resetConversation();
  renderSpotTabs();
  renderComments();
  bindEvents();

  try {
    await health();
    setStatus("后端已连接，官方资料包知识库可用");
    const result = await fetchSpots();
    spots = normalizeSpots(result.items?.length ? result.items : FALLBACK_SPOTS);
    activeSpotId = spots[0].id;
    spotComments = loadComments();
    renderSpotTabs();
    renderComments();
  } catch {
    setStatus("后端未连接，当前使用本地备用景点数据");
  }
}

function bindEvents() {
  elements.newChatButton.addEventListener("click", () => {
    resetConversation();
    hasAutoPlayedIntro = false;
    playIntro();
    elements.questionInput.focus();
  });

  elements.recordButton.addEventListener("click", async () => {
    try {
      if (isRecording) {
        await stopRecording();
        return;
      }
      await startRecording();
    } catch (error) {
      const message = error?.message || "无法启动录音，请检查浏览器麦克风权限。";
      setStatus(message);
      addSystemMessage(message);
    }
  });

  elements.sendButton.addEventListener("click", async () => {
    const message = elements.questionInput.value.trim();
    if (message) {
      await sendQuestion(message);
    }
  });

  elements.stopButton.addEventListener("click", () => {
    lipSync.stop();
  });

  elements.questionInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const message = elements.questionInput.value.trim();
      if (message) {
        await sendQuestion(message);
      }
    }
  });

  document.querySelectorAll(".route-chip").forEach((button) => {
    button.addEventListener("click", () => sendRouteQuestion(button.dataset.interest || "历史文化"));
  });

  elements.publishCommentButton.addEventListener("click", publishComment);
  elements.commentInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      publishComment();
    }
  });
  elements.explainSpotButton.addEventListener("click", () => {
    const spot = getActiveSpot();
    sendQuestion(spot.question || `请根据官方资料包为我讲解${spot.name}。`);
  });
  elements.openCommentsButton.addEventListener("click", openCommentsDrawer);
  elements.closeCommentsButton.addEventListener("click", closeCommentsDrawer);
  elements.commentsBackdrop.addEventListener("click", closeCommentsDrawer);

  window.addEventListener("load", () => {
    playIntro();
  });

  document.addEventListener(
    "click",
    () => {
      if (introPlaybackPending) {
        playIntro();
      }
    },
    { once: true },
  );
}

function resetConversation() {
  currentSessionId = crypto.randomUUID();
  history = [];
  messages = [{ role: "assistant", content: INTRO_MESSAGE }];
  lastAssistantMessage = INTRO_MESSAGE;
  elements.asrText.textContent = "";
  elements.guideText.textContent = INTRO_MESSAGE;
  renderMessages();
}

function normalizeSpots(items) {
  const byName = new Map(items.map((spot) => [spot.name, spot]));
  const preferred = PREFERRED_SPOTS.map((name) => byName.get(name)).filter(Boolean);
  const rest = items.filter((spot) => !PREFERRED_SPOTS.includes(spot.name));
  return [...preferred, ...rest].slice(0, 12);
}

function loadComments() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMMENT_STORAGE_KEY) || "{}");
    return spots.reduce((acc, spot) => {
      acc[spot.id] = Array.isArray(stored[spot.id]) ? stored[spot.id] : spot.comments || [];
      return acc;
    }, {});
  } catch {
    return spots.reduce((acc, spot) => {
      acc[spot.id] = spot.comments || [];
      return acc;
    }, {});
  }
}

function saveComments() {
  localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(spotComments));
}

function getActiveSpot() {
  return spots.find((spot) => spot.id === activeSpotId) || spots[0];
}

function renderSpotTabs() {
  elements.spotTabs.innerHTML = "";
  spots.slice(0, 8).forEach((spot) => {
    const button = document.createElement("button");
    button.className = "spot-tab";
    button.type = "button";
    button.dataset.active = String(spot.id === activeSpotId);
    button.textContent = spot.name;
    button.addEventListener("click", () => {
      activeSpotId = spot.id;
      renderSpotTabs();
      renderComments();
      sendQuestion(spot.question || `请根据官方资料包为我讲解${spot.name}。`);
    });
    elements.spotTabs.append(button);
  });
}

function renderComments() {
  const spot = getActiveSpot();
  elements.activeSpotName.textContent = spot?.name || "官方资料包景点";
  elements.activeSpotSummary.textContent = spot?.summary || "该景点已接入官方资料包，可由玄奘法师进行讲解。";
  elements.commentsList.innerHTML = "";
  (spotComments[spot.id] || spot.comments || []).forEach((comment) => {
    const item = document.createElement("article");
    item.className = "comment-item";
    const avatarNode = document.createElement("span");
    avatarNode.className = "comment-avatar";
    avatarNode.textContent = "游";
    const text = document.createElement("p");
    text.textContent = comment;
    item.append(avatarNode, text);
    elements.commentsList.append(item);
  });
}

function publishComment() {
  const value = elements.commentInput.value.trim();
  if (!value) {
    return;
  }
  const spot = getActiveSpot();
  spotComments[spot.id] = [value, ...(spotComments[spot.id] || [])].slice(0, 8);
  elements.commentInput.value = "";
  saveComments();
  renderComments();
  submitFeedback({
    sessionId: currentSessionId,
    message: lastAssistantMessage,
    rating: 5,
    comment: value,
  })
    .then(() => setStatus("反馈已记录，后台报告会纳入统计"))
    .catch(() => setStatus("反馈暂未提交，请检查后端连接"));
}

function openCommentsDrawer() {
  renderComments();
  elements.commentsBackdrop.hidden = false;
  elements.commentsDrawer.dataset.open = "true";
  elements.commentsDrawer.setAttribute("aria-hidden", "false");
}

function closeCommentsDrawer() {
  elements.commentsBackdrop.hidden = true;
  elements.commentsDrawer.dataset.open = "false";
  elements.commentsDrawer.setAttribute("aria-hidden", "true");
}

async function sendRouteQuestion(interest) {
  await sendQuestion(`请根据官方资料包，为我推荐一条${interest}游览路线。请控制在三到四句，突出路线顺序和适合人群。`);
}

function renderMessages() {
  elements.messageList.innerHTML = "";
  messages.forEach((message) => {
    elements.messageList.append(createMessageBubble(message));
  });
  scrollMessagesToBottom();
}

function createMessageBubble(message) {
  const bubble = document.createElement("article");
  bubble.className = `message-bubble ${message.role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = message.role === "user" ? "游客" : message.role === "system" ? "系统提示" : "玄奘法师";

  const content = document.createElement("p");
  content.textContent = message.content;

  bubble.append(label, content);
  if (message.role === "assistant" && message.content) {
    bubble.append(createFeedbackBar(message.content));
  }
  return bubble;
}

function createFeedbackBar(content) {
  const bar = document.createElement("div");
  bar.className = "feedback-bar";
  [5, 3, 1].forEach((rating) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = rating === 5 ? "满意" : rating === 3 ? "一般" : "待改进";
    button.addEventListener("click", () => {
      submitFeedback({ sessionId: currentSessionId, message: content, rating, comment: "" })
        .then(() => setStatus("反馈已记录，后台报告会纳入统计"))
        .catch(() => setStatus("反馈暂未提交，请检查后端连接"));
    });
    bar.append(button);
  });
  return bar;
}

function appendAssistantBubble() {
  const assistantMessage = { role: "assistant", content: "" };
  messages.push(assistantMessage);
  const bubble = createMessageBubble(assistantMessage);
  elements.messageList.append(bubble);
  scrollMessagesToBottom();
  return { assistantMessage, contentNode: bubble.querySelector("p") };
}

function scrollMessagesToBottom() {
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前浏览器不支持麦克风录音，请用 Chrome 或 Edge 打开页面。");
  }
  setStatus("正在连接语音识别");
  asrSocket = createAsrSocket();

  asrSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "partial" || data.type === "final") {
      elements.asrText.textContent = data.text || "正在识别...";
      elements.questionInput.value = data.text || "";
      if (data.type === "final" && data.text) {
        stopRecording().then(() => sendQuestion(data.text));
      }
    }
    if (data.type === "error") {
      setStatus(data.message || "语音识别失败");
      addSystemMessage(data.message || "语音识别失败");
    }
  };

  asrSocket.onerror = () => {
    setStatus("语音识别连接失败");
    addSystemMessage("语音识别连接失败，请检查后端服务。");
  };
  asrSocket.onclose = () => {
    if (isRecording) {
      setStatus("语音识别连接已断开");
    }
  };

  await waitForSocketOpen(asrSocket);
  recorder = new PcmRecorder({
    onChunk: (chunk) => {
      if (asrSocket?.readyState === WebSocket.OPEN) {
        asrSocket.send(chunk);
      }
    },
    onError: (error) => {
      const message = error.name === "NotAllowedError" ? "麦克风权限被拒绝" : "无法获取麦克风";
      setStatus(message);
      addSystemMessage(message);
    },
  });
  await recorder.start();
  isRecording = true;
  elements.recordButton.textContent = "停止录音";
  setStatus("正在实时识别");
}

async function stopRecording() {
  isRecording = false;
  elements.recordButton.textContent = "开始录音";
  if (recorder) {
    await recorder.stop();
    recorder = null;
  }
  if (asrSocket?.readyState === WebSocket.OPEN) {
    asrSocket.send("stop");
    asrSocket.close();
  }
  asrSocket = null;
  setStatus("录音已停止");
}

async function sendQuestion(message) {
  try {
    messages.push({ role: "user", content: message });
    elements.questionInput.value = "";
    elements.asrText.textContent = "";
    renderMessages();

    const { assistantMessage, contentNode } = appendAssistantBubble();
    setStatus("玄奘法师正在查阅官方资料包");
    elements.sendButton.disabled = true;

    const result = await streamChat({
      sessionId: currentSessionId,
      message,
      history,
      onDelta: (delta) => {
        assistantMessage.content += delta;
        contentNode.textContent = assistantMessage.content;
        elements.guideText.textContent = assistantMessage.content;
        scrollMessagesToBottom();
      },
    });

    const finalAnswer = result?.answer || assistantMessage.content;
    assistantMessage.content = finalAnswer;
    lastAssistantMessage = finalAnswer;
    contentNode.textContent = finalAnswer;
    history = result?.history || [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: finalAnswer },
    ];
    elements.guideText.textContent = finalAnswer;
    setExpressionByText(finalAnswer);
    renderMessages();

    setStatus("正在合成语音");
    const audio = await synthesizeSpeech(finalAnswer);
    setStatus("正在播放");
    await lipSync.play(audio);
  } catch (error) {
    const messageText = `请求失败：${error.message}`;
    setStatus(messageText);
    addSystemMessage(messageText);
  } finally {
    elements.sendButton.disabled = false;
  }
}

async function playIntro() {
  if (hasAutoPlayedIntro) {
    return;
  }
  hasAutoPlayedIntro = true;
  try {
    setStatus("玄奘法师正在问候");
    const audio = await synthesizeSpeech(INTRO_MESSAGE);
    introPlaybackPending = false;
    await lipSync.play(audio);
  } catch {
    hasAutoPlayedIntro = false;
    introPlaybackPending = true;
    setStatus("点击页面后播放玄奘法师问候");
  }
}

function addSystemMessage(content) {
  messages.push({ role: "system", content });
  renderMessages();
}

function setStatus(text) {
  elements.connectionStatus.textContent = text;
}

function setExpressionByText(text) {
  if (/危险|注意|小心|禁止|严禁|不要|安全|湿滑|拥挤/.test(text)) {
    setExpression("serious");
    return;
  }
  if (/欢迎|推荐|适合|精彩|有趣|祈福|祝愿|不妨/.test(text)) {
    setExpression("smile");
    return;
  }
  setExpression("neutral");
}

function setExpression(expression) {
  const labels = {
    neutral: "自然",
    smile: "微笑",
    serious: "严肃",
  };
  avatar.setExpression(expression);
  elements.expressionStatus.textContent = `表情：${labels[expression] || labels.neutral}`;
}

function waitForSocketOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}
