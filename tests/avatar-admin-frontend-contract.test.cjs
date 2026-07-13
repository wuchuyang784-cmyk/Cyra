const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

assert(exists("src/frontend/avatar.html"), "avatar management page should exist");
assert(exists("src/frontend/scripts/avatar.js"), "avatar management script should exist");
assert(exists("src/frontend/styles/avatar.css"), "avatar management styles should exist");

const adminHtml = read("src/frontend/admin.html");
assert(adminHtml.includes("avatar.html"), "admin dashboard should link to avatar management");
assert(adminHtml.includes("形象管理"), "admin dashboard should label the avatar management link");

const html = read("src/frontend/avatar.html");
assert(html.includes("avatarUploadForm"), "avatar page should include an upload form");
assert(html.includes("avatarFileInput"), "avatar page should include a zip file input");
assert(html.includes("avatarList"), "avatar page should include an avatar list");
assert(html.includes("activeAvatarSummary"), "avatar page should show current active avatar");
assert(html.includes("avatarEditorForm"), "avatar page should include an editor form");
assert(html.includes("avatarActivateButton"), "avatar page should include an activate button");
assert(html.includes("avatarDeleteButton"), "avatar page should include a delete button");
assert(html.includes("./scripts/avatar.js"), "avatar page should load its script");

const script = read("src/frontend/scripts/avatar.js");
assert(script.includes("/api/admin/avatars"), "avatar script should load admin avatars");
assert(script.includes("/api/admin/avatars/upload"), "avatar script should upload zip packages");
assert(script.includes("/activate"), "avatar script should activate selected avatars");
assert(script.includes("method: \"PATCH\""), "avatar script should save display edits");
assert(script.includes("method: \"DELETE\""), "avatar script should delete custom avatars");
assert(script.includes("FormData"), "avatar script should send multipart uploads");
assert(script.includes("textContent"), "avatar script should render user-provided strings safely");

const touristScript = read("src/frontend/scripts/tourist-live2d.js");
assert(
  touristScript.includes("http://127.0.0.1:8001/api/avatar/manifest"),
  "tourist script should request backend avatar manifest",
);
assert(
  touristScript.includes("./assets/live2d/characters.json"),
  "tourist script should keep the static character manifest fallback",
);
assert(touristScript.includes("activeAvatarId"), "tourist script should track the active avatar id");
assert(touristScript.includes("loadStaticCharacters"), "tourist script should isolate static fallback loading");
assert(touristScript.includes("catch"), "tourist script should tolerate backend manifest loading failure");

console.log("Avatar admin frontend contract passed");
