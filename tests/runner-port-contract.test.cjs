const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const runner = fs.readFileSync(path.join(root, "run_cyra_demo.py"), "utf8");
const staticServer = fs.readFileSync(path.join(root, "src/frontend/static_server.py"), "utf8");

assert(runner.includes("find_available_port"), "runner should find an available frontend port");
assert(runner.includes("ensure_backend_port_available"), "runner should check the fixed backend port before starting");
assert(runner.includes("BACKEND_PORT = 8001"), "runner should keep the backend port explicit");
assert(runner.includes("already in use"), "runner should explain when the backend port is already occupied");
assert(runner.includes("FRONTEND_PORT_START = 5173"), "runner should prefer the existing frontend port first");
assert(runner.includes("CORS_ORIGINS"), "runner should pass the selected frontend origin to the backend");
assert(runner.includes("--port"), "runner should start the static server with the selected port");
assert(!runner.includes('FRONTEND_URL = "http://127.0.0.1:5173"'), "runner should not hardcode the frontend URL");

assert(staticServer.includes("argparse"), "static server should accept a port argument");
assert(staticServer.includes("--port"), "static server should expose a --port option");
assert(staticServer.includes("args.port"), "static server should bind to the requested port");

console.log("Runner port contract passed");
