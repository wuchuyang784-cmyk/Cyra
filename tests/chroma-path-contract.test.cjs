const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "src", "backend", "app", "core", "config.py");
const config = fs.readFileSync(configPath, "utf8");

assert(
  config.includes('chroma_persist_dir: str = "src/backend/chroma_db"'),
  "default ChromaDB persist directory should live under src/backend/chroma_db",
);

console.log("ChromaDB path contract passed");
