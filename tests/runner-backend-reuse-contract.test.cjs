const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const runner = fs.readFileSync(path.join(root, "run_cyra_demo.py"), "utf8");

assert(runner.includes("ensure_backend_ready"), "runner should decide whether to reuse an existing backend");
assert(runner.includes("backend_owner"), "runner should track whether it started the backend");
assert(runner.includes("Backend port") && runner.includes("already in use"), "runner should still describe the occupied port case");
assert(runner.includes("is already running, reusing it"), "runner should explain when an existing backend will be reused");
assert(runner.includes("backend_owner"), "runner should only stop the backend it started");

console.log("Runner backend reuse contract passed");
