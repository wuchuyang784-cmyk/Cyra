from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.comment_service import (
    MAX_IMAGE_BYTES,
    add_comment_image_to_gallery,
    create_comment,
    delete_comment,
    list_comments,
    moderate_comment,
)


router = APIRouter(prefix="/api", tags=["comments"])


class ModerationRequest(BaseModel):
    status: str


@router.get("/comments")
async def approved_comments(spot_id: str | None = None) -> dict:
    return {"items": list_comments(status="approved", spot_id=spot_id)}


@router.post("/comments", status_code=201)
async def submit_comment(
    spot_id: str = Form(...),
    content: str = Form(..., max_length=200),
    image: UploadFile | None = File(default=None),
) -> dict:
    image_bytes = None
    content_type = None
    if image is not None:
        image_bytes = await image.read(MAX_IMAGE_BYTES + 1)
        content_type = image.content_type
    try:
        item = create_comment(spot_id, content, image_bytes, content_type)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"item": item, "message": "评论已提交，审核通过后将在游客端展示"}


@router.get("/admin/comments")
async def admin_comments(status: str | None = None) -> dict:
    return {"items": list_comments(status=status)}


@router.patch("/admin/comments/{comment_id}")
async def review_comment(comment_id: str, payload: ModerationRequest) -> dict:
    try:
        return {"item": moderate_comment(comment_id, payload.status)}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="评论不存在") from error


@router.post("/admin/comments/{comment_id}/gallery")
async def add_to_gallery(comment_id: str) -> dict:
    try:
        return {"item": add_comment_image_to_gallery(comment_id)}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail="评论不存在") from error


@router.delete("/admin/comments/{comment_id}")
async def remove_comment(comment_id: str) -> dict:
    try:
        return {"item": delete_comment(comment_id)}
    except KeyError as error:
        raise HTTPException(status_code=404, detail="评论不存在") from error
