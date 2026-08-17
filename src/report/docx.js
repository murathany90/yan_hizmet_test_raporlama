import { dataUrlToUint8Array } from "../utils/text.js";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { isMinutesReport } from "../app/settings.js";
import { recordsForReportSection } from "./record-selection.js";

const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const PAGE_MARGIN = 950;
const TABLE_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const BLUE = "005B9F";
const DARK = "063F68";
const LIGHT = "EAF2F7";
const LINE = "D5E0E7";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function applyWordWatermark(bytes, watermark) {
  if (!watermark) return bytes;
  const archive = unzipSync(bytes);
  const opacity = Math.max(3, Math.min(25, Math.round(Number(watermark.opacity) * 100)));
  const watermarkXml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:pict><v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/></v:shapetype><v:shape id="TEIASWatermark" o:spid="_x0000_s1025" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;z-index:-251654144;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" fillcolor="#005B9F" stroked="f"><v:fill opacity="${opacity}%"/><v:textpath style="font-family:&quot;Arial&quot;;font-size:1pt" string="${escapeXml(watermark.text)}"/></v:shape></w:pict></w:r></w:p>`;
  for (const path of Object.keys(archive).filter((name) => /^word\/header\d+\.xml$/.test(name))) {
    let xml = strFromU8(archive[path]);
    if (xml.includes("TEIASWatermark")) continue;
    if (!xml.includes("xmlns:v=")) xml = xml.replace("<w:hdr ", '<w:hdr xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" ');
    archive[path] = strToU8(xml.replace("</w:hdr>", `${watermarkXml}</w:hdr>`));
  }
  return zipSync(archive, { level: 6 });
}

export async function buildDocxDocument(model) {
  const docx = await import("docx");
  const { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } = docx;
  const borders = { top: { style: BorderStyle.SINGLE, size: 3, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 3, color: LINE }, left: { style: BorderStyle.SINGLE, size: 3, color: LINE }, right: { style: BorderStyle.SINGLE, size: 3, color: LINE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINE } };
  const paragraph = (text, options = {}) => new Paragraph({ alignment: options.alignment, spacing: { before: options.before ?? 0, after: options.after ?? 100, line: options.line ?? 276 }, children: [new TextRun({ text: String(text ?? ""), bold: options.bold, size: options.size ?? 18, color: options.color ?? "172630", font: "Arial" })] });
  const heading = (text, level = HeadingLevel.HEADING_1) => new Paragraph({ heading: level, spacing: { before: 180, after: 90 }, shading: { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" }, border: { left: { style: BorderStyle.SINGLE, size: 16, color: BLUE, space: 5 } }, children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 21 : 18, color: DARK, font: "Arial" })] });
  const cell = (text, width, options = {}) => new TableCell({ width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, shading: options.header ? { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" } : undefined, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [paragraph(text, { bold: options.header, size: options.size ?? 14, after: 0, line: 210, alignment: options.alignment })] });
  const makeTable = (headers, rows, widths, size = 14) => new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: widths, borders, rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((item, index) => cell(item, widths[index], { header: true, size })) }), ...(rows.length ? rows : [["Yüklenmiş kayıt yok"]]).map((row) => new TableRow({ cantSplit: true, children: widths.map((width, index) => cell(row[index] ?? "", width, { size })) }))] });
  const selected = (selection = []) => recordsForReportSection(model, selection);
  const certificateReserveRows = () => model.records.flatMap((record) => record.events?.length
    ? record.events.map((event) => ({ ...record, name: `${record.name} — ${event.label}`, status: event.status, metrics: { ...event.metrics, delaySeconds: event.metrics.delaySeconds, durationSeconds: event.metrics.sustainSeconds, trpA: event.metrics.trp?.TRP_A?.percentage, trpB: event.metrics.trp?.TRP_B?.percentage, trpC: event.metrics.trp?.TRP_C?.percentage } }))
    : (record.stepId.includes("NEG200") || record.stepId.includes("POS200") ? [record] : []));
  const summaryTable = (records) => makeTable(["Test adımı", "CSV", "Durum", "Hesap / not"], records.map((record) => [record.name, record.filename, record.status, record.detail]), [2400, 1800, 1100, TABLE_WIDTH - 5300], 13);
  const technical = () => [
    paragraph(model.documentText.technicalData, { size: 15 }),
    paragraph("Ölçüm ekipmanı ve kalibrasyon", { bold: true, size: 16, after: 55 }),
    makeTable(["Cihaz türü", "Marka", "Model", "Seri no", "Yazılım", "Doğruluk", "Kal. no", "Kal. tarihi"], model.technicalData.equipment.map((item) => [item.deviceType, item.brand, item.model, item.serialNo, item.software, item.accuracyClass, item.calibrationNo, item.calibrationDate]), [1050, 700, 800, 750, 820, 620, 750, TABLE_WIDTH - 5490], 10),
    paragraph("Kanal tanımları", { bold: true, size: 16, after: 55 }),
    makeTable(["Sinyal adı", "Bağlantı noktası", "Ölçme aralığı", "Tip", "m", "b", "Birim"], model.technicalData.channels.map((item) => [item.signal, item.connectionPoint, item.measurementRange, item.signalType, item.scaleM, item.scaleB, item.unit]), [1550, 1800, 1250, 800, 420, 420, TABLE_WIDTH - 6240], 11)
  ];
  const evidence = () => [paragraph("SHA-256 özeti elektronik imza değildir; ham CSV arşiv zinciri için izlenebilirlik sağlar.", { size: 14 }), paragraph(model.documentText.attachmentsDescription, { size: 14 }), makeTable(["Dosya", "SHA-256", "Ünite", "STEP_ID", "Satır", "Başlangıç", "Bitiş", "ms"], model.evidence.map((item) => [item.filename, item.sha256, item.unitId, item.stepId, String(item.rowCount), item.start, item.end, Number.isFinite(item.sampleMs) ? item.sampleMs.toFixed(3) : "—"]), [950, 1750, 450, 800, 400, 1200, 1200, TABLE_WIDTH - 6750], 9)];
  const charts = (records) => records.flatMap((record) => record.charts.flatMap((chart) => [paragraph(`${record.name} — ${chart.title}`, { bold: true, size: 15, before: 80, after: 45 }), new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 110 }, children: [new ImageRun({ data: dataUrlToUint8Array(chart.dataUrl), transformation: { width: 510, height: 184 }, type: "png" })] })]));
  const grouped = (section) => section.groups.flatMap((group) => {
    const items = group.items ?? [group];
    return [heading(group.heading, HeadingLevel.HEADING_2), ...items.flatMap((item) => { const records = selected(item); return [...(group.items ? [paragraph(item.heading, { bold: true, size: 16, after: 45 })] : []), summaryTable(records), ...charts(records)]; })];
  });
  const participants = () => [makeTable(["Alan", "Değer"], [["Test ekibi / katılımcılar", model.metadata.TEST_TEAM || "—"], ["Raporu hazırlayan", model.metadata.REPORT_PREPARED_BY || "—"]], [2200, TABLE_WIDTH - 2200], 14)];
  const campaign = () => model.campaignSummary ? [makeTable(["Ünite", "Pnom", "RPmax", "Yüklenen / beklenen", "Son P", "Beklenen P", "Durum"], model.campaignSummary.units.map((unit) => [`${unit.unitId} — ${unit.unitName}`, unit.pnomMw, unit.rpmaxMw, `${unit.loadedSteps} / ${unit.expectedSteps}`, Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(3) : "—", Number.isFinite(unit.expectedPowerMw) ? unit.expectedPowerMw.toFixed(3) : "—", unit.status]), [2050, 650, 650, 1100, 800, 900, TABLE_WIDTH - 6150], 11), paragraph(`Santral toplam P: ${model.campaignSummary.totalActivePowerMw.toFixed(3)} MW | Beklenen P: ${model.campaignSummary.expectedPowerMw.toFixed(3)} MW | Fark: ${model.campaignSummary.expectedPowerDifferenceMw.toFixed(3)} MW`, { size: 14 })] : [];
  const minutes = () => [paragraph(model.documentText.minutesIntroduction, { size: 16 }), paragraph(model.documentText.operationSafety, { size: 16 }), paragraph(model.documentText.testMethod, { size: 16 }), makeTable(["Santral / ünite detayı", "Değer"], [["Türbin / jeneratör", model.metadata.TURBINE_GENERATOR_DESCRIPTION || "—"], ["Nominal güç", `${model.metadata.PNOM_MW || "—"} MW`], ["Frekans simülasyonu", model.metadata.SIGNAL_GENERATOR || "—"], ["İşletme modu", model.metadata.UNIT_OPERATION_MODE || model.metadata.PFK_OPERATION_MODE || "—"]], [2200, TABLE_WIDTH - 2200], 14)];
  const summary = (section) => {
    const isMinutes = isMinutesReport(model.reportType);
    return [paragraph(isMinutes ? model.documentText.minutesResult : model.documentText.reportConclusion, { size: 16 }), paragraph(`Otomatik değerlendirme: ${model.overallStatus} | Resmî çıktı statüsü: ${model.officialStatus}`, { bold: true, size: 15 }), summaryTable(model.records), ...(isMinutes && section.heading.includes("TESLİM") ? [paragraph(model.documentText.copyDelivery, { size: 15 })] : [])];
  };
  const evaluation = () => [paragraph(model.documentText.testResult, { size: 16 }), paragraph(`Test sonuçları; hedef/ölçülen değerler, ortalama, kararlılık ve kabul kriterleri üzerinden değerlendirilmiştir. Otomatik değerlendirme: ${model.overallStatus}.`, { size: 15 }), summaryTable(model.records)];
  const conclusion = () => [paragraph(model.documentText.reportConclusion, { size: 16 }), paragraph(`Nihai sonuç: ${model.overallStatus}`, { bold: true, size: 17, color: model.overallStatus === "GEÇTİ" ? "19724F" : "9B1C1C" })];
  const sectionContent = (section) => {
    if (section.type === "participants") return participants();
    if (section.type === "technical") return technical();
    if (section.type === "minutes") return minutes();
    if (section.type === "campaign-summary") return campaign();
    if (section.type === "evidence") return evidence();
    if (section.type === "evaluation") return evaluation();
    if (section.type === "conclusion") return conclusion();
    if (section.type === "summary") return summary(section);
    if (section.type === "grouped-records") return grouped(section);
    const records = selected(section);
    return [summaryTable(records), ...charts(records)];
  };
  const certificate = () => {
    const device = model.technicalData.equipment[0] ?? {};
    const reserve = certificateReserveRows();
    return [
      ...(model.assets.logoDataUrl ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 180, after: 120 }, children: [new ImageRun({ data: dataUrlToUint8Array(model.assets.logoDataUrl), transformation: { width: 72, height: 100 }, type: "png" })] })] : []),
      paragraph(`Sertifika No: ${model.metadata.REPORT_NO || "—"}`, { alignment: AlignmentType.RIGHT, size: 16 }),
      paragraph(model.title, { alignment: AlignmentType.CENTER, bold: true, size: 28, color: DARK, after: 220 }),
      paragraph(model.documentText.certificateIntroduction, { size: 17, line: 300, after: 130 }),
      makeTable(["Tesis", "Ünite", "Test tarih aralığı", "Belge durumu"], [[model.metadata.TESIS_ADI || "—", `${model.metadata.UNIT_ID || "Tesis kapsamı"} — ${model.metadata.UNIT_NAME || model.metadata.UNIT_ID || ""}`, model.metadata.TEST_DATE || "—", model.officialStatus]], [5006, 1600, 1800, 1600], 13),
      paragraph("Test cihazı bilgileri", { bold: true, size: 17, after: 45 }),
      makeTable(["Marka", "Model", "Seri no", "Kalibrasyon"], [[device.brand || "—", device.model || "—", device.serialNo || "—", `${device.calibrationNo || "—"} / ${device.calibrationDate || "—"}`]], [3103, 3103, 1700, 2100], 13),
      paragraph(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", { alignment: AlignmentType.CENTER, bold: true, color: "8A5700", size: 18, before: 180 }),
      new Paragraph({ children: [new PageBreak()] }),
      paragraph("SONUÇ TABLOSU", { alignment: AlignmentType.CENTER, bold: true, size: 26, color: DARK, after: 150 }),
      makeTable(["Test", "Pnom", "Pset", "ΔP", "Etkinleşme s", "Sürdürme s", "TRP A", "TRP B", "TRP C", "Ölü bant", "Sonuç"], reserve.map((record) => [record.name, model.metadata.PNOM_MW || "—", record.stepId.includes("MAX") ? model.metadata.PSET_MAX_MW || "—" : model.metadata.PSET_MIN_MW || "—", model.metadata.RPMAX_MW || "—", Number.isFinite(record.metrics.delaySeconds) ? record.metrics.delaySeconds.toFixed(2) : "—", Number.isFinite(record.metrics.durationSeconds) ? record.metrics.durationSeconds.toFixed(1) : "—", Number.isFinite(record.metrics.trpA) ? record.metrics.trpA.toFixed(1) : "—", Number.isFinite(record.metrics.trpB) ? record.metrics.trpB.toFixed(1) : "—", Number.isFinite(record.metrics.trpC) ? record.metrics.trpC.toFixed(1) : "—", model.metadata.DEADBAND_MHZ || "—", record.status]), [1500, 500, 500, 500, 700, 700, 500, 500, 500, 500, TABLE_WIDTH - 6900], 9),
      paragraph(model.documentText.certificateResult, { size: 16, line: 295, before: 130 }), paragraph(model.documentText.certificateValidityText, { size: 16, line: 295 }), paragraph(`Düzenlenme tarihi: ${new Date().toLocaleDateString("tr-TR")}`, { size: 15 }),
      new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: model.signatures.map(() => Math.floor(TABLE_WIDTH / model.signatures.length)), borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ children: model.signatures.map((signature) => cell(`\n\n______________________\n${signature.role}\n${signature.name}`, Math.floor(TABLE_WIDTH / model.signatures.length), { size: 13, alignment: AlignmentType.CENTER })) })] }),
      paragraph(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", { alignment: AlignmentType.CENTER, bold: true, color: "8A5700", size: 17, before: 160 })
    ];
  };
  const cover = [
    ...(model.assets.logoDataUrl ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 260 }, children: [new ImageRun({ data: dataUrlToUint8Array(model.assets.logoDataUrl), transformation: { width: 80, height: 110 }, type: "png" })] })] : []),
    paragraph(model.settings.institutionName || "TEİAŞ", { alignment: AlignmentType.CENTER, bold: true, size: 18, color: DARK, after: 140 }),
    paragraph(model.metadata.TESIS_ADI || "TESİS ADI", { alignment: AlignmentType.CENTER, bold: true, size: 32, color: DARK, after: 220 }),
    paragraph(model.title, { alignment: AlignmentType.CENTER, bold: true, size: 28, color: DARK, after: 300 }),
    paragraph(`Rapor No: ${model.metadata.REPORT_NO || "—"}\nTest Tarihi: ${model.metadata.TEST_DATE || "—"}\nİl: ${model.metadata.CITY || "—"}`, { alignment: AlignmentType.CENTER, size: 18, line: 290, after: 240 }),
    ...(model.draft ? [paragraph(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK", { alignment: AlignmentType.CENTER, bold: true, size: 18, color: "8A5700" })] : []), new Paragraph({ children: [new PageBreak()] })
  ];
  const isMinutes = isMinutesReport(model.reportType);
  const children = model.reportType.includes("Sertifika") ? certificate() : [
    ...cover, heading("İÇİNDEKİLER"), new Paragraph({ children: model.sections.filter((section) => section.type !== "evidence").map((section) => new TextRun({ text: `${section.heading}\n`, size: 17, font: "Arial" })) }),
    heading("YÜKLEME VE TAMLIK DURUMU"), paragraph(model.missingSteps.length ? `Eksik test adımları: ${model.missingSteps.map((step) => step.stepId).join(", ")}` : `Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.`, { bold: true, color: model.missingSteps.length ? "9B1C1C" : "19724F", size: 16 }), ...(isMinutes ? [] : [paragraph(model.documentText.reportIntroduction, { size: 16 })]), paragraph(model.reportNote, { size: 15 }),
    ...model.sections.flatMap((section) => [heading(section.heading), ...sectionContent(section)]),
    heading("İMZA ALANLARI"), new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: model.signatures.map(() => Math.floor(TABLE_WIDTH / model.signatures.length)), borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ children: model.signatures.map((signature) => cell(`\n\n________________________\n${signature.role}\n${signature.name}`, Math.floor(TABLE_WIDTH / model.signatures.length), { alignment: AlignmentType.CENTER, size: 14 })) })] })
  ];
  const header = new Header({ children: [paragraph(`${model.settings.reportHeader || "YDA"}${model.watermark ? "   |   TEİAŞ" : ""}`, { size: 13, color: "637585", after: 0 })] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${model.settings.reportFooter || "YDA"} | Sayfa `, size: 13, color: "637585", font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], size: 13, color: "637585", font: "Arial" }), new TextRun({ text: "/", size: 13, color: "637585", font: "Arial" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 13, color: "637585", font: "Arial" })] })] });
  return new Document({ creator: "YDA (Yan Hizmetler Doğrulama Aracı)", title: model.title, description: model.reportType, styles: { default: { document: { run: { font: "Arial", size: 18, color: "172630" }, paragraph: { spacing: { after: 100, line: 276 } } } }, paragraphStyles: [{ id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 21, bold: true, color: DARK }, paragraph: { spacing: { before: 180, after: 90 }, outlineLevel: 0 } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 18, bold: true, color: BLUE }, paragraph: { spacing: { before: 140, after: 70 }, outlineLevel: 1 } }] }, sections: [{ properties: { page: { size: { width: A4_WIDTH, height: A4_HEIGHT }, margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, header: 620, footer: 620 } } }, headers: { default: header }, footers: { default: footer }, children }] });
}

export async function createDocxBuffer(model) {
  const { Packer } = await import("docx");
  return applyWordWatermark(new Uint8Array(await Packer.toBuffer(await buildDocxDocument(model))), model.watermark);
}

export async function createDocxBlob(model) {
  const { Packer } = await import("docx");
  const blob = await Packer.toBlob(await buildDocxDocument(model));
  return new Blob([applyWordWatermark(new Uint8Array(await blob.arrayBuffer()), model.watermark)], { type: DOCX_MIME });
}
