import { dataUrlToUint8Array } from "../utils/text.js";

const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;
const PAGE_MARGIN = 1134;
const TABLE_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const BLUE = "005B9F";
const DARK_BLUE = "063F68";
const LIGHT_BLUE = "EAF2F7";
const BORDER = "D5E0E7";

export async function buildDocxDocument(model) {
  const docx = await import("docx");
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    ImageRun,
    PageBreak,
    PageNumber,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType
  } = docx;

  const borders = {
    top: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER }
  };

  const textParagraph = (text, options = {}) => new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.before ?? 0, after: options.after ?? 120, line: options.line ?? 276 },
    children: [new TextRun({ text: String(text ?? ""), bold: options.bold, size: options.size ?? 20, color: options.color ?? "172630", font: "Arial" })]
  });
  const heading = (text, pageBreakBefore = false) => new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore,
    spacing: { before: 180, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: LIGHT_BLUE, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 6 } },
    children: [new TextRun({ text, bold: true, size: 22, color: DARK_BLUE, font: "Arial" })]
  });
  const cell = (value, width, options = {}) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options.header ? { type: ShadingType.CLEAR, fill: LIGHT_BLUE, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [textParagraph(value, { bold: options.header, size: options.size ?? 16, after: 0, line: 240, alignment: options.alignment })]
  });
  const table = (headers, rows, widths, fontSize = 16) => new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((header, index) => cell(header, widths[index], { header: true, size: fontSize })) }),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: row.map((value, index) => cell(value, widths[index], { size: fontSize })) }))
    ]
  });
  const summaryTable = (records) => table(
    ["Test Adımı", "CSV", "Durum", "Hesap / Not"],
    records.length ? records.map((record) => [record.name, record.filename, record.status, record.detail]) : [["Bu bölüm için yüklenmiş kayıt yok", "—", "EKSİK", "—"]],
    [2600, 1800, 1400, TABLE_WIDTH - 5800],
    15
  );
  const variablesTable = () => table(
    ["Değişken", "Açıklama", "Değer", "Birim", "Kaynak", "CSV/Metadata Alanı"],
    model.variables.map((item) => [item.key, item.description, String(item.value ?? ""), item.unit, item.source, item.field]),
    [1250, 2250, 1000, 650, 2050, TABLE_WIDTH - 7200],
    13
  );
  const technicalTables = () => [
    textParagraph("Test ekipmanı ve kalibrasyon", { bold: true, size: 17, after: 70 }),
    table(
      ["Amaç", "Marka / Model", "Seri / Yazılım", "Kalibrasyon", "Doğruluk"],
      model.technicalData.equipment.map((item) => [item.purpose, item.brandModel, item.serialNo, item.calibration, item.accuracy]),
      [1450, 2500, 1750, 1850, TABLE_WIDTH - 7550],
      13
    ),
    textParagraph("Kanal, ölçek ve kaynak bilgileri", { bold: true, size: 17, after: 70 }),
    variablesTable()
  ];
  const campaignSummaryTable = () => table(
    ["Ünite", "Yüklenen / Beklenen", "Son P [MW]", "Durum"],
    model.campaignSummary.units.map((unit) => [
      `${unit.unitId} — ${unit.unitName}`,
      `${unit.loadedSteps} / ${unit.expectedSteps}`,
      Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(2) : "—",
      unit.status
    ]),
    [2800, 1700, 1300, TABLE_WIDTH - 5800],
    15
  );

  const children = [];
  if (model.assets.logoDataUrl) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 220 }, children: [new ImageRun({ data: dataUrlToUint8Array(model.assets.logoDataUrl), transformation: { width: 82, height: 114 }, type: "png" })] }));
  }
  children.push(textParagraph(model.metadata.TESIS_ADI || "TESİS ADI", { alignment: AlignmentType.CENTER, bold: true, size: 30, color: DARK_BLUE, after: 320 }));
  children.push(textParagraph(model.title, { alignment: AlignmentType.CENTER, bold: true, size: 28, color: DARK_BLUE, after: 440 }));
  children.push(textParagraph(`${model.metadata.TEST_DATE || "Tarih"}  |  ${model.metadata.CITY || "İl"}`, { alignment: AlignmentType.CENTER, bold: true, size: 20, after: 260 }));
  children.push(textParagraph(`Rapor No: ${model.metadata.REPORT_NO || "—"}  |  Ünite: ${model.metadata.UNIT_ID || "—"}`, { alignment: AlignmentType.CENTER, size: 18, after: 260 }));
  children.push(textParagraph(model.officialStatus, { alignment: AlignmentType.CENTER, bold: true, color: model.officialStatus === "İMZA ÖNCESİ" ? "19724F" : "8A5700", size: 19, after: 180 }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("YÜKLEME VE TAMLIK DURUMU"));
  children.push(textParagraph(model.missingSteps.length ? `Eksik test adımları: ${model.missingSteps.map((step) => step.stepId).join(", ")}` : `Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.`, { bold: true, color: model.missingSteps.length ? "9B1C1C" : "19724F" }));
  children.push(textParagraph(model.reportNote));

  model.sections.forEach((section) => {
    children.push(heading(section.heading));
    if (section.type === "participants") {
      children.push(table(["Alan", "Değer"], [["Test Ekibi / Katılımcılar", model.metadata.TEST_TEAM || "—"], ["Raporu Hazırlayan", model.metadata.REPORT_PREPARED_BY || "—"]], [2300, TABLE_WIDTH - 2300], 16));
    } else if (section.type === "technical" || section.type === "variables") children.push(...technicalTables());
    else if (section.type === "campaign-summary") {
      children.push(textParagraph(`Kampanya: ${model.campaignSummary.campaignId} · ${model.campaignSummary.facilityId} · ${model.campaignSummary.units.length} ünite`, { size: 16 }));
      children.push(campaignSummaryTable());
      children.push(textParagraph(`Tesis toplamı P: ${Number.isFinite(model.campaignSummary.totalActivePowerMw) ? model.campaignSummary.totalActivePowerMw.toFixed(2) : "—"} MW | Beklenen P: ${Number.isFinite(model.campaignSummary.expectedPowerMw) ? model.campaignSummary.expectedPowerMw.toFixed(2) : "—"} MW | Fark: ${Number.isFinite(model.campaignSummary.expectedPowerDifferenceMw) ? model.campaignSummary.expectedPowerDifferenceMw.toFixed(2) : "—"} MW`, { size: 15 }));
    }
    else {
      const records = section.type === "summary" ? model.records : model.records.filter((record) => section.stepIds.includes(record.stepId));
      if (section.type === "summary") children.push(textParagraph(`Otomatik değerlendirme: ${model.overallStatus} | Resmî çıktı statüsü: ${model.officialStatus}`, { bold: true, size: 16 }));
      children.push(summaryTable(records));
      if (section.type === "records") {
        for (const record of records) {
          for (const chart of record.charts) {
            children.push(textParagraph(`${record.name} - ${chart.title}`, { bold: true, size: 17, before: 100, after: 60 }));
            children.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: false, spacing: { after: 120 }, children: [new ImageRun({ data: dataUrlToUint8Array(chart.dataUrl), transformation: { width: 520, height: 190 }, type: "png" })] }));
          }
        }
      }
    }
  });

  children.push(heading("RAPOR İÇİNDE KULLANILAN DEĞİŞKENLER", true));
  children.push(variablesTable());
  children.push(heading("İMZA ALANLARI"));
  children.push(new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [Math.floor(TABLE_WIDTH / 3), Math.floor(TABLE_WIDTH / 3), TABLE_WIDTH - Math.floor(TABLE_WIDTH / 3) * 2],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: model.signatures.map((signature, index) => cell(`\n\n________________________\n${signature.role}\n${signature.name}`, index === 2 ? TABLE_WIDTH - Math.floor(TABLE_WIDTH / 3) * 2 : Math.floor(TABLE_WIDTH / 3), { alignment: AlignmentType.CENTER, size: 16 })) })]
  }));
  const header = new Header({ children: [textParagraph(`TEİAŞ-YHDA | ${model.reportType}`, { size: 15, color: "637585", after: 0 })] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `TEİAŞ-YHDA v${model.appVersion}  |  Sayfa `, size: 14, color: "637585", font: "Arial" }), new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "637585", font: "Arial" }), new TextRun({ text: "/", size: 14, color: "637585", font: "Arial" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "637585", font: "Arial" })] })] });

  return new Document({
    creator: "TEİAŞ-YHDA",
    title: model.title,
    description: model.reportType,
    styles: {
      default: { document: { run: { font: "Arial", size: 20, color: "172630" }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 22, bold: true, color: DARK_BLUE }, paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 20, bold: true, color: BLUE }, paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 1 } }
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: A4_WIDTH, height: A4_HEIGHT }, margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, header: 708, footer: 708 } }
      },
      headers: { default: header },
      footers: { default: footer },
      children
    }]
  });
}

export async function createDocxBuffer(model) {
  const { Packer } = await import("docx");
  const document = await buildDocxDocument(model);
  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}

export async function createDocxBlob(model) {
  return new Blob([await createDocxBuffer(model)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
