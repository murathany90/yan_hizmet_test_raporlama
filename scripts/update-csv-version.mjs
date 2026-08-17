import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const { version } = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const roots = [resolve("CSV_Sablonlari"), resolve("Ornek_Veriler")];
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) collect(path);
    else if (extname(path).toLowerCase() === ".csv") files.push(path);
  }
}

roots.forEach(collect);
let changed = 0;
for (const file of files) {
  const input = readFileSync(file, "utf8");
  const output = input
    .replace(/^(﻿?)# YDA_VERSION=.*$/m, `$1# YDA_VERSION=${version}`)
    .replace(/^(﻿?)# YHDA_VERSION=.*$/m, `$1# YHDA_VERSION=${version}`)
    .replace(/^# REPORT_PREPARED_BY=(?:YHDA|YDA) v.*$/m, `# REPORT_PREPARED_BY=YDA v${version}`);
  if (output !== input) {
    writeFileSync(file, output, "utf8");
    changed += 1;
  }
}

console.log(`CSV metadata version: ${files.length} files scanned, ${changed} updated to ${version}`);
