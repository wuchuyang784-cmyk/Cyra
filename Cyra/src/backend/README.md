# Cyra 后端接口

FastAPI 后端提供 ASR、LLM 对话和 TTS 三类接口。

## 接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/health` | 健康检查 |
| `POST /api/chat` | 调用通义千问生成导游回复，保存最近 N 轮上下文 |
| `POST /api/tts` | 调用阿里云 NLS TTS，返回音频流 |
| `WS /ws/asr` | 浏览器发送 16k PCM 音频，后端转发到阿里云 NLS ASR |

## 环境变量

复制 `.env.example` 为 `.env`，先用 `MOCK_AI=true` 可以跑通本地流程。

```bash
MOCK_AI=true
DASHSCOPE_API_KEY=
ALIYUN_NLS_APP_KEY=
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_NLS_TOKEN=
```

接入真实服务时：

- `DASHSCOPE_API_KEY`：百炼/通义千问 API Key。
- `ALIYUN_NLS_APP_KEY`：阿里云智能语音交互项目 AppKey。
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`：用于自动创建阿里云 NLS Token。
- `ALIYUN_NLS_TOKEN`：可选，手动填写后会优先使用该 Token。

## 启动

```bash
cd Cyra
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd src/backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 测试

```bash
cd Cyra/src/backend
python test_chat.py
```
