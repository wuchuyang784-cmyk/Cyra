const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const python = path.join(root, ".venv", "Scripts", "python.exe");

const script = `
from app.core.config import Settings

default_voice = Settings.model_fields["dashscope_tts_voice"].default
assert default_voice == "longyingmu", default_voice
embedding_model = Settings.model_fields["dashscope_embedding_model"].default
embedding_dimension = Settings.model_fields["dashscope_embedding_dimension"].default
assert embedding_model == "text-embedding-v4", embedding_model
assert embedding_dimension == 1024, embedding_dimension
print("Config import contract passed")
`;

const result = spawnSync(python, ["-c", script], {
  cwd: path.join(root, "src", "backend"),
  env: { ...process.env, PYTHONPATH: path.join(root, "src", "backend") },
  encoding: "utf8",
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert(result.stdout.includes("Config import contract passed"));

const projectRootScript = `
from app.core.config import get_settings

settings = get_settings()
assert settings.dashscope_embedding_model == "text-embedding-v4", settings.dashscope_embedding_model
assert settings.dashscope_embedding_dimension == 1024, settings.dashscope_embedding_dimension
assert settings.dashscope_api_key, "src/backend/.env should be loaded from project root"
print("Project root env contract passed")
`;

const projectRootResult = spawnSync(python, ["-c", projectRootScript], {
  cwd: root,
  env: { ...process.env, PYTHONPATH: path.join(root, "src", "backend") },
  encoding: "utf8",
});

assert.strictEqual(projectRootResult.status, 0, projectRootResult.stderr || projectRootResult.stdout);
assert(projectRootResult.stdout.includes("Project root env contract passed"));
