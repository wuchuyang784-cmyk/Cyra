from __future__ import annotations

import json
import re
import shutil
import zipfile
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4


ROOT_DIR = Path(__file__).resolve().parents[4]
FRONTEND_DIR = ROOT_DIR / "src" / "frontend"
MANIFEST_FILE = ROOT_DIR / "src" / "backend" / "app_data" / "avatar_manifest.json"
CUSTOM_AVATAR_DIR = FRONTEND_DIR / "assets" / "live2d" / "custom"

MAX_ZIP_BYTES = 80 * 1024 * 1024
MAX_EXTRACTED_BYTES = 240 * 1024 * 1024
SUPPORTED_MOC3_VERSION = 5

DISPLAY_LIMITS = {
    "maxScale": (0.02, 1.0),
    "stageWidthRatio": (0.1, 1.0),
    "stageHeightRatio": (0.1, 1.0),
    "anchorX": (0.0, 1.0),
    "anchorY": (0.0, 1.0),
    "offsetX": (-2000.0, 2000.0),
    "offsetY": (-2000.0, 2000.0),
}


DEFAULT_AVATAR = {
    "id": "mao_pro",
    "name": "Mao Pro 导游",
    "role": "Live2D 示例数字人",
    "model": "./assets/live2d/mao_pro/mao_pro.model3.json",
    "built_in": True,
    "maxScale": 0.115,
    "stageWidthRatio": 0.44,
    "stageHeightRatio": 0.6,
    "anchorX": 0.5,
    "anchorY": 0.52,
    "offsetX": 0,
    "offsetY": -20,
}


def load_avatar_manifest() -> dict[str, Any]:
    saved = _read_saved_manifest()
    avatars = _merge_default_avatar(saved.get("avatars", []))
    active_avatar_id = str(saved.get("active_avatar_id") or DEFAULT_AVATAR["id"])
    if not any(item["id"] == active_avatar_id for item in avatars):
        active_avatar_id = DEFAULT_AVATAR["id"]
    active_avatar = next(item for item in avatars if item["id"] == active_avatar_id)
    if not _avatar_runtime_is_supported(active_avatar):
        active_avatar_id = DEFAULT_AVATAR["id"]
    return {"active_avatar_id": active_avatar_id, "avatars": avatars}


def public_avatar_manifest() -> dict[str, Any]:
    manifest = load_avatar_manifest()
    active = _find_avatar(manifest, manifest["active_avatar_id"])
    return {
        **manifest,
        "active_avatar": active,
    }


def upload_avatar_zip(filename: str, content: bytes) -> dict[str, Any]:
    if not content:
        raise ValueError("上传文件为空")
    if len(content) > MAX_ZIP_BYTES:
        raise OverflowError("形象包不能超过 80MB")
    if Path(filename or "").suffix.lower() != ".zip":
        raise ValueError("仅支持上传 .zip Live2D 运行时包")

    try:
        archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as error:
        raise ValueError("形象包不是有效的 zip 文件") from error

    with archive:
        entries = [item for item in archive.infolist() if not item.is_dir()]
        if not entries:
            raise ValueError("形象包为空")
        _validate_zip_entries(entries)
        model_entries = [item.filename for item in entries if item.filename.lower().endswith(".model3.json")]
        if not model_entries:
            raise ValueError("形象包内必须包含 .model3.json")
        model_entry = sorted(model_entries, key=lambda item: (len(item), item))[0].replace("\\", "/")
        _validate_model_runtime_in_archive(archive, entries, model_entry)

        avatar_id = _unique_avatar_id(Path(filename).stem)
        target_dir = CUSTOM_AVATAR_DIR / avatar_id
        target_dir.mkdir(parents=True, exist_ok=False)
        try:
            for entry in entries:
                destination = _safe_extract_destination(target_dir, entry.filename)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(entry) as source, destination.open("wb") as output:
                    shutil.copyfileobj(source, output)
        except Exception:
            shutil.rmtree(target_dir, ignore_errors=True)
            raise

    avatar = {
        "id": avatar_id,
        "name": _display_name_from_filename(filename),
        "role": "自定义 Live2D 数字人",
        "model": f"./assets/live2d/custom/{avatar_id}/{model_entry}",
        "built_in": False,
        "maxScale": DEFAULT_AVATAR["maxScale"],
        "stageWidthRatio": DEFAULT_AVATAR["stageWidthRatio"],
        "stageHeightRatio": DEFAULT_AVATAR["stageHeightRatio"],
        "anchorX": DEFAULT_AVATAR["anchorX"],
        "anchorY": DEFAULT_AVATAR["anchorY"],
        "offsetX": DEFAULT_AVATAR["offsetX"],
        "offsetY": DEFAULT_AVATAR["offsetY"],
    }
    manifest = load_avatar_manifest()
    manifest["avatars"].append(avatar)
    _save_manifest(manifest)
    return avatar


def update_avatar(avatar_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    manifest = load_avatar_manifest()
    avatar = _find_avatar(manifest, avatar_id)
    if "name" in payload and payload["name"] is not None:
        name = str(payload["name"]).strip()
        if not name:
            raise ValueError("形象名称不能为空")
        if len(name) > 80:
            raise ValueError("形象名称不能超过 80 个字符")
        avatar["name"] = name
    if "role" in payload and payload["role"] is not None:
        role = str(payload["role"]).strip()
        if len(role) > 160:
            raise ValueError("角色说明不能超过 160 个字符")
        avatar["role"] = role
    for field, (minimum, maximum) in DISPLAY_LIMITS.items():
        if field not in payload or payload[field] is None:
            continue
        value = float(payload[field])
        if value < minimum or value > maximum:
            raise ValueError(f"{field} 必须在 {minimum} 到 {maximum} 之间")
        avatar[field] = value
    _save_manifest(manifest)
    return avatar


def activate_avatar(avatar_id: str) -> dict[str, Any]:
    manifest = load_avatar_manifest()
    avatar = _find_avatar(manifest, avatar_id)
    _validate_avatar_runtime(avatar)
    manifest["active_avatar_id"] = avatar["id"]
    _save_manifest(manifest)
    return public_avatar_manifest()


def delete_avatar(avatar_id: str) -> dict[str, Any]:
    manifest = load_avatar_manifest()
    avatar = _find_avatar(manifest, avatar_id)
    if avatar.get("built_in"):
        raise ValueError("内置形象不能删除")
    manifest["avatars"] = [item for item in manifest["avatars"] if item["id"] != avatar_id]
    if manifest["active_avatar_id"] == avatar_id:
        manifest["active_avatar_id"] = DEFAULT_AVATAR["id"]
    _save_manifest(manifest)
    shutil.rmtree(CUSTOM_AVATAR_DIR / avatar_id, ignore_errors=True)
    return {"id": avatar_id, "deleted": True}


def _read_saved_manifest() -> dict[str, Any]:
    if not MANIFEST_FILE.exists():
        return {}
    try:
        data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_manifest(manifest: dict[str, Any]) -> None:
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    normalized = {
        "active_avatar_id": manifest.get("active_avatar_id") or DEFAULT_AVATAR["id"],
        "avatars": [_normalize_avatar(item) for item in manifest.get("avatars", [])],
    }
    MANIFEST_FILE.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")


def _merge_default_avatar(saved_avatars: list[Any]) -> list[dict[str, Any]]:
    avatars = []
    seen = set()
    for raw in [DEFAULT_AVATAR, *saved_avatars]:
        if not isinstance(raw, dict):
            continue
        avatar = _normalize_avatar(raw)
        if avatar["id"] in seen:
            continue
        seen.add(avatar["id"])
        avatars.append(avatar)
    return avatars


def _normalize_avatar(raw: dict[str, Any]) -> dict[str, Any]:
    avatar = dict(DEFAULT_AVATAR)
    avatar.update(raw)
    avatar["id"] = _safe_avatar_id(str(avatar.get("id") or DEFAULT_AVATAR["id"]))
    avatar["name"] = str(avatar.get("name") or avatar["id"])
    avatar["role"] = str(avatar.get("role") or "")
    avatar["model"] = str(avatar.get("model") or DEFAULT_AVATAR["model"])
    avatar["built_in"] = bool(avatar.get("built_in"))
    for field in DISPLAY_LIMITS:
        avatar[field] = float(avatar.get(field, DEFAULT_AVATAR[field]))
    if avatar["offsetX"].is_integer():
        avatar["offsetX"] = int(avatar["offsetX"])
    if avatar["offsetY"].is_integer():
        avatar["offsetY"] = int(avatar["offsetY"])
    return avatar


def _find_avatar(manifest: dict[str, Any], avatar_id: str) -> dict[str, Any]:
    for avatar in manifest.get("avatars", []):
        if avatar["id"] == avatar_id:
            return avatar
    raise KeyError(avatar_id)


def _validate_avatar_runtime(avatar: dict[str, Any]) -> None:
    if avatar.get("built_in"):
        return
    model_path = _frontend_public_path_to_file(str(avatar.get("model") or ""))
    _validate_model_runtime_on_disk(model_path)


def _avatar_runtime_is_supported(avatar: dict[str, Any]) -> bool:
    try:
        _validate_avatar_runtime(avatar)
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    return True


def _frontend_public_path_to_file(public_path: str) -> Path:
    normalized = public_path.replace("\\", "/").lstrip("./")
    if not normalized:
        raise ValueError("形象模型路径为空")
    custom_prefix = "assets/live2d/custom/"
    if normalized.startswith(custom_prefix):
        relative_custom_path = normalized[len(custom_prefix) :]
        _validate_zip_path(relative_custom_path)
        return CUSTOM_AVATAR_DIR / Path(relative_custom_path.replace("\\", "/"))
    model_path = FRONTEND_DIR / normalized
    resolved_frontend = FRONTEND_DIR.resolve()
    resolved_model = model_path.resolve()
    if resolved_frontend not in resolved_model.parents and resolved_model != resolved_frontend:
        raise ValueError("形象模型路径非法")
    return model_path


def _validate_model_runtime_on_disk(model_path: Path) -> None:
    try:
        model = json.loads(model_path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"形象模型文件不存在：{model_path.name}") from error
    references = _collect_model_file_references(model)
    for reference in references:
        path = _safe_model_reference(model_path.parent, reference)
        if not path.exists():
            raise ValueError(f"形象包缺少运行时资源：{reference}")
    moc_reference = _read_moc_reference(model)
    if moc_reference:
        _validate_moc3_version((model_path.parent / Path(moc_reference)).read_bytes(), moc_reference)


def _validate_model_runtime_in_archive(
    archive: zipfile.ZipFile,
    entries: list[zipfile.ZipInfo],
    model_entry: str,
) -> None:
    entry_names = {item.filename.replace("\\", "/") for item in entries}
    model = json.loads(archive.read(model_entry).decode("utf-8"))
    model_dir = PurePosixPath(model_entry).parent
    for reference in _collect_model_file_references(model):
        entry_name = _safe_archive_model_reference(model_dir, reference)
        if entry_name not in entry_names:
            raise ValueError(f"形象包缺少运行时资源：{reference}")
    moc_reference = _read_moc_reference(model)
    if moc_reference:
        moc_entry = _safe_archive_model_reference(model_dir, moc_reference)
        _validate_moc3_version(archive.read(moc_entry), moc_reference)


def _collect_model_file_references(model: Any) -> list[str]:
    if not isinstance(model, dict):
        raise ValueError(".model3.json 格式无效")
    file_references = model.get("FileReferences")
    if not isinstance(file_references, dict):
        raise ValueError(".model3.json 缺少 FileReferences")

    references: list[str] = []
    for field in ("Moc", "Physics", "Pose", "DisplayInfo"):
        value = file_references.get(field)
        if value:
            references.append(str(value))

    textures = file_references.get("Textures", [])
    if not isinstance(textures, list):
        raise ValueError(".model3.json 的 Textures 格式无效")
    references.extend(str(item) for item in textures if item)

    expressions = file_references.get("Expressions", [])
    if expressions and not isinstance(expressions, list):
        raise ValueError(".model3.json 的 Expressions 格式无效")
    for expression in expressions:
        if isinstance(expression, dict) and expression.get("File"):
            references.append(str(expression["File"]))

    motions = file_references.get("Motions", {})
    if motions and not isinstance(motions, dict):
        raise ValueError(".model3.json 的 Motions 格式无效")
    for group in motions.values():
        if not isinstance(group, list):
            continue
        for motion in group:
            if isinstance(motion, dict) and motion.get("File"):
                references.append(str(motion["File"]))

    return references


def _read_moc_reference(model: Any) -> str:
    file_references = model.get("FileReferences") if isinstance(model, dict) else {}
    moc = file_references.get("Moc") if isinstance(file_references, dict) else ""
    if not moc:
        raise ValueError(".model3.json 缺少 Moc 引用")
    return str(moc)


def _safe_model_reference(base_dir: Path, reference: str) -> Path:
    _validate_zip_path(reference)
    path = base_dir / Path(reference.replace("\\", "/"))
    resolved_base = base_dir.resolve()
    resolved_path = path.resolve()
    if resolved_base not in resolved_path.parents and resolved_path != resolved_base:
        raise ValueError("形象包包含非法资源路径")
    return path


def _safe_archive_model_reference(model_dir: PurePosixPath, reference: str) -> str:
    _validate_zip_path(reference)
    path = model_dir / PurePosixPath(reference.replace("\\", "/"))
    normalized = path.as_posix()
    _validate_zip_path(normalized)
    return normalized


def _validate_moc3_version(content: bytes, reference: str) -> None:
    if len(content) < 8 or content[:4] != b"MOC3":
        raise ValueError(f"{reference} 不是有效的 moc3 文件")
    version = int.from_bytes(content[4:8], byteorder="little", signed=False)
    if version > SUPPORTED_MOC3_VERSION:
        raise ValueError(
            f"{reference} 是 moc3 v{version}，当前游客端 Live2D 运行时仅支持到 moc3 v{SUPPORTED_MOC3_VERSION}；"
            "请用兼容的 Cubism 版本重新导出运行时包"
        )


def _validate_zip_entries(entries: list[zipfile.ZipInfo]) -> None:
    total = 0
    for entry in entries:
        total += int(entry.file_size or 0)
        if total > MAX_EXTRACTED_BYTES:
            raise OverflowError("形象包解压后不能超过 240MB")
        _validate_zip_path(entry.filename)


def _validate_zip_path(filename: str) -> None:
    normalized = filename.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or any(part in {"..", ""} for part in path.parts):
        raise ValueError("形象包包含非法路径")


def _safe_extract_destination(target_dir: Path, filename: str) -> Path:
    _validate_zip_path(filename)
    destination = target_dir / Path(filename.replace("\\", "/"))
    resolved_target = target_dir.resolve()
    resolved_destination = destination.resolve()
    if resolved_target not in resolved_destination.parents and resolved_destination != resolved_target:
        raise ValueError("形象包包含非法路径")
    return destination


def _unique_avatar_id(filename_stem: str) -> str:
    base = _safe_avatar_id(filename_stem) or "avatar"
    manifest = load_avatar_manifest()
    existing = {item["id"] for item in manifest["avatars"]}
    candidate = base
    while candidate in existing or (CUSTOM_AVATAR_DIR / candidate).exists():
        candidate = f"{base}-{uuid4().hex[:6]}"
    return candidate


def _safe_avatar_id(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip().lower()).strip("-_")
    return slug[:64] or "avatar"


def _display_name_from_filename(filename: str) -> str:
    name = Path(filename or "自定义形象").stem.strip()
    return name[:80] or "自定义形象"
