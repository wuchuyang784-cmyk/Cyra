from __future__ import annotations

import re
from collections import Counter
from threading import Lock


CATEGORY_RULES = (
    ("路线推荐", ("路线", "怎么走", "怎么逛", "游览", "推荐", "安排", "先去", "顺序", "半日", "一日")),
    ("票务交通", ("门票", "票价", "开放", "时间", "交通", "停车", "怎么去", "几点", "营业")),
    ("景点讲解", ("介绍", "讲解", "是什么", "有什么", "看点", "特色", "历史", "文化", "梵宫", "大佛")),
    ("图片识别", ("图片", "照片", "这张图", "图里", "拍的是")),
)
CATEGORY_QUESTIONS = {
    "路线推荐": "游览路线怎么安排？",
    "票务交通": "门票、开放时间和交通怎么查？",
    "景点讲解": "景点有什么看点？",
    "图片识别": "这张图片是什么？",
    "其他问题": "游客还关心哪些问题？",
}

_lock = Lock()
_question_category_counts: Counter[str] = Counter()


def categorize_question(message: str, has_image: bool = False) -> str:
    if has_image:
        return "图片识别"
    compact = _compact_text(message)
    for category, keywords in CATEGORY_RULES:
        if any(keyword in compact for keyword in keywords):
            return category
    return "其他问题"


def record_visitor_question(message: str, has_image: bool = False) -> None:
    if not message or not message.strip():
        return
    category = categorize_question(message, has_image=has_image)
    with _lock:
        _question_category_counts[category] += 1


def get_frequent_questions(limit: int = 10) -> list[dict[str, int | str]]:
    with _lock:
        return [
            {
                "category": category,
                "question": CATEGORY_QUESTIONS.get(category, "游客还关心哪些问题？"),
                "count": count,
            }
            for category, count in _question_category_counts.most_common(limit)
            if count > 0
        ]


def reset_question_metrics() -> None:
    with _lock:
        _question_category_counts.clear()


def _compact_text(text: str) -> str:
    return re.sub(r"\s+", "", text)
