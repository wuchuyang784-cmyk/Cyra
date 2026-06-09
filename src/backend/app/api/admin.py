from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.resource_pack import get_behavior_overview, get_resource_pack, get_visitor_report

router = APIRouter(prefix="/api/admin", tags=["admin"])


class KnowledgeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    content: str | None = Field(default=None, max_length=6000)


@router.get("/knowledge")
async def knowledge_items() -> dict:
    return {"items": get_resource_pack().admin_knowledge()}


@router.get("/knowledge/{item_id}")
async def knowledge_detail(item_id: str) -> dict:
    try:
        return {"item": get_resource_pack().get_knowledge_item(item_id)}
    except KeyError as error:
        raise HTTPException(status_code=404, detail="知识条目不存在") from error


@router.patch("/knowledge/{item_id}")
async def update_knowledge(item_id: str, payload: KnowledgeUpdateRequest) -> dict:
    if payload.title is None and payload.content is None:
        raise HTTPException(status_code=400, detail="请提供标题或正文")
    try:
        item = get_resource_pack().update_knowledge(item_id, payload.title, payload.content)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="知识条目不存在") from error
    return {"item": item}


@router.delete("/knowledge/{item_id}")
async def delete_knowledge(item_id: str) -> dict:
    try:
        return {"item": get_resource_pack().delete_knowledge(item_id)}
    except KeyError as error:
        raise HTTPException(status_code=404, detail="知识条目不存在") from error


@router.post("/knowledge/upload")
async def upload_knowledge(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="知识文件不能超过 8MB")
    try:
        item = get_resource_pack().add_uploaded_knowledge(file.filename or "knowledge.txt", content)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"item": item}


@router.get("/analytics/overview")
async def analytics_overview() -> dict:
    return get_behavior_overview()


@router.get("/analytics/report")
async def visitor_report() -> dict:
    return get_visitor_report()
