import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4


BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "app_data" / "visitor_comments"
UPLOAD_DIR = DATA_DIR / "uploads"
GALLERY_DIR = DATA_DIR / "gallery"
STORE_PATH = DATA_DIR / "comments.json"
ALLOWED_SPOT_IDS = {"lingshan-buddha", "jiulong", "fangong", "wuyin"}
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
_LOCK = RLock()


def _ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    GALLERY_DIR.mkdir(parents=True, exist_ok=True)


def _load() -> list[dict]:
    _ensure_dirs()
    if not STORE_PATH.exists():
        return []
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def _save(items: list[dict]) -> None:
    _ensure_dirs()
    temp_path = STORE_PATH.with_suffix(".tmp")
    temp_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(STORE_PATH)


def _public_item(item: dict) -> dict:
    return {
        **item,
        "image_url": f"/media/comments/uploads/{item['image_name']}" if item.get("image_name") else None,
        "gallery_url": f"/media/comments/gallery/{item['gallery_name']}" if item.get("gallery_name") else None,
    }


def create_comment(spot_id: str, content: str, image: bytes | None, content_type: str | None) -> dict:
    if spot_id not in ALLOWED_SPOT_IDS:
        raise ValueError("不支持的景点")
    clean_content = content.strip()
    if not clean_content:
        raise ValueError("评论内容不能为空")
    image_name = None
    if image is not None:
        suffix = ALLOWED_IMAGE_TYPES.get((content_type or "").lower())
        if suffix is None:
            raise ValueError("评论图片仅支持 JPG、PNG 或 WebP")
        if len(image) > MAX_IMAGE_BYTES:
            raise ValueError("评论图片不能超过 8MB")
        image_name = f"{uuid4().hex}{suffix}"
        _ensure_dirs()
        (UPLOAD_DIR / image_name).write_bytes(image)

    item = {
        "id": uuid4().hex,
        "spot_id": spot_id,
        "author": "游客",
        "content": clean_content[:200],
        "image_name": image_name,
        "status": "pending",
        "in_gallery": False,
        "gallery_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _LOCK:
        items = _load()
        items.append(item)
        _save(items)
    return _public_item(item)


def list_comments(status: str | None = None, spot_id: str | None = None) -> list[dict]:
    with _LOCK:
        items = _load()
    if status:
        items = [item for item in items if item.get("status") == status]
    if spot_id:
        items = [item for item in items if item.get("spot_id") == spot_id]
    return [_public_item(item) for item in reversed(items)]


def moderate_comment(comment_id: str, status: str) -> dict:
    if status not in {"approved", "rejected"}:
        raise ValueError("审核状态无效")
    with _LOCK:
        items = _load()
        for item in items:
            if item.get("id") == comment_id:
                item["status"] = status
                if status == "rejected":
                    item["in_gallery"] = False
                _save(items)
                return _public_item(item)
    raise KeyError(comment_id)


def add_comment_image_to_gallery(comment_id: str) -> dict:
    with _LOCK:
        items = _load()
        for item in items:
            if item.get("id") != comment_id:
                continue
            if item.get("status") != "approved":
                raise ValueError("只有审核通过的评论图片可以入库")
            image_name = item.get("image_name")
            if not image_name:
                raise ValueError("该评论没有图片")
            source = UPLOAD_DIR / image_name
            if not source.exists():
                raise ValueError("评论图片文件不存在")
            gallery_name = f"{item['spot_id']}-{item['id']}{source.suffix}"
            shutil.copy2(source, GALLERY_DIR / gallery_name)
            item["in_gallery"] = True
            item["gallery_name"] = gallery_name
            _save(items)
            return _public_item(item)
    raise KeyError(comment_id)


def delete_comment(comment_id: str) -> dict:
    with _LOCK:
        items = _load()
        for index, item in enumerate(items):
            if item.get("id") != comment_id:
                continue
            removed = items.pop(index)
            for directory, key in ((UPLOAD_DIR, "image_name"), (GALLERY_DIR, "gallery_name")):
                file_name = removed.get(key)
                if file_name:
                    (directory / file_name).unlink(missing_ok=True)
            _save(items)
            return _public_item(removed)
    raise KeyError(comment_id)
