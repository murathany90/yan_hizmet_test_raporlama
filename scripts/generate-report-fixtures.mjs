import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIGS } from "../src/app/config.js";
import { buildReportModel } from "../src/report/model.js";
import { createPdfBuffer } from "../src/report/pdf.js";
import { createDocxBuffer } from "../src/report/docx.js";

const outputDirectory = resolve("qa_artifacts");
mkdirSync(outputDirectory, { recursive: true });

function dataUrl(path, mimeType) {
  return `data:${mimeType};base64,${readFileSync(resolve(path)).toString("base64")}`;
}

const config = CONFIGS["PFK:HES"];
const chartDataUrl = dataUrl("qa_artifacts/fixture-chart.png", "image/png");
const records = config.steps.map((step, index) => ({
  name: `${step.id}_ÖRNEK.csv`,
  step,
  rows: [{ time_s: 0, active_power_mw: 100 }],
  analysis: {
    status: index < 8 ? "GEÇTİ" : "YÜKLENDİ",
    detail: index < 8 ? "Örnek kayıt doğrulandı; sayısal sonuç rapora aktarıldı." : "24 saatlik doğrulama kaydı yüklendi.",
    metrics: { satirSayisi: 1, örneklemeMs: step.sampleMs }
  },
  validation: { warnings: [] }
}));

const model = buildReportModel({
  service: "PFK",
  plant: "HES",
  config,
  metadata: {
    TESIS_ADI: "İğdır Şaşı Hidroelektrik Üretim Tesisi",
    UNIT_ID: "Ünite-1",
    TEST_DATE: "2026-08-16",
    CITY: "İğdır",
    COMPANY: "Örnek Enerji Üretim A.Ş.",
    PNOM_MW: "500",
    REPORT_NO: "TEİAŞ-YHDA-006",
    TEST_TEAM: "TEİAŞ / Tesis / Bağımsız Test Ekibi",
    REPORT_PREPARED_BY: "Test Mühendisi",
    TEST_ENGINEER: "Ölçüm ve Doğrulama Uzmanı"
  },
  reportType: "Performans Test Raporu",
  reportNote: "Türkçe karakter, tablo, sayfa sonu, grafik ve imza alanlarının görsel kalite kontrol nüshası.",
  records,
  chartProvider: (record) => record.step.id === config.steps[0].id ? [{ title: "Frekans ve Aktif Güç Tepkisi", dataUrl: chartDataUrl }] : [],
  logoDataUrl: dataUrl("teias_logo.png", "image/png"),
  referenceDataUrl: dataUrl("Rapor_Format_Referanslari/pfk_report.jpg", "image/jpeg")
});

const [pdf, docx] = await Promise.all([createPdfBuffer(model), createDocxBuffer(model)]);
writeFileSync(resolve(outputDirectory, "TEIAS-YHDA-QA.pdf"), pdf);
writeFileSync(resolve(outputDirectory, "TEIAS-YHDA-QA.docx"), docx);
writeFileSync(resolve(outputDirectory, "report-model.json"), JSON.stringify(model, null, 2), "utf8");
console.log(`Generated PDF: ${pdf.byteLength} bytes`);
console.log(`Generated DOCX: ${docx.byteLength} bytes`);
