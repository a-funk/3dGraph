import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN = [
  "toto",
  "obsidian",
  "localStorage",
  "postMessage",
  "/api/lists",
  "bearer",
  "dream",
  "metadata.files",
];

function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (path.endsWith(".js")) files.push(path);
  }
  return files;
}

test("package source stays free of product coupling", () => {
  for (const file of sourceFiles(fileURLToPath(new URL("../src", import.meta.url)))) {
    const text = readFileSync(file, "utf8");
    for (const term of FORBIDDEN) {
      assert.equal(
        text.toLowerCase().includes(term.toLowerCase()),
        false,
        `${file} contains forbidden coupling term: ${term}`,
      );
    }
  }
});
