import json
import re
import urllib.error
import urllib.request
from collections.abc import Generator

from app.core.config import get_settings
from app.schemas.chat import ChatRequest
from app.services.prompt import GUIDE_SYSTEM_PROMPT
from app.services.resource_pack import get_resource_pack
from app.services.vector_store import vector_context_for


RAG_CONTEXT_LIMIT = 4
QUERY_STOPWORDS = {
    "请问",
    "介绍",
    "讲解",
    "一下",
    "这个",
    "那个",
    "说说",
    "说一下",
    "说下",
    "说一说",
    "了解",
    "帮我",
    "关于",
    "相关",
    "资料",
    "信息",
    "是什么",
    "是啥",
    "什么是",
    "在哪里",
    "在哪",
    "哪里",
    "有什么",
    "特色",
    "怎么走",
    "路线",
}


def _build_rag_context(message: str) -> str:
    keyword_context = ""
    try:
        keyword_context, _keyword_sources = get_resource_pack().context_for(message, limit=RAG_CONTEXT_LIMIT)
    except Exception:
        keyword_context = ""

    if keyword_context.strip() and _has_direct_query_match(message, keyword_context):
        return keyword_context.strip()

    try:
        vector_context, _vector_sources = vector_context_for(message, limit=RAG_CONTEXT_LIMIT)
    except Exception:
        vector_context = ""
    return (vector_context or keyword_context).strip()


def _has_direct_query_match(message: str, context: str) -> bool:
    compact_context = re.sub(r"\s+", "", context.lower())
    for term in _meaningful_query_terms(message):
        if term in compact_context:
            return True
    return False


def _meaningful_query_terms(message: str) -> list[str]:
    clean = message.lower()
    for stopword in QUERY_STOPWORDS:
        clean = clean.replace(stopword, " ")
    terms = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]+", clean)
    return [term for term in terms if term not in QUERY_STOPWORDS]


def _build_messages(request: ChatRequest, rag_context: str) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": GUIDE_SYSTEM_PROMPT}]
    if rag_context:
        messages.append(
            {
                "role": "system",
                "content": (
                    "资料包检索结果：\n"
                    f"{rag_context}\n\n"
                    "回答要求：已经检索到知识库资料时，必须基于以上资料回答游客问题。"
                    "不要表示没有资料，也不要表示还要再查官方资料。"
                    "只在资料确实没有覆盖的开放时间、票价、交通等实时信息上说明不确定，不能编造。"
                ),
            }
        )
    else:
        messages.append(
            {
                "role": "system",
                "content": "未检索到知识库资料。可自由回答游客问题，但涉及实时信息或不确定事实时不要编造。",
            }
        )
    for turn in request.history[-8:]:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": request.message.strip()})
    return messages


def _fallback_reply(message: str, rag_context: str) -> str:
    if rag_context:
        clean_context = " ".join(
            line.strip()
            for line in rag_context.splitlines()
            if line.strip() and not line.startswith("[资料")
        )
        return f"我根据知识库资料为您说明：{clean_context[:260]}。您可以继续问我具体游览顺序、文化背景或拍照建议。"

    clean = message.strip(" 　")
    if "路线" in clean or "推荐" in clean:
        return "我建议您先从灵山大佛开始，再到九龙灌浴和灵山梵宫，节奏会比较顺。这个问题暂未检索到知识库资料，我可以先按通用导览经验给您建议。"
    if "拍照" in clean:
        return "如果您想拍照，可以优先选择视野开阔、标志性强的景点。这个问题暂未检索到知识库资料，我会先给出通用建议。"
    return "您好，我是灵山胜境的数字人导游。这个问题我已经收到，当前大模型服务暂不可用，我会先建议您围绕灵山大佛、九龙灌浴、灵山梵宫等重点景点安排游览。"


def complete_chat(request: ChatRequest) -> tuple[str, str, bool]:
    settings = get_settings()
    rag_context = _build_rag_context(request.message)
    if not settings.dashscope_api_key:
        return _fallback_reply(request.message, rag_context), "fallback", True

    payload = {
        "model": settings.dashscope_model,
        "messages": _build_messages(request, rag_context),
        "temperature": 0.6,
        "max_tokens": 500,
        "stream": False,
    }
    http_request = urllib.request.Request(
        settings.dashscope_api_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.dashscope_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
        reply = data["choices"][0]["message"]["content"].strip()
        return reply or _fallback_reply(request.message, rag_context), "dashscope", not bool(reply)
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError):
        return _fallback_reply(request.message, rag_context), "fallback", True


def stream_chat(request: ChatRequest) -> Generator[str, None, None]:
    settings = get_settings()
    rag_context = _build_rag_context(request.message)
    if not settings.dashscope_api_key:
        yield _fallback_reply(request.message, rag_context)
        return

    payload = {
        "model": settings.dashscope_model,
        "messages": _build_messages(request, rag_context),
        "temperature": 0.6,
        "max_tokens": 500,
        "stream": True,
    }
    http_request = urllib.request.Request(
        settings.dashscope_api_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.dashscope_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=30) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="ignore").strip()
                if not line.startswith("data:"):
                    continue
                chunk = line.removeprefix("data:").strip()
                if chunk == "[DONE]":
                    break
                try:
                    data = json.loads(chunk)
                    delta = data["choices"][0].get("delta", {}).get("content", "")
                except (KeyError, json.JSONDecodeError):
                    delta = ""
                if delta:
                    yield delta
    except (TimeoutError, urllib.error.URLError):
        yield _fallback_reply(request.message, rag_context)
