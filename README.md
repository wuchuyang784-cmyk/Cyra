# Cyra 灵山胜境 AI 数字人导览系统

这是面向“景区导览服务 AI 数字人”的本地演示项目，包含游客端 Live2D 数字人导览页、园区管理后台和 FastAPI 后端。

## 已实现

- 游客端：Live2D 数字人、Whisper 语音输入、ChromaDB + text-embedding-v4 知识库 RAG 流式对话、百炼 CosyVoice 语音播报、字级时间戳口型驱动。
- 管理后台：行为数据指标、游客感受度报告、行业对比、游客画像、官方资料包知识条目、知识文件上传入库。
- 后端：`/api/chat`、`/api/chat/stream`、`/api/asr`、`/api/tts`、`/api/tts/audio`、`/api/admin/*`。
- 数据来源：`示范景区公开资料包/` 中的 Word 景点资料和 Excel 游客行为数据。

## 暂未实现

- 游客反馈写入后端。
- 独立演示入口页。

## 项目结构

```text
Cyra/
  README.md
  requirements.txt
  run_cyra_demo.py
  示范景区公开资料包/
  src/
    backend/
      app/
        main.py
        api/admin.py
        api/asr.py
        api/chat.py
        api/tts.py
        core/config.py
        schemas/asr.py
        services/asr_service.py
        services/llm_service.py
        services/prompt.py
        services/resource_pack.py
        services/tts_service.py
      .env.example
    frontend/
      tourist.html
      admin.html
      static_server.py
      assets/live2d/
      scripts/tourist-live2d.js
      scripts/admin.js
      styles/tourist.css
      styles/admin.css
```

## 一键运行

要求 64 位 Python 3.12。首次部署先运行：

```powershell
.\安装环境.bat
```

安装成功后运行：

```powershell
.\启动Cyra.bat
```

脚本会启动：

- 后端：`http://127.0.0.1:8001`
- 游客端：`http://127.0.0.1:5173/tourist.html`
- 管理后台：`http://127.0.0.1:5173/admin.html`
- 后端健康检查：`http://127.0.0.1:8001/api/health`

使用 LLM 和 TTS 前，请在 `src/backend/.env` 配置百炼 API Key。Whisper 语音输入默认使用本地 `base` 模型，项目会优先使用系统 FFmpeg，并在缺失时尝试使用 `imageio-ffmpeg` 的 Python 环境兜底。参考 `src/backend/.env.example`。

安装脚本会自动创建本机可用的 `.venv` 并安装依赖。完整步骤见 `docs/产品部署和使用手册.md`。
