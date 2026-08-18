import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { parseCsv } from "../src/csv/parser.js";
import { resolveCsvRoute } from "../src/csv/metadata.js";
import { validateParsedCsv } from "../src/csv/validator.js";
import { evaluateRecord } from "../src/analysis/evaluate.js";
import { seriesSetsFor } from "../src/charts/series.js";
import { CONFIGS } from "../src/app/config-runtime.js";
import { buildReportModel } from "../src/report/model.js";
import { createPdfBuffer } from "../src/report/pdf.js";
import { createDocxBuffer } from "../src/report/docx.js";
import { DEFAULT_DOCUMENT_SETTINGS } from "../src/app/settings.js";

const root = resolve(import.meta.dirname, "..");
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? sourceFiles(resolve(directory, entry.name))
    : entry.name.endsWith(".js") ? [resolve(directory, entry.name)] : []);
}

function assertProductionSourceIsGeneric() {
  const forbidden = /Köprü|KOPRU|Kopru|KOPRU_HES|77\.924|7\.7924|54\.86|36\.14|824379|809161|95\.41424|93\.65290/iu;
  const matches = sourceFiles(resolve(root, "src")).filter((path) => forbidden.test(readFileSync(path, "utf8")));
  assert.equal(matches.length, 0, `Production source contains private-fixture detail: ${matches.join(", ")}`);
}

assertProductionSourceIsGeneric();
const fixtureRoot = resolve(root, "docs", "test_dosyaları", "pfk_test", "örnek_hes", "KOPRU_HES_YDA_DUZELTILMIS_PFK_CSV");
if (!existsSync(fixtureRoot)) {
  console.log("SKIPPED_PRIVATE_FIXTURE");
  console.log("KÖPRÜ HES private fixture bulunamadı; private regression çalıştırılmadı.");
  process.exit(0);
}

const expectedReserve = {
  "U1/MAKSIMUM_REZERV/NEG200": [7.775, 19.9, 100, 100, 99.877],
  "U1/MAKSIMUM_REZERV/POS200": [7.699, 19.5, 100, 100, 100],
  "U1/MINIMUM_REZERV/NEG200": [7.811, 26.7, 100, 99.834, 99.901],
  "U1/MINIMUM_REZERV/POS200": [7.964, 18.0, 100, 100, 99.877],
  "U2/MAKSIMUM_REZERV/NEG200": [7.900, 18.8, 100, 100, 100],
  "U2/MAKSIMUM_REZERV/POS200": [7.769, 18.7, 100, 99.667, 99.815],
  "U2/MINIMUM_REZERV/NEG200": [7.914, 23.4, 100, 100, 100],
  "U2/MINIMUM_REZERV/POS200": [7.737, 21.4, 100, 100, 99.951]
};

function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected} (±${tolerance})`);
}

function loadRecord(unit, filename) {
  const path = resolve(fixtureRoot, unit, filename);
  const parsed = parseCsv(readFileSync(path));
  const route = resolveCsvRoute(parsed.metadata);
  const validation = validateParsedCsv(parsed, route);
  assert.equal(validation.ok, true, `${unit}/${filename}: ${validation.errors.join("; ")}`);
  const record = {
    name: basename(path),
    step: route.step,
    rows: validation.rows,
    sourceMetadata: parsed.metadata,
    validation: { warnings: validation.warnings },
    legacyReserveEventId: route.legacyReserveEventId
  };
  record.analysis = evaluateRecord(record, { service: route.service, plant: route.plant, metadata: parsed.metadata });
  return record;
}

function compactValidationRecord(record) {
  const { validationRows, positiveCriticalWindow, negativeCriticalWindow, ...metrics } = record.analysis.metrics;
  return { ...record, rows: [record.rows.at(0), record.rows.at(-1)], analysis: { ...record.analysis, metrics } };
}

const records = [];
const campaignUnits = [];
for (const unit of ["U1", "U2"]) {
  const maximum = loadRecord(unit, "MAKSIMUM_REZERV.csv");
  const minimum = loadRecord(unit, "MINIMUM_REZERV.csv");
  for (const record of [maximum, minimum]) {
    assert.equal(record.analysis.status, "GEÇTİ", `${unit}/${record.step.id} status`);
    assert.equal(seriesSetsFor(record, "PFK").length, 4, `${unit}/${record.step.id} overview panel count`);
    for (const event of record.analysis.metrics.events) {
      const key = `${unit}/${record.step.id}/${event.eventId}`;
      const [deltaPower, activation, trpA, trpB, trpC] = expectedReserve[key];
      assert.equal(event.status, "GEÇTİ", `${key} status`);
      close(event.deltaPowerMw, deltaPower, 0.005, `${key} ΔP`);
      close(event.officialActivationTimeSeconds, activation, 0.2, `${key} activation`);
      close(event.trp.TRP_A.percentage, trpA, 0.05, `${key} TRP-A`);
      close(event.trp.TRP_B.percentage, trpB, 0.05, `${key} TRP-B`);
      close(event.trp.TRP_C.percentage, trpC, 0.05, `${key} TRP-C`);
      assert.equal(seriesSetsFor({ ...record, rows: event.chartRows, eventAnalysis: event }, "PFK").length, 2, `${key} response/sustain chart count`);
      console.log(`${key}: ΔP=${event.deltaPowerMw.toFixed(3)} MW, etkinleştirme=${event.officialActivationTimeSeconds.toFixed(1)} s, TRP=${event.trp.TRP_A.percentage.toFixed(3)}/${event.trp.TRP_B.percentage.toFixed(3)}/${event.trp.TRP_C.percentage.toFixed(3)} %`);
    }
  }
  const sensitivity = loadRecord(unit, "HASSASIYET.csv");
  assert.equal(sensitivity.analysis.status, "GEÇTİ", `${unit}/HASSASIYET status`);
  assert.deepEqual(sensitivity.analysis.metrics.sensitivityResults.map((item) => item.targetFrequencyHz), [49.995, 50.005, 49.990, 50.010], `${unit} sensitivity plateaus`);
  assert.equal(seriesSetsFor(sensitivity, "PFK").length, 4, `${unit} sensitivity panel count`);
  const validation = loadRecord(unit, "DOGRULAMA_24H.csv");
  const expectedSamples = unit === "U1" ? 824379 : 809161;
  const expectedRatio = unit === "U1" ? 95.41424 : 93.65290;
  assert.equal(validation.analysis.status, "GEÇTİ", `${unit}/DOGRULAMA_24H status`);
  assert.equal(validation.analysis.metrics.evaluationSamples, 864000, `${unit} evaluation samples`);
  assert.equal(validation.analysis.metrics.compliantSamples, expectedSamples, `${unit} compliant samples`);
  close(validation.analysis.metrics.compliancePercent, expectedRatio, 0.00001, `${unit} compliance ratio`);
  assert.equal(seriesSetsFor(validation, "PFK").length, 8, `${unit} validation chart count`);
  console.log(`${unit}/DOGRULAMA_24H: ${validation.analysis.metrics.compliantSamples}/${validation.analysis.metrics.evaluationSamples} = ${validation.analysis.metrics.compliancePercent.toFixed(5)} %`);
  campaignUnits.push({ unitId: unit, unitName: maximum.sourceMetadata.UNIT_NAME, pnomMw: maximum.sourceMetadata.PNOM_MW, rpmaxMw: maximum.sourceMetadata.RPMAX_MW, included: true });
  records.push(maximum, minimum, sensitivity, compactValidationRecord(validation));
  if (global.gc) global.gc();
}

const campaign = { enabled: true, campaignId: records[0].sourceMetadata.CAMPAIGN_ID, facilityId: records[0].sourceMetadata.FACILITY_ID, eventId: records[0].sourceMetadata.EVENT_ID, runId: records[0].sourceMetadata.RUN_ID, units: campaignUnits };
const metadata = { ...records[0].sourceMetadata, TEST_START_DATE: "12.03.2026", TEST_END_DATE: "14.03.2026", DOCUMENT_DATE: "14.03.2026", PARTICIPANTS: "Ad Soyad | TEİAŞ | Gözlemci | Katılımcı", TEST_TEAM: "TEİAŞ / Tesis / Test Ekibi" };
const makeModel = (reportType) => buildReportModel({ service: "PFK", plant: "HES", config: CONFIGS["PFK:HES"], metadata, reportType, reportNote: "KÖPRÜ HES private fixture regression smoke.", records, campaign, settings: DEFAULT_DOCUMENT_SETTINGS, chartProvider: () => [] });
const report = makeModel("Performans Test Raporu");
const minutes = makeModel("Test Tutanağı");
assert.deepEqual(report.sections.map((section) => section.heading.slice(0, 2)), ["A)", "B)", "C)", "D)", "E)", "F)", "G)"]);
assert.equal(report.evaluationStatus, "GEÇTİ", "report technical status");
assert.equal(minutes.evaluationStatus, "GEÇTİ", "minutes technical status");
assert.equal(minutes.figureProfile, "OFFICIAL_TEIAS_PFK_MINUTES");
assert.equal(minutes.sections.filter((section) => section.type === "grouped-records")[0].groups.length, 2, "minutes unit appendix groups");
assert.ok(new TextDecoder().decode((await createPdfBuffer(report)).slice(0, 5)) === "%PDF-", "report PDF smoke");
assert.equal(String.fromCharCode(...(await createDocxBuffer(minutes)).slice(0, 2)), "PK", "minutes DOCX smoke");
console.log("KÖPRÜ HES PFK private fixture regression: PASS");
