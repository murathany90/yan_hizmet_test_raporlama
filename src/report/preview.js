import { escapeHtml } from "../utils/text.js";
import { isMinutesReport } from "../app/settings.js";
import { recordsForReportSection } from "./record-selection.js";
import { pfkMinutesDetails, pfkSimulationSvg } from "./pfk-official.js";

const esc = (value) => escapeHtml(String(value ?? ""));
const statusBadge = (status) => `<span class="status ${status === "GEÇTİ" ? "pass" : status === "KALDI" ? "fail" : status.includes("TASLAK") || status.includes("ÖN") ? "draft" : "info"}">${esc(status)}</span>`;

const recordsFor = recordsForReportSection;
function certificateReserveRows(model) {
  return model.records.flatMap((record) => record.events?.length
    ? record.events.map((event) => ({ ...record, name: `${record.name} — ${event.label}`, status: event.status, metrics: { ...event.metrics, delaySeconds: event.metrics.delaySeconds, durationSeconds: event.metrics.sustainSeconds, trpA: event.metrics.trp?.TRP_A?.percentage, trpB: event.metrics.trp?.TRP_B?.percentage, trpC: event.metrics.trp?.TRP_C?.percentage } }))
    : (record.stepId.includes("NEG200") || record.stepId.includes("POS200") ? [record] : []));
}
const metric = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
function reserveChecklist(record) {
  const metrics = record.metrics ?? {};
  const trp = metrics.trp ?? {};
  const checks = [
    ["100 ms kayıt çözünürlüğü", `${metric(metrics.sampleMs, 0)} ms`, Number(metrics.sampleMs) <= 102],
    ["Pnom / RPmax metadata", `${metric(metrics.pNomMw)} / ${metric(metrics.reserveMw)} MW`, Number(metrics.pNomMw) > 0 && Number(metrics.reserveMw) > 0],
    ["Δtd", `${metric(metrics.deltaTdSeconds)} s`, Number(metrics.deltaTdSeconds) <= 4],
    ["t50", `${metric(metrics.t50Seconds)} s`, Number(metrics.t50Seconds) <= 15],
    ["Dahili t100", `${metric(metrics.t100Seconds)} s`, Number(metrics.t100Seconds) <= 30],
    ["Resmî etkinleştirme", `${metric(metrics.officialActivationTimeSeconds)} s`, Number(metrics.officialActivationTimeSeconds) <= 30],
    ["90–900 s sürdürme", `${metric(metrics.sustainSeconds, 1)} s`, Number(metrics.sustainSeconds) >= 900],
    ["TRP-A", `${metric(trp.TRP_A?.percentage)} %`, Number(trp.TRP_A?.percentage) >= 90],
    ["TRP-B / TRP-C", `${metric(trp.TRP_B?.percentage)} / ${metric(trp.TRP_C?.percentage)} %`, Number(trp.TRP_B?.percentage) >= 90 && Number(trp.TRP_C?.percentage) >= 90]
  ];
  return `<h5>Resmî kontrol listesi</h5><div class="table-wrap"><table><thead><tr><th>Kontrol</th><th>Ölçülen değer</th><th>Sonuç</th></tr></thead><tbody>${checks.map(([label, value, pass]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td><td>${statusBadge(pass ? "GEÇTİ" : "KALDI")}</td></tr>`).join("")}</tbody></table></div>`;
}
function reserveKpiTable(records) {
  return `<div class="table-wrap"><table><thead><tr><th>Olay</th><th>Pnom</th><th>Pset</th><th>ΔP</th><th>2% Pnom</th><th>1% Pnom</th><th>Δtd</th><th>Etkinleştirme</th><th>TRP A/B/C</th><th>Sonuç</th></tr></thead><tbody>${records.map((record) => { const metrics = record.metrics ?? {}; const trp = metrics.trp ?? {}; return `<tr><td>${esc(record.label || record.name)}</td><td>${metric(metrics.pNomMw)} MW</td><td>${metric(metrics.pSetMw)} MW</td><td>${metric(metrics.deltaPowerMw)} MW</td><td>${metric(Number(metrics.pNomMw) * 0.02)} MW</td><td>${metric(Number(metrics.pNomMw) * 0.01)} MW</td><td>${metric(metrics.deltaTdSeconds)} s</td><td>${metric(metrics.officialActivationTimeSeconds)} s</td><td>${metric(trp.TRP_A?.percentage)} / ${metric(trp.TRP_B?.percentage)} / ${metric(trp.TRP_C?.percentage)} %</td><td>${statusBadge(record.status)}</td></tr>`; }).join("")}</tbody></table></div>${records.map(reserveChecklist).join("")}`;
}
function summaryTable(records) {
  if (!records.length) return `<div class="warning-note">Bu bölüm için yüklenmiş test kaydı yok.</div>`;
  if (records.every((record) => record.eventId && record.metrics?.trp)) return reserveKpiTable(records);
  return `<div class="table-wrap"><table><thead><tr><th>Test adımı</th><th>CSV</th><th>Durum</th><th>Hesap / not</th></tr></thead><tbody>${records.map((record) => `<tr><td>${esc(record.name)}</td><td>${esc(record.filename)}</td><td>${statusBadge(record.status)}</td><td>${esc(record.detail)}</td></tr>`).join("")}</tbody></table></div>`;
}
function recordCharts(records) { return records.flatMap((record) => record.charts.map((chart) => `<figure><figcaption>${esc(record.name)} — ${esc(chart.title)}</figcaption><img class="report-chart" src="${chart.dataUrl}" alt="${esc(record.name)} ${esc(chart.title)}"></figure>`)).join(""); }
function technicalTables(model) {
  const equipment = model.technicalData.equipment.map((item) => `<tr><td>${esc(item.deviceType)}</td><td>${esc(item.brand)}</td><td>${esc(item.model)}</td><td>${esc(item.serialNo)}</td><td>${esc(item.software)}</td><td>${esc(item.accuracyClass)}</td><td>${esc(item.calibrationNo)}</td><td>${esc(item.calibrationDate)}</td></tr>`).join("");
  const channels = model.technicalData.channels.map((item) => `<tr><td>${esc(item.signal)}</td><td>${esc(item.connectionPoint)}</td><td>${esc(item.measurementRange)}</td><td>${esc(item.signalType)}</td><td>${esc(item.scaleM)}</td><td>${esc(item.scaleB)}</td><td>${esc(item.unit)}</td></tr>`).join("");
  return `<p>${esc(model.documentText.technicalData)}</p><h4>Ölçüm ekipmanı ve kalibrasyon</h4><div class="table-wrap"><table><thead><tr><th>Cihaz türü</th><th>Marka</th><th>Model</th><th>Seri no</th><th>Yazılım</th><th>Doğruluk sınıfı</th><th>Kalibrasyon no</th><th>Kalibrasyon tarihi</th></tr></thead><tbody>${equipment}</tbody></table></div><h4>Kanal tanımları</h4><div class="table-wrap"><table><thead><tr><th>Sinyal adı</th><th>Bağlantı noktası</th><th>Ölçme aralığı</th><th>Sinyal tipi</th><th>Ölçek m</th><th>Ölçek b</th><th>Birim</th></tr></thead><tbody>${channels}</tbody></table></div>`;
}
function evidenceTable(model) {
  return `<p>Bu liste, yüklenen ham CSV baytları üzerinden hesaplanan SHA-256 özetidir; elektronik imza değildir.</p><p>${esc(model.documentText.attachmentsDescription)}</p><div class="table-wrap"><table><thead><tr><th>Dosya</th><th>SHA-256</th><th>Ünite</th><th>STEP_ID</th><th>Satır</th><th>Başlangıç</th><th>Bitiş</th><th>Örnekleme ms</th></tr></thead><tbody>${model.evidence.map((item) => `<tr><td>${esc(item.filename)}</td><td><code>${esc(item.sha256)}</code></td><td>${esc(item.unitId)}</td><td>${esc(item.stepId)}</td><td>${esc(item.rowCount)}</td><td>${esc(item.start)}</td><td>${esc(item.end)}</td><td>${Number.isFinite(item.sampleMs) ? item.sampleMs.toFixed(3) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
function campaignTable(summary) {
  if (!summary) return "";
  return `<div class="table-wrap"><table><thead><tr><th>Ünite</th><th>Pnom</th><th>RPmax</th><th>Yüklenen / beklenen</th><th>Son P MW</th><th>Beklenen P MW</th><th>Durum</th></tr></thead><tbody>${summary.units.map((unit) => `<tr><td>${esc(unit.unitId)} — ${esc(unit.unitName)}</td><td>${esc(unit.pnomMw)}</td><td>${esc(unit.rpmaxMw)}</td><td>${unit.loadedSteps} / ${unit.expectedSteps}</td><td>${Number.isFinite(unit.activePowerMw) ? unit.activePowerMw.toFixed(3) : "—"}</td><td>${Number.isFinite(unit.expectedPowerMw) ? unit.expectedPowerMw.toFixed(3) : "—"}</td><td>${statusBadge(unit.status)}</td></tr>`).join("")}</tbody></table></div><p><strong>Santral toplam P:</strong> ${summary.totalActivePowerMw.toFixed(3)} MW · <strong>Beklenen P:</strong> ${summary.expectedPowerMw.toFixed(3)} MW · <strong>Fark:</strong> ${summary.expectedPowerDifferenceMw.toFixed(3)} MW</p>`;
}
function groupedRecords(model, section) {
  return section.groups.map((group) => {
    const items = group.items ?? [group];
    return `<section class="report-subsection"><h4>${esc(group.heading)}</h4>${items.map((item) => { const records = recordsFor(model, item); return `${group.items ? `<h5>${esc(item.heading)}</h5>` : ""}${summaryTable(records)}${recordCharts(records)}`; }).join("")}</section>`;
  }).join("");
}
function minutesContent(model) {
  const meta = model.metadata;
  return `<p>${esc(model.documentText.minutesIntroduction)}</p><p>${esc(model.documentText.operationSafety)}</p><p>${esc(model.documentText.testMethod)}</p><h4>Santral / ünite detayları</h4><dl class="report-kv"><dt>Türbin / jeneratör</dt><dd>${esc(meta.TURBINE_GENERATOR_DESCRIPTION || "—")}</dd><dt>Nominal güç</dt><dd>${esc(meta.PNOM_MW || "—")} MW</dd><dt>İşletme modu</dt><dd>${esc(meta.UNIT_OPERATION_MODE || meta.PFK_OPERATION_MODE || "—")}</dd><dt>Frekans simülasyonu</dt><dd>${esc(meta.SIGNAL_GENERATOR || "—")}</dd><dt>Örnekleme</dt><dd>Yüklenen CSV kayıtlarından doğrulanır</dd></dl>`;
}
function pfkMinutesDetailsTable(model) {
  return `<div class="table-wrap"><table><thead><tr><th>Bilgi</th><th>Değer</th></tr></thead><tbody>${pfkMinutesDetails(model).map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join("")}</tbody></table></div>`;
}
function pfkSimulation() {
  return `<p>Şebeke frekansı ve kontrollü test sinyali, kayıt altındaki simülasyon yöntemiyle birleştirilerek hız regülatörü girişine uygulanır. Referans frekans ayrı izlenir.</p><figure class="pfk-simulation-diagram">${pfkSimulationSvg()}<figcaption>PFK frekans simülasyonu blok şeması</figcaption></figure>`;
}
function pfkConclusion(model) {
  const events = certificateReserveRows(model);
  return `<h4>Primer Frekans Kontrol Performans Testleri Özet Tablosu</h4>${reserveKpiTable(events)}<h4>Primer Frekans Kontrol Performans Testleri Sonuç Tablosu</h4><div class="table-wrap"><table><thead><tr><th>Teknik değerlendirme</th><th>Belge tamlığı</th><th>Açıklama</th></tr></thead><tbody><tr><td>${statusBadge(model.evaluationStatus)}</td><td>${statusBadge(model.documentStatus)}</td><td>Teknik kabul sonucu ile imza/metadata tamamlık durumu ayrı izlenir.</td></tr></tbody></table></div><p>${esc(model.documentText.reportConclusion)}</p>`;
}
function certificate(model) {
  const rows = certificateReserveRows(model).map((record) => `<tr><td>${esc(record.name)}</td><td>${metric(record.metrics.pNomMw)}</td><td>${metric(record.metrics.pSetMw)}</td><td>${metric(record.metrics.deltaPowerMw)}</td><td>${metric(record.metrics.officialActivationTimeSeconds)}</td><td>${metric(record.metrics.sustainSeconds, 1)}</td><td>${metric(record.metrics.trp?.TRP_A?.percentage)}</td><td>${metric(record.metrics.trp?.TRP_B?.percentage)}</td><td>${metric(record.metrics.trp?.TRP_C?.percentage)}</td><td>${esc(record.metadata?.DEADBAND_MHZ || model.metadata.DEADBAND_MHZ)}</td><td>${statusBadge(record.status)}</td></tr>`).join("");
  const watermark = model.watermark ? `<span class="certificate-watermark" style="opacity:${model.watermark.opacity}">${esc(model.watermark.text)}</span>` : "";
  return `<section class="certificate-page">${watermark}${model.assets.logoDataUrl ? `<img class="certificate-logo" src="${model.assets.logoDataUrl}" alt="TEİAŞ amblemi">` : ""}<p class="certificate-number">Sertifika no: ${esc(model.metadata.REPORT_NO || "—")}</p><h2>${esc(model.title)}</h2><p>${esc(model.documentText.certificateIntroduction)}</p><dl class="report-kv"><dt>Tesis</dt><dd>${esc(model.metadata.TESIS_ADI)}</dd><dt>Ünite</dt><dd>${esc(`${model.metadata.UNIT_ID || "Tesis kapsamı"} — ${model.metadata.UNIT_NAME || model.metadata.UNIT_ID || ""}`)}</dd><dt>Test tarih aralığı</dt><dd>${esc(model.metadata.TEST_DATE)}</dd><dt>Belge durumu</dt><dd>${statusBadge(model.officialStatus)}</dd></dl><h4>Test cihazı bilgileri</h4>${technicalTables(model).split("<h4>Kanal tanımları")[0]}<p class="draft-warning">${esc(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK")}</p></section><section class="certificate-page">${watermark}<h2>SONUÇ TABLOSU</h2><div class="table-wrap certificate-result"><table><thead><tr><th>Test</th><th>Pnom</th><th>Pset</th><th>ΔP</th><th>Etkinleşme s</th><th>Sürdürme s</th><th>TRP A</th><th>TRP B</th><th>TRP C</th><th>Ölü bant</th><th>Sonuç</th></tr></thead><tbody>${rows || "<tr><td colspan=11>Yüklenmiş rezerv testi yok.</td></tr>"}</tbody></table></div><p>${esc(model.documentText.certificateResult)}</p><p>${esc(model.documentText.certificateValidityText)}</p><p>Düzenlenme tarihi: ${new Date().toLocaleDateString("tr-TR")}</p><div class="report-signatures">${model.signatures.map((signature) => `<div class="report-signature"><strong>${esc(signature.role)}</strong><br>${esc(signature.name)}</div>`).join("")}</div><p class="draft-warning">${esc(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK")}</p></section>`;
}

export function renderReportPreview(model) {
  if (model.reportType.includes("Sertifika")) return certificate(model);
  const isMinutes = isMinutesReport(model.reportType);
  const warning = model.draft ? `<p class="draft-warning">${esc(model.documentText.draftWarning || "İMZA ÖNCESİ / TASLAK")}</p>` : "";
  const contents = model.sections.filter((section) => !["evidence"].includes(section.type)).map((section, index) => `<li>${esc(section.heading)} <span>${index + 3}</span></li>`).join("");
  const cover = `<section class="report-cover page-break">${model.assets.logoDataUrl ? `<img src="${model.assets.logoDataUrl}" alt="TEİAŞ amblemi">` : ""}<p>${esc(model.settings.institutionName)}</p><h2>${esc(model.title)}</h2><dl><dt>Rapor no</dt><dd>${esc(model.metadata.REPORT_NO || "—")}</dd><dt>Tesis</dt><dd>${esc(model.metadata.TESIS_ADI)}</dd><dt>Test tarihi</dt><dd>${esc(model.metadata.TEST_DATE)}</dd><dt>İl</dt><dd>${esc(model.metadata.CITY)}</dd></dl><p>${statusBadge(model.officialStatus)}</p>${warning}</section><section class="report-section report-toc"><h3>İÇİNDEKİLER</h3><ol>${contents}</ol></section>`;
  const sections = model.sections.map((section, index) => {
    let content = "";
    if (section.type === "participants") content = `<div class="table-wrap"><table><thead><tr><th>Ad Soyad</th><th>Kurum</th><th>Ünvan</th><th>Rol</th><th>İmza</th></tr></thead><tbody>${model.participants.map((participant) => `<tr><td>${esc(participant.name)}</td><td>${esc(participant.company)}</td><td>${esc(participant.title)}</td><td>${esc(participant.role)}</td><td>${esc(participant.signature)}</td></tr>`).join("")}</tbody></table></div>`;
    else if (section.type === "technical") content = technicalTables(model);
    else if (section.type === "minutes") content = minutesContent(model);
    else if (section.type === "pfk-simulation") content = pfkSimulation();
    else if (section.type === "pfk-minutes-details") content = pfkMinutesDetailsTable(model);
    else if (section.type === "campaign-summary") content = campaignTable(model.campaignSummary);
    else if (section.type === "evidence") content = evidenceTable(model);
    else if (section.type === "summary") content = `<p>${esc(isMinutes ? model.documentText.minutesResult : model.documentText.reportConclusion)}</p><p><strong>Otomatik değerlendirme:</strong> ${statusBadge(model.overallStatus)} · <strong>Resmî çıktı statüsü:</strong> ${statusBadge(model.officialStatus)}</p>${summaryTable(model.records)}${isMinutes && section.heading.includes("TESLİM") ? `<p>${esc(model.documentText.copyDelivery)}</p>` : ""}`;
    else if (section.type === "evaluation") content = `<p>${esc(model.documentText.testResult)}</p><p>Test sonuçları; Q hedefi, ölçülen Q, ortalama, kararlılık ve kabul kriterleriyle değerlendirilmiştir.</p><p><strong>Otomatik değerlendirme:</strong> ${statusBadge(model.overallStatus)}</p>${summaryTable(model.records)}`;
    else if (section.type === "conclusion") content = `<p>${esc(model.documentText.reportConclusion)}</p><p><strong>Nihai sonuç:</strong> ${statusBadge(model.overallStatus)}</p>`;
    else if (section.type === "pfk-conclusion") content = pfkConclusion(model);
    else if (section.type === "grouped-records") content = groupedRecords(model, section);
    else { const records = recordsFor(model, section); content = `${summaryTable(records)}${recordCharts(records)}`; }
    const pageBreak = model.figureProfile?.startsWith("OFFICIAL_TEIAS_PFK") && index > 0 ? " page-break" : "";
    return `<section class="report-section${pageBreak}"><h3>${esc(section.heading)}</h3>${content}</section>`;
  }).join("");
  const completeness = model.completeness?.length ? `<div class="warning-note">Taslak / eksik bilgi: ${model.completeness.map((item) => esc(item.label)).join(", ")}</div>` : "";
  return `${cover}<section class="report-section"><h3>YÜKLEME VE TAMLIK DURUMU</h3>${model.missingSteps.length ? `<div class="warning-note">Eksik test adımları: ${model.missingSteps.map((step) => esc(step.stepId)).join(", ")}</div>` : `<div class="source-note">Beklenen ${model.expectedStepCount} test adımının tamamı yüklendi.</div>`}${completeness}${isMinutes ? "" : `<p>${esc(model.documentText.reportIntroduction)}</p>`}<p>${esc(model.reportNote)}</p></section>${sections}<section class="report-section"><h3>İMZA ALANLARI</h3><div class="report-signatures">${model.signatures.map((signature) => `<div class="report-signature"><strong>${esc(signature.role)}</strong><br>${esc(signature.name)}</div>`).join("")}</div></section>`;
}
