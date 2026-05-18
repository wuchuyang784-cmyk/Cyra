from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.config import Settings, get_settings
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService
from app.services.expression import infer_expression

router = APIRouter(prefix="/api", tags=["chat"])
_services: dict[int, ChatService] = {}


def get_chat_service(settings: Settings = Depends(get_settings)) -> ChatService:
    key = id(settings)
    if key not in _services:
        _services[key] = ChatService(settings)
    return _services[key]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, service: ChatService = Depends(get_chat_service)) -> ChatResponse:
    answer, history, sources = await service.ask(request.session_id, request.message, request.history)
    return ChatResponse(
        session_id=request.session_id,
        answer=answer,
        expression=infer_expression(answer),
        history=history,
        sources=sources,
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, service: ChatService = Depends(get_chat_service)) -> StreamingResponse:
    return StreamingResponse(
        service.stream(request.session_id, request.message, request.history),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
