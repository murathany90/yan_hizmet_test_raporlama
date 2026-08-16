import { readdirSync, statSync } from "node:fs";
import { resolve, extname } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["src", "scripts", "tests", "playwright.config.js", "vite.config.js", "vitest.config.js"];
const files = [];

function collect(path) {
  const absolute = resolve(path);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolute)) collect(resolve(absolute, entry));
  } else if ([".js", ".mjs", ".cjs"].includes(extname(absolute))) files.push(absolute);
}

roots.forEach(collect);
const failures = [];
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`${file}\n${result.stderr || result.stdout}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`JavaScript syntax: ${files.length}/${files.length} PASS`);
}
