const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "src/frontend/scripts/tourist-live2d.js"), "utf8");
const html = fs.readFileSync(path.join(root, "src/frontend/tourist.html"), "utf8");

for (const file of ["lingshan-buddha.png", "jiulong.png", "fangong.png", "wuyin.png"]) {
  assert(fs.existsSync(path.join(root, "src/frontend/assets/scenic-spots", file)), `${file} should exist`);
  assert(script.includes(`./assets/scenic-spots/${file}`), `${file} should be referenced by scenic spot data`);
}

assert(html.includes('id="spotImage"'), "left panel should contain the scenic spot image");
assert(script.includes("appendScenicReferences(replyItem, finalReply)"), "AI replies should append matching scenic references");
assert(script.includes("景点参考插画"), "generated scenic images should be labelled as illustrations");

console.log("Scenic images contract passed");
