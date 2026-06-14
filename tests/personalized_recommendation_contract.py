from app.schemas.chat import ChatRequest
from app.services import llm_service


labels = llm_service._detect_interest_preferences("我们带小孩来，想看一点历史文化，路线怎么安排？")
assert "亲子轻松" in labels, "child/family keywords should map to 亲子轻松"
assert "历史文化" in labels, "history/culture keywords should map to 历史文化"

query = llm_service._interest_expanded_query("适合老人少走路的路线推荐")
assert "适合老人少走路的路线推荐" in query, "expanded query should keep the original question"
assert "老人友好" in query, "expanded query should include the matched interest label"
assert "少走路" in query, "expanded query should include matched route constraint keywords"
assert "轻松" in query, "expanded query should include nearby retrieval terms"

messages = llm_service._build_messages(
    ChatRequest(message="喜欢拍照打卡，帮我推荐路线"),
    "灵山胜境 - 灵山大佛\n适合参观游览。",
)
system_text = "\n".join(message["content"] for message in messages if message["role"] == "system")
assert "已识别游客偏好：拍照打卡" in system_text, "LLM messages should include detected preferences"
assert "基于资料包检索结果推荐路线" in system_text, "preference prompt should require RAG-grounded routes"
assert "不要新增知识库没有的景点事实" in system_text, "preference prompt should keep recommendations factual"

assert (
    llm_service._max_output_tokens_for("喜欢自然风光，怎么安排？") == llm_service.LLM_ROUTE_OUTPUT_TOKENS
), "interest-based route requests should receive route-sized output"

print("Personalized recommendation contract passed")
