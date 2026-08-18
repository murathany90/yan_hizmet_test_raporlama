import { isMinutesReport } from "../app/settings.js";
import { recordsForReportSection } from "./record-selection.js";
import { officialPfkConclusionTables, pfkMinutesDetails, pfkSimulationSvg } from "./pfk-official.js";

async function loadPdfMake() {
  const [pdfMakeModule, fontModule] = await Promise.all([import("pdfmake/build/pdfmake.js"), import("pdfmake/build/vfs_fonts.js")]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const fonts = fontModule.default ?? fontModule;
  pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? fonts;
  return pdfMake;
}

const table = (headers, rows, widths, fontSize = 7) => {
  const emptyRow = () => headers.map((_, index) => index === 0 ? "Yüklenmiş kayıt yok" : "—");
  return { table: { headerRows: 1, widths, body: [headers, ...(rows.length ? rows : [emptyRow()])] }, layout: "lightHorizontalLines", fontSize, margin: [0, 4, 0, 8] };
};
const selected = recordsForReportSection;
const certificateReserveRows = (model) => model.records.flatMap((record) => record.events?.length
  ? record.events.map((event) => ({ ...record, name: `${record.name} — ${event.label}`, status: event.status, metrics: { ...event.metrics, delaySeconds: event.metrics.delaySeconds, durationSeconds: event.metrics.sustainSeconds, trpA: event.metrics.trp?.TRP_A?.percentage, trpB: event.metrics.trp?.TRP_B?.percentage, trpC: event.metrics.trp?.TRP_C?.percentage } }))
  : (record.stepId.includes("NEG200") || record.stepId.includes("POS200") ? [record] : []));
const metric = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
const reserveSummaryTable = (records) => table(["Olay", "Pnom", "Pset", "ΔP", "Δtd", "Etkin.", "TRP A", "TRP B", "TRP C", "Sonuç"], records.map((record) => {
  const metrics = record.metrics ?? {}; const trp = metrics.trp ?? {};
  return [record.label || record.name, `${metric(metrics.pNomMw)} MW`, `${metric(metrics.pSetMw)} MW`, `${metric(metrics.deltaPowerMw)} MW`, `${metric(metrics.deltaTdSeconds)} s`, `${metric(metrics.officialActivationTimeSeconds)} s`, `${metric(trp.TRP_A?.percentage)} %`, `${metric(trp.TRP_B?.percentage)} %`, `${metric(trp.TRP_C?.percentage)} %`, record.status];
}), ["*", 43, 43, 43, 38, 42, 38, 38, 38, 42], 5.5);
const summaryTable = (records) => records.length && records.every((record) => record.eventId && record.metrics?.trp)
  ? reserveSummaryTable(records)
  : table(["Test adımı", "CSV", "Durum", "Hesap / not"], records.map((record) => [record.name, record.filename, record.status, record.detail]), ["*", 90, 58, "*"], 6.8);
const reserveChecklist = (record) => {
  const rows = record.metrics?.officialChecklist ?? [];
  return table(["Kriter", "Resmî kontrol", "Ölçülen", "Sınır", "Kanıt", "Sonuç"], rows.map((item) => [item.criterionId, item.officialText, item.measuredValue, item.limitText, item.evidenceRef, item.result]), [34, "*", 70, 70, 62, 52], 5.6);
};
const evidenceTable = (model) => table(["Dosya", "SHA-256", "Ünite", "STEP_ID", "Satır", "Başlangıç", "Bitiş", "ms"], model.evidence.map((item) => [item.filename, item.sha256, item.unitId, item.stepId, String(item.rowCount), item.start, item.end, Number.isFinite(item.sampleMs) ? item.sampleMs.toFixed(3) : "—"]), [50, 105, 30, 55, 28, 75, 75, 24], 5.2);

function technicalContent(model) {
  const equipment = table(["Cihaz türü", "Marka", "Model", "Seri no", "Yazılım", "Doğruluk", "Kal. no", "Kal. tarihi"], model.technicalData.equipment.map((item) => [item.deviceType, item.brand, item.model, item.serialNo, item.software, item.accuracyClass, item.calibrationNo, item.calibrationDate]), [62, 48, 58, 52, 55, 44, 52, 54], 5.9);
  const channels = table(["Sinyal adı", "Bağlantı noktası", "Ölçme aralığı", "Tip", "m", "b", "Birim"], model.technicalData.channels.map((item) => [item.signal, item.connectionPoint, item.measurementRange, item.signalType, item.scaleM, item.scaleB, item.unit]), [95, 120, 85, 52, 34, 34, 45], 6.1);
  return [{ text: model.documentText.technicalData, fontSize: 8, margin: [0, 0, 0, 5] }, { text: "Ölçüm ekipmanı ve kalibrasyon", bold: true, fontSize: 8 }, equipment, { text: "Kanal tanımları", bold: true, fontSize: 8 }, channels];
}

function recordContent(records, charts = true) {
  const content = [summaryTable(records), ...(records.length && records.every((record) => record.eventId && record.metrics?.trp) ? records.flatMap((record) => [{ text: `${record.name} — resmî kontrol listesi`, bold: true, fontSize: 7.4, margin: [0, 4, 0, 1] }, reserveChecklist(record)]) : [])];
  if (charts) records.forEach((record) => record.charts.forEach((chart) => content.push({ text: `${record.name} — ${chart.title}`, bold: true, fontSize: 7.5, margin: [0, 5, 0, 2] }, { image: chart.dataUrl, fit: [510, 185], alignment: "center", margin: [0, 0, 0, 7] })));
  return content;
}

function groupedContent(model, section) {
  return section.groups.flatMap((group) => {
    const items = group.items ?? [group];
    return [{ text: group.heading, style: "subHeading" }, ...items.flatMap((item) => [group.items ? { text: item.heading, bold: true, fontSize: 8, margin: [0, 5, 0, 1] } : null, ...recordContent(selected(model, item))].filter(Boolean))];
  });
}

function campaignContent(summary) {
  if (!summary) return [];
  return [table(["Ünite", "Pnom", "RPmax", "Yüklenen / beklenen", "Son P", "Beklenen P", "Durum"], summary.units.map((unit) => [`${unit.unitId} — ${unit.unitName}`, unit.pnomMw, unit.rpmaxMw, `${unit.loadedSteps} / ${unit.expectedSteps}`, Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(3) : "—", Number.isFinite(unit.expectedPowerMw) ? unit.expectedPowerMw.toFixed(3) : "—", unit.status]), ["*", 40, 40, 66, 52, 62, 62], 6.5), { text: `Santral toplam P: ${summary.totalActivePowerMw.toFixed(3)} MW | Beklenen P: ${summary.expectedPowerMw.toFixed(3)} MW | Fark: ${summary.expectedPowerDifferenceMw.toFixed(3)} MW`, fontSize: 7.5 }];
}

function minutesContent(model) {
  return [model.documentText.minutesIntroduction, model.documentText.operationSafety, model.documentText.testMethod].map((text) => ({ text, fontSize: 8.5, lineHeight: 1.25, margin: [0, 0, 0, 7] })).concat([table(["Santral / ünite detayı", "Değer"], [["Türbin / jeneratör", model.metadata.TURBINE_GENERATOR_DESCRIPTION || "—"], ["Nominal güç", `${model.metadata.PNOM_MW || "—"} MW`], ["Frekans simülasyonu", model.metadata.SIGNAL_GENERATOR || "—"], ["İşletme modu", model.metadata.UNIT_OPERATION_MODE || model.metadata.PFK_OPERATION_MODE || "—"]], [145, "*"], 7.4)]);
}

function pfkSimulationContent() {
  return [{ text: "Şebeke frekansı ve kontrollü test sinyali, kayıt altındaki simülasyon yöntemiyle birleştirilerek hız regülatörü girişine uygulanır. Referans frekans ayrı izlenir.", fontSize: 8.5, margin: [0, 0, 0, 6] }, { svg: pfkSimulationSvg(), fit: [500, 150], alignment: "center", margin: [0, 2, 0, 7] }];
}

function certificateContent(model) {
  const reserve = certificateReserveRows(model);
  const device = model.technicalData.equipment[0] ?? {};
  const pageOne = [
    ...(model.assets.logoDataUrl ? [{ image: model.assets.logoDataUrl, fit: [70, 94], alignment: "center", margin: [0, 22, 0, 12] }] : []),
    { text: `Sertifika No: ${model.metadata.REPORT_NO || "—"}`, alignment: "right", fontSize: 9 },
    { text: model.title, alignment: "center", bold: true, color: "#063f68", fontSize: 16, margin: [20, 8, 20, 14] },
    { text: model.documentText.certificateIntroduction, alignment: "justify", fontSize: 9, lineHeight: 1.25, margin: [0, 0, 0, 12] },
    table(["Tesis", "Ünite", "Test tarih aralığı", "Belge durumu"], [[model.metadata.TESIS_ADI || "—", `${model.metadata.UNIT_ID || "Tesis kapsamı"} — ${model.metadata.UNIT_NAME || model.metadata.UNIT_ID || ""}`, model.metadata.TEST_DATE || "—", model.officialStatus]], ["*", 95, 105, 90], 7.1),
    { text: "Test cihazı bilgileri", bold: true, fontSize: 9 },
    table(["Marka", "Model", "Seri no", "Kalibrasyon"], [[device.brand || "—", device.model || "—", device.serialNo || "—", `${device.calibrationNo || "—"} / ${device.calibrationDate || "—"}`]], ["*", "*", 100, 130], 7.2),
    { text: model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", bold: true, alignment: "center", color: "#8a5700", margin: [0, 22, 0, 0] },
    { text: "Sayfa 1 / 2", alignment: "center", fontSize: 7, margin: [0, 26, 0, 0] }
  ];
  const pageTwo = [
    { text: "SONUÇ TABLOSU", alignment: "center", bold: true, color: "#063f68", fontSize: 15, margin: [0, 28, 0, 14] },
    table(["Test", "Pnom", "Pset", "ΔP", "Etkinleşme s", "Sürdürme s", "TRP A", "TRP B", "TRP C", "Ölü bant", "Sonuç"], reserve.map((record) => [record.name, metric(record.metrics.pNomMw), metric(record.metrics.pSetMw), metric(record.metrics.deltaPowerMw), metric(record.metrics.officialActivationTimeSeconds), metric(record.metrics.sustainSeconds, 1), metric(record.metrics.trp?.TRP_A?.percentage), metric(record.metrics.trp?.TRP_B?.percentage), metric(record.metrics.trp?.TRP_C?.percentage), record.metadata?.DEADBAND_MHZ || model.metadata.DEADBAND_MHZ || "—", record.status]), [70, 34, 34, 34, 45, 45, 35, 35, 35, 35, 44], 5.5),
    { text: model.documentText.certificateResult, fontSize: 8.5, lineHeight: 1.25, margin: [0, 13, 0, 8] },
    { text: model.documentText.certificateValidityText, fontSize: 8.5, lineHeight: 1.25, margin: [0, 0, 0, 12] },
    { text: `Düzenlenme tarihi: ${new Date().toLocaleDateString("tr-TR")}`, fontSize: 8 },
    { columns: model.signatures.map((signature) => ({ width: "*", stack: [{ text: "\n\n______________________", alignment: "center" }, { text: signature.role, bold: true, alignment: "center", fontSize: 7 }, { text: signature.name, alignment: "center", fontSize: 7 }] })), columnGap: 8, margin: [0, 20, 0, 0] },
    { text: model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", bold: true, alignment: "center", color: "#8a5700", margin: [0, 20, 0, 0] },
    { text: "Sayfa 2 / 2", alignment: "center", fontSize: 7, margin: [0, 16, 0, 0] }
  ];
  return [{ stack: pageOne, pageBreak: "after" }, { stack: pageTwo }];
}

function sectionContent(section, model) {
  if (section.type === "technical") return technicalContent(model);
  if (section.type === "participants") return [table(["Ad Soyad", "Kurum", "Ünvan", "Rol", "İmza"], model.participants.map((participant) => [participant.name, participant.company, participant.title, participant.role, participant.signature]), ["*", "*", "*", "*", 42], 7.1)];
  if (section.type === "minutes") return minutesContent(model);
  if (section.type === "pfk-simulation") return pfkSimulationContent();
  if (section.type === "pfk-minutes-details") return [table(["Bilgi", "Değer"], pfkMinutesDetails(model), [170, "*"], 7.4)];
  if (section.type === "campaign-summary") return campaignContent(model.campaignSummary);
  if (section.type === "evidence") return [{ text: "SHA-256 özeti elektronik imza değildir; ham CSV arşiv zinciri için izlenebilirlik sağlar.", fontSize: 7.5 }, { text: model.documentText.attachmentsDescription, fontSize: 7.5, margin: [0, 2, 0, 4] }, evidenceTable(model)];
  if (section.type === "summary") {
    const isMinutes = isMinutesReport(model.reportType);
    return [{ text: isMinutes ? model.documentText.minutesResult : model.documentText.reportConclusion, fontSize: 8.3, margin: [0, 0, 0, 5] }, { text: `Otomatik değerlendirme: ${model.overallStatus} | Resmî çıktı statüsü: ${model.officialStatus}`, bold: true, fontSize: 8.2 }, summaryTable(model.records), ...(isMinutes && section.heading.includes("TESLİM") ? [{ text: model.documentText.copyDelivery, fontSize: 8 }] : [])];
  }
  if (section.type === "evaluation") return [{ text: model.documentText.testResult, fontSize: 8.3, margin: [0, 0, 0, 5] }, { text: `Test sonuçları hedef/ölçülen değerler, ortalama, kararlılık ve kabul kriterleriyle değerlendirildi. Durum: ${model.overallStatus}`, bold: true, fontSize: 8.2 }, summaryTable(model.records)];
  if (section.type === "pfk-conclusion") return [
    { text: "Primer Frekans Kontrol Performans Testleri Özet Tablosu", bold: true, fontSize: 8.5, margin: [0, 0, 0, 3] },
    table(officialPfkConclusionTables(model).summaryHeaders, officialPfkConclusionTables(model).summaryRows, ["*", 27, 27, 27, 38, 35, 27, 27, 27, 34, 32, 36, 38, 34], 4.3),
    { text: "Primer Frekans Kontrol Performans Testleri Sonuç Tablosu", bold: true, fontSize: 8.5, margin: [0, 6, 0, 3] },
    table(officialPfkConclusionTables(model).matrixHeaders, officialPfkConclusionTables(model).matrixRows, ["*", 47, 47, 42, 47, 38, 38, 38, 52, 48], 4.8),
    table(["Durum", "Sonuç"], officialPfkConclusionTables(model).statusRows, [125, "*"], 7),
    { text: model.documentText.reportConclusion, fontSize: 8.3, margin: [0, 5, 0, 0] }
  ];
  if (section.type === "conclusion") return [{ text: model.documentText.reportConclusion, fontSize: 8.3, margin: [0, 0, 0, 5] }, { text: `Nihai sonuç: ${model.overallStatus}`, bold: true, fontSize: 9, color: model.overallStatus === "GEÇTİ" ? "19724f" : "9b1c1c" }];
  if (section.type === "grouped-records") return groupedContent(model, section);
  return recordContent(selected(model, section));
}

export function makePdfDefinition(model) {
  if (model.reportType.includes("Sertifika")) return {
    pageSize: "A4", pageMargins: [40, 42, 40, 38], defaultStyle: { font: "Roboto", fontSize: 9, color: "#172630" },
    watermark: model.watermark ? { text: model.watermark.text, color: "#005b9f", opacity: model.watermark.opacity, bold: true, fontSize: 54 } : undefined,
    footer: (page) => ({ text: `YDA v${model.appVersion} | ${page}/2`, alignment: "center", color: "#637585", fontSize: 7, margin: [0, 8, 0, 0] }), content: certificateContent(model)
  };
  const isMinutes = isMinutesReport(model.reportType);
  const content = [{ stack: [
    ...(model.assets.logoDataUrl ? [{ image: model.assets.logoDataUrl, fit: [76, 104], alignment: "center", margin: [0, 65, 0, 24] }] : []),
    { text: model.settings.institutionName || "TEİAŞ", bold: true, alignment: "center", fontSize: 12, color: "#244b64" },
    { text: model.metadata.TESIS_ADI || "TESİS ADI", bold: true, alignment: "center", fontSize: 20, color: "#063f68", margin: [0, 14, 0, 16] },
    { text: model.title, bold: true, alignment: "center", fontSize: 16, color: "#063f68", margin: [20, 0, 20, 25] },
    { text: `Rapor No: ${model.metadata.REPORT_NO || "—"}\nTest Tarihi: ${model.metadata.TEST_DATE || "—"}\nİl: ${model.metadata.CITY || "—"}`, alignment: "center", fontSize: 9.5, lineHeight: 1.4 },
    ...(model.draft ? [{ text: model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", bold: true, alignment: "center", color: "#8a5700", margin: [0, 28, 0, 0], fontSize: 10 }] : [])
  ], pageBreak: "after" }];
  content.push({ text: "İÇİNDEKİLER", style: "sectionHeading" }, { ol: model.sections.filter((section) => section.type !== "evidence").map((section) => section.heading), fontSize: 8.5, margin: [12, 4, 0, 12] }, { text: "YÜKLEME VE TAMLIK DURUMU", style: "sectionHeading" }, { text: model.missingSteps.length ? `Eksik test adımları: ${model.missingSteps.map((step) => step.stepId).join(", ")}` : `Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.`, color: model.missingSteps.length ? "#9b1c1c" : "#19724f", bold: true, fontSize: 8.5 }, ...(isMinutes ? [] : [{ text: model.documentText.reportIntroduction, fontSize: 8.2, margin: [0, 4, 0, 5] }]), { text: model.reportNote, fontSize: 8, margin: [0, 0, 0, 5] });
  model.sections.forEach((section, index) => { content.push({ text: section.heading, style: "sectionHeading", pageBreak: model.figureProfile?.startsWith("OFFICIAL_TEIAS_PFK") && index > 0 ? "before" : undefined }, ...sectionContent(section, model)); });
  content.push({ text: "İMZA ALANLARI", style: "sectionHeading" }, { columns: model.signatures.map((signature) => ({ width: "*", stack: [{ text: "\n\n________________________", alignment: "center" }, { text: signature.role, bold: true, alignment: "center", fontSize: 7.5 }, { text: signature.name, alignment: "center", fontSize: 7.5 }] })), columnGap: 10 });
  return { pageSize: "A4", pageMargins: [36, 48, 36, 42], defaultStyle: { font: "Roboto", fontSize: 9, color: "#172630" }, watermark: model.watermark ? { text: model.watermark.text, color: "#005b9f", opacity: model.watermark.opacity, bold: true, fontSize: 54 } : undefined, styles: { sectionHeading: { fontSize: 10, bold: true, color: "#244b64", fillColor: "#eaf2f7", margin: [0, 10, 0, 6] }, subHeading: { fontSize: 8.5, bold: true, color: "#244b64", margin: [0, 7, 0, 3] } }, footer: (currentPage, pageCount) => ({ text: `${model.settings.reportFooter || "YDA"} | Sayfa ${currentPage}/${pageCount}`, alignment: "center", color: "#637585", fontSize: 7, margin: [0, 10, 0, 0] }), info: { title: model.title, author: "YDA (Yan Hizmetler Testleri Doğrulama Aracı)", subject: model.reportType }, content };
}

export async function createPdfBuffer(model) {
  const pdfMake = await loadPdfMake();
  return await new Promise((resolve, reject) => { try { pdfMake.createPdf(makePdfDefinition(model)).getBuffer((buffer) => resolve(new Uint8Array(buffer))); } catch (error) { reject(error); } });
}
export async function createPdfBlob(model) { return new Blob([await createPdfBuffer(model)], { type: "application/pdf" }); }
