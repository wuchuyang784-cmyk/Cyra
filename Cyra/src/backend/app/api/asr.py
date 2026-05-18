from fastapi import APIRouter, Depends, WebSocket

from app.core.config import Settings, get_settings
from app.services.aliyun_nls import proxy_asr

router = APIRouter(tags=["asr"])


@router.websocket("/ws/asr")
async def asr(websocket: WebSocket, settings: Settings = Depends(get_settings)) -> None:
    await proxy_asr(websocket, settings)
