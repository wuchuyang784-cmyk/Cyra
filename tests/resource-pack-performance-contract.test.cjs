const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const resourcePack = fs.readFileSync(path.join(root, "src/backend/app/services/resource_pack.py"), "utf8");
const loadBody = resourcePack.match(/def load\(cls\).*?return pack/s)?.[0] ?? "";

assert(!loadBody.includes("reset_resource_index"), "ResourcePack.load should not rebuild ChromaDB on every startup");
assert(!loadBody.includes("pack._rebuild_vector_store()"), "ResourcePack.load should avoid slow full vector rebuilds");
assert(
  resourcePack.includes("def rebuild_vector_store"),
  "ResourcePack should still expose an explicit vector rebuild method for admin/maintenance use",
);
assert(resourcePack.includes("self._index_vector_store(chunks)"), "Uploaded knowledge should still be indexed incrementally");

console.log("Resource pack performance contract passed");
