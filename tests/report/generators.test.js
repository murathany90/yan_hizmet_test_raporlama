import { describe, expect, it } from "vitest";
import { CONFIGS } from "../../src/app/config.js";
import { buildReportModel } from "../../src/report/model.js";
import { createPdfBuffer } from "../../src/report/pdf.js";
import { createDocxBuffer } from "../../src/report/docx.js";

function fixtureModel() {
  const config = CONFIGS["PFK:HES"];
  const step = config.steps[0];
  return buildReportModel({
    service: "PFK",
    plant: "HES",
    config,
    metadata: { TESIS_ADI: "İğdır Şaşı Üretim Tesisi", UNIT_ID: "Ü1", TEST_DATE: "2026-08-16", REPORT_NO: "YHDA-006", TEST_TEAM: "TEİAŞ / Tesis" },
    reportType: "Performans Test Raporu",
    reportNote: "Türkçe karakter, değişken ve imza alanı doğrulaması.",
    records: [{
      name: "örnek.csv",
      step,
      rows: [{ time_s: 0, active_power_mw: 100 }],
      analysis: { status: "GEÇTİ", detail: "Başarılı", metrics: { t50Seconds: 12.5 } },
      validation: { warnings: [] }
    }],
    chartProvider: () => []
  });
}

describe("report generators", () => {
  it("builds one shared immutable ReportModel", () => {
    const model = fixtureModel();
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.variables[0]).toEqual(expect.objectContaining({ key: "TESIS_ADI", description: expect.any(String), unit: expect.any(String), source: expect.any(String), field: "# TESIS_ADI" }));
    expect(model.missingSteps.length).toBe(model.expectedStepCount - 1);
  });

  it("maps RGDH C1 and C2 headings without using a source-reference page", () => {
    const make = (plant, records) => buildReportModel({
      service: "RGDH", plant, config: CONFIGS[`RGDH:${plant}`], metadata: {}, reportType: "RGDH Performans Test Raporu", reportNote: "", records, chartProvider: () => []
    });
    const c1 = make("KONV", []);
    const c2 = make("RESGES", []);
    expect(c1.sections.map((section) => section.heading)).toEqual(expect.arrayContaining(["C) AŞIRI İKAZ", "D) DÜŞÜK İKAZ", "E) DEĞERLENDİRME", "F) SONUÇ"]));
    expect(c2.sections.map((section) => section.heading)).toEqual(expect.arrayContaining(["C) MAKSİMUM ÇIKIŞ / AŞIRI İKAZ KAPASİTE TESTLERİ", "D) ORTA ÇALIŞMA NOKTASI / %50 TESTLERİ", "E) DÜŞÜK ÇALIŞMA NOKTASI / %20 TESTLERİ", "F) GERİLİM KONTROLCÜSÜ PERFORMANS TESTLERİ", "G) SONUÇ"]));
    expect(JSON.stringify(c2)).not.toContain("referenceDataUrl");
  });

  it("creates a PFK campaign model with unit summary and guarded official status", () => {
    const config = CONFIGS["PFK:HES"];
    const model = buildReportModel({
      service: "PFK", plant: "HES", config, metadata: { PLANT_TOTAL_INSTALLED_MW: "100" }, reportType: "Performans Test Raporu", reportNote: "", chartProvider: () => [],
      campaign: { enabled: true, campaignId: "C1", facilityId: "F1", eventId: "E1", runId: "R1", units: [{ unitId: "U1", unitName: "Ünite 1" }, { unitId: "U2", unitName: "Ünite 2" }] },
      records: [{ name: "u1.csv", step: config.steps[0], rows: [{ time_s: 0, active_power_mw: 50 }], sourceMetadata: { CAMPAIGN_ID: "C1", UNIT_ID: "U1", UNIT_NAME: "Ünite 1", RUN_ID: "R1" }, analysis: { status: "GEÇTİ", detail: "ok", metrics: {} }, validation: { warnings: [] } }]
    });
    expect(model.campaignSummary.units).toHaveLength(2);
    expect(model.officialStatus).toBe("İNCELEME GEREKLİ");
    expect(model.sections.map((section) => section.type)).toContain("campaign-summary");
  });

  it("creates a real PDF binary", async () => {
    const buffer = await createPdfBuffer(fixtureModel());
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(5_000);
  }, 30_000);

  it("creates a real DOCX package", async () => {
    const buffer = await createDocxBuffer(fixtureModel());
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    expect(String.fromCharCode(...bytes.slice(0, 2))).toBe("PK");
    expect(bytes.byteLength).toBeGreaterThan(5_000);
  }, 30_000);
});
