from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.avatar import AvatarDisplayUpdate
from app.services.avatar_service import (
    activate_avatar,
    delete_avatar,
    load_avatar_manifest,
    public_avatar_manifest,
    update_avatar,
    upload_avatar_zip,
)


router = APIRouter(prefix="/api", tags=["avatar"])


@router.get("/avatar/manifest")
async def avatar_manifest() -> dict:
    return public_avatar_manifest()


@router.get("/admin/avatars")
async def admin_avatars() -> dict:
    return load_avatar_manifest()


@router.post("/admin/avatars/upload")
async def upload_avatar(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    try:
        avatar = upload_avatar_zip(file.filename or "avatar.zip", content)
    except OverflowError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"avatar": avatar}


@router.patch("/admin/avatars/{avatar_id}")
async def patch_avatar(avatar_id: str, payload: AvatarDisplayUpdate) -> dict:
    try:
        avatar = update_avatar(avatar_id, payload.model_dump(exclude_unset=True))
    except KeyError as error:
        raise HTTPException(status_code=404, detail="形象不存在") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {"avatar": avatar}


@router.post("/admin/avatars/{avatar_id}/activate")
async def activate_admin_avatar(avatar_id: str) -> dict:
    try:
        return activate_avatar(avatar_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="形象不存在") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/admin/avatars/{avatar_id}")
async def delete_admin_avatar(avatar_id: str) -> dict:
    try:
        return delete_avatar(avatar_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="形象不存在") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
