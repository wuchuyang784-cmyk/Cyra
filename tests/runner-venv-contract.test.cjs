const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const runner = fs.readFileSync(path.join(root, "run_cyra_demo.py"), "utf8");

assert(runner.includes("VENV_PYTHON"), "runner should know the project virtualenv Python path");
assert(runner.includes("ensure_project_python"), "runner should switch from system Python to the project virtualenv");
assert(runner.includes("os.execv"), "runner should re-exec itself with the virtualenv interpreter");
assert(runner.includes("samefile"), "runner should avoid re-exec when already running inside the virtualenv");

console.log("Runner virtualenv contract passed");
