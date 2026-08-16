import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { CONFIGS } from "../src/app/config-v062.js";
import { formatTurkishTimestamp, makeCsvTemplate, parseLocaleNumber } from "../src/csv/parser.js";

const root = resolve(import.meta.dirname, "..");
const templateRoot = resolve(root, "CSV_Sablonlari");
const exampleRoot = resolve(root, "Ornek_Veriler");
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function csvFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? csvFiles(path) : extname(name).toLowerCase() === ".csv" ? [path] : [];
  });
}

function parts(input) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line !== "");
  const comments = [];
  let headerIndex = 0;
  while (headerIndex < lines.length && lines[headerIndex].startsWith("#")) { comments.push(lines[headerIndex]); headerIndex += 1; }
  return { comments, headers: (lines[headerIndex] ?? "").split(";"), rows: lines.slice(headerIndex + 1).map((line) => line.split(";")) };
}

function metadataFromComments(comments) {
  return Object.fromEntries(comments.map((line) => line.slice(1).trim()).map((line) => {
    const index = line.indexOf("=");
    return index > 0 ? [line.slice(0, index).trim().toUpperCase(), line.slice(index + 1).trim()] : [];
  }).filter((entry) => entry.length));
}

function timestampFor(seconds, metadata, ordinal = 0) {
  const date = String(metadata.TEST_DATE || "2026-03-12").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const start = date ? new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), 9, 0, 0, 0) : new Date(2026, 2, 12, 9, 0, 0, 0);
  return formatTurkishTimestamp(start.valueOf() + (Number.isFinite(seconds) ? seconds * 1000 : ordinal * 100));
}

function normalizeComments(comments, changes = {}) {
  const map = { ...metadataFromComments(comments), ...changes, YHDA_VERSION: version };
  return Object.entries(map).map(([key, value]) => `# ${key}=${value ?? ""}`);
}

function migrateText(input, changes = {}) {
  const parsed = parts(input);
  const metadata = { ...metadataFromComments(parsed.comments), ...changes };
  const timeIndex = parsed.headers.findIndex((header) => header.trim().toLowerCase() === "time_s");
  const sequenceIndex = parsed.headers.findIndex((header) => header.trim().toLocaleLowerCase("tr-TR").replaceAll("ı", "i") === "sira_no");
  const zamanIndex = parsed.headers.findIndex((header) => /^zaman$/i.test(header.trim()));
  const controlHeader = (header) => header.trim().toLocaleLowerCase("tr-TR").replaceAll("ı", "i");
  const remainingIndexes = parsed.headers.map((header, index) => ({ header, index })).filter(({ header }) => !["time_s", "zaman", "sira_no"].includes(controlHeader(header))).map(({ index }) => index);
  const remaining = remainingIndexes.map((index) => parsed.headers[index]);
  const rows = parsed.rows.map((values, index) => {
    const seconds = timeIndex >= 0 ? parseLocaleNumber(values[timeIndex], index * 0.1) : index * 0.1;
    const rest = remainingIndexes.map((valueIndex) => values[valueIndex] ?? "");
    return [zamanIndex >= 0 ? values[zamanIndex] : timestampFor(seconds, metadata, index), String(index + 1), ...rest];
  });
  return `\uFEFF${normalizeComments(parsed.comments, changes).join("\r\n")}\r\nZAMAN;SIRA_NO;${remaining.join(";")}\r\n${rows.map((row) => row.join(";")).join("\r\n")}\r\n`;
}

function sensitivityPaths(rootPath, plant, template) {
  const base = resolve(rootPath, "PFK", plant);
  return csvFiles(base).filter((path) => /(?:^|_)(?:SENS|BESS_SENS)/.test(basename(path))).filter((path) => template ? !path.includes("_ORNEK") : path.includes("_ORNEK"));
}

function combineSensitivity(paths, destination, config, template) {
  const source = paths.map((path) => ({ path, parsed: parts(readFileSync(path, "utf8")) }));
  const first = source[0]?.parsed;
  if (!first) return;
  const firstMetadata = metadataFromComments(first.comments);
  const targets = source.map(({ parsed }) => metadataFromComments(parsed.comments).STEP_ID).join(",");
  if (template) {
    const metadata = { ...firstMetadata, STEP_ID: "HASSASIYET", SENSITIVITY_SEGMENTS: targets, YHDA_VERSION: version };
    writeFileSync(destination, makeCsvTemplate(metadata, config.steps.find((step) => step.id === "HASSASIYET").columns), "utf8");
  } else {
    const headers = first.headers;
    const timeIndex = headers.findIndex((header) => header.trim().toLowerCase() === "time_s");
    const remaining = headers.filter((_, index) => index !== timeIndex);
    const metadata = { ...firstMetadata, STEP_ID: "HASSASIYET", SENSITIVITY_SEGMENTS: targets, DATA_CLASS: "ÖRNEK / SENTETİK", YHDA_VERSION: version };
    const rows = source.flatMap(({ parsed }) => {
      const result = parsed.rows.map((values, index) => {
        const rest = values.filter((_, valueIndex) => valueIndex !== timeIndex);
        return ["", "", ...rest];
      });
      return result;
    }).map((row, index) => {
      // Eski alt-duyarlılık dosyalarının başlangıç zamanları ortak olduğundan,
      // birleşik HASSASIYET kaydında gerçek zaman eksenini tekil ve sürekli kur.
      row[0] = timestampFor(index * 0.1, metadata, index);
      row[1] = String(index + 1);
      return row;
    });
    writeFileSync(destination, `\uFEFF${normalizeComments(first.comments, metadata).join("\r\n")}\r\nZAMAN;SIRA_NO;${remaining.join(";")}\r\n${rows.map((row) => row.join(";")).join("\r\n")}\r\n`, "utf8");
  }
  paths.forEach((path) => rmSync(path));
}

function commonMetadata(service, plant, step, unitId, unitName, start) {
  return {
    YHDA_VERSION: version, TEST_SERVICE: service, PLANT_TYPE: plant, STEP_ID: step.id, SAMPLE_PERIOD_MS: step.sampleMs,
    TESIS_ADI: "Köprü HES — Örnek/Sentetik Kampanya", TEST_DATE: "2026-03-12", CITY: "Örnek İl", DATA_CLASS: "ÖRNEK / SENTETİK",
    PNOM_MW: "77.924", UNIT_PNOM_MW: "77.924", RPMAX_MW: "7.7924", RPMIN_MW: "7.7924", PSET_MAX_MW: "54.86", PSET_MIN_MW: "36.14",
    DROOP_PERCENT: "4", DEADBAND_MHZ: "0", MEASUREMENT_DEVICE_TYPE: "Veri toplama cihazı", MEASUREMENT_BRAND: "Sentetik örnek", MEASUREMENT_MODEL: "YHDA-SIM", MEASUREMENT_SERIAL_NO: `SIM-${unitId}-2026`, MEASUREMENT_SOFTWARE: "YHDA sentetik veri üreticisi", CALIBRATION_NO: "ÖRNEK", CALIBRATION_DATE: "2026-03-01",
    CAMPAIGN_ID: "PFK-KOPRU-HES-20260312", FACILITY_ID: "KOPRU-HES", TEST_SCOPE: "MULTI_UNIT", ENTITY_TYPE: "UNIT", ENTITY_ID: unitId, UNIT_ID: unitId, UNIT_NAME: unitName, UNIT_COUNT: "2", EVENT_ID: "KOPRU-PFK-01", RUN_ID: "RUN-001", TEST_START: start
  };
}

function line(metadata, headers, values) { return `\uFEFF${Object.entries(metadata).map(([key, value]) => `# ${key}=${value}`).join("\r\n")}\r\n${headers.join(";")}\r\n${values.map((row) => row.join(";")).join("\r\n")}\r\n`; }
function number(value, digits = 4) { return Number(value).toFixed(digits).replace(".", ","); }

function makeMultiUnitExample() {
  const base = resolve(exampleRoot, "PFK", "HES_MULTI_UNIT");
  mkdirSync(base, { recursive: true });
  const config = CONFIGS["PFK:HES"];
  const files = [];
  ["U1", "U2"].forEach((unitId, unitIndex) => {
    const unitName = `Ünite-${unitIndex + 1}`;
    const unitDir = resolve(base, unitId);
    mkdirSync(unitDir, { recursive: true });
    for (const step of config.steps) {
      const metadata = commonMetadata("PFK", "HES", step, unitId, unitName, "12.3.2026 09:00:00,0s");
      const rows = [];
      const headers = step.columns.map((column) => ({ zaman: "ZAMAN", sira_no: "SIRA_NO" }[column] ?? column.toUpperCase()));
      const baseTime = new Date(2026, 2, 12, 9 + unitIndex, 0, 0, 0).valueOf();
      if (step.kind === "reserve") {
        const isUp = step.id.includes("NEG200");
        const pset = step.id.includes("MAX") ? 54.86 : 36.14;
        for (let index = 0; index <= 9400; index += 1) {
          const seconds = index / 10;
          const response = seconds < 20 ? 0 : 7.7924 * Math.min(1, (seconds - 20) / (unitIndex ? 21.5 : 19.5));
          const active = pset + (isUp ? response : -response) + Math.sin(index / (13 + unitIndex)) * 0.025;
          const frequency = seconds < 20 ? 50 : isUp ? 49.8 : 50.2;
          const values = { zaman: formatTurkishTimestamp(baseTime + index * 100), sira_no: index + 1, grid_frequency_hz: number(50 + Math.sin(index / 17) * 0.008), test_frequency_hz: number(frequency), active_power_mw: number(active), active_power_reference_mw: number(pset + (isUp ? response : -response)), guide_vane_pct: number(42 + active * 0.28, 3) };
          rows.push(step.columns.map((column) => values[column] ?? ""));
        }
      } else if (step.kind === "sensitivity") {
        const targets = [50.005, 50.010, 49.995, 49.990];
        for (let index = 0; index < 4100; index += 1) {
          const segment = Math.min(3, Math.max(0, Math.floor((index - 100) / 1000)));
          const frequency = index < 100 ? 50 : targets[segment];
          const delta = (50 - frequency) * 390 + Math.sin(index / 19) * 0.015 + unitIndex * 0.018;
          const values = { zaman: formatTurkishTimestamp(baseTime + index * 100), sira_no: index + 1, grid_frequency_hz: number(50 + Math.sin(index / 11) * 0.009), test_frequency_hz: number(frequency), active_power_mw: number(54.86 + delta), active_power_reference_mw: number(54.86 + delta), guide_vane_pct: number(57 + delta * 0.35, 3) };
          rows.push(step.columns.map((column) => values[column] ?? ""));
        }
      } else {
        metadata.SAMPLE_PERIOD_MS = "1000";
        for (let index = 0; index < 86400; index += 1) {
          const active = 54.86 + Math.sin(index / 311) * 0.16 + unitIndex * 0.06;
          const values = { zaman: formatTurkishTimestamp(baseTime + index * 1000), sira_no: index + 1, grid_frequency_hz: number(50 + Math.sin(index / 37) * 0.018), active_power_mw: number(active), active_power_reference_mw: number(54.86), guide_vane_pct: number(57 + Math.sin(index / 311) * 0.08, 3) };
          rows.push(step.columns.map((column) => values[column] ?? ""));
        }
      }
      const path = resolve(unitDir, `${step.id}.csv`);
      writeFileSync(path, line(metadata, headers, rows), "utf8");
      files.push({ path, unitId, unitName, stepId: step.id, rows });
    }
  });
  writeFileSync(resolve(base, "campaign.csv"), "\uFEFFCAMPAIGN_ID;FACILITY_ID;TEST_SCOPE;UNIT_COUNT;EVENT_ID;RUN_ID;DATA_CLASS\r\nPFK-KOPRU-HES-20260312;KOPRU-HES;MULTI_UNIT;2;KOPRU-PFK-01;RUN-001;ÖRNEK / SENTETİK\r\n", "utf8");
  const manifestRows = files.map((item) => {
    const bytes = readFileSync(item.path);
    const source = parts(bytes.toString("utf8"));
    const metadata = metadataFromComments(source.comments);
    const start = source.rows[0]?.[0] ?? "";
    const end = source.rows.at(-1)?.[0] ?? "";
    return [`${item.unitId}/${basename(item.path)}`, createHash("sha256").update(bytes).digest("hex"), "PFK", "HES", item.unitId, item.stepId, source.rows.length, start, end, metadata.SAMPLE_PERIOD_MS].join(";");
  });
  writeFileSync(resolve(base, "manifest.csv"), `\uFEFFDosya;SHA256;Hizmet;Tesis;Ünite;STEP_ID;Satır;Başlangıç;Bitiş;Örnekleme_ms\r\n${manifestRows.join("\r\n")}\r\n`, "utf8");
}

function refreshManifest() {
  const rows = csvFiles(exampleRoot).filter((path) => !["ORNEK_VERI_MANIFESTOSU.csv", "campaign.csv", "manifest.csv"].includes(basename(path))).map((path) => {
    const parsed = parts(readFileSync(path, "utf8"));
    const metadata = metadataFromComments(parsed.comments);
    const route = relative(exampleRoot, path).split(sep);
    return [metadata.TEST_SERVICE || route[0], metadata.PLANT_TYPE || route[1], metadata.STEP_ID || "", relative(exampleRoot, path).replaceAll("\\", "/"), parsed.rows.length, metadata.SAMPLE_PERIOD_MS || "", "", metadata.STEP_ID === "HASSASIYET" ? "Tek CSV hassasiyet — örnek/sentetik" : "Örnek/sentetik"];
  });
  writeFileSync(resolve(exampleRoot, "ORNEK_VERI_MANIFESTOSU.csv"), `\uFEFFHizmet;Tesis_Tipi;STEP_ID;Dosya;Satir_Sayisi;Ornekleme_ms;Yaklasik_Sure_s;Test_Adi\r\n${rows.map((row) => row.join(";")).join("\r\n")}\r\n`, "utf8");
}

for (const [key, config] of Object.entries(CONFIGS)) {
  const [service, plant] = key.split(":");
  for (const step of config.steps) {
    const path = resolve(templateRoot, service, plant, `${step.id}.csv`);
    const source = existsSync(path) ? parts(readFileSync(path, "utf8")) : { comments: [] };
    const metadata = { ...metadataFromComments(source.comments), TEST_SERVICE: service, PLANT_TYPE: plant, STEP_ID: step.id, SAMPLE_PERIOD_MS: step.sampleMs, YHDA_VERSION: version };
    writeFileSync(path, makeCsvTemplate(metadata, step.columns), "utf8");
  }
}

const legacyReference = "718a7ce";
const legacyExamplePaths = execFileSync("git", ["ls-tree", "-r", "--name-only", legacyReference, "Ornek_Veriler"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter((path) => path.endsWith(".csv") && !path.endsWith("ORNEK_VERI_MANIFESTOSU.csv"));
for (const path of legacyExamplePaths) {
  const relativePath = path.replace(/^Ornek_Veriler\//, "");
  const destination = resolve(exampleRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, execFileSync("git", ["show", `${legacyReference}:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }), "utf8");
}
for (const [key, config] of Object.entries(CONFIGS)) {
  if (!key.startsWith("PFK:")) continue;
  const [, plant] = key.split(":");
  const exampleSens = sensitivityPaths(exampleRoot, plant, false);
  if (exampleSens.length) combineSensitivity(exampleSens, resolve(exampleRoot, "PFK", plant, "HASSASIYET_ORNEK.csv"), config, false);
}
for (const path of csvFiles(exampleRoot)) {
  if (["ORNEK_VERI_MANIFESTOSU.csv", "campaign.csv", "manifest.csv"].includes(basename(path))) continue;
  writeFileSync(path, migrateText(readFileSync(path, "utf8")), "utf8");
}
makeMultiUnitExample();
refreshManifest();
console.log(`CSV time migration complete: ${csvFiles(templateRoot).length} templates, ${csvFiles(exampleRoot).length} CSV files (campaign manifest files excluded from test-record count).`);
