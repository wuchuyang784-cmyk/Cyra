const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const python = path.join(root, ".venv", "Scripts", "python.exe");

const script = String.raw`
import app.services.llm_service as service

ATTRACTION = "\u68b5\u5929\u82b1\u6d77"
IRRELEVANT = "\u4e0d\u76f8\u5173\u5185\u5bb9"


def fake_vector_context_for(query, limit=4):
    return f"[\u8d44\u65991] {IRRELEVANT}\n\u8fd9\u91cc\u6ca1\u6709\u6e38\u5ba2\u8be2\u95ee\u7684\u666f\u70b9\u3002", [{"id": "vector-1"}]


class FakeResourcePack:
    def context_for(self, query, limit=4):
        return f"[\u8d44\u65991] \u7075\u5c71\u80dc\u5883 - {ATTRACTION}\n{ATTRACTION}\u662f\u77e5\u8bc6\u5e93\u5df2\u6536\u5f55\u666f\u70b9\u3002", [{"id": "spot-brahma"}]


service.vector_context_for = fake_vector_context_for
service.get_resource_pack = lambda: FakeResourcePack()

for query in (
    "\u8bf4\u4e00\u4e0b\u68b5\u5929\u82b1\u6d77",
    "\u68b5\u5929\u82b1\u6d77\u5728\u54ea\u91cc",
    "\u68b5\u5929\u82b1\u6d77\u662f\u4ec0\u4e48",
    "\u4ec0\u4e48\u662f\u68b5\u5929\u82b1\u6d77",
):
    context = service._build_rag_context(query)
    assert ATTRACTION in context, context
    assert IRRELEVANT not in context, context

terms = service._meaningful_query_terms("\u68b5\u5929\u82b1\u6d77\u662f\u4ec0\u4e48")
assert ATTRACTION in terms, terms
assert "\u68b5\u5929\u82b1\u6d77\u662f\u4ec0\u4e48" not in terms, terms
print("RAG direct match contract passed")
`;

const result = spawnSync(python, ["-c", script], {
  cwd: root,
  env: { ...process.env, PYTHONPATH: path.join(root, "src", "backend"), PYTHONUTF8: "1" },
  encoding: "utf8",
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert(result.stdout.includes("RAG direct match contract passed"));
