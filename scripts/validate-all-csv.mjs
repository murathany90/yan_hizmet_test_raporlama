import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";
import { hasUtf8Bom, parseCsv } from "../src/csv/parser.js";
import { resolveCsvRoute } from "../src/csv/metadata.js";
import { validateParsedCsv } from "../src/csv/validator.js";

const root = resolve(import.meta.dirname, "..");
const templateRoot = resolve(root, "CSV_Sablonlari");
const exampleRoot = resolve(root, "Ornek_Veriler");

function csvFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) output.push(...csvFiles(path));
    else if (extname(entry).toLowerCase() === ".csv") output.push(path);
  }
  return output.sort();
}

function pathRoute(path, base) {
  const parts = relative(base, path).split(sep);
  return { service: parts[0]?.toUpperCase(), plant: parts[1]?.toUpperCase() };
}

function inspect(path, base, template) {
  const bytes = readFileSync(path);
  const errors = [];
  if (!hasUtf8Bom(bytes)) errors.push("UTF-8 BOM eksik");
  let parsed;
  let route;
  try {
    parsed = parseCsv(bytes);
    route = resolveCsvRoute(parsed.metadata);
  } catch (error) {
    errors.push(error.message);
    return { path, ok: false, errors, warnings: [] };
  }
  const expected = pathRoute(path, base);
  if (route.service !== expected.service || route.plant !== expected.plant) {
    errors.push(`dizin rotası ${expected.service}/${expected.plant}, metadata rotası ${route.service}/${route.plant}`);
  }
  if (template && basename(path, ".csv").toUpperCase() !== route.stepId) {
    errors.push(`dosya adı STEP_ID ile eşleşmiyor: ${basename(path)} / ${route.stepId}`);
  }
  const validationInput = template ? { ...parsed, rows: [], rowErrors: [] } : parsed;
  const validation = validateParsedCsv(validationInput, route, { allowEmpty: template });
  errors.push(...validation.errors);
  return { path, ok: errors.length === 0, errors, warnings: validation.warnings, stats: validation.stats, route };
}

const templateFiles = csvFiles(templateRoot);
const exampleFiles = csvFiles(exampleRoot).filter((path) => basename(path) !== "ORNEK_VERI_MANIFESTOSU.csv");
const templates = templateFiles.map((path) => inspect(path, templateRoot, true));
const examples = exampleFiles.map((path) => inspect(path, exampleRoot, false));
const failures = [...templates, ...examples].filter((result) => !result.ok);
const warnings = examples.flatMap((result) => result.warnings.map((warning) => `${relative(root, result.path)}: ${warning}`));

console.log(`CSV templates: ${templates.filter((item) => item.ok).length}/${templateFiles.length} PASS`);
console.log(`Example CSV: ${examples.filter((item) => item.ok).length}/${exampleFiles.length} PASS`);
console.log(`Expected inventory: templates=${templateFiles.length === 87 ? "87/87" : templateFiles.length}, examples=${exampleFiles.length === 87 ? "87/87" : exampleFiles.length}`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
if (failures.length) {
  console.error(`Failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${relative(root, failure.path)}: ${failure.errors.join("; ")}`);
}
if (templateFiles.length !== 87 || exampleFiles.length !== 87 || failures.length) process.exitCode = 1;
