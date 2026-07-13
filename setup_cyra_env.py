import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / ".venv"
VENV_PYTHON = VENV_DIR / "Scripts" / "python.exe"
REQUIRED_VERSION = (3, 12)


def run(args: list[str]) -> None:
    print(f"> {' '.join(args)}", flush=True)
    subprocess.run(args, cwd=ROOT, check=True)


def venv_is_healthy() -> bool:
    if not VENV_PYTHON.exists():
        return False
    result = subprocess.run(
        [str(VENV_PYTHON), "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and result.stdout.strip() == "3.12"


def main() -> int:
    if sys.version_info[:2] != REQUIRED_VERSION:
        print("错误：本项目要求 Python 3.12（64 位）。")
        print(f"当前执行版本：Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
        print("请从 https://www.python.org/downloads/release/python-31210/ 安装 Python 3.12，")
        print("安装时勾选 Add python.exe to PATH，然后重新双击“安装环境.bat”。")
        return 1

    if VENV_DIR.exists() and not venv_is_healthy():
        print("检测到损坏或版本不符的 .venv，正在清理后重建……")
        shutil.rmtree(VENV_DIR)

    if not VENV_DIR.exists():
        print("正在项目目录创建 Python 3.12 虚拟环境 .venv……")
        run([sys.executable, "-m", "venv", str(VENV_DIR)])

    print("正在更新 pip 并安装项目依赖，首次安装需要联网且可能耗时较长……")
    run([str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip"])
    run([str(VENV_PYTHON), "-m", "pip", "install", "-r", "requirements.txt"])
    run([str(VENV_PYTHON), "-c", "import fastapi, uvicorn, chromadb, dashscope, whisper"])
    print("\n环境安装成功。现在可以双击“启动Cyra.bat”。")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"\n环境安装失败，命令退出码：{exc.returncode}")
        print("请确认网络可访问 PyPI，然后重新运行“安装环境.bat”。")
        raise SystemExit(exc.returncode)
