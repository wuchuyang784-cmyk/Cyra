from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import complete_chat, stream_chat
from app.services.visitor_metrics import record_visitor_question

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    record_visitor_question(request.message, has_image=bool(request.image_data_url))
    reply, provider, fallback = complete_chat(request)
    return ChatResponse(reply=reply, provider=provider, fallback=fallback)


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    record_visitor_question(request.message, has_image=bool(request.image_data_url))
    return StreamingResponse(stream_chat(request), media_type="text/plain; charset=utf-8")
