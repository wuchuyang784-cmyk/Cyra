const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const touristScript = fs.readFileSync(path.join(root, "src/frontend/scripts/tourist-live2d.js"), "utf8");

for (const mojibake of ["鏁", "瓧", "浜", "闊", "挱", "", "?.."]) {
  assert(!touristScript.includes(mojibake), `tourist script should not contain mojibake fragment ${mojibake}`);
}

assert(
  touristScript.includes('setStatus("数字人正在语音播报...", true)'),
  "tourist speech status should use readable Chinese text",
);

console.log("Frontend encoding contract passed");
