from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.chat import ChatRequest
from app.services import llm_service


PNG_DOT_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def test_chat_request_accepts_safe_image_data_url():
    request = ChatRequest(message="这张图是什么地方？", image_data_url=PNG_DOT_DATA_URL)

    assert request.image_data_url == PNG_DOT_DATA_URL


def test_chat_request_rejects_non_image_data_url():
    try:
        ChatRequest(message="看看这个", image_data_url="data:text/html;base64,PGgxPmhpPC9oMT4=")
    except ValidationError:
        return
    raise AssertionError("ChatRequest should reject non-image data URLs")


def test_build_messages_uses_openai_compatible_multimodal_content():
    request = ChatRequest(message="这张图适合怎么游览？", image_data_url=PNG_DOT_DATA_URL)
    messages = llm_service._build_messages(request, "上传知识：景点\n这里适合步行游览。")

    user_message = messages[-1]
    assert user_message["role"] == "user"
    assert isinstance(user_message["content"], list)
    assert user_message["content"][0] == {"type": "text", "text": "这张图适合怎么游览？"}
    assert user_message["content"][1] == {"type": "image_url", "image_url": {"url": PNG_DOT_DATA_URL}}

    system_text = "\n".join(message["content"] for message in messages if message["role"] == "system")
    assert "游客上传了图片" in system_text
    assert "结合图片内容和知识库资料回答" in system_text


def test_default_chat_model_supports_text_and_vision():
    assert Settings.model_fields["dashscope_model"].default == "qwen3.7-plus"


def test_image_http_errors_return_clear_image_fallback():
    class FakeHttpError(Exception):
        code = 400

    request = ChatRequest(message="这张图是什么？", image_data_url=PNG_DOT_DATA_URL)
    reply = llm_service._upstream_error_fallback(FakeHttpError(), request, "")

    assert reply == "抱歉，这张图片暂时无法识别，请换一张更清晰的图片再试。"


if __name__ == "__main__":
    test_chat_request_accepts_safe_image_data_url()
    test_chat_request_rejects_non_image_data_url()
    test_build_messages_uses_openai_compatible_multimodal_content()
    test_default_chat_model_supports_text_and_vision()
    test_image_http_errors_return_clear_image_fallback()
    print("Vision chat contract passed")
