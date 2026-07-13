# LAM 口型服务接入

Cyra 的口型主路径已经改为优先调用 OpenAvatarChat/LAM 兼容的 audio2expression 服务：

```text
TTS audio -> LAM_Audio2Expression -> ARKit 52 -> frontend Live2D
```

配置项在 `src/backend/.env`：

```env
LAM_EXPRESSION_API_URL=http://127.0.0.1:8091/api/lam/audio2expression
LAM_EXPRESSION_TIMEOUT_SECONDS=30
```

如果 `LAM_EXPRESSION_API_URL` 为空，或服务暂不可用，后端会临时回退到本地 ARKit PoC 生成器，保证演示不会中断。

## OpenAvatarChat 模型准备

当前本机 `C:\tmp\OpenAvatarChat\models` 里还没有 LAM 模型。需要先在 OpenAvatarChat 项目里执行：

```powershell
cd C:\tmp\OpenAvatarChat
uv run install.py --config config/chat_with_lam.yaml
uv run scripts/download_models.py --handler lam
```

OpenAvatarChat LAM handler 使用：

- `models/wav2vec2-base-960h`
- `models/LAM_audio2exp/pretrained_models/lam_audio2exp_streaming.tar`
- `src/handlers/avatar/lam/avatar_handler_lam_audio2expression.py`

## Cyra 期望的 LAM 服务响应

服务接收 JSON：

```json
{
  "audio_base64": "...",
  "media_type": "audio/wav",
  "target_frame_rate": 30
}
```

服务返回 JSON：

```json
{
  "frame_rate": 30,
  "channels": ["browDownLeft", "...", "tongueOut"],
  "frames": [
    {
      "time_ms": 0,
      "values": {
        "jawOpen": 0.2,
        "mouthFunnel": 0.1
      }
    }
  ]
}
```

也兼容 OpenAvatarChat 风格的矩阵字段：

```json
{
  "frame_rate": 30,
  "channels": ["browDownLeft", "...", "tongueOut"],
  "arkit_face": [[0.0, 0.0, "... 52 values"]]
}
```
