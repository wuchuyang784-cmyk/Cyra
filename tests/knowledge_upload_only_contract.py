from app.services.resource_pack import ResourcePack


pack = ResourcePack.load()
items = pack.admin_knowledge()
item_types = {item["type"] for item in items}
chunk_ids = [chunk["id"] for chunk in pack.chunks]

assert pack.spots == [], "knowledge loading should not import bundled structured scenic spots"
assert "spot" not in item_types, "admin knowledge should not show bundled scenic spot entries"
assert "guide" not in item_types, "admin knowledge should not show bundled guide document entries"
assert all(not chunk_id.startswith("spot-") for chunk_id in chunk_ids), "RAG chunks should not include bundled spot chunks"
assert all(not chunk_id.startswith("guide-") for chunk_id in chunk_ids), "RAG chunks should not include bundled guide chunks"

print("Knowledge upload-only contract passed")
