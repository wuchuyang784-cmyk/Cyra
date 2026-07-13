const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

const config = read("src/backend/app/core/config.py");
assert(config.includes("def default_cors_origins"), "backend config should build default CORS origins dynamically");
assert(config.includes("range(5173, 5193)"), "backend config should cover the local dev port window");

const runner = read("run_cyra_demo.py");
assert(runner.includes("build_cors_origins"), "runner should build CORS origins for its candidate frontend ports");
assert(runner.includes("FRONTEND_PORT_ATTEMPTS"), "runner should share the frontend port search range with CORS setup");
assert(
  runner.includes("CORS_ORIGINS") && runner.includes("json.dumps(build_cors_origins())"),
  "runner should pass the full local dev CORS origin list to the backend",
);

console.log("CORS dev ports contract passed");
