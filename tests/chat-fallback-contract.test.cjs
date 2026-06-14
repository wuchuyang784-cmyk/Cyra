const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const llmService = fs.readFileSync(path.join(root, "src/backend/app/services/llm_service.py"), "utf8");

assert(
  llmService.includes('FALLBACK_REPLY = "抱歉，目前无服务"'),
  "chat fallback reply should be exactly 抱歉，目前无服务",
);

assert(
  !llmService.includes("当前大模型服务暂不可用"),
  "chat fallback reply should not expose the old model-unavailable wording",
);

console.log("Chat fallback contract passed");
