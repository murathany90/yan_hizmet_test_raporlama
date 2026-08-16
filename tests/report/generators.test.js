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
