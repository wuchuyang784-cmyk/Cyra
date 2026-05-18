import asyncio
import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
import websockets
from fastapi import HTTPException, WebSocket

from app.core.config import Settings

_token_cache: dict[str, str | int] = {"id": "", "expire_time": 0}


async def get_nls_token(settings: Settings) -> str:
    if settings.aliyun_nls_token:
        return settings.aliyun_nls_token
    now = int(time.time())
    cached_token = str(_token_cache.get("id") or "")
    expire_time = int(_token_cache.get("expire_time") or 0)
    if cached_token and expire_time - now > 300:
        return cached_token
    if settings.aliyun_access_key_id and settings.aliyun_access_key_secret:
        token, token_expire_time = await _create_nls_token(settings)
        _token_cache["id"] = token
        _token_cache["expire_time"] = token_expire_time
        return token
    raise HTTPException(
        status_code=500,
        detail="Missing Alibaba Cloud NLS credentials. Set ALIYUN_NLS_TOKEN or ALIYUN_ACCESS_KEY_ID/ALIYUN_ACCESS_KEY_SECRET.",
    )


def nls_url(settings: Settings, token: str) -> str:
    separator = "&" if "?" in settings.aliyun_nls_ws_url else "?"
    return f"{settings.aliyun_nls_ws_url}{separator}token={token}"


async def _create_nls_token(settings: Settings) -> tuple[str, int]:
    params = {
        "AccessKeyId": settings.aliyun_access_key_id,
        "Action": "CreateToken",
        "Format": "JSON",
        "RegionId": settings.aliyun_nls_region,
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": uuid.uuid4().hex,
        "SignatureVersion": "1.0",
        "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "Version": "2019-02-28",
    }
    params["Signature"] = _sign_rpc_params(params, settings.aliyun_access_key_secret)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"https://nls-meta.{settings.aliyun_nls_region}.aliyuncs.com", params=params)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Create NLS token failed: {exc.response.text[:300]}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Create NLS token request failed: {exc}") from exc

    data = response.json()
    token = data.get("Token") or {}
    token_id = token.get("Id")
    expire_time = int(token.get("ExpireTime") or 0)
    if not token_id:
        raise HTTPException(status_code=502, detail=f"Create NLS token returned invalid payload: {data}")
    return token_id, expire_time


def _sign_rpc_params(params: dict[str, str], access_key_secret: str) -> str:
    canonicalized_query = "&".join(f"{_percent_encode(key)}={_percent_encode(params[key])}" for key in sorted(params))
    string_to_sign = f"GET&%2F&{_percent_encode(canonicalized_query)}"
    digest = hmac.new(
        f"{access_key_secret}&".encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


def _percent_encode(value: str) -> str:
    return quote(str(value), safe="-_.~")


def nls_command(namespace: str, name: str, appkey: str, task_id: str, payload: dict | None = None) -> str:
    return json.dumps(
        {
            "header": {
                "appkey": appkey,
                "namespace": namespace,
                "name": name,
                "task_id": task_id,
                "message_id": uuid.uuid4().hex,
            },
            "payload": payload or {},
        },
        ensure_ascii=False,
    )


async def proxy_asr(websocket: WebSocket, settings: Settings) -> None:
    await websocket.accept()

    if settings.mock_ai:
        await _mock_asr(websocket)
        return

    task_id = uuid.uuid4().hex
    token = await get_nls_token(settings)
    async with websockets.connect(nls_url(settings, token), max_size=8 * 1024 * 1024) as nls:
        await nls.send(
            nls_command(
                "SpeechTranscriber",
                "StartTranscription",
                settings.aliyun_nls_app_key,
                task_id,
                {
                    "format": "pcm",
                    "sample_rate": 16000,
                    "enable_intermediate_result": True,
                    "enable_punctuation_prediction": True,
                    "enable_inverse_text_normalization": True,
                },
            )
        )

        forward = asyncio.create_task(_browser_to_nls(websocket, nls))
        backward = asyncio.create_task(_nls_to_browser(websocket, nls))
        done, pending = await asyncio.wait({forward, backward}, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        for task in done:
            task.result()

        await nls.send(nls_command("SpeechTranscriber", "StopTranscription", settings.aliyun_nls_app_key, task_id))


async def _browser_to_nls(websocket: WebSocket, nls) -> None:
    while True:
        message = await websocket.receive()
        if message.get("bytes"):
            await nls.send(message["bytes"])
        elif message.get("text") == "stop":
            return


async def _nls_to_browser(websocket: WebSocket, nls) -> None:
    async for raw in nls:
        data = json.loads(raw) if isinstance(raw, str) else {}
        header = data.get("header", {})
        payload = data.get("payload", {})
        name = header.get("name", "")
        if name in {"TranscriptionResultChanged", "SentenceEnd"}:
            await websocket.send_json(
                {
                    "type": "partial" if name == "TranscriptionResultChanged" else "final",
                    "text": payload.get("result", ""),
                }
            )
        elif name.endswith("Failed"):
            await websocket.send_json({"type": "error", "message": header.get("status_text", "ASR failed")})


async def _mock_asr(websocket: WebSocket) -> None:
    chunks = ["正在监听", "正在识别语音", "这是本地模拟识别结果"]
    for text in chunks:
        await asyncio.sleep(0.8)
        await websocket.send_json({"type": "partial", "text": text})
    await websocket.send_json({"type": "final", "text": chunks[-1]})
    while True:
        message = await websocket.receive()
        if message.get("text") == "stop":
            return
