import tempfile
from pathlib import Path

from app.services import resource_pack
from app.services.llm_service import _build_rag_context, _temperature_for
from app.services.resource_pack import get_resource_pack


def main() -> None:
    temp_dir = tempfile.TemporaryDirectory()
    temp_path = Path(temp_dir.name)
    original_overrides_file = resource_pack.KNOWLEDGE_OVERRIDES_FILE
    original_uploaded_dir = resource_pack.UPLOADED_KNOWLEDGE_DIR
    resource_pack.KNOWLEDGE_OVERRIDES_FILE = temp_path / "knowledge_overrides.json"
    resource_pack.UPLOADED_KNOWLEDGE_DIR = temp_path / "uploaded_knowledge"
    resource_pack.UPLOADED_KNOWLEDGE_DIR.mkdir()
    get_resource_pack.cache_clear()

    try:
        query = "\u4ecb\u7ecd\u4e00\u4e0b\uff0c\u4e94\u667a\u95e8"
        spot_name = "\u4e94\u667a\u95e8"
        expected_fact = "\u4f18\u8d28\u6c49\u767d\u7389"
        uploaded_content = (
            "\u4e94\u667a\u95e8\u7531\u4f18\u8d28\u6c49\u767d\u7389\u7cbe\u96d5\u7ec6\u7422\u800c\u6210\uff0c"
            "\u662f\u6e38\u5ba2\u8fdb\u5165\u6838\u5fc3\u666f\u533a\u524d\u7684\u91cd\u8981\u666f\u70b9\u3002"
        )
        updated_content = (
            "\u4e94\u667a\u95e8\u7531\u4f18\u8d28\u6c49\u767d\u7389\u7cbe\u96d5\u7ec6\u7422\u800c\u6210\uff0c"
            "\u96d5\u523b\u5de5\u827a\u7cbe\u6e5b\u7edd\u4f26\uff0c\u95e8\u67f1\u4e0a\u96d5\u523b\u7740"
            "\u4f5b\u6559\u516d\u5ea6\u667a\u6167\u7684\u76f8\u5173\u7ecf\u6587\u3002"
        )
        (resource_pack.UPLOADED_KNOWLEDGE_DIR / "five-wisdom-gate.txt").write_text(
            uploaded_content,
            encoding="utf-8",
        )

        pack = get_resource_pack()
        assert pack.spots == [], "ResourcePack should not load bundled structured scenic spots"
        assert all(not chunk["id"].startswith("guide-") for chunk in pack.chunks), "ResourcePack should not load bundled guide chunks"

        hits = pack.search(query, limit=4)
        assert hits, "ResourcePack keyword search should find the Five Wisdom Gate entry"
        assert any(spot_name in f"{hit.title}\n{hit.content}" for hit in hits), "Five Wisdom Gate should be in keyword hits"

        rag_context = _build_rag_context(query)
        assert spot_name in rag_context, "RAG context should include the Five Wisdom Gate entry"
        assert expected_fact in rag_context, "RAG context should include the official material fact"
        assert _temperature_for(rag_context) == 0.2, "RAG-backed answers should use low randomness"

        pack.update_knowledge("upload-five-wisdom-gate-001", spot_name, updated_content)
        refreshed = _build_rag_context(query)
        assert updated_content in refreshed, "edited knowledge should be used by tourist answers immediately"
        assert "\u4e94\u95e8\u516d\u67f1" not in refreshed, "edited spot knowledge should suppress stale original details"
        assert "\u4e94\u65b9\u4e94\u4f5b" not in refreshed, "edited spot knowledge should suppress stale symbolic details"
    finally:
        resource_pack.KNOWLEDGE_OVERRIDES_FILE = original_overrides_file
        resource_pack.UPLOADED_KNOWLEDGE_DIR = original_uploaded_dir
        get_resource_pack.cache_clear()
        temp_dir.cleanup()


if __name__ == "__main__":
    main()
