import { escapeHtml } from "../utils/text.js";

function statusBadge(status) {
  const statusClass = status === "GEÇTİ" ? "pass" : status === "KALDI" ? "fail" : status.includes("TASLAK") || status.includes("ÖN") ? "draft" : "info";
  return `<span class="status ${statusClass}">${escapeHtml(status)}</span>`;
}

function summaryTable(records) {
  if (!records.length) return `<div class="warning-note">Bu bölüm için yüklenmiş test kaydı yok.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Test Adımı</th><th>CSV</th><th>Durum</th><th>Hesap / Not</th></tr></thead><tbody>${records.map((record) => `<tr><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.filename)}</td><td>${statusBadge(record.status)}</td><td>${escapeHtml(record.detail)}</td></tr>`).join("")}</tbody></table></div>`;
}

function variableTable(variables) {
  return `<div class="table-wrap"><table><thead><tr><th>Değişken</th><th>Açıklama</th><th>Değer</th><th>Birim</th><th>Kaynak</th><th>CSV/Metadata Alanı</th></tr></thead><tbody>${variables.map((variable) => `<tr><td><code>${escapeHtml(variable.key)}</code></td><td>${escapeHtml(variable.description)}</td><td>${escapeHtml(variable.value)}</td><td>${escapeHtml(variable.unit)}</td><td>${escapeHtml(variable.source)}</td><td><code>${escapeHtml(variable.field)}</code></td></tr>`).join("")}</tbody></table></div>`;
}

function technicalTables(model) {
  const equipment = model.technicalData.equipment.map((item) => `<tr><td>${escapeHtml(item.purpose)}</td><td>${escapeHtml(item.brandModel)}</td><td>${escapeHtml(item.serialNo)}</td><td>${escapeHtml(item.calibration)}</td><td>${escapeHtml(item.accuracy)}</td></tr>`).join("");
  const channels = model.technicalData.channels.map((item) => `<tr><td><code>${escapeHtml(item.channel)}</code></td><td>${escapeHtml(item.signal)}</td><td>${escapeHtml(item.scale)}</td><td>${escapeHtml(item.unit)}</td><td>${escapeHtml(item.source)}</td><td><code>${escapeHtml(item.field)}</code></td></tr>`).join("");
  return `<h4>Test ekipmanı ve kalibrasyon</h4><div class="table-wrap"><table><thead><tr><th>Amaç</th><th>Marka / Model</th><th>Seri / Yazılım</th><th>Kalibrasyon</th><th>Doğruluk</th></tr></thead><tbody>${equipment}</tbody></table></div><h4>Kanal, ölçek ve kaynak bilgileri</h4><div class="table-wrap"><table><thead><tr><th>Kanal</th><th>Sinyal</th><th>Ölçek / Değer</th><th>Birim</th><th>Kaynak</th><th>CSV/Metadata Alanı</th></tr></thead><tbody>${channels}</tbody></table></div>`;
}

function campaignTable(summary) {
  if (!summary) return "";
  return `<p><strong>Kampanya:</strong> ${escapeHtml(summary.campaignId)} · ${escapeHtml(summary.facilityId)} · ${summary.units.length} ünite</p><div class="table-wrap"><table><thead><tr><th>Ünite</th><th>Yüklenen / Beklenen</th><th>Son P [MW]</th><th>Durum</th></tr></thead><tbody>${summary.units.map((unit) => `<tr><td>${escapeHtml(unit.unitId)} — ${escapeHtml(unit.unitName)}</td><td>${unit.loadedSteps} / ${unit.expectedSteps}</td><td>${Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(2) : "—"}</td><td>${statusBadge(unit.status)}</td></tr>`).join("")}</tbody></table></div><p><strong>Tesis toplamı P:</strong> ${Number.isFinite(summary.totalActivePowerMw) ? summary.totalActivePowerMw.toFixed(2) : "—"} MW · <strong>Beklenen P:</strong> ${Number.isFinite(summary.expectedPowerMw) ? summary.expectedPowerMw.toFixed(2) : "—"} MW · <strong>Fark:</strong> ${Number.isFinite(summary.expectedPowerDifferenceMw) ? summary.expectedPowerDifferenceMw.toFixed(2) : "—"} MW</p>`;
}

function recordCharts(record) {
  return record.charts.map((chart) => `<div><p><strong>${escapeHtml(chart.title)}</strong></p><img class="report-chart" src="${chart.dataUrl}" alt="${escapeHtml(record.name)} - ${escapeHtml(chart.title)}"></div>`).join("");
}

export function renderReportPreview(model) {
  const sections = model.sections.map((section) => {
    let content = "";
    if (section.type === "participants") {
      content = `<div class="table-wrap"><table><tbody><tr><th>Test Ekibi / Katılımcılar</th><td>${escapeHtml(model.metadata.TEST_TEAM || "—")}</td></tr><tr><th>Raporu Hazırlayan</th><td>${escapeHtml(model.metadata.REPORT_PREPARED_BY || "—")}</td></tr></tbody></table></div>`;
    } else if (section.type === "technical" || section.type === "variables") content = technicalTables(model);
    else if (section.type === "campaign-summary") content = campaignTable(model.campaignSummary);
    else if (section.type === "summary") content = `<p><strong>Otomatik değerlendirme:</strong> ${statusBadge(model.overallStatus)} &nbsp; <strong>Resmî çıktı statüsü:</strong> ${statusBadge(model.officialStatus)}</p>${summaryTable(model.records)}`;
    else {
      const records = model.records.filter((record) => section.stepIds.includes(record.stepId));
      content = `${summaryTable(records)}${records.map((record) => recordCharts(record)).join("")}`;
    }
    return `<section class="report-section"><h3>${escapeHtml(section.heading)}</h3>${content}</section>`;
  }).join("");
  const missing = model.missingSteps.length
    ? `<div class="warning-note"><strong>Eksik test adımları (${model.missingSteps.length}):</strong> ${model.missingSteps.map((step) => escapeHtml(step.stepId)).join(", ")}</div>`
    : `<div class="source-note">Beklenen ${model.expectedStepCount} test adımının tamamı yüklenmiştir.</div>`;
  return `
    <section class="report-cover page-break">
      ${model.assets.logoDataUrl ? `<img src="${model.assets.logoDataUrl}" alt="TEİAŞ amblemi">` : ""}
      <p>${escapeHtml(model.metadata.TESIS_ADI || "TESİS ADI")}</p>
      <h2>${escapeHtml(model.title)}</h2>
      <dl><dt>Rapor No</dt><dd>${escapeHtml(model.metadata.REPORT_NO || "—")}</dd><dt>Tarih</dt><dd>${escapeHtml(model.metadata.TEST_DATE || "—")}</dd><dt>İl</dt><dd>${escapeHtml(model.metadata.CITY || "—")}</dd><dt>Ünite / Kapsam</dt><dd>${escapeHtml(model.campaign ? `${model.campaign.units.length} üniteli kampanya` : model.metadata.UNIT_ID || "—")}</dd></dl>
      <p>${statusBadge(model.officialStatus)}</p>
    </section>
    <section class="report-section"><h3>YÜKLEME VE TAMLIK DURUMU</h3>${missing}<p>${escapeHtml(model.reportNote)}</p></section>
    ${sections}
    <section class="report-section"><h3>RAPOR İÇİNDE KULLANILAN DEĞİŞKENLER</h3>${variableTable(model.variables)}</section>
    <section class="report-section"><h3>İMZA ALANLARI</h3><div class="report-signatures">${model.signatures.map((signature) => `<div class="report-signature"><strong>${escapeHtml(signature.role)}</strong><br>${escapeHtml(signature.name)}</div>`).join("")}</div></section>`;
}
