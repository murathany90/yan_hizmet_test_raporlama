import { describe, expect, it } from "vitest";
import { CONFIGS } from "../../src/app/config-runtime.js";
import { buildReportModel } from "../../src/report/model.js";
import { createPdfBuffer, makePdfDefinition } from "../../src/report/pdf.js";
import { createDocxBlob, createDocxBuffer } from "../../src/report/docx.js";
import { DEFAULT_DOCUMENT_SETTINGS } from "../../src/app/settings.js";
import { renderReportPreview } from "../../src/report/preview.js";
import { strFromU8, unzipSync } from "fflate";

function fixtureModel(settings) {
  const config = CONFIGS["PFK:HES"];
  const step = config.steps[0];
  return buildReportModel({
    service: "PFK",
    plant: "HES",
    config,
    metadata: { TESIS_ADI: "İğdır Şaşı Üretim Tesisi", UNIT_ID: "Ü1", TEST_DATE: "2026-08-16", REPORT_NO: "YHDA-006", TEST_TEAM: "TEİAŞ / Tesis" },
    reportType: "Performans Test Raporu",
    reportNote: "Türkçe karakter, değişken ve imza alanı doğrulaması.",
    settings,
    records: [{
      name: "örnek.csv",
      step,
      rows: [{ zaman: "12.3.2026 11:09:19,1s", sira_no: 1, timestamp_ms: 1773302959100, time_s: 0, active_power_mw: 100 }],
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

  it("routes every RGDH C.2 step to its single prescribed section", () => {
    const config = CONFIGS["RGDH:RESGES"];
    const records = config.steps.map((step) => ({ name: `${step.id}.csv`, step, rows: [], analysis: { status: "GEÇTİ", detail: "ok", metrics: {} }, validation: { warnings: [] } }));
    const model = buildReportModel({ service: "RGDH", plant: "RESGES", config, metadata: {}, reportType: "RGDH Performans Test Raporu", reportNote: "", records, chartProvider: () => [] });
    const byHeading = (start) => model.sections.find((section) => section.heading.startsWith(start)).stepIds;
    expect(byHeading("C)")).toEqual(["OE_MAX", "UE_MAX"]);
    expect(byHeading("D)")).toEqual(["OE_P50", "UE_P50"]);
    expect(byHeading("E)")).toEqual(["OE_P20", "UE_P20"]);
    expect(byHeading("F)")).toEqual(["VCTRL_PLUS1", "VCTRL_MINUS1"]);
  });

  it("keeps PFK campaign summary and evidence outside the default official body", () => {
    const config = CONFIGS["PFK:HES"];
    const model = buildReportModel({
      service: "PFK", plant: "HES", config, metadata: { PLANT_TOTAL_INSTALLED_MW: "100" }, reportType: "Performans Test Raporu", reportNote: "", chartProvider: () => [],
      campaign: { enabled: true, campaignId: "C1", facilityId: "F1", eventId: "E1", runId: "R1", units: [{ unitId: "U1", unitName: "Ünite 1" }, { unitId: "U2", unitName: "Ünite 2" }] },
      records: [{ name: "u1.csv", step: config.steps[0], rows: [{ zaman: "12.3.2026 11:09:19,1s", sira_no: 1, timestamp_ms: 1773302959100, time_s: 0, active_power_mw: 50 }], sourceMetadata: { CAMPAIGN_ID: "C1", UNIT_ID: "U1", UNIT_NAME: "Ünite 1", RUN_ID: "R1" }, analysis: { status: "GEÇTİ", detail: "ok", metrics: {} }, validation: { warnings: [] } }]
    });
    expect(model.campaignSummary.units).toHaveLength(2);
    expect(model.officialStatus).toBe("TASLAK / EKSİK BİLGİ");
    expect(model.sections.map((section) => section.type)).not.toContain("campaign-summary");
    expect(model.sections.map((section) => section.type)).not.toContain("evidence");
  });

  it("keeps PFK campaign report records scoped by campaign, unit, step and run", () => {
    const config = CONFIGS["PFK:HES"];
    const step = config.steps.find((item) => item.id === "MAKSIMUM_REZERV");
    const makeRecord = (unitId) => ({ name: `${unitId}.csv`, step, rows: [], sourceMetadata: { CAMPAIGN_ID: "C1", UNIT_ID: unitId, UNIT_NAME: `Ünite ${unitId}`, RUN_ID: "R1" }, analysis: { status: "GEÇTİ", detail: unitId, metrics: {} }, validation: { warnings: [] } });
    const model = buildReportModel({
      service: "PFK", plant: "HES", config, metadata: {}, reportType: "Performans Test Raporu", reportNote: "", chartProvider: () => [],
      campaign: { enabled: true, campaignId: "C1", runId: "R1", units: [{ unitId: "U1", unitName: "Ünite U1" }, { unitId: "U2", unitName: "Ünite U2" }] },
      records: [makeRecord("U1"), makeRecord("U2"), { ...makeRecord("U1"), name: "legacy-U1.csv", sourceMetadata: { CAMPAIGN_ID: "C0", UNIT_ID: "U1", UNIT_NAME: "Eski Ünite", RUN_ID: "R0" } }]
    });
    const maximum = model.sections.find((section) => section.heading.startsWith("C)"));
    expect(maximum.groups[0].items[0].recordKeys).toEqual(["C1\u001fU1\u001fMAKSIMUM_REZERV\u001fR1"]);
    expect(maximum.groups[1].items[0].recordKeys).toEqual(["C1\u001fU2\u001fMAKSIMUM_REZERV\u001fR1"]);
    expect(model.records.map((record) => record.filename)).not.toContain("legacy-U1.csv");
    const preview = renderReportPreview(model);
    const firstUnitSection = preview.slice(preview.indexOf("C.1"), preview.indexOf("C.2"));
    expect(firstUnitSection).toContain("U1.csv");
    expect(firstUnitSection).not.toContain("U2.csv");
  });

  it("uses unit-specific certificate metadata and scoped settings in preview, PDF and DOCX", async () => {
    const config = CONFIGS["PFK:HES"];
    const step = config.steps.find((item) => item.id === "MAKSIMUM_REZERV");
    const settings = { ...DEFAULT_DOCUMENT_SETTINGS, scopedTexts: { PFK: { certificate: { certificateValidityText: "U2 için yalnız bu geçerlilik metni kullanılmalıdır." } } } };
    const model = buildReportModel({
      service: "PFK", plant: "HES", config, metadata: { TESIS_ADI: "Test Tesisi", UNIT_ID: "U2", UNIT_NAME: "Ünite İki", PNOM_MW: "90", RPMAX_MW: "12", REPORT_NO: "U2-01" },
      reportType: "Test Sertifikası", reportNote: "", settings, chartProvider: () => [],
      records: [{ name: "U2.csv", step, rows: [], analysis: { status: "GEÇTİ", detail: "ok", metrics: {} }, validation: { warnings: [] } }]
    });
    expect(model.documentText.certificateValidityText).toContain("U2 için");
    expect(renderReportPreview(model)).toContain("Ünite İki");
    const pdfDefinition = JSON.stringify(makePdfDefinition(model));
    expect(pdfDefinition).toContain("U2 için yalnız bu geçerlilik metni");
    expect(pdfDefinition).toContain("90");
    const docx = await createDocxBuffer(model);
    const documentXml = strFromU8(unzipSync(docx)["word/document.xml"]);
    expect(documentXml).toContain("90");
    expect(documentXml).toContain("U2 için yalnız bu geçerlilik metni");
  }, 30_000);

  it("keeps report and minutes text in their own sections across preview, PDF and DOCX", async () => {
    const config = CONFIGS["PFK:HES"];
    const step = config.steps[0];
    const settings = {
      ...DEFAULT_DOCUMENT_SETTINGS,
      scopedTexts: {
        PFK: {
          report: { reportIntroduction: "SADECE RAPOR GİRİŞİ", technicalData: "RAPOR TEKNİK METNİ", reportConclusion: "RAPOR NİHAİ SONUCU", testResult: "RAPOR DEĞERLENDİRMESİ" },
          minutes: { minutesIntroduction: "SADECE TUTANAK BAŞLANGICI", operationSafety: "TUTANAK GÜVENLİĞİ", testMethod: "TUTANAK YÖNTEMİ", minutesResult: "TUTANAK SONUCU", copyDelivery: "TUTANAK TESLİMİ", attachmentsDescription: "TUTANAK EKLERİ" }
        }
      }
    };
    const record = { name: "örnek.csv", step, rows: [], analysis: { status: "GEÇTİ", detail: "ok", metrics: {} }, validation: { warnings: [] } };
    const report = buildReportModel({ service: "PFK", plant: "HES", config, metadata: {}, reportType: "Performans Test Raporu", reportNote: "", settings, records: [record], chartProvider: () => [] });
    const minutes = buildReportModel({ service: "PFK", plant: "HES", config, metadata: {}, reportType: "Test Tutanağı", reportNote: "", settings, records: [record], chartProvider: () => [] });
    const reportPreview = renderReportPreview(report);
    const minutesPreview = renderReportPreview(minutes);
    expect(report.figureProfile).toBe("OFFICIAL_TEIAS_PFK_REPORT");
    expect(minutes.figureProfile).toBe("OFFICIAL_TEIAS_PFK_MINUTES");
    expect(minutes.sections.map((section) => section.type)).toEqual(expect.arrayContaining(["pfk-simulation", "pfk-minutes-details", "grouped-records"]));
    expect(reportPreview).toContain("SADECE RAPOR GİRİŞİ");
    expect(reportPreview).toContain("RAPOR NİHAİ SONUCU");
    expect(reportPreview).not.toContain("SADECE TUTANAK BAŞLANGICI");
    expect(minutesPreview).toContain("SADECE TUTANAK BAŞLANGICI");
    expect(minutesPreview).toContain("TUTANAK SONUCU");
    expect(minutesPreview).not.toContain("SADECE RAPOR GİRİŞİ");
    const minutesPdf = JSON.stringify(makePdfDefinition(minutes));
    expect(minutesPdf).toContain("TUTANAK SONUCU");
    expect(minutesPdf).not.toContain("SADECE RAPOR GİRİŞİ");
    const docx = await createDocxBuffer(minutes);
    const archive = unzipSync(docx);
    const documentXml = strFromU8(archive["word/document.xml"]);
    expect(documentXml).toContain("TUTANAK SONUCU");
    expect(documentXml).not.toContain("SADECE RAPOR GİRİŞİ");
    expect(Object.keys(archive).some((path) => path.endsWith(".svg"))).toBe(true);
  }, 30_000);

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

  it("creates a browser DOCX Blob with a real Word VML watermark", async () => {
    const blob = await createDocxBlob(fixtureModel({ ...DEFAULT_DOCUMENT_SETTINGS, showPfkOfficialWatermark: true }));
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const headerXml = strFromU8(archive["word/header1.xml"]);
    expect(headerXml).toContain("TEIASWatermark");
    expect(headerXml).toContain("v:shape");
  }, 30_000);
});
