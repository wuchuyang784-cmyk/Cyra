const API_BASE = "http://127.0.0.1:8001";
const WS_BASE = "ws://127.0.0.1:8001";

export async function health() {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error("后端服务不可用");
  }
  return response.json();
}

export async function chat({ sessionId, message, history }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, history }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function streamChat({ sessionId, message, history, onDelta }) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, history }),
  });
  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalPayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const eventText of events) {
      const event = parseSseEvent(eventText);
      if (!event) {
        continue;
      }
      if (event.type === "delta") {
        onDelta(event.data.content || "");
      }
      if (event.type === "done") {
        finalPayload = event.data;
      }
      if (event.type === "error") {
        throw new Error(event.data.message || "流式回复失败");
      }
    }
  }

  return finalPayload;
}

export async function synthesizeSpeech(text) {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.blob();
}

export function createAsrSocket() {
  return new WebSocket(`${WS_BASE}/ws/asr`);
}

export async function fetchSpots() {
  const response = await fetch(`${API_BASE}/api/knowledge/spots?limit=18`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function recommendRoute(interest) {
  const response = await fetch(`${API_BASE}/api/routes/recommend?interest=${encodeURIComponent(interest)}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

export async function submitFeedback({ sessionId, message, rating, comment }) {
  const response = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, rating, comment }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function parseSseEvent(eventText) {
  const lines = eventText.split("\n");
  const typeLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!typeLine || !dataLine) {
    return null;
  }
  return {
    type: typeLine.replace("event:", "").trim(),
    data: JSON.parse(dataLine.replace("data:", "").trim()),
  };
}
