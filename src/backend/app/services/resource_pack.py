from __future__ import annotations

from io import BytesIO
import logging
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from statistics import mean
from typing import Any
from uuid import uuid4

from docx import Document
from openpyxl import load_workbook

from app.services.vector_store import delete_resource_chunks, index_resource_pack, reset_resource_index


logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).resolve().parents[4]
RESOURCE_DIR = ROOT_DIR / "示范景区公开资料包"
STRUCTURED_DOC = RESOURCE_DIR / "灵山胜境 景点结构化数据集.docx"
GUIDE_DOC = RESOURCE_DIR / "灵山胜境：历史、文化、景点特色与个性化游览指南.docx"
BEHAVIOR_XLSX = RESOURCE_DIR / "景点景区旅游数据行为分析数据.xlsx"
UPLOADED_KNOWLEDGE_DIR = RESOURCE_DIR / "uploaded_knowledge"
SUPPORTED_KNOWLEDGE_EXTENSIONS = {".txt", ".md", ".docx"}

SPOT_COLUMNS = [
    "scenic_name",
    "spot_id",
    "name",
    "location",
    "parameters",
    "function",
    "culture",
    "description",
    "highlights",
    "open_info",
    "notes",
]

LINGSHAN_NAMES = {"灵山胜境", "灵山大佛", "禅意小镇·拈花湾"}
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


@dataclass
class KnowledgeHit:
    id: str
    title: str
    content: str
    source: str
    score: float


@dataclass
class ResourcePack:
    spots: list[dict[str, Any]] = field(default_factory=list)
    chunks: list[dict[str, str]] = field(default_factory=list)
    feedback: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def load(cls) -> "ResourcePack":
        pack = cls()
        pack.spots = _load_spots()
        pack.chunks = _load_guide_chunks()
        pack.chunks.extend(_load_uploaded_knowledge())
        pack.chunks.extend(_spot_to_chunks(pack.spots))
        pack._rebuild_vector_store()
        return pack

    def list_spots(self, limit: int = 24) -> list[dict[str, Any]]:
        return [
            {
                "id": spot["spot_id"],
                "name": spot["name"],
                "scenic_name": spot["scenic_name"],
                "summary": _shorten(spot.get("description") or spot.get("culture") or "", 120),
                "question": f"请根据官方资料包为我讲解{spot['name']}，并给出游玩建议。",
                "comments": _default_comments(spot),
            }
            for spot in self.spots[:limit]
        ]

    def search(self, query: str, limit: int = 5) -> list[KnowledgeHit]:
        terms = _terms(query)
        if not terms:
            return []
        compact_query = re.sub(r"\s+", "", query.lower())
        hits: list[KnowledgeHit] = []
        for chunk in self.chunks:
            text = f"{chunk['title']} {chunk['content']}"
            score = _score(text, terms)
            if chunk["title"] and _plain_title(chunk["title"]) in compact_query:
                score += 12
            if score > 0:
                hits.append(
                    KnowledgeHit(
                        id=chunk["id"],
                        title=chunk["title"],
                        content=chunk["content"],
                        source=chunk["source"],
                        score=score,
                    )
                )
        hits.sort(key=lambda item: item.score, reverse=True)
        return hits[:limit]

    def context_for(self, query: str, limit: int = 4) -> tuple[str, list[dict[str, str]]]:
        hits = self.search(query, limit=limit)
        blocks = []
        sources = []
        for index, hit in enumerate(hits, start=1):
            blocks.append(f"[资料{index}] {hit.title}\n{_shorten(hit.content, 360)}")
            sources.append({"id": hit.id, "title": hit.title, "source": hit.source})
        return "\n\n".join(blocks), sources

    def recommend_route(self, interest: str) -> dict[str, Any]:
        query = f"{interest} 路线 推荐 游览"
        hits = self.search(query, limit=4)
        if not hits:
            hits = self.search("个性化游览路线推荐", limit=4)
        return {
            "interest": interest,
            "title": _route_title(interest),
            "summary": _shorten(" ".join(hit.content for hit in hits), 280),
            "sources": [{"title": hit.title, "source": hit.source} for hit in hits],
        }

    def add_feedback(self, payload: dict[str, Any]) -> dict[str, Any]:
        item = {
            "session_id": str(payload.get("session_id") or "default"),
            "message": str(payload.get("message") or ""),
            "rating": int(payload.get("rating") or 0),
            "comment": str(payload.get("comment") or ""),
        }
        self.feedback.append(item)
        return item

    def admin_knowledge(self) -> list[dict[str, Any]]:
        items = []
        for spot in self.spots:
            items.append(
                {
                    "id": spot["spot_id"],
                    "type": "spot",
                    "title": spot["name"],
                    "source": "灵山胜境 景点结构化数据集.docx",
                    "content": spot["description"],
                    "meta": {
                        "location": spot["location"],
                        "open_info": spot["open_info"],
                        "culture": spot["culture"],
                    },
                }
            )
        for chunk in self.chunks:
            if chunk["id"].startswith("guide-"):
                items.append({"id": chunk["id"], "type": "guide", **chunk})
            if chunk["id"].startswith("upload-"):
                items.append({"id": chunk["id"], "type": "uploaded", **chunk})
        return items

    def get_knowledge_item(self, item_id: str) -> dict[str, Any]:
        for item in self.admin_knowledge():
            if item["id"] == item_id:
                return item
        raise KeyError(item_id)

    def add_uploaded_knowledge(self, filename: str, content: bytes) -> dict[str, Any]:
        source_name = _safe_upload_filename(filename)
        text = _extract_uploaded_knowledge_text(source_name, content)
        if not text:
            raise ValueError("上传文件没有可索引的文字内容")

        UPLOADED_KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
        stored_name = f"{Path(source_name).stem}-{uuid4().hex[:8]}{Path(source_name).suffix}"
        (UPLOADED_KNOWLEDGE_DIR / stored_name).write_bytes(content)

        chunks = _uploaded_knowledge_chunks(stored_name, text)
        self.chunks.extend(chunks)
        self._index_vector_store(chunks)
        return {
            "filename": stored_name,
            "chunks": len(chunks),
            "items": [{"id": chunk["id"], "title": chunk["title"], "source": chunk["source"]} for chunk in chunks],
        }

    def update_knowledge(self, item_id: str, title: str | None, content: str | None) -> dict[str, Any]:
        for spot in self.spots:
            if spot["spot_id"] == item_id:
                if title:
                    spot["name"] = title
                if content:
                    spot["description"] = content
                self._rebuild_spot_chunks()
                return {"id": item_id, "title": spot["name"], "content": spot["description"]}
        for chunk in self.chunks:
            if chunk["id"] == item_id:
                old_chunk = dict(chunk)
                if title:
                    chunk["title"] = title
                if content:
                    chunk["content"] = content
                self._delete_vector_chunks([old_chunk])
                self._index_vector_store([chunk])
                return chunk
        raise KeyError(item_id)

    def delete_knowledge(self, item_id: str) -> dict[str, Any]:
        for spot in list(self.spots):
            if spot["spot_id"] == item_id:
                self.spots.remove(spot)
                deleted_chunks = [chunk for chunk in self.chunks if chunk["id"] == f"spot-{item_id}"]
                self.chunks = [chunk for chunk in self.chunks if chunk["id"] != f"spot-{item_id}"]
                self._delete_vector_chunks(deleted_chunks)
                return {"id": item_id, "deleted": True}

        deleted_chunks = [chunk for chunk in self.chunks if chunk["id"] == item_id]
        if not deleted_chunks:
            raise KeyError(item_id)
        source_name = deleted_chunks[0]["source"]
        self.chunks = [chunk for chunk in self.chunks if chunk["id"] != item_id]
        self._delete_vector_chunks(deleted_chunks)
        if item_id.startswith("upload-"):
            self._delete_uploaded_file_if_unused(source_name)
        return {"id": item_id, "deleted": True}

    def _rebuild_spot_chunks(self) -> None:
        guide_chunks = [chunk for chunk in self.chunks if not chunk["id"].startswith("spot-")]
        self.chunks = guide_chunks + _spot_to_chunks(self.spots)
        self._index_vector_store()

    def _index_vector_store(self, chunks: list[dict[str, str]] | None = None) -> None:
        try:
            index_resource_pack(chunks or self.chunks)
        except Exception as error:
            # Keyword search remains available when embeddings are not configured.
            logger.warning("ChromaDB vector indexing skipped: %s", error)
            return

    def _rebuild_vector_store(self) -> None:
        try:
            reset_resource_index(self.chunks)
        except Exception as error:
            # Keyword search remains available when embeddings are not configured.
            logger.warning("ChromaDB vector rebuild skipped: %s", error)
            return

    def _delete_vector_chunks(self, chunks: list[dict[str, str]]) -> None:
        try:
            delete_resource_chunks(chunks)
        except Exception as error:
            logger.warning("ChromaDB vector delete skipped: %s", error)
            return

    def _delete_uploaded_file_if_unused(self, source_name: str) -> None:
        if any(chunk["source"] == source_name for chunk in self.chunks):
            return
        file_path = UPLOADED_KNOWLEDGE_DIR / Path(source_name).name
        file_path.unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_resource_pack() -> ResourcePack:
    return ResourcePack.load()


@lru_cache(maxsize=1)
def get_behavior_overview() -> dict[str, Any]:
    if not BEHAVIOR_XLSX.exists():
        return {"available": False, "message": "行为数据 Excel 未找到"}

    wb = load_workbook(BEHAVIOR_XLSX, read_only=True, data_only=True)
    ws = wb.active
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    index = {name: pos for pos, name in enumerate(headers)}
    total_rows = 0
    attraction_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    gender_counts: Counter[str] = Counter()
    age_buckets: Counter[str] = Counter()
    satisfaction: defaultdict[str, list[float]] = defaultdict(list)
    stay_duration: defaultdict[str, list[float]] = defaultdict(list)
    total_cost: defaultdict[str, list[float]] = defaultdict(list)
    cost_parts = Counter()

    for row in ws.iter_rows(min_row=2, values_only=True):
        total_rows += 1
        attraction = str(row[index["attraction_name"]] or "未知景区")
        attraction_type = str(row[index["attraction_type"]] or "未分类")
        gender = str(row[index["gender"]] or "未知")
        age = row[index["age"]]
        attraction_counts[attraction] += 1
        type_counts[attraction_type] += 1
        gender_counts[gender] += 1
        age_buckets[_age_bucket(age)] += 1
        _append_number(satisfaction[attraction], row[index["satisfaction"]])
        _append_number(stay_duration[attraction], row[index["stay_duration"]])
        _append_number(total_cost[attraction], row[index["total_cost"]])
        for field_name in ["ticket_cost", "food_cost", "shopping_cost", "transport_cost", "entertainment_cost"]:
            value = row[index[field_name]]
            if isinstance(value, (int, float)):
                cost_parts[field_name] += value

    focus = []
    for name in LINGSHAN_NAMES:
        focus.append(
            {
                "name": name,
                "visits": attraction_counts[name],
                "avg_satisfaction": _avg(satisfaction[name]),
                "avg_stay_duration": _avg(stay_duration[name]),
                "avg_total_cost": _avg(total_cost[name]),
            }
        )

    industry_top = []
    for name, count in attraction_counts.most_common(12):
        industry_top.append(
            {
                "name": name,
                "visits": count,
                "avg_satisfaction": _avg(satisfaction[name]),
                "avg_total_cost": _avg(total_cost[name]),
            }
        )

    return {
        "available": True,
        "total_records": total_rows,
        "unique_attractions": len(attraction_counts),
        "focus_attractions": focus,
        "top_attractions": industry_top,
        "type_distribution": _counter_items(type_counts, 8),
        "gender_distribution": _counter_items(gender_counts, 6),
        "age_distribution": _counter_items(age_buckets, 8),
        "cost_structure": [
            {"name": _cost_label(name), "value": round(value, 2)}
            for name, value in cost_parts.items()
        ],
    }


def get_visitor_report() -> dict[str, Any]:
    overview = get_behavior_overview()
    if not overview.get("available"):
        return overview
    focus = overview["focus_attractions"]
    avg_sat = _avg([item["avg_satisfaction"] for item in focus if item["avg_satisfaction"]])
    hot = sorted(focus, key=lambda item: item["visits"], reverse=True)
    suggestions = [
        "灵山相关样本满意度约为 %.2f，建议重点优化排队、讲解深度和动线提示。" % avg_sat,
        "游客端可突出九龙灌浴演出时间、灵山大佛参数、拈花湾夜游等高频信息。",
        "后台应持续沉淀游客追问和低分反馈，用于更新 FAQ 与讲解词。",
    ]
    return {
        "summary": "基于官方行为分析 Excel 与系统反馈生成的游客感受度报告。",
        "focus": focus,
        "hot_focus": hot,
        "sentiment_trend": [
            {"label": "满意", "value": round(max(avg_sat - 3, 0) * 45 + 48, 1)},
            {"label": "中性", "value": 32.0},
            {"label": "待改进", "value": round(max(5 - avg_sat, 0) * 8 + 6, 1)},
        ],
        "suggestions": suggestions,
        "feedback_count": len(get_resource_pack().feedback),
    }


def _load_spots() -> list[dict[str, Any]]:
    if not STRUCTURED_DOC.exists():
        return []
    doc = Document(STRUCTURED_DOC)
    spots: list[dict[str, Any]] = []
    for table in doc.tables:
        for row in table.rows[1:]:
            values = [cell.text.strip() for cell in row.cells]
            if len(values) < len(SPOT_COLUMNS) or not values[1]:
                continue
            spot = {key: values[pos] for pos, key in enumerate(SPOT_COLUMNS)}
            spots.append(spot)
    return spots


def _load_guide_chunks() -> list[dict[str, str]]:
    if not GUIDE_DOC.exists():
        return []
    doc = Document(GUIDE_DOC)
    chunks: list[dict[str, str]] = []
    current_title = "灵山胜境导览指南"
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer
        content = "\n".join(buffer).strip()
        if len(content) >= 24:
            chunks.append(
                {
                    "id": f"guide-{len(chunks) + 1:03d}",
                    "title": current_title,
                    "content": content,
                    "source": "灵山胜境：历史、文化、景点特色与个性化游览指南.docx",
                }
            )
        buffer = []

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        if _looks_like_heading(text):
            flush()
            current_title = text
        else:
            buffer.append(text)
    flush()

    for table in doc.tables:
        rows = []
        for row in table.rows:
            cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            rows.append("：".join(cells))
        if rows:
            chunks.append(
                {
                    "id": f"guide-table-{len(chunks) + 1:03d}",
                    "title": rows[0],
                    "content": "\n".join(rows[1:]),
                    "source": "灵山胜境：历史、文化、景点特色与个性化游览指南.docx",
                }
            )
    return chunks


def _load_uploaded_knowledge() -> list[dict[str, str]]:
    if not UPLOADED_KNOWLEDGE_DIR.exists():
        return []
    chunks: list[dict[str, str]] = []
    for file_path in sorted(UPLOADED_KNOWLEDGE_DIR.iterdir()):
        if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_KNOWLEDGE_EXTENSIONS:
            continue
        try:
            text = _extract_uploaded_knowledge_text(file_path.name, file_path.read_bytes())
        except ValueError:
            continue
        chunks.extend(_uploaded_knowledge_chunks(file_path.name, text))
    return chunks


def _safe_upload_filename(filename: str) -> str:
    name = Path(filename or "knowledge.txt").name
    suffix = Path(name).suffix.lower()
    if suffix not in SUPPORTED_KNOWLEDGE_EXTENSIONS:
        supported = "、".join(sorted(SUPPORTED_KNOWLEDGE_EXTENSIONS))
        raise ValueError(f"仅支持上传 {supported} 知识文件")
    stem = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", Path(name).stem).strip("._") or "knowledge"
    return f"{stem}{suffix}"


def _extract_uploaded_knowledge_text(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_KNOWLEDGE_EXTENSIONS:
        raise ValueError("不支持的知识文件类型")
    if suffix == ".docx":
        doc = Document(BytesIO(content))
        paragraphs = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip().replace("\n", " ") for cell in row.cells if cell.text.strip()]
                if cells:
                    paragraphs.append("：".join(cells))
        return "\n".join(paragraphs).strip()
    for encoding in ("utf-8", "gb18030"):
        try:
            return content.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    raise ValueError("知识文件文本编码无法识别")


def _uploaded_knowledge_chunks(source_name: str, text: str) -> list[dict[str, str]]:
    paragraphs = [item.strip() for item in re.split(r"\n{2,}|(?<=。)", text) if item.strip()]
    chunks: list[dict[str, str]] = []
    buffer: list[str] = []
    for paragraph in paragraphs:
        buffer.append(paragraph)
        content = "\n".join(buffer).strip()
        if len(content) >= 420:
            chunks.append(_uploaded_chunk(source_name, len(chunks) + 1, content))
            buffer = []
    if buffer:
        chunks.append(_uploaded_chunk(source_name, len(chunks) + 1, "\n".join(buffer).strip()))
    return chunks


def _uploaded_chunk(source_name: str, index: int, content: str) -> dict[str, str]:
    stem = Path(source_name).stem
    return {
        "id": f"upload-{stem}-{index:03d}",
        "title": f"上传知识：{stem}",
        "content": _shorten(content, 900),
        "source": source_name,
    }


def _spot_to_chunks(spots: list[dict[str, Any]]) -> list[dict[str, str]]:
    chunks = []
    for spot in spots:
        content = "\n".join(
            [
                f"景区：{spot['scenic_name']}",
                f"景点：{spot['name']}",
                f"位置：{spot['location']}",
                f"建筑/景观参数：{spot['parameters']}",
                f"核心功能：{spot['function']}",
                f"文化内涵：{spot['culture']}",
                f"详细介绍：{spot['description']}",
                f"游玩亮点：{spot['highlights']}",
                f"演艺/开放信息：{spot['open_info']}",
                f"备注：{spot['notes']}",
            ]
        )
        chunks.append(
            {
                "id": f"spot-{spot['spot_id']}",
                "title": f"{spot['scenic_name']} - {spot['name']}",
                "content": content,
                "source": "灵山胜境 景点结构化数据集.docx",
            }
        )
    return chunks


def _terms(text: str) -> list[str]:
    clean = text.lower()
    for stopword in QUERY_STOPWORDS:
        clean = clean.replace(stopword, " ")
    words = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]+", clean)
    expanded = []
    for word in words:
        expanded.append(word)
        if len(word) > 4:
            expanded.extend(word[index : index + 2] for index in range(len(word) - 1))
    return [word for word in expanded if word not in QUERY_STOPWORDS]


def _plain_title(title: str) -> str:
    plain = re.split(r"\s+-\s+", title)[-1]
    return re.sub(r"\s+", "", plain.lower())


def _score(text: str, terms: list[str]) -> float:
    lowered = text.lower()
    score = 0.0
    for term in terms:
        count = lowered.count(term)
        if count:
            score += 1.0 + math.log(count + 1)
    return score


def _looks_like_heading(text: str) -> bool:
    return (
        len(text) <= 34
        and not text.endswith("。")
        and (
            re.search(r"路线|景点|文化|历史|贴士|推荐|概况|特色|时间|餐饮|住宿", text)
            or re.match(r"^[一二三四五六七八九十]+[、.]", text)
        )
    )


def _shorten(text: str, limit: int) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    return compact if len(compact) <= limit else compact[: limit - 1] + "…"


def _default_comments(spot: dict[str, Any]) -> list[str]:
    comments = []
    if spot.get("highlights"):
        comments.append(_shorten(spot["highlights"], 52))
    if spot.get("open_info"):
        comments.append(_shorten(spot["open_info"], 52))
    if spot.get("notes"):
        comments.append(_shorten(spot["notes"], 52))
    return comments[:3] or ["官方资料包已收录该景点，可点击讲解。"]


def _route_title(interest: str) -> str:
    if "亲子" in interest:
        return "亲子家庭轻松游"
    if "自然" in interest:
        return "自然风光全景游"
    if "历史" in interest or "文化" in interest:
        return "历史文化深度游"
    return "个性化游览路线"


def _append_number(target: list[float], value: Any) -> None:
    if isinstance(value, (int, float)):
        target.append(float(value))


def _avg(values: list[float]) -> float:
    clean = [value for value in values if isinstance(value, (int, float)) and not math.isnan(value)]
    return round(mean(clean), 2) if clean else 0.0


def _age_bucket(age: Any) -> str:
    if not isinstance(age, (int, float)):
        return "未知"
    if age < 18:
        return "18岁以下"
    if age < 30:
        return "18-29岁"
    if age < 45:
        return "30-44岁"
    if age < 60:
        return "45-59岁"
    return "60岁以上"


def _counter_items(counter: Counter[str], limit: int) -> list[dict[str, Any]]:
    return [{"name": name, "value": value} for name, value in counter.most_common(limit)]


def _cost_label(name: str) -> str:
    return {
        "ticket_cost": "门票",
        "food_cost": "餐饮",
        "shopping_cost": "购物",
        "transport_cost": "交通",
        "entertainment_cost": "娱乐",
    }.get(name, name)
