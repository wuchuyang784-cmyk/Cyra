from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import admin, avatar, chat, comments, tts
from app.api import asr
from app.core.config import get_settings
from app.services.comment_service import DATA_DIR

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(avatar.router)
app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(asr.router)
app.include_router(comments.router)
DATA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media/comments", StaticFiles(directory=DATA_DIR), name="comment-media")


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "app": settings.app_name}
