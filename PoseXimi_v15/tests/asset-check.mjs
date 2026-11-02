/** Verify every local service worker precache resource exists on disk. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(resolve(root, "sw.js"), "utf8");
const entries = (sw.split("const APP_FILES=[")[1] || "")
  .split("];")[0]
  .matchAll(/'\.\/([^']*)'/g);
const paths = [...entries].map((v) => v[1]).filter(Boolean);
assert.equal(new Set(paths).size, paths.length, "Duplicate precache file");
for (const path of paths)
  assert.ok(existsSync(resolve(root, path)), `Missing precache file: ${path}`);
console.log(`PASS: ${paths.length} precache files exist`);
