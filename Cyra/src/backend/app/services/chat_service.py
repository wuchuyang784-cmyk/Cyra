import json
from collections import defaultdict
from typing import AsyncIterator, Dict, List

import httpx
from fastapi import HTTPException

from app.core.config import Settings
from app.schemas.chat import ChatMessage
from app.services.prompt import SCENIC_GUIDE_SYSTEM_PROMPT
from app.services.resource_pack import get_resource_pack


class ChatService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._history: Dict[str, List[ChatMessage]] = defaultdict(list)

    def build_messages(
        self,
        session_id: str,
        user_message: str,
        incoming_history: List[ChatMessage] | None,
        knowledge_context: str,
    ) -> List[dict]:
        source_history = incoming_history if incoming_history is not None else self._history[session_id]
        recent = source_history[-self.settings.chat_history_turns * 2 :]
        system_prompt = SCENIC_GUIDE_SYSTEM_PROMPT
        if knowledge_context:
            system_prompt += f"\n【官方资料包知识库】\n{knowledge_context}"
        else:
            system_prompt += "\n【官方资料包知识库】本次问题未检索到高相关资料。"
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend({"role": item.role, "content": item.content} for item in recent if item.role != "system")
        messages.append({"role": "user", "content": user_message})
        return messages

    async def ask(
        self,
        session_id: str,
        user_message: str,
        incoming_history: List[ChatMessage] | None = None,
    ) -> tuple[str, List[ChatMessage], list[dict]]:
        knowledge_context, sources = get_resource_pack().context_for(user_message)
        if self.settings.mock_ai or not self.settings.dashscope_api_key:
            answer = self._mock_answer(knowledge_context, sources)
            _, history = self._save_turn(session_id, user_message, answer)
            return answer, history, sources

        payload = {
            "model": self.settings.dashscope_model,
            "messages": self.build_messages(session_id, user_message, incoming_history, knowledge_context),
            "temperature": 0.55,
            "stream": False,
        }
        headers = {"Authorization": f"Bearer {self.settings.dashscope_api_key}"}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.settings.dashscope_base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            answer = self._mock_answer(knowledge_context, sources)
            _, history = self._save_turn(session_id, user_message, answer)
            return answer, history, sources
        except httpx.HTTPError as exc:
            answer = self._mock_answer(knowledge_context, sources)
            _, history = self._save_turn(session_id, user_message, answer)
            return answer, history, sources

        data = response.json()
        answer = data["choices"][0]["message"]["content"].strip()
        _, history = self._save_turn(session_id, user_message, answer)
        return answer, history, sources

    async def stream(
        self,
        session_id: str,
        user_message: str,
        incoming_history: List[ChatMessage] | None = None,
    ) -> AsyncIterator[str]:
        knowledge_context, sources = get_resource_pack().context_for(user_message)
        if self.settings.mock_ai or not self.settings.dashscope_api_key:
            answer = self._mock_answer(knowledge_context, sources)
            for index in range(0, len(answer), 4):
                yield _sse("delta", {"content": answer[index : index + 4]})
            _, history = self._save_turn(session_id, user_message, answer)
            yield _sse("done", {"answer": answer, "history": [item.model_dump() for item in history], "sources": sources})
            return

        payload = {
            "model": self.settings.dashscope_model,
            "messages": self.build_messages(session_id, user_message, incoming_history, knowledge_context),
            "temperature": 0.55,
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.settings.dashscope_api_key}"}
        answer_parts: list[str] = []

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    f"{self.settings.dashscope_base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line.removeprefix("data:").strip()
                        if not raw or raw == "[DONE]":
                            continue
                        data = json.loads(raw)
                        delta = data.get("choices", [{}])[0].get("delta", {}).get("content") or ""
                        if delta:
                            answer_parts.append(delta)
                            yield _sse("delta", {"content": delta})
        except httpx.HTTPStatusError as exc:
            answer = self._mock_answer(knowledge_context, sources)
            for index in range(0, len(answer), 4):
                yield _sse("delta", {"content": answer[index : index + 4]})
            _, history = self._save_turn(session_id, user_message, answer)
            yield _sse("done", {"answer": answer, "history": [item.model_dump() for item in history], "sources": sources})
            return
        except httpx.HTTPError as exc:
            answer = self._mock_answer(knowledge_context, sources)
            for index in range(0, len(answer), 4):
                yield _sse("delta", {"content": answer[index : index + 4]})
            _, history = self._save_turn(session_id, user_message, answer)
            yield _sse("done", {"answer": answer, "history": [item.model_dump() for item in history], "sources": sources})
            return

        answer = "".join(answer_parts).strip()
        _, history = self._save_turn(session_id, user_message, answer)
        yield _sse("done", {"answer": answer, "history": [item.model_dump() for item in history], "sources": sources})

    def _save_turn(self, session_id: str, user_message: str, answer: str) -> tuple[str, List[ChatMessage]]:
        history = self._history[session_id]
        history.extend(
            [
                ChatMessage(role="user", content=user_message),
                ChatMessage(role="assistant", content=answer),
            ]
        )
        del history[: max(0, len(history) - self.settings.chat_history_turns * 2)]
        return answer, list(history)

    def _mock_answer(self, knowledge_context: str, sources: list[dict]) -> str:
        if not knowledge_context:
            return "贫僧在资料包中暂未确认这个问题。你可以问灵山大佛、九龙灌浴、梵宫、五印坛城，或让贫僧按亲子、历史、自然风光来推荐路线。"
        first_block = knowledge_context.split("\n\n", 1)[0]
        content = first_block.split("\n", 1)[-1]
        compact = " ".join(content.split())
        source_text = sources[0]["title"] if sources else "官方资料包"
        return f"贫僧查到官方资料：{compact[:110]}。资料来源：{source_text}。"


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
