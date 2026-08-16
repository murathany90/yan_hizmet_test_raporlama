async function loadPdfMake() {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import("pdfmake/build/pdfmake.js"),
    import("pdfmake/build/vfs_fonts.js")
  ]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const fonts = fontModule.default ?? fontModule;
  pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? fonts;
  return pdfMake;
}

function summaryTable(records) {
  return {
    table: {
      headerRows: 1,
      widths: ["*", 92, 76, "*"],
      body: [["Test Adımı", "CSV", "Durum", "Hesap / Not"], ...(records.length ? records.map((record) => [record.name, record.filename, record.status, record.detail]) : [["Bu bölüm için yüklenmiş kayıt yok", "—", "EKSİK", "—"]])]
    },
    layout: "lightHorizontalLines",
    fontSize: 7.5,
    margin: [0, 4, 0, 8]
  };
}

function variableTable(variables) {
  return {
    table: {
      headerRows: 1,
      widths: [62, "*", 58, 35, 84, 74],
      body: [["Değişken", "Açıklama", "Değer", "Birim", "Kaynak", "CSV/Metadata Alanı"], ...variables.map((item) => [item.key, item.description, String(item.value ?? ""), item.unit, item.source, item.field])]
    },
    layout: "lightHorizontalLines",
    fontSize: 6.3,
    margin: [0, 4, 0, 8]
  };
}

function technicalContent(model) {
  return [
    { text: "Test ekipmanı ve kalibrasyon", bold: true, fontSize: 8, margin: [0, 3, 0, 3] },
    {
      table: {
        headerRows: 1,
        widths: [82, "*", 88, 92, 48],
        body: [["Amaç", "Marka / Model", "Seri / Yazılım", "Kalibrasyon", "Doğruluk"], ...model.technicalData.equipment.map((item) => [item.purpose, item.brandModel, item.serialNo, item.calibration, item.accuracy])]
      },
      layout: "lightHorizontalLines", fontSize: 7, margin: [0, 0, 0, 7]
    },
    { text: "Kanal, ölçek ve kaynak bilgileri", bold: true, fontSize: 8, margin: [0, 3, 0, 3] },
    variableTable(model.technicalData.channels.map((item) => ({ key: item.channel, description: item.signal, value: item.scale, unit: item.unit, source: item.source, field: item.field })))
  ];
}

function campaignContent(summary) {
  if (!summary) return [];
  return [
    { text: `Kampanya: ${summary.campaignId} · ${summary.facilityId} · ${summary.units.length} ünite`, fontSize: 8, margin: [0, 2, 0, 4] },
    {
      table: {
        headerRows: 1,
        widths: ["*", 74, 68, 86],
        body: [["Ünite", "Yüklenen / Beklenen", "Son P [MW]", "Durum"], ...summary.units.map((unit) => [`${unit.unitId} — ${unit.unitName}`, `${unit.loadedSteps} / ${unit.expectedSteps}`, Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(2) : "—", unit.status])]
      },
      layout: "lightHorizontalLines", fontSize: 7.5, margin: [0, 0, 0, 5]
    },
    { text: `Tesis toplamı P: ${Number.isFinite(summary.totalActivePowerMw) ? summary.totalActivePowerMw.toFixed(2) : "—"} MW | Beklenen P: ${Number.isFinite(summary.expectedPowerMw) ? summary.expectedPowerMw.toFixed(2) : "—"} MW | Fark: ${Number.isFinite(summary.expectedPowerDifferenceMw) ? summary.expectedPowerDifferenceMw.toFixed(2) : "—"} MW`, fontSize: 7.5 }
  ];
}

function sectionContent(section, model) {
  if (section.type === "technical" || section.type === "variables") return technicalContent(model);
  if (section.type === "participants") return [{ table: { widths: [130, "*"], body: [["Test Ekibi / Katılımcılar", model.metadata.TEST_TEAM || "—"], ["Raporu Hazırlayan", model.metadata.REPORT_PREPARED_BY || "—"]] }, layout: "lightHorizontalLines", fontSize: 8 }];
  if (section.type === "campaign-summary") return campaignContent(model.campaignSummary);
  const records = section.type === "summary" ? model.records : model.records.filter((record) => section.stepIds.includes(record.stepId));
  const content = section.type === "summary"
    ? [{ text: `Otomatik değerlendirme: ${model.overallStatus} | Resmî çıktı statüsü: ${model.officialStatus}`, bold: true, fontSize: 8, margin: [0, 0, 0, 4] }, summaryTable(records)]
    : [summaryTable(records)];
  if (section.type === "records") {
    for (const record of records) {
      for (const chart of record.charts) {
        content.push({ text: `${record.name} - ${chart.title}`, bold: true, fontSize: 8, margin: [0, 7, 0, 3] });
        content.push({ image: chart.dataUrl, fit: [515, 190], alignment: "center", margin: [0, 0, 0, 8] });
      }
    }
  }
  return content;
}

export function makePdfDefinition(model) {
  const content = [{
    stack: [
      ...(model.assets.logoDataUrl ? [{ image: model.assets.logoDataUrl, fit: [84, 112], alignment: "center", margin: [0, 80, 0, 28] }] : []),
      { text: model.metadata.TESIS_ADI || "TESİS ADI", bold: true, alignment: "center", fontSize: 20, color: "#063f68", margin: [0, 0, 0, 20] },
      { text: model.title, bold: true, alignment: "center", fontSize: 16, color: "#063f68", margin: [20, 0, 20, 30] },
      { text: `Rapor No: ${model.metadata.REPORT_NO || "—"}\nTarih: ${model.metadata.TEST_DATE || "—"}\nİl: ${model.metadata.CITY || "—"}\nKapsam: ${model.campaign ? `${model.campaign.units.length} üniteli PFK kampanyası` : model.metadata.UNIT_ID || "—"}`, alignment: "center", fontSize: 10, lineHeight: 1.5 },
      { text: model.officialStatus, bold: true, alignment: "center", color: model.officialStatus === "İMZA ÖNCESİ" ? "#19724f" : "#8a5700", margin: [0, 34, 0, 0], fontSize: 11 }
    ],
    pageBreak: "after"
  }];
  content.push({ text: "YÜKLEME VE TAMLIK DURUMU", style: "sectionHeading" });
  content.push({ text: model.missingSteps.length ? `Eksik test adımları: ${model.missingSteps.map((step) => step.stepId).join(", ")}` : `Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.`, color: model.missingSteps.length ? "#9b1c1c" : "#19724f", bold: true, fontSize: 8.5 });
  content.push({ text: model.reportNote, fontSize: 8, margin: [0, 4, 0, 8] });
  model.sections.forEach((section) => {
    content.push({ text: section.heading, style: "sectionHeading" });
    content.push(...sectionContent(section, model));
  });
  content.push({ text: "RAPOR İÇİNDE KULLANILAN DEĞİŞKENLER", style: "sectionHeading" }, variableTable(model.variables));
  content.push({ text: "İMZA ALANLARI", style: "sectionHeading" });
  content.push({ columns: model.signatures.map((signature) => ({ width: "*", stack: [{ text: "\n\n________________________", alignment: "center" }, { text: signature.role, bold: true, alignment: "center", fontSize: 8 }, { text: signature.name, alignment: "center", fontSize: 8 }] })), columnGap: 12 });
  return {
    pageSize: "A4",
    pageMargins: [36, 48, 36, 42],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#172630" },
    styles: { sectionHeading: { fontSize: 10, bold: true, color: "#244b64", fillColor: "#eaf2f7", margin: [0, 10, 0, 6] } },
    footer: (currentPage, pageCount) => ({ text: `TEİAŞ-YHDA v${model.appVersion} | Sayfa ${currentPage}/${pageCount}`, alignment: "center", color: "#637585", fontSize: 7, margin: [0, 10, 0, 0] }),
    info: { title: model.title, author: "TEİAŞ-YHDA", subject: model.reportType },
    content
  };
}

export async function createPdfBuffer(model) {
  const pdfMake = await loadPdfMake();
  return await new Promise((resolve, reject) => {
    try { pdfMake.createPdf(makePdfDefinition(model)).getBuffer((buffer) => resolve(new Uint8Array(buffer))); } catch (error) { reject(error); }
  });
}

export async function createPdfBlob(model) {
  return new Blob([await createPdfBuffer(model)], { type: "application/pdf" });
}
