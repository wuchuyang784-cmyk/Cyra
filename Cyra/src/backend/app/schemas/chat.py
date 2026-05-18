from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1)
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    expression: str = "neutral"
    history: List[ChatMessage]
    sources: List[dict] = Field(default_factory=list)
