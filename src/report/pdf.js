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
      widths: ["*", 92, 72, "*"],
      body: [
        ["Test Adımı", "CSV", "Durum", "Hesap / Not"],
        ...records.map((record) => [record.name, record.filename, record.status, record.detail])
      ]
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
      body: [
        ["Değişken", "Açıklama", "Değer", "Birim", "Kaynak", "CSV/Metadata Alanı"],
        ...variables.map((item) => [item.key, item.description, String(item.value ?? ""), item.unit, item.source, item.field])
      ]
    },
    layout: "lightHorizontalLines",
    fontSize: 6.3,
    margin: [0, 4, 0, 8]
  };
}

function sectionContent(section, model) {
  if (section.type === "variables") return [variableTable(model.variables)];
  if (section.type === "participants") {
    return [{ table: { widths: [120, "*"], body: [["Test Ekibi / Katılımcılar", model.metadata.TEST_TEAM || "—"], ["Raporu Hazırlayan", model.metadata.REPORT_PREPARED_BY || "—"]] }, layout: "lightHorizontalLines", fontSize: 8 }];
  }
  const records = section.type === "summary" ? model.records : model.records.filter((record) => section.stepIds.includes(record.stepId));
  const content = [summaryTable(records)];
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
  const content = [];
  content.push({
    table: {
      widths: [72, "*", 145],
      body: [[
        model.assets.logoDataUrl ? { image: model.assets.logoDataUrl, fit: [48, 68], alignment: "center" } : "TEİAŞ",
        { stack: [{ text: model.metadata.TESIS_ADI || "TESİS ADI", bold: true, alignment: "center", margin: [0, 9, 0, 5] }, { text: model.title, bold: true, fontSize: 12, color: "#063f68", alignment: "center" }] },
        { text: `Rapor No: ${model.metadata.REPORT_NO || "—"}\nTarih: ${model.metadata.TEST_DATE || "—"}\nİl: ${model.metadata.CITY || "—"}\nÜnite: ${model.metadata.UNIT_ID || "—"}`, fontSize: 7.5 }
      ]]
    },
    layout: { hLineColor: () => "#063f68", vLineColor: () => "#063f68", hLineWidth: () => 1, vLineWidth: () => 1 },
    margin: [0, 0, 0, 12]
  });
  if (model.draft) {
    content.push({ text: "TEKNİK ÖN DEĞERLENDİRME / TASLAK - Resmî rapor veya sertifika değildir.", color: "#8a5700", fillColor: "#fff4d8", bold: true, fontSize: 9, margin: [6, 6, 6, 9] });
  }
  content.push({ text: "YÜKLEME VE TAMLIK DURUMU", style: "sectionHeading" });
  content.push({ text: model.missingSteps.length ? `Eksik test adımları: ${model.missingSteps.map((step) => step.stepId).join(", ")}` : `Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.`, color: model.missingSteps.length ? "#9b1c1c" : "#19724f", bold: true, fontSize: 8.5 });
  content.push({ text: `${model.reportNote}\nKaynak/statü: ${model.sourceNote}`, fontSize: 8, margin: [0, 4, 0, 8] });
  model.sections.forEach((section, index) => {
    content.push({ text: section.heading, style: "sectionHeading", pageBreak: index > 1 && section.type === "records" ? "before" : undefined });
    content.push(...sectionContent(section, model));
  });
  content.push({ text: "RAPOR İÇİNDE KULLANILAN DEĞİŞKENLER", style: "sectionHeading", pageBreak: "before" }, variableTable(model.variables));
  content.push({ text: "İMZA ALANLARI", style: "sectionHeading" });
  content.push({ columns: model.signatures.map((signature) => ({ width: "*", stack: [{ text: "\n\n________________________", alignment: "center" }, { text: signature.role, bold: true, alignment: "center", fontSize: 8 }, { text: signature.name, alignment: "center", fontSize: 8 }] })), columnGap: 12 });
  content.push({ text: "ORİJİNAL FORMAT / KAYNAK BELGE REFERANSI", style: "sectionHeading", pageBreak: "before" });
  content.push({ text: "Görsel yalnız bölüm/alan yapısı için referanstır; raporun tamamının piksel kopyası değildir.", fontSize: 8, margin: [0, 0, 0, 8] });
  if (model.assets.referenceDataUrl) content.push({ image: model.assets.referenceDataUrl, fit: [430, 610], alignment: "center" });
  else content.push({ text: "Bu rapor türü için ayrı referans görseli bulunmuyor.", color: "#8a5700" });
  return {
    pageSize: "A4",
    pageMargins: [36, 48, 36, 42],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#172630" },
    styles: { sectionHeading: { fontSize: 10, bold: true, color: "#244b64", fillColor: "#eaf2f7", margin: [0, 10, 0, 6] } },
    footer: (currentPage, pageCount) => ({ text: `TEİAŞ-YHDA v${model.appVersion}  |  Sayfa ${currentPage}/${pageCount}`, alignment: "center", color: "#637585", fontSize: 7, margin: [0, 10, 0, 0] }),
    info: { title: model.title, author: "TEİAŞ-YHDA", subject: model.reportType },
    content
  };
}

export async function createPdfBuffer(model) {
  const pdfMake = await loadPdfMake();
  return await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(makePdfDefinition(model)).getBuffer((buffer) => resolve(new Uint8Array(buffer)));
    } catch (error) {
      reject(error);
    }
  });
}

export async function createPdfBlob(model) {
  return new Blob([await createPdfBuffer(model)], { type: "application/pdf" });
}

