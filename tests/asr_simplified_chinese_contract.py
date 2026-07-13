from app.services.asr_service import _to_simplified_chinese


def test_traditional_chinese_is_converted() -> None:
    assert _to_simplified_chinese("請問靈山大佛有什麼特色？") == "请问灵山大佛有什么特色？"


def test_simplified_chinese_is_unchanged() -> None:
    assert _to_simplified_chinese("推荐一条亲子路线") == "推荐一条亲子路线"
