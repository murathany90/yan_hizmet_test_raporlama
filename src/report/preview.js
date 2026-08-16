import { escapeHtml } from "../utils/text.js";

function statusBadge(status) {
  const statusClass = status === "GEÇTİ" ? "pass" : status === "KALDI" ? "fail" : status.includes("ÖN") || status.includes("TASLAK") ? "draft" : "info";
  return `<span class="status ${statusClass}">${escapeHtml(status)}</span>`;
}

function summaryTable(records) {
  if (!records.length) return `<div class="warning-note">Bu bölüm için yüklenmiş test kaydı yok.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Test Adımı</th><th>CSV</th><th>Durum</th><th>Hesap / Not</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.filename)}</td><td>${statusBadge(record.status)}</td><td>${escapeHtml(record.detail)}</td></tr>`).join("")}</tbody></table></div>`;
}

function variableTable(variables) {
  return `<div class="table-wrap"><table><thead><tr><th>Değişken</th><th>Açıklama</th><th>Değer</th><th>Birim</th><th>Kaynak</th><th>CSV/Metadata Alanı</th></tr></thead><tbody>${variables.map((variable) => `<tr><td><code>${escapeHtml(variable.key)}</code></td><td>${escapeHtml(variable.description)}</td><td>${escapeHtml(variable.value)}</td><td>${escapeHtml(variable.unit)}</td><td>${escapeHtml(variable.source)}</td><td><code>${escapeHtml(variable.field)}</code></td></tr>`).join("")}</tbody></table></div>`;
}

function recordCharts(record) {
  return record.charts.map((chart) => `<div><p><strong>${escapeHtml(chart.title)}</strong></p><img class="report-chart" src="${chart.dataUrl}" alt="${escapeHtml(record.name)} - ${escapeHtml(chart.title)}"></div>`).join("");
}

export function renderReportPreview(model) {
  const sections = model.sections.map((section, sectionIndex) => {
    let content = "";
    if (section.type === "participants") {
      content = `<div class="table-wrap"><table><tbody><tr><th>Test Ekibi / Katılımcılar</th><td>${escapeHtml(model.metadata.TEST_TEAM || "—")}</td></tr><tr><th>Raporu Hazırlayan</th><td>${escapeHtml(model.metadata.REPORT_PREPARED_BY || "—")}</td></tr></tbody></table></div>`;
    } else if (section.type === "variables") content = variableTable(model.variables);
    else if (section.type === "summary") content = `<p><strong>Genel durum:</strong> ${statusBadge(model.overallStatus)}</p>${summaryTable(model.records)}`;
    else {
      const records = model.records.filter((record) => section.stepIds.includes(record.stepId));
      content = `${summaryTable(records)}${records.map((record) => recordCharts(record)).join("")}`;
    }
    return `<section class="report-section ${sectionIndex > 1 && section.type === "records" ? "page-break" : ""}"><h3>${escapeHtml(section.heading)}</h3>${content}</section>`;
  }).join("");
  const missing = model.missingSteps.length
    ? `<div class="warning-note"><strong>Eksik test adımları (${model.missingSteps.length}):</strong> ${model.missingSteps.map((step) => escapeHtml(step.stepId)).join(", ")}</div>`
    : `<div class="source-note">Beklenen ${model.expectedStepCount} test adımının tamamı yüklenmiştir.</div>`;
  const draft = model.draft ? `<div class="warning-note"><strong>Rapor statüsü:</strong> Teknik Ön Değerlendirme / Taslak. Ayrıntılı resmî TEİAŞ prosedürü veya formatı repo kaynaklarında bulunmadığından bu çıktı resmî rapor/sertifika değildir.</div>` : "";
  const reference = model.assets.referenceDataUrl
    ? `<img class="report-reference" src="${model.assets.referenceDataUrl}" alt="Referans rapor formatı önizlemesi">`
    : `<div class="warning-note">Bu rapor türü için repo içinde ayrı bir referans format görseli bulunmuyor.</div>`;
  return `
    <header class="report-header">
      <div class="report-logo"><img src="${model.assets.logoDataUrl}" alt="TEİAŞ amblemi"></div>
      <div class="report-title"><div><strong>${escapeHtml(model.metadata.TESIS_ADI || "TESİS ADI")}</strong><h2>${escapeHtml(model.title)}</h2></div></div>
      <div class="report-meta"><strong>Rapor No:</strong> ${escapeHtml(model.metadata.REPORT_NO || "—")}<br><strong>Tarih:</strong> ${escapeHtml(model.metadata.TEST_DATE || "—")}<br><strong>İl:</strong> ${escapeHtml(model.metadata.CITY || "—")}<br><strong>Ünite:</strong> ${escapeHtml(model.metadata.UNIT_ID || "—")}</div>
    </header>
    ${draft}
    <section class="report-section"><h3>YÜKLEME VE TAMLIK DURUMU</h3>${missing}<p>${escapeHtml(model.reportNote)}</p><p><strong>Kaynak/statü:</strong> ${escapeHtml(model.sourceNote)}</p></section>
    ${sections}
    <section class="report-section page-break"><h3>RAPOR İÇİNDE KULLANILAN DEĞİŞKENLER</h3>${variableTable(model.variables)}</section>
    <section class="report-section"><h3>İMZA ALANLARI</h3><div class="report-signatures">${model.signatures.map((signature) => `<div class="report-signature"><strong>${escapeHtml(signature.role)}</strong><br>${escapeHtml(signature.name)}</div>`).join("")}</div></section>
    <section class="report-section page-break"><h3>ORİJİNAL FORMAT / KAYNAK BELGE REFERANSI</h3><p>Bu görsel yalnız bölüm/alan yapısı için referanstır; raporun tamamının piksel kopyası değildir.</p>${reference}</section>`;
}

