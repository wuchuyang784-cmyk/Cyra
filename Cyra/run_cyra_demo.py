import subprocess
import sys
import time
import urllib.error
import urllib.request
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "src" / "backend"
FRONTEND_DIR = ROOT / "src" / "frontend"
BACKEND_LOG = ROOT / "backend.runtime.log"
FRONTEND_LOG = ROOT / "frontend.runtime.log"
BACKEND_URL = "http://127.0.0.1:8001"
FRONTEND_URL = "http://127.0.0.1:5173"


def check_dependencies() -> None:
    missing = []
    for module_name, package_name in [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn[standard]"),
        ("docx", "python-docx"),
        ("openpyxl", "openpyxl"),
    ]:
        try:
            __import__(module_name)
        except ImportError:
            missing.append(package_name)
    if missing:
        packages = " ".join(missing)
        raise RuntimeError(
            "Missing Python packages: "
            f"{packages}\nRun this once in PyCharm Terminal:\n"
            f"{sys.executable} -m pip install -r requirements.txt"
        )


def start_process(name: str, args: list[str], cwd: Path, log_path: Path) -> tuple[subprocess.Popen, object]:
    print(f"[{name}] starting: {' '.join(args)}")
    print(f"[{name}] log: {log_path}")
    log_file = log_path.open("w", encoding="utf-8", errors="replace")
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.Popen(
        args,
        cwd=str(cwd),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
    )
    return process, log_file


def read_log_tail(log_path: Path) -> str:
    if not log_path.exists():
        return ""
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-40:])


def wait_for_url(url: str, timeout: int = 20) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                return response.status < 500
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.5)
    return False


def main() -> None:
    check_dependencies()

    backend, backend_log = start_process(
        "backend",
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        BACKEND_DIR,
        BACKEND_LOG,
    )
    frontend, frontend_log = start_process(
        "frontend",
        [sys.executable, "static_server.py"],
        FRONTEND_DIR,
        FRONTEND_LOG,
    )

    print("")
    print("Cyra competition demo is starting.")
    print("Waiting for services...")
    backend_ready = wait_for_url(f"{BACKEND_URL}/api/health", timeout=30)
    frontend_ready = wait_for_url(FRONTEND_URL, timeout=20)
    print("")
    print("Open these URLs after both services are ready:")
    print(f"Portal page:        {FRONTEND_URL}/")
    print(f"Tourist mobile web: {FRONTEND_URL}/tourist.html")
    print(f"Admin dashboard:     {FRONTEND_URL}/admin.html")
    print(f"Backend health:      {BACKEND_URL}/api/health")
    print(f"Backend status:      {'ready' if backend_ready else 'not ready, check backend.runtime.log'}")
    print(f"Frontend status:     {'ready' if frontend_ready else 'not ready, check frontend.runtime.log'}")
    print("Press Ctrl+C in this PyCharm console to stop both services.")
    print("")

    try:
        while True:
            if backend.poll() is not None:
                raise RuntimeError(f"Backend exited with code {backend.returncode}\n{read_log_tail(BACKEND_LOG)}")
            if frontend.poll() is not None:
                raise RuntimeError(f"Frontend exited with code {frontend.returncode}\n{read_log_tail(FRONTEND_LOG)}")
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping Cyra demo...")
    finally:
        for process in (frontend, backend):
            if process.poll() is None:
                process.terminate()
        for process in (frontend, backend):
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        backend_log.close()
        frontend_log.close()


if __name__ == "__main__":
    main()
