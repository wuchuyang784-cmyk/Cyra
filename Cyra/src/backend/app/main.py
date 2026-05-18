from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, asr, chat, knowledge, tts
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(asr.router)
app.include_router(knowledge.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "app": settings.app_name}
