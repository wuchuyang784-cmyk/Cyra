# Cyra 灵山胜境 AI 数字人导览系统

这是面向中国软件杯赛题的景区数字人导览原型，当前版本包含游客端、管理端、后端接口和官方资源包解析能力。

## 已实现

- 演示入口页：游客扫码入口 + 管理端入口。
- 游客端：数字人形象、文字/语音问答、景点快捷讲解、路线推荐、游客热评与满意度反馈。
- 管理端：知识库管理、数据大屏、游客感受度报告、行业对比数据。
- 后端：FastAPI 接口、官方 Word/Excel 资源包解析、本地关键词检索、问答上下文注入、TTS/ASR 接口封装。
- 知识来源：`示范景区公开资料包/` 中的灵山胜境资料和游客行为 Excel 数据。

## 项目结构

```text
Cyra/
  README.md                         # 项目入口说明
  requirements.txt                  # Python 依赖
  run_cyra_demo.py                  # PyCharm/命令行一键启动脚本
  docs/
    项目技术说明-当前版本.md          # 给组员看的技术说明
  示范景区公开资料包/                 # 官方 Word/Excel 资料
  src/
    backend/
      app/
        api/                        # FastAPI 路由
        core/                       # 配置读取
        schemas/                    # 请求/响应模型
        services/                   # 问答、资源包、语音、表情服务
      .env.example                  # 环境变量示例
      test_chat.py
    frontend/
      index.html                    # 演示入口页
      tourist.html                  # 游客端
      admin.html                    # 管理端
      assets/                       # 数字人图片资源
      scripts/                      # 前端交互逻辑
      styles/                       # 页面样式
```

## 一键运行

在 PyCharm 中打开项目根目录 `Cyra`，直接运行：

```text
run_cyra_demo.py
```

脚本会同时启动：

- 后端：`http://127.0.0.1:8001`
- 前端：`http://127.0.0.1:5173`
- 演示入口：`http://127.0.0.1:5173/`

首次运行前安装依赖：

```powershell
pip install -r requirements.txt
```

如果使用项目虚拟环境：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 页面入口

- 演示入口页：`http://127.0.0.1:5173/`
- 游客端：`http://127.0.0.1:5173/tourist.html`
- 管理端：`http://127.0.0.1:5173/admin.html`
- 后端健康检查：`http://127.0.0.1:8001/api/health`

## 环境变量

复制 `src/backend/.env.example` 为 `src/backend/.env`，按需填写模型和语音服务密钥。

注意：`src/backend/.env` 不要提交到 GitHub。

## 给组员

详细技术说明见：

```text
docs/项目技术说明-当前版本.md
```
