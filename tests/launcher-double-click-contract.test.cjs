const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const launcher = fs.readFileSync(path.join(root, "启动Cyra.bat"), "utf8");
const runner = fs.readFileSync(path.join(root, "run_cyra_demo.py"), "utf8");

assert(!launcher.includes("start_cyra_core.cmd"), "launcher should not depend on a nested CMD process");
assert(launcher.includes('".venv\\Scripts\\python.exe" run_cyra_demo.py'), "launcher should run Cyra directly in its visible window");
assert(launcher.includes("pause"), "launcher should preserve errors for the user");
assert(runner.includes('open_in_default_browser(f"{frontend_url}/tourist.html")'), "runner should open tourist page");
assert(runner.includes('open_in_default_browser(f"{frontend_url}/admin.html")'), "runner should open admin page");
assert(runner.includes('"cmd.exe", "/d", "/c", "start"'), "runner should use Windows start instead of Python webbrowser");

console.log("Double-click launcher contract passed");
