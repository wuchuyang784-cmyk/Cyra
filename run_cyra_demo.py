import importlib.util
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "src" / "backend"
FRONTEND_DIR = ROOT / "src" / "frontend"
BACKEND_LOG = ROOT / "backend.runtime.log"
FRONTEND_LOG = ROOT / "frontend.runtime.log"
BACKEND_PORT = 8001
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
FRONTEND_PORT_START = 5173
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"


def ensure_project_python() -> None:
    if not VENV_PYTHON.exists():
        return
    try:
        running_project_python = Path(sys.executable).resolve().samefile(VENV_PYTHON.resolve())
    except OSError:
        running_project_python = False
    if running_project_python:
        return
    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), *sys.argv])


def check_dependencies() -> None:
    missing = []
    for module_name, package_name in [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn[standard]"),
        ("docx", "python-docx"),
        ("openpyxl", "openpyxl"),
        ("dashscope", "dashscope"),
        ("chromadb", "chromadb"),
        ("whisper", "openai-whisper"),
        ("multipart", "python-multipart"),
        ("imageio_ffmpeg", "imageio-ffmpeg"),
    ]:
        if importlib.util.find_spec(module_name) is None:
            missing.append(package_name)
    if missing:
        packages = " ".join(missing)
        raise RuntimeError(
            "Missing Python packages: "
            f"{packages}\nRun this once in Terminal:\n"
            f"{sys.executable} -m pip install -r requirements.txt"
        )


def start_process(
    name: str,
    args: list[str],
    cwd: Path,
    log_path: Path,
    extra_env: dict[str, str] | None = None,
) -> tuple[subprocess.Popen, object]:
    print(f"[{name}] starting: {' '.join(args)}")
    print(f"[{name}] log: {log_path}")
    log_file = log_path.open("w", encoding="utf-8", errors="replace")
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    if extra_env:
        env.update(extra_env)
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


def is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def find_available_port(start: int, attempts: int = 20) -> int:
    for port in range(start, start + attempts):
        if is_port_available(port):
            return port
    raise RuntimeError(f"No available frontend port found from {start} to {start + attempts - 1}")


def ensure_backend_port_available() -> None:
    if is_port_available(BACKEND_PORT):
        return
    if wait_for_url(f"{BACKEND_URL}/api/health", timeout=2):
        print(f"Backend at {BACKEND_PORT} is already running, reusing it.")
        return
    raise RuntimeError(
        f"Backend port {BACKEND_PORT} is already in use. "
        "Stop the old Cyra backend first with Ctrl+C in its console, "
        "or end the python process that is listening on that port, then run this script again."
    )


def ensure_backend_ready() -> str:
    if is_port_available(BACKEND_PORT):
        return "runner"
    if wait_for_url(f"{BACKEND_URL}/api/health", timeout=2):
        print(f"Backend at {BACKEND_PORT} is already running, reusing it.")
        return "external"
    ensure_backend_port_available()
    return "runner"


def main() -> None:
    ensure_project_python()
    check_dependencies()
    backend_owner = ensure_backend_ready()

    frontend_port = find_available_port(FRONTEND_PORT_START)
    frontend_url = f"http://127.0.0.1:{frontend_port}"

    backend = None
    backend_log = None
    if backend_owner == "runner":
        backend, backend_log = start_process(
            "backend",
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
            BACKEND_DIR,
            BACKEND_LOG,
            extra_env={
                "CORS_ORIGINS": f'["http://localhost:{frontend_port}","{frontend_url}"]',
            },
        )
    else:
        print(f"Backend at {BACKEND_PORT} is already running, reusing it.")
    frontend, frontend_log = start_process(
        "frontend",
        [sys.executable, "static_server.py", "--port", str(frontend_port)],
        FRONTEND_DIR,
        FRONTEND_LOG,
    )

    print("")
    print("Cyra demo is starting.")
    print("Waiting for services...")
    backend_ready = wait_for_url(f"{BACKEND_URL}/api/health", timeout=30)
    frontend_ready = wait_for_url(f"{frontend_url}/admin.html", timeout=20)
    print("")
    print("Open these URLs after both services are ready:")
    print(f"Tourist Live2D page: {frontend_url}/tourist.html")
    print(f"Admin dashboard:     {frontend_url}/admin.html")
    print(f"Knowledge manager:   {frontend_url}/knowledge.html")
    print(f"Backend health:      {BACKEND_URL}/api/health")
    print(f"Backend status:      {'ready' if backend_ready else 'not ready, check backend.runtime.log'}")
    print(f"Frontend status:     {'ready' if frontend_ready else 'not ready, check frontend.runtime.log'}")
    print("Press Ctrl+C in this console to stop both services.")
    print("")

    try:
        while True:
            if backend is not None and backend.poll() is not None:
                raise RuntimeError(f"Backend exited with code {backend.returncode}\n{read_log_tail(BACKEND_LOG)}")
            if frontend.poll() is not None:
                raise RuntimeError(f"Frontend exited with code {frontend.returncode}\n{read_log_tail(FRONTEND_LOG)}")
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping Cyra admin dashboard...")
    finally:
        for process in (frontend, backend):
            if process is None:
                continue
            if process.poll() is None:
                process.terminate()
        for process in (frontend, backend):
            if process is None:
                continue
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        if backend_log is not None:
            backend_log.close()
        frontend_log.close()


if __name__ == "__main__":
    main()
