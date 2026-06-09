const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const python = path.join(root, ".venv", "Scripts", "python.exe");

const script = `
from app.core.config import Settings

default_voice = Settings.model_fields["dashscope_tts_voice"].default
assert default_voice == "Chelsie", default_voice
print("Config import contract passed")
`;

const result = spawnSync(python, ["-c", script], {
  cwd: path.join(root, "src", "backend"),
  env: { ...process.env, PYTHONPATH: path.join(root, "src", "backend") },
  encoding: "utf8",
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert(result.stdout.includes("Config import contract passed"));
