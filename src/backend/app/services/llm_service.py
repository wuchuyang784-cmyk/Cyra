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
LLM_SIMPLE_OUTPUT_TOKENS = 120
LLM_DEFAULT_OUTPUT_TOKENS = 260
LLM_ROUTE_OUTPUT_TOKENS = 520
FALLBACK_REPLY = "抱歉，目前无服务"
INTEREST_RULES = (
    {
        "label": "历史文化",
        "terms": ("历史", "文化", "佛教", "典故", "建筑", "故事", "传承"),
        "retrieval_terms": ("历史文化", "佛教", "建筑", "典故", "文化", "梵宫", "五印坛城"),
    },
    {
        "label": "自然风光",
        "terms": ("自然", "风景", "风光", "散步", "安静", "绿树", "放松", "景色"),
        "retrieval_terms": ("自然风光", "散步", "安静", "绿树", "湖景", "步行"),
    },
    {
        "label": "亲子轻松",
        "terms": ("亲子", "孩子", "小孩", "家庭", "儿童", "带娃"),
        "retrieval_terms": ("亲子", "家庭", "儿童", "轻松", "少走路", "带娃"),
    },
    {
        "label": "拍照打卡",
        "terms": ("拍照", "打卡", "出片", "好看", "摄影", "留念"),
        "retrieval_terms": ("拍照打卡", "出片", "观景", "好看", "合影"),
    },
    {
        "label": "老人友好",
        "terms": ("老人", "长辈", "少走路", "轻松", "慢一点", "不累"),
        "retrieval_terms": ("老人友好", "轻松", "少走路", "休息", "慢行"),
    },
)
PREFERENCE_RECOMMENDATION_TERMS = (
    "喜欢",
    "适合",
    "想看",
    "想去",
    "带",
    "怎么玩",
    "怎么逛",
    "怎么安排",
)
ROUTE_QUERY_TERMS = (
    "路线",
    "游览",
    "推荐",
    "怎么走",
    "先去",
    "顺序",
    "安排",
    "半日",
    "一天",
    "一日",
    "亲子",
    "老人",
)
COMPLEX_QUERY_TERMS = (
    "详细",
    "介绍",
    "讲解",
    "为什么",
    "区别",
    "历史",
    "文化",
    "特色",
    "攻略",
    "建议",
)
QUERY_STOPWORDS = (
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
)


def _build_rag_context(message: str) -> str:
    query = _interest_expanded_query(message)
    keyword_context = ""
    try:
        keyword_context, _keyword_sources = get_resource_pack().context_for(query, limit=RAG_CONTEXT_LIMIT)
    except Exception:
        keyword_context = ""

    if keyword_context.strip() and (
        _has_direct_query_match(query, keyword_context) or _has_direct_title_match(message, keyword_context)
    ):
        return keyword_context.strip()

    try:
        vector_context, _vector_sources = vector_context_for(query, limit=RAG_CONTEXT_LIMIT)
    except Exception:
        vector_context = ""
    return (vector_context or keyword_context).strip()


def _has_direct_query_match(message: str, context: str) -> bool:
    compact_context = re.sub(r"\s+", "", context.lower())
    for term in _meaningful_query_terms(message):
        if term in compact_context:
            return True
    return False


def _has_direct_title_match(message: str, context: str) -> bool:
    compact_message = re.sub(r"\s+", "", message.lower())
    for title in re.findall(r"灵山胜境\s+-\s+([^\n]+)", context):
        compact_title = re.sub(r"\s+", "", title.lower())
        if compact_title and compact_title in compact_message:
            return True
    return False


def _meaningful_query_terms(message: str) -> list[str]:
    clean = message.lower()
    for stopword in sorted(QUERY_STOPWORDS, key=len, reverse=True):
        clean = clean.replace(stopword, " ")
    terms = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]+", clean)
    return [term for term in terms if term not in QUERY_STOPWORDS]


def _detect_interest_preferences(message: str) -> list[str]:
    compact = re.sub(r"\s+", "", message.lower())
    labels: list[str] = []
    for rule in INTEREST_RULES:
        if any(term in compact for term in rule["terms"]):
            labels.append(rule["label"])
    return labels


def _interest_expanded_query(message: str) -> str:
    query = message.strip()
    if not query:
        return query

    compact = re.sub(r"\s+", "", query.lower())
    extras: list[str] = []
    for rule in INTEREST_RULES:
        if any(term in compact for term in rule["terms"]):
            for term in rule["retrieval_terms"]:
                if term not in extras and term not in query:
                    extras.append(term)
    if extras:
        return f"{query} {' '.join(extras)}"
    return query


def _max_output_tokens_for(message: str) -> int:
    compact = re.sub(r"\s+", "", message.lower())
    has_route_intent = any(term in compact for term in ROUTE_QUERY_TERMS)
    has_preference_route_intent = _detect_interest_preferences(message) and any(
        term in compact for term in PREFERENCE_RECOMMENDATION_TERMS
    )
    if has_route_intent or has_preference_route_intent:
        return LLM_ROUTE_OUTPUT_TOKENS
    if any(term in compact for term in COMPLEX_QUERY_TERMS) or len(compact) >= 18:
        return LLM_DEFAULT_OUTPUT_TOKENS
    return LLM_SIMPLE_OUTPUT_TOKENS


def _temperature_for(rag_context: str) -> float:
    return 0.2 if rag_context.strip() else 0.6


def _build_user_content(request: ChatRequest) -> str | list[dict[str, object]]:
    text = request.message.strip()
    if not request.image_data_url:
        return text
    return [
        {"type": "text", "text": text},
        {"type": "image_url", "image_url": {"url": request.image_data_url}},
    ]


def _build_messages(request: ChatRequest, rag_context: str) -> list[dict[str, object]]:
    messages = [{"role": "system", "content": GUIDE_SYSTEM_PROMPT}]
    if request.image_data_url:
        messages.append(
            {
                "role": "system",
                "content": (
                    "游客上传了图片。请先识别图片中的可见内容，再结合图片内容和知识库资料回答。"
                    "如果无法确定图片中的具体景点名称，要说明不确定，并用“可能/看起来”表述；不要把不确定的图片判断说成事实。"
                ),
            }
        )
    interest_labels = _detect_interest_preferences(request.message)
    if interest_labels:
        grounding_instruction = (
            "基于资料包检索结果推荐路线。"
            if rag_context
            else "未检索到知识库资料时，可以给轻量建议，但涉及景点事实和实时信息不要编造。"
        )
        messages.append(
            {
                "role": "system",
                "content": (
                    f"已识别游客偏好：{'、'.join(interest_labels)}。\n"
                    "请在保持知识库事实准确的前提下，优先按这些偏好组织推荐路线。"
                    f"{grounding_instruction}"
                    "路线回答要说明顺序、理由和适合人群，必要时可以给出轻量个性化建议，但不要新增知识库没有的景点事实。"
                ),
            }
        )
    if rag_context:
        messages.append(
            {
                "role": "system",
                "content": (
                    "资料包检索结果：\n"
                    f"{rag_context}\n\n"
                    "回答要求：已经检索到知识库资料时，必须基于以上资料回答游客问题。"
                    "只能改写和组织资料中的事实，不能加入资料里没有出现的新事实。"
                    "不要补充资料中没有的数量、组成、象征关系、年代、尺寸、人物、传说、宗教对应关系。"
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
    messages.append({"role": "user", "content": _build_user_content(request)})
    return messages


def _fallback_reply(message: str, rag_context: str) -> str:
    return FALLBACK_REPLY


def _upstream_error_fallback(error: Exception, request: ChatRequest, rag_context: str) -> str:
    status_code = getattr(error, "code", None)
    if request.image_data_url and isinstance(status_code, int) and 400 <= status_code < 500:
        return "抱歉，这张图片暂时无法识别，请换一张更清晰的图片再试。"
    return _fallback_reply(request.message, rag_context)


def _stream_delta_from_chunk(data: dict) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    delta = choices[0].get("delta") or {}
    return str(delta.get("content") or "")


def complete_chat(request: ChatRequest) -> tuple[str, str, bool]:
    settings = get_settings()
    rag_context = _build_rag_context(request.message)
    if not settings.dashscope_api_key:
        return _fallback_reply(request.message, rag_context), "fallback", True

    payload = {
        "model": settings.dashscope_model,
        "messages": _build_messages(request, rag_context),
        "temperature": _temperature_for(rag_context),
        "max_tokens": _max_output_tokens_for(request.message),
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
    except (KeyError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as error:
        return _upstream_error_fallback(error, request, rag_context), "fallback", True


def stream_chat(request: ChatRequest) -> Generator[str, None, None]:
    settings = get_settings()
    rag_context = _build_rag_context(request.message)
    if not settings.dashscope_api_key:
        yield _fallback_reply(request.message, rag_context)
        return

    payload = {
        "model": settings.dashscope_model,
        "messages": _build_messages(request, rag_context),
        "temperature": _temperature_for(rag_context),
        "max_tokens": _max_output_tokens_for(request.message),
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
                    delta = _stream_delta_from_chunk(data)
                except (TypeError, json.JSONDecodeError):
                    delta = ""
                if delta:
                    yield delta
    except (TimeoutError, urllib.error.URLError, IndexError, KeyError) as error:
        yield _upstream_error_fallback(error, request, rag_context)
