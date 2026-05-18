from fastapi import APIRouter

from app.services.resource_pack import get_behavior_overview, get_resource_pack, get_visitor_report

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/knowledge")
async def knowledge_items() -> dict:
    return {"items": get_resource_pack().admin_knowledge()}


@router.get("/analytics/overview")
async def analytics_overview() -> dict:
    return get_behavior_overview()


@router.get("/analytics/report")
async def visitor_report() -> dict:
    return get_visitor_report()
