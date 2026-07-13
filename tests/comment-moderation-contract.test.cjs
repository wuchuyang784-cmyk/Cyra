const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const main = read("src/backend/app/main.py");
const api = read("src/backend/app/api/comments.py");
const service = read("src/backend/app/services/comment_service.py");
const tourist = read("src/frontend/scripts/tourist-live2d.js");
const admin = read("src/frontend/scripts/admin.js");
const touristHtml = read("src/frontend/tourist.html");
const adminHtml = read("src/frontend/admin.html");

assert(main.includes("comments.router"), "comments API should be registered");
assert(main.includes('/media/comments'), "comment images should be served by the backend");
assert(api.includes('@router.post("/comments"'), "tourists should be able to submit comments");
assert(api.includes('@router.patch("/admin/comments/{comment_id}"'), "admins should be able to moderate comments");
assert(api.includes('@router.post("/admin/comments/{comment_id}/gallery"'), "admins should be able to add images to gallery");
assert(service.includes('status": "pending"'), "new comments should require review");
assert(service.includes("MAX_IMAGE_BYTES"), "comment images should have a size limit");
assert(touristHtml.includes('id="spotCommentImage"'), "tourist comment form should accept a photo");
assert(tourist.includes("loadApprovedSpotComments"), "tourist page should only load approved comments");
assert(adminHtml.includes('id="commentModerationList"'), "admin page should expose moderation UI");
assert(admin.includes("handleCommentAction"), "admin page should handle moderation actions");

console.log("Comment moderation contract passed");
