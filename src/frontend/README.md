# Cyra 前端

这是 Cyra 的静态前端，包含游客端 Live2D 数字人页面和管理后台数据看板。

## 模块

| 路径 | 说明 |
| --- | --- |
| `tourist.html` | 游客端 Live2D 数字人导览页面 |
| `admin.html` | 管理后台页面 |
| `assets/live2d/characters.json` | 数字人形象配置 |
| `assets/live2d/mao_pro/` | Mao Pro Live2D runtime 模型 |
| `scripts/tourist-live2d.js` | Live2D 加载、形象切换、背景上传、麦克风录音、Whisper 语音输入、流式对话、TTS 播放和字级时间戳口型驱动 |
| `scripts/admin.js` | 调用 `/api/admin/*` 并渲染指标、报告、画像和知识条目 |
| `styles/tourist.css` | 游客端样式 |
| `styles/admin.css` | 管理后台样式 |
| `static_server.py` | 本地静态服务器 |

## 启动

```powershell
cd Cyra\src\frontend
python static_server.py
```

然后访问：

- 游客端：`http://127.0.0.1:5173/tourist.html`
- 管理后台：`http://127.0.0.1:5173/admin.html`
