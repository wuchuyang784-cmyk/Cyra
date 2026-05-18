from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.resource_pack import get_resource_pack

router = APIRouter(prefix="/api", tags=["knowledge"])


class FeedbackRequest(BaseModel):
    session_id: str = "default"
    message: str = ""
    rating: int = Field(ge=1, le=5)
    comment: str = ""


@router.get("/knowledge/spots")
async def list_spots(limit: int = 24) -> dict:
    return {"items": get_resource_pack().list_spots(limit=limit)}


@router.get("/knowledge/search")
async def search_knowledge(q: str, limit: int = 5) -> dict:
    hits = get_resource_pack().search(q, limit=limit)
    return {
        "items": [
            {
                "id": hit.id,
                "title": hit.title,
                "content": hit.content,
                "source": hit.source,
                "score": hit.score,
            }
            for hit in hits
        ]
    }


@router.get("/routes/recommend")
async def recommend_route(interest: str = "历史文化") -> dict:
    return get_resource_pack().recommend_route(interest)


@router.post("/feedback")
async def add_feedback(request: FeedbackRequest) -> dict:
    return {"ok": True, "item": get_resource_pack().add_feedback(request.model_dump())}


@router.put("/admin/knowledge/{item_id}")
async def update_knowledge(item_id: str, payload: dict) -> dict:
    try:
        item = get_resource_pack().update_knowledge(
            item_id,
            title=payload.get("title"),
            content=payload.get("content"),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Knowledge item not found") from exc
    return {"ok": True, "item": item}
