const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const python = path.join(root, ".venv", "Scripts", "python.exe");

const script = String.raw`
from io import BytesIO
import json
import tempfile
import zipfile
from pathlib import Path

from fastapi import HTTPException

import app.services.avatar_service as avatar_service


def make_zip(entries):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return buffer.getvalue()


with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    avatar_service.MANIFEST_FILE = root / "avatar_manifest.json"
    avatar_service.CUSTOM_AVATAR_DIR = root / "frontend" / "assets" / "live2d" / "custom"

    manifest = avatar_service.load_avatar_manifest()
    assert manifest["active_avatar_id"] == "mao_pro"
    assert any(item["id"] == "mao_pro" and item["built_in"] for item in manifest["avatars"])

    try:
        avatar_service.upload_avatar_zip("broken.zip", make_zip({"readme.txt": "no model"}))
    except ValueError as error:
        assert ".model3.json" in str(error)
    else:
        raise AssertionError("zip without model3 json should fail")

    try:
        avatar_service.upload_avatar_zip("evil.zip", make_zip({"../evil.model3.json": "{}"}))
    except ValueError as error:
        assert "非法" in str(error) or "路径" in str(error)
    else:
        raise AssertionError("zip path traversal should fail")

    try:
        avatar_service.upload_avatar_zip(
            "missing-runtime.zip",
            make_zip({"ren/ren.model3.json": "{\"Version\": 3, \"FileReferences\": {\"Moc\": \"ren.moc3\"}}"}),
        )
    except ValueError as error:
        assert "ren.moc3" in str(error)
    else:
        raise AssertionError("model3 references to missing runtime files should fail")

    try:
        avatar_service.upload_avatar_zip(
            "cubism-53.zip",
            make_zip({
                "ren/ren.model3.json": "{\"Version\": 3, \"FileReferences\": {\"Moc\": \"ren.moc3\"}}",
                "ren/ren.moc3": b"MOC3" + bytes([6, 0, 0, 0]) + b"0" * 24,
            }),
        )
    except ValueError as error:
        assert "moc3 v6" in str(error)
    else:
        raise AssertionError("moc3 v6 packages should fail before activation")

    uploaded = avatar_service.upload_avatar_zip(
        "Ren Guide.zip",
        make_zip({
            "ren/ren.model3.json": "{\"Version\": 3, \"FileReferences\": {\"Moc\": \"ren.moc3\", \"Textures\": [\"textures/texture_00.png\"]}}",
            "ren/ren.moc3": b"MOC3" + bytes([5, 0, 0, 0]) + b"0" * 24,
            "ren/textures/texture_00.png": "fake",
        }),
    )
    assert uploaded["id"].startswith("ren-guide")
    assert uploaded["model"].startswith("./assets/live2d/custom/")
    assert uploaded["model"].endswith("/ren/ren.model3.json")
    assert uploaded["built_in"] is False

    after_upload = avatar_service.load_avatar_manifest()
    assert after_upload["active_avatar_id"] == "mao_pro", "upload must not auto-activate"

    incompatible_dir = avatar_service.CUSTOM_AVATAR_DIR / "new-ren" / "ren"
    incompatible_dir.mkdir(parents=True)
    (incompatible_dir / "ren.model3.json").write_text(
        "{\"Version\": 3, \"FileReferences\": {\"Moc\": \"ren.moc3\"}}",
        encoding="utf-8",
    )
    (incompatible_dir / "ren.moc3").write_bytes(b"MOC3" + bytes([6, 0, 0, 0]) + b"0" * 24)
    manifest_with_incompatible_active = avatar_service.load_avatar_manifest()
    manifest_with_incompatible_active["active_avatar_id"] = "new-ren"
    manifest_with_incompatible_active["avatars"].append({
        "id": "new-ren",
        "name": "New Ren",
        "model": "./assets/live2d/custom/new-ren/ren/ren.model3.json",
        "built_in": False,
    })
    avatar_service.MANIFEST_FILE.write_text(json.dumps(manifest_with_incompatible_active), encoding="utf-8")
    admin_fallback_manifest = avatar_service.load_avatar_manifest()
    assert admin_fallback_manifest["active_avatar_id"] == "mao_pro", "admin manifest should not report an unsupported active avatar"
    fallback_manifest = avatar_service.public_avatar_manifest()
    assert fallback_manifest["active_avatar_id"] == "mao_pro", "unsupported active avatars should fall back to the built-in model"
    try:
        avatar_service.activate_avatar("new-ren")
    except ValueError as error:
        assert "moc3 v6" in str(error)
    else:
        raise AssertionError("activation should reject existing incompatible custom avatars")

    activated = avatar_service.activate_avatar(uploaded["id"])
    assert activated["active_avatar_id"] == uploaded["id"]
    assert activated["active_avatar"]["id"] == uploaded["id"]

    updated = avatar_service.update_avatar(
        uploaded["id"],
        {
            "name": "仁导游",
            "role": "自定义导览员",
            "maxScale": 0.2,
            "stageWidthRatio": 0.5,
            "stageHeightRatio": 0.7,
            "anchorX": 0.45,
            "anchorY": 0.55,
            "offsetX": 12,
            "offsetY": -18,
        },
    )
    assert updated["name"] == "仁导游"
    assert updated["offsetY"] == -18

    try:
        avatar_service.delete_avatar("mao_pro")
    except ValueError as error:
        assert "内置" in str(error)
    else:
        raise AssertionError("built-in avatar deletion should fail")

    deleted = avatar_service.delete_avatar(uploaded["id"])
    assert deleted["deleted"] is True
    final_manifest = avatar_service.load_avatar_manifest()
    assert final_manifest["active_avatar_id"] == "mao_pro"
    assert not any(item["id"] == uploaded["id"] for item in final_manifest["avatars"])

    response = avatar_service.public_avatar_manifest()
    assert response["active_avatar"]["id"] == "mao_pro"

print("Avatar service contract passed")
`;

const result = spawnSync(python, ["-c", script], {
  cwd: path.join(root, "src", "backend"),
  env: { ...process.env, PYTHONPATH: path.join(root, "src", "backend") },
  encoding: "utf8",
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert(result.stdout.includes("Avatar service contract passed"));
