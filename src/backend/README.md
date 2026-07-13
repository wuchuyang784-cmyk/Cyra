# Cyra 后端

FastAPI 后端提供游客端数字人对话、Whisper 语音识别、语音合成代理和管理后台数据接口。

## 接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `POST /api/chat` | 非流式导游问答，会先检索知识库并把命中资料交给大模型 |
| `POST /api/chat/stream` | 流式导游问答，会先检索知识库并把命中资料交给大模型 |
| `POST /api/asr` | 接收浏览器录音文件，调用本地 openai/Whisper base 模型转写文字 |
| `POST /api/tts` | 调用百炼 CosyVoice SDK 生成语音，并返回字级时间戳 |
| `GET /api/tts/audio/{audio_id}` | 播放 SDK 合成后缓存的同源音频 |
| `GET /api/tts/audio` | 兜底代理播放百炼 HTTP 临时音频 |
| `GET /api/admin/analytics/overview` | Excel 行为数据总览 |
| `GET /api/admin/analytics/report` | 游客感受度报告 |
| `GET /api/admin/knowledge` | 官方资料包知识条目 |
| `POST /api/admin/knowledge/upload` | 上传 `.txt`、`.md`、`.docx` 知识文件并加入 RAG 检索 |

## 配置

后端读取 `src/backend/.env`，示例见 `.env.example`。LLM 和 TTS 共用 `DASHSCOPE_API_KEY`，语音模型、音色和 websocket 地址由 `DASHSCOPE_TTS_MODEL`、`DASHSCOPE_TTS_VOICE`、`DASHSCOPE_TTS_WS_URL` 配置。TTS 请求会开启 `word_timestamp_enabled`，用于前端 Live2D 口型同步。

导游问答会先从官方资料包和后台上传知识文件中做 ChromaDB 向量检索，向量由百炼 `text-embedding-v4` 生成，默认维度为 1024；如果向量检索暂不可用，会回退到关键词检索。检索到内容时，后端会把“资料包检索结果”作为系统上下文交给大模型，要求回答优先依据知识库；没有检索到内容时，大模型可自由回答，但仍需避免编造实时信息。

ASR 使用本地 openai/Whisper，默认 `WHISPER_MODEL=base`、`WHISPER_LANGUAGE=Chinese`、`WHISPER_DEVICE=cpu`。浏览器通常上传 WebM/Opus 音频，Whisper 依赖 FFmpeg 解码；项目会优先使用系统 `ffmpeg`，如果没有安装，会尝试使用 `imageio-ffmpeg` 随 Python 环境提供的可执行文件。

## 启动

```powershell
cd Cyra\src\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```
