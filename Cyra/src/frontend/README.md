# Cyra 前端 Demo

这是 Web 端景区数字人导游演示页，使用原生 HTML/CSS/JS 和 Web Audio API。

## 模块

| 路径 | 说明 |
| --- | --- |
| `index.html` | 演示入口 |
| `styles/xuanzang-avatar.css` | 页面布局、数字人状态、口型和声波样式 |
| `scripts/app.js` | 页面流程编排：ASR → LLM → TTS → 口型/表情 |
| `scripts/api-client.js` | 后端 HTTP/WebSocket 客户端 |
| `scripts/audio-recorder.js` | 麦克风采集并转换为 16k PCM |
| `scripts/lip-sync.js` | 分析 TTS 播放音量并驱动嘴型 |
| `scripts/avatar-controller.js` | 数字人待机、说话、表情控制 |

## 启动

前端是静态页面，但麦克风权限通常要求安全上下文。建议用本地 HTTP 服务打开：

```bash
cd Cyra/src/frontend
python -m http.server 5173
```

然后访问 `http://127.0.0.1:5173`。
