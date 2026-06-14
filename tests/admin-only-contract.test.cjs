const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

assert(exists("src/frontend/admin.html"), "admin dashboard page should exist");
assert(exists("src/frontend/knowledge.html"), "knowledge management page should exist");
assert(exists("src/frontend/scripts/admin.js"), "admin dashboard script should exist");
assert(exists("src/frontend/scripts/knowledge.js"), "knowledge management script should exist");
assert(exists("src/frontend/styles/admin.css"), "admin dashboard styles should exist");
assert(exists("src/frontend/styles/knowledge.css"), "knowledge management styles should exist");
assert(exists("src/backend/app/api/admin.py"), "admin API routes should exist");
assert(exists("src/backend/app/services/resource_pack.py"), "resource pack analytics service should exist");

for (const filePath of [
  "src/frontend/scripts/app.js",
  "src/frontend/scripts/api-client.js",
  "src/frontend/scripts/audio-recorder.js",
  "src/frontend/scripts/avatar-controller.js",
  "src/frontend/scripts/lip-sync.js",
  "src/frontend/styles/xuanzang-avatar.css",
  "src/backend/app/api/knowledge.py",
  "src/backend/app/services/chat_service.py",
  "src/backend/app/services/aliyun_nls.py",
  "src/backend/app/services/expression.py",
]) {
  assert(!exists(filePath), `${filePath} should be removed from the admin-only extraction`);
}

const main = read("src/backend/app/main.py");
assert(main.includes("from app.api import admin"), "backend should import the admin router");
assert(main.includes("app.include_router(admin.router)"), "backend should expose admin router");
assert(!main.includes("knowledge"), "backend should not expose knowledge router yet");

const adminHtml = read("src/frontend/admin.html");
assert(!adminHtml.includes("tourist.html"), "admin page should not link to tourist client");
assert(adminHtml.includes("knowledgeManagementLink"), "admin page should expose a button that opens knowledge management");
assert(adminHtml.includes("knowledge.html"), "admin page should link to the separate knowledge management page");
assert(adminHtml.includes("热门问答列表"), "admin dashboard should show the popular Q&A list panel");
assert(adminHtml.includes("运营趋势"), "admin dashboard should show an operation trend panel");
assert(adminHtml.includes("trendChart"), "admin dashboard should contain the trend chart container");
assert(adminHtml.includes("frequentQuestionsPanel"), "popular Q&A panel should be moved to its own lower panel");
assert(adminHtml.includes("frequentQuestions"), "admin dashboard should contain the frequent question list container");
assert(!adminHtml.includes("热门景区满意度"), "admin dashboard should replace the old attraction satisfaction panel");
assert(!adminHtml.includes("knowledgeUploadForm"), "admin dashboard should not embed the knowledge upload form");
assert(!adminHtml.includes("knowledgeEditorForm"), "admin dashboard should not embed the knowledge editor form");

const knowledgeHtml = read("src/frontend/knowledge.html");
assert(knowledgeHtml.includes("knowledgeUploadForm"), "knowledge page should expose a knowledge file upload form");
assert(knowledgeHtml.includes("knowledgeFileInput"), "knowledge page should allow selecting knowledge files");
assert(knowledgeHtml.includes("knowledgeSearchInput"), "knowledge page should expose a knowledge search input");
assert(knowledgeHtml.includes("knowledgeEditorForm"), "knowledge page should expose a knowledge editor form");
assert(knowledgeHtml.includes("knowledgeDeleteButton"), "knowledge page should expose a knowledge delete button");
assert(knowledgeHtml.includes("knowledgeStats"), "knowledge page should show knowledge base summary stats");
assert(knowledgeHtml.includes("admin.html"), "knowledge page should link back to the admin dashboard");

const adminApi = read("src/backend/app/api/admin.py");
assert(adminApi.includes('@router.post("/knowledge/upload"'), "admin API should expose a knowledge upload endpoint");
assert(adminApi.includes('@router.get("/knowledge/{item_id}"'), "admin API should expose a knowledge detail endpoint");
assert(adminApi.includes('@router.patch("/knowledge/{item_id}"'), "admin API should expose a knowledge update endpoint");
assert(adminApi.includes('@router.delete("/knowledge/{item_id}"'), "admin API should expose a knowledge delete endpoint");
assert(adminApi.includes("UploadFile"), "knowledge upload endpoint should accept a multipart file");
assert(adminApi.includes("add_uploaded_knowledge"), "knowledge upload endpoint should add uploaded content into the RAG index");
assert(adminApi.includes("update_knowledge"), "knowledge update endpoint should update RAG source content");
assert(adminApi.includes("delete_knowledge"), "knowledge delete endpoint should remove RAG source content");
assert(adminApi.includes("get_frequent_questions"), "admin overview should include categorized frequent questions");

const resourcePack = read("src/backend/app/services/resource_pack.py");
assert(resourcePack.includes("add_uploaded_knowledge"), "resource pack should index uploaded knowledge files");
assert(resourcePack.includes("get_knowledge_item"), "resource pack should return knowledge details for editing");
assert(resourcePack.includes("delete_knowledge"), "resource pack should delete knowledge entries");
assert(resourcePack.includes("index_resource_pack"), "resource pack should index uploaded knowledge into ChromaDB");
assert(resourcePack.includes("delete_resource_chunks"), "resource pack should remove deleted chunks from ChromaDB");
assert(resourcePack.includes("_extract_uploaded_knowledge_text"), "resource pack should extract text from uploaded knowledge files");
assert(resourcePack.includes("_uploaded_knowledge_chunks"), "resource pack should split uploaded knowledge into searchable chunks");

const adminScript = read("src/frontend/scripts/admin.js");
assert(!adminScript.includes("knowledgeUploadForm"), "admin script should not bind knowledge upload controls");
assert(!adminScript.includes("/api/admin/knowledge/upload"), "admin script should not call knowledge upload");
assert(adminScript.includes("DASHBOARD_REFRESH_INTERVAL_MS"), "admin dashboard should periodically refresh realtime question metrics");
assert(adminScript.includes("renderFrequentQuestions"), "admin script should render categorized frequent questions");
assert(adminScript.includes("overview.frequent_questions"), "admin script should read frequent questions from overview");
assert(adminScript.includes("item.question"), "admin script should display popular entries as question text");
assert(adminScript.includes("renderTrendChart"), "admin script should render the operation trend chart");
assert(adminScript.includes("平均满意度"), "trend chart should include average satisfaction");
assert(adminScript.includes("平均停留时长"), "trend chart should include average stay duration");
assert(adminScript.includes("问答热度"), "trend chart should include question heat as an additional dimension");
assert(!adminHtml.includes("panel full-width"), "admin dashboard should not make the Q&A panel full width");
assert(adminScript.includes("report-insights"), "report card should include a filled operational summary area");
assert(adminScript.includes("本周服务人次"), "report summary should include weekly service volume");
assert(adminScript.includes("热门咨询"), "report summary should include the hottest question");
assert(adminScript.includes("路线需求"), "report summary should include route demand");
assert(adminScript.includes("知识库覆盖"), "report summary should include knowledge coverage");

const knowledgeScript = read("src/frontend/scripts/knowledge.js");
assert(knowledgeScript.includes("knowledgeUploadForm"), "knowledge script should bind the knowledge upload form");
assert(knowledgeScript.includes("knowledgeEditorForm"), "knowledge script should bind the knowledge editor form");
assert(knowledgeScript.includes("knowledgeSearchInput"), "knowledge script should filter knowledge entries");
assert(knowledgeScript.includes("/api/admin/knowledge/upload"), "knowledge script should call the knowledge upload endpoint");
assert(knowledgeScript.includes("PATCH"), "knowledge script should save edited knowledge entries");
assert(knowledgeScript.includes("DELETE"), "knowledge script should delete knowledge entries");
assert(knowledgeScript.includes("FormData"), "knowledge script should upload knowledge files as multipart form data");

const runner = read("run_cyra_demo.py");
assert(runner.includes("Admin dashboard:"), "runner should advertise the admin dashboard");
assert(!runner.includes("Portal page"), "runner should not advertise portal page");

console.log("Admin contract passed");
