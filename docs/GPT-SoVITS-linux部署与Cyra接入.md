# GPT-SoVITS Linux 部署与 Cyra 接入

本文档面向“服务器上只有普通账户、没有 sudo 权限”的部署方式。目标是让 GPT-SoVITS 作为独立 TTS 服务运行，Cyra 后端通过 HTTP 调用它。

## 架构

```text
游客端页面
  -> Cyra 后端 /api/tts
  -> GPT-SoVITS API 服务 http://127.0.0.1:9880/tts
  -> 返回音频
  -> 前端数字人播放音频并驱动口型
```

如果 Cyra 和 GPT-SoVITS 在同一台服务器，GPT-SoVITS 建议只监听 `127.0.0.1`。如果 GPT-SoVITS 在另一台服务器，建议用 HTTPS 反向代理和 API Key，不要裸露模型服务端口。

## 服务器配置

推荐配置：

- NVIDIA GPU，8GB 显存起步，12GB 或 16GB 更稳。
- 内存 16GB 起步，32GB 更稳。
- 硬盘预留 50GB 以上。
- Python 3.10 或 3.11。
- CUDA 驱动通常需要管理员提前装好；普通账户一般无法安装系统驱动。

普通账户可以安装的内容：

- conda / micromamba 环境。
- Python 包。
- FFmpeg 的 conda 版本。
- GPT-SoVITS 项目和模型文件，放在用户目录。

普通账户通常不能做的事：

- 安装 NVIDIA 系统驱动。
- 用 `apt install` 安装系统包。
- 绑定 80/443 等低端口。
- 写入 `/usr/local`、`/opt` 等系统目录。

## 无 sudo 安装方式

进入用户目录：

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/RVC-Boss/GPT-SoVITS.git
cd GPT-SoVITS
```

如果服务器已有 conda：

```bash
conda create -n gpt-sovits python=3.10 -y
conda activate gpt-sovits
```

如果没有 conda，可以把 micromamba 安装在用户目录。服务器不能联网时，需要让管理员或运维提前准备安装包。

安装 FFmpeg 到当前环境：

```bash
conda install -c conda-forge ffmpeg -y
```

按 GPT-SoVITS 官方 README 安装 PyTorch 和项目依赖。CUDA 版本要和服务器驱动匹配。无法确认 CUDA 时，先运行：

```bash
nvidia-smi
```

如果 `nvidia-smi` 不存在或看不到 GPU，需要找服务器管理员确认 GPU 驱动。

## 启动 GPT-SoVITS API

官方 API v2 常见启动方式：

```bash
python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

建议先在前台启动，看到模型加载成功后再测试。

后台运行可以用：

```bash
nohup python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml > gpt-sovits.log 2>&1 &
```

或使用 `tmux` / `screen`，如果服务器已安装。

## 测试 GPT-SoVITS

准备一段 5 到 10 秒的干净参考音频，例如：

```text
/home/yourname/voice/ref.wav
```

并准备这段音频对应的文字。

测试请求：

```bash
curl -X POST http://127.0.0.1:9880/tts \
  -H "Content-Type: application/json" \
  -o test.wav \
  -d '{
    "text": "您好，欢迎来到灵山胜境。",
    "text_lang": "zh",
    "ref_audio_path": "/home/yourname/voice/ref.wav",
    "prompt_text": "这里填写参考音频逐字文本",
    "prompt_lang": "zh",
    "media_type": "wav",
    "streaming_mode": false
  }'
```

如果能生成 `test.wav`，说明 GPT-SoVITS 服务可用。

## Cyra 接入配置

Cyra 已支持通过配置切换到 GPT-SoVITS。修改 `src/backend/.env`：

```env
TTS_PROVIDER=gpt_sovits
GPT_SOVITS_API_URL=http://127.0.0.1:9880
GPT_SOVITS_API_KEY=
GPT_SOVITS_REF_AUDIO_PATH=/home/yourname/voice/ref.wav
GPT_SOVITS_PROMPT_TEXT=这里填写参考音频逐字文本
GPT_SOVITS_PROMPT_LANG=zh
GPT_SOVITS_TEXT_LANG=zh
GPT_SOVITS_MEDIA_TYPE=wav
GPT_SOVITS_TIMEOUT_SECONDS=60
```

重启 Cyra 后端后，前端仍然调用 Cyra 的 `/api/tts`，不需要直接访问 GPT-SoVITS。

## 远程 GPT-SoVITS

如果 GPT-SoVITS 和 Cyra 不在同一台服务器：

```env
GPT_SOVITS_API_URL=https://tts.example.com
GPT_SOVITS_API_KEY=your-private-token
```

推荐让 GPT-SoVITS 仍然监听 `127.0.0.1:9880`，由 Nginx/Caddy 转发 HTTPS 请求。没有 sudo 时，你通常不能自己配置系统 Nginx，需要管理员协助，或者用平台提供的 Web 服务管理面板。

## 常见问题

`nvidia-smi` 不存在：
服务器 GPU 驱动没有装好，普通账户无法解决，需要管理员处理。

`ffmpeg: command not found`：
用 `conda install -c conda-forge ffmpeg -y` 安装到当前 conda 环境。

端口被占用：
换一个高位端口，例如 `-p 9881`，并同步修改 `GPT_SOVITS_API_URL`。

语音合成慢：
缩短每次合成文本；Cyra 前端已经按句子排队播报，适合远程 TTS。

公网不能访问：
确认安全组、防火墙、反向代理和服务监听地址。正式环境不要把模型服务直接暴露到公网。
