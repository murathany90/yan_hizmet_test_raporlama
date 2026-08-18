import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseCsv } from "../src/csv/parser.js";
import { resolveCsvRoute } from "../src/csv/metadata.js";
import { validateParsedCsv } from "../src/csv/validator.js";
import { evaluateRecord } from "../src/analysis/evaluate.js";
import { chartToSvg, chartViewForRows } from "../src/charts/engine.js";
import { normalizeSeries, seriesSetsFor } from "../src/charts/series.js";
import { CONFIGS } from "../src/app/config-runtime.js";
import { buildReportModel } from "../src/report/model.js";
import { createPdfBuffer } from "../src/report/pdf.js";
import { createDocxBuffer } from "../src/report/docx.js";
import { renderReportPreview } from "../src/report/preview.js";
import { strFromU8, unzipSync } from "fflate";
import { DEFAULT_DOCUMENT_SETTINGS } from "../src/app/settings.js";
import { getPfkPlantAdapter } from "../src/criteria/pfk-plant-adapters.js";

const root = resolve(import.meta.dirname, "..");
const sampleRoot = resolve(root, "Ornek_Veriler", "PFK");
const classicFiles = ["MAKSIMUM_REZERV_ORNEK.csv", "MINIMUM_REZERV_ORNEK.csv", "HASSASIYET_ORNEK.csv", "DOGRULAMA_24H_ORNEK.csv"];

function readRecord(plant, filename) {
  const path = resolve(sampleRoot, plant, filename);
  const parsed = parseCsv(readFileSync(path));
  assert.equal(/KOPRU|Köprü/i.test(parsed.metadata.TESIS_ADI ?? ""), false, `${plant} public fixture must be synthetic`);
  const route = resolveCsvRoute(parsed.metadata);
  const validation = validateParsedCsv(parsed, route);
  assert.equal(validation.ok, true, `${plant}/${filename}: ${validation.errors.join("; ")}`);
  const record = { name: basename(path), plant: route.plant, step: route.step, rows: validation.rows, sourceMetadata: parsed.metadata, validation: { warnings: validation.warnings }, legacyReserveEventId: route.legacyReserveEventId };
  record.analysis = evaluateRecord(record, { service: route.service, plant: route.plant, metadata: parsed.metadata });
  return record;
}

function compact(record) {
  if (!record.analysis.metrics?.validationRows) return record;
  const { validationRows, positiveCriticalWindow, negativeCriticalWindow, ...metrics } = record.analysis.metrics;
  return { ...record, rows: [record.rows.at(0), record.rows.at(-1)], analysis: { ...record.analysis, metrics } };
}

async function checkClassicPlant(plant) {
  const adapter = getPfkPlantAdapter(plant);
  const records = classicFiles.map((filename) => readRecord(plant, filename));
  assert.equal(adapter.profile, "PFK_CLASSIC", `${plant} profile`);
  for (const record of records.filter((item) => item.step.kind === "reserve_sequence")) {
    assert.equal(record.analysis.metrics.events.length, 2, `${plant}/${record.step.id} event segmentation`);
    assert.ok(record.analysis.metrics.events.every((event) => event.officialChecklist?.length === 9), `${plant}/${record.step.id} official checklist`);
  }
  const sensitivity = records.find((item) => item.step.id === "HASSASIYET");
  assert.equal(sensitivity.analysis.metrics.primaryControlSignal, adapter.primaryControlSignal, `${plant} primary process signal`);
  assert.equal(sensitivity.analysis.status, "GEÇTİ", `${plant} sensitivity status`);
  const validation = records.find((item) => item.step.id === "DOGRULAMA_24H");
  assert.equal(validation.analysis.status, "GEÇTİ", `${plant} 24h status`);
  const scatter = seriesSetsFor(validation, "PFK").find((set) => set.title.includes("Frekans–Güç saçılımı"));
  assert.ok(scatter, `${plant} scatter model`);
  const options = { xMode: scatter.xMode, xKey: scatter.xKey, chartType: scatter.chartType };
  const view = chartViewForRows(scatter.rows, options);
  const frequencies = scatter.rows.map((row) => row.grid_frequency_hz).filter(Number.isFinite);
  assert.equal(view.minimum, Math.min(...frequencies), `${plant} scatter production minimum`);
  assert.equal(view.maximum, Math.max(...frequencies), `${plant} scatter production maximum`);
  const svg = chartToSvg(scatter.rows, normalizeSeries(scatter.series), view, scatter.title, 900, 430, options);
  assert.doesNotMatch(svg, /Gösterilecek seri seçilmedi|No series|empty chart|0 rendered series/i, `${plant} scatter must render`);
  assert.match(svg, /<circle /, `${plant} scatter must contain points`);
  assert.match(svg, /<polyline /, `${plant} scatter must contain expected characteristic lines`);
  assert.match(svg, /stroke-dasharray=/, `${plant} scatter must contain tolerance lines`);
  const reportRecords = records.map(compact);
  const metadata = { ...records[0].sourceMetadata, TEST_START_DATE: "01.08.2026", TEST_END_DATE: "02.08.2026", DOCUMENT_DATE: "03.08.2026", VALIDATION_START_DATETIME: "02.08.2026 00:00:00", VALIDATION_END_DATETIME: "03.08.2026 00:00:00", PARTICIPANTS: "Test Mühendisi | YDA | Mühendis | Katılımcı" };
  for (const reportType of ["Performans Test Raporu", "Test Tutanağı"]) {
    const model = buildReportModel({ service: "PFK", plant, config: CONFIGS[`PFK:${plant}`], metadata, reportType, reportNote: "Public synthetic plant-matrix regression.", records: reportRecords, settings: DEFAULT_DOCUMENT_SETTINGS, chartProvider: () => [] });
    const pdf = await createPdfBuffer(model);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-", `${plant}/${reportType} PDF smoke`);
    if (reportType === "Performans Test Raporu") {
      const preview = renderReportPreview(model);
      assert.match(preview, /Primer Frekans Kontrol Performans Testleri Özet Tablosu/);
      assert.match(preview, /Primer Frekans Kontrol Performans Testleri Sonuç Tablosu/);
      assert.match(preview, /PFK-09/);
      const docx = await createDocxBuffer(model);
      const documentXml = strFromU8(unzipSync(docx)["word/document.xml"]);
      assert.match(documentXml, /Primer Frekans Kontrol Performans Testleri Özet Tablosu/);
      assert.match(documentXml, /PFK-09/);
    }
  }
  console.log(`${plant}: PASS (4 CSV, reserve, sensitivity, 24h, scatter, report/minutes PDF)`);
}

async function checkStorageRoute() {
  const record = readRecord("EDUEDT", "HASSASIYET_ORNEK.csv");
  assert.equal(getPfkPlantAdapter("EDUEDT").profile, "PFK_STORAGE");
  assert.equal(record.analysis.status, "TEKNİK ÖN DEĞERLENDİRME");
  assert.equal(record.analysis.metrics.primaryControlSignal, "soc_pct");
  assert.ok(record.analysis.metrics.availableSignals.includes("soc_pct"));
  console.log("EDÜ/EDT: PASS (PFK_STORAGE routing and technical pre-evaluation)");
}

for (const plant of ["HES", "DGKCS", "TES"]) await checkClassicPlant(plant);
await checkStorageRoute();
console.log("Public PFK plant matrix: PASS");
