from app.services.llm_service import _stream_delta_from_chunk


assert _stream_delta_from_chunk({"choices": []}) == "", "empty choices chunks should be ignored"
assert _stream_delta_from_chunk({"choices": [{"delta": {}}]}) == "", "missing content should be ignored"
assert _stream_delta_from_chunk({"choices": [{"delta": {"content": "你好"}}]}) == "你好"

print("Stream delta contract passed")
