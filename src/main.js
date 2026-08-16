import { CONFIGS, DETAILED_CRITERIA, MENU } from "./app/config-v062.js";
import { TEIAS_LOGO_URL } from "./app/assets.js";
import { AVAILABLE_PLACEHOLDERS, isMinutesReport } from "./app/settings.js";
import {
  APP_VERSION,
  configFor,
  createPfkCampaign,
  createAppState,
  getModeMetadata,
  getPfkCampaign,
  modeKey,
  patchModeMetadata,
  patchDocumentSettings,
  recordKey,
  recordsForMode,
  resetDocumentSettings,
  setPfkCampaign
} from "./app/state.js";
import { ChartManager } from "./charts/engine.js";
import { controlsFor, isDraftMode, procedureFor } from "./criteria/procedures.js";
import { evaluateRecord } from "./analysis/evaluate.js";
import { hasUtf8Bom, makeCsvTemplate, parseCsv } from "./csv/parser.js";
import { resolveCsvRoute } from "./csv/metadata.js";
import { validateParsedCsv } from "./csv/validator.js";
import { allTemplatesZip, pfkCampaignTemplatesZip } from "./csv/templates.js";
import { rawCsvEvidence, rawEvidenceManifestCsv } from "./csv/evidence.js";
import { askReplace, chooseOutputDirectory, isTauriRuntime, openCsvFilesNative, saveBinary } from "./platform/files.js";
import { buildReportModel } from "./report/model.js";
import { renderReportPreview } from "./report/preview.js";
import { createPdfBlob } from "./report/pdf.js";
import { createDocxBlob } from "./report/docx.js";
import { safeFilename, urlToDataUrl } from "./utils/text.js";
import { zipSync } from "fflate";

const SERVICE_NAMES = {
  PFK: "Primer Frekans Kontrolü",
  RGDH: "Reaktif Güç Destek Hizmeti",
  HFK: "Hızlı Frekans Kontrol Hizmeti",
  SFHM: "Sınırlı Frekans Hassasiyet Modu",
  SFK: "Sekonder Frekans Kontrolü"
};

const state = createAppState();
const elements = {};
let logoDataUrlPromise;
let booted = false;
let settingsPreviewTimer;
let reportPreviewRequest = 0;

function byId(id) {
  return document.getElementById(id);
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.title) node.title = options.title;
  return node;
}

function showToast(message, kind = "info") {
  const toast = element("div", { className: `toast ${kind}`, text: message });
  elements.toastRegion.append(toast);
  setTimeout(() => toast.remove(), 5_000);
}

function showSavedToast(label, saved) {
  showToast(saved?.native && saved.path ? `${label}: ${saved.path}` : `${label}.`, "success");
}

function plantLabel(service, plant) {
  return MENU.find((item) => item.service === service)?.plants.find(([code]) => code === plant)?.[1] ?? plant;
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  if (tabId === "chartsPanel") renderCharts();
  if (tabId === "criteriaPanel") renderCriteria();
  if (tabId === "settingsPanel") renderSettings();
}

function renderSidebar() {
  elements.sidebar.replaceChildren();
  for (const menuItem of MENU) {
    const group = element("section", { className: "menu-group" });
    group.classList.toggle("open", state.openMenuServices.has(menuItem.service));
    const heading = element("button", { className: "menu-group-button", title: menuItem.label });
    heading.type = "button";
    heading.setAttribute("aria-expanded", String(state.openMenuServices.has(menuItem.service)));
    const code = element("span", { className: "menu-code", text: menuItem.service });
    const name = element("span", { className: "menu-name", text: SERVICE_NAMES[menuItem.service] ?? menuItem.label });
    const chevron = element("span", { className: "menu-chevron", text: "⌄" });
    chevron.setAttribute("aria-hidden", "true");
    heading.append(code, name, chevron);
    heading.addEventListener("click", () => {
      if (state.openMenuServices.has(menuItem.service)) state.openMenuServices.delete(menuItem.service);
      else state.openMenuServices.add(menuItem.service);
      renderSidebar();
    });
    const children = element("div", { className: "menu-children" });
    for (const [plant, label] of menuItem.plants) {
      const button = element("button", { className: "menu-child", text: label, title: label });
      button.type = "button";
      button.dataset.service = menuItem.service;
      button.dataset.plant = plant;
      button.classList.toggle("active", state.service === menuItem.service && state.plant === plant);
      button.addEventListener("click", () => switchMode(menuItem.service, plant));
      children.append(button);
    }
    group.append(heading, children);
    elements.sidebar.append(group);
  }
}

function switchMode(service, plant) {
  state.service = service;
  state.plant = plant;
  state.reportModel = null;
  state.reportDirty = true;
  renderWorkspace();
  if (window.matchMedia("(max-width: 620px)").matches) document.body.classList.remove("mobile-menu-open");
}

function renderModeHeader() {
  const serviceName = SERVICE_NAMES[state.service] ?? state.service;
  const currentPlantLabel = plantLabel(state.service, state.plant);
  elements.crumb.textContent = `${state.service} / ${state.plant}`;
  elements.workTitle.textContent = `${serviceName} — ${currentPlantLabel}`;
  const draft = isDraftMode(state.service, state.plant);
  elements.modeTag.textContent = draft ? "Teknik Ön Değerlendirme / Taslak" : "YHDA Test Modu";
  elements.modeTag.classList.toggle("draft", draft);
}

function renderMetaForm() {
  const config = configFor(state.service, state.plant);
  const metadata = getModeMetadata(state);
  elements.metaForm.replaceChildren();
  for (const [key, label, type] of config.meta) {
    const group = element("div", { className: "field-group" });
    const fieldLabel = element("label", { text: label });
    const input = document.createElement("input");
    input.id = `meta-${key}`;
    input.dataset.metaKey = key;
    input.type = ["date", "number"].includes(type) ? type : "text";
    if (input.type === "number") input.step = "any";
    input.value = metadata[key] ?? "";
    fieldLabel.htmlFor = input.id;
    input.addEventListener("input", () => {
      patchModeMetadata(state, state.service, state.plant, { [key]: input.value });
    });
    group.append(fieldLabel, input);
    elements.metaForm.append(group);
  }
}

function campaignField(key, label, value, onInput, type = "text") {
  const group = element("div", { className: "field-group" });
  const fieldLabel = element("label", { text: label });
  const input = document.createElement("input");
  input.id = `campaign-${key}`;
  input.type = type;
  input.value = value;
  if (type === "number") {
    input.min = "2";
    input.max = "20";
    input.step = "1";
  }
  fieldLabel.htmlFor = input.id;
  input.addEventListener("input", () => onInput(input.value));
  group.append(fieldLabel, input);
  return group;
}

function campaignToggle(key, label, checked, onInput) {
  const group = element("div", { className: "field-group campaign-toggle" });
  const input = document.createElement("input");
  input.id = `campaign-${key}`;
  input.type = "checkbox";
  input.checked = checked;
  const fieldLabel = element("label", { text: label });
  fieldLabel.htmlFor = input.id;
  input.addEventListener("change", () => onInput(input.checked));
  group.append(input, fieldLabel);
  return group;
}

function updateCampaign(values) {
  const current = getPfkCampaign(state);
  if (!current) return;
  const next = { ...current, ...values };
  if (values.unitCount !== undefined) {
    const count = Math.max(2, Math.min(20, Number.parseInt(values.unitCount, 10) || 2));
    next.units = Array.from({ length: count }, (_, index) => current.units[index] ?? ({ unitId: `U${index + 1}`, unitName: `Ünite ${index + 1}`, pnomMw: "", rpmaxMw: "", included: true }));
  }
  setPfkCampaign(state, state.service, state.plant, next);
  renderPfkCampaign();
  renderWorkspace();
}

function renderPfkCampaign() {
  const visible = state.service === "PFK";
  elements.pfkCampaignCard.hidden = !visible;
  if (!visible) return;
  const campaign = getPfkCampaign(state);
  elements.pfkCampaignSetup.textContent = campaign?.enabled ? "Tek Ünite Moduna Dön" : "Çok Üniteli Kampanyayı Etkinleştir";
  elements.pfkCampaignZip.hidden = !campaign?.enabled;
  elements.pfkCampaignForm.replaceChildren();
  if (!campaign?.enabled) {
    elements.pfkCampaignForm.append(element("div", { className: "campaign-note", text: "Varsayılan PFK akışı tek ünitedir. Çok üniteli mod yalnız bu karttan etkinleştirilir; diğer hizmetlerde kampanya metadata alanı kullanılmaz." }));
    return;
  }
  elements.pfkCampaignForm.append(
    campaignField("id", "CAMPAIGN_ID", campaign.campaignId, (value) => updateCampaign({ campaignId: value })),
    campaignField("facility", "FACILITY_ID", campaign.facilityId, (value) => updateCampaign({ facilityId: value })),
    campaignField("count", "UNIT_COUNT", campaign.units.length, (value) => updateCampaign({ unitCount: value }), "number"),
    campaignField("event", "EVENT_ID", campaign.eventId, (value) => updateCampaign({ eventId: value })),
    campaignField("run", "RUN_ID", campaign.runId, (value) => updateCampaign({ runId: value }))
  );
  campaign.units.forEach((unit, index) => {
    const patchUnit = (values) => updateCampaign({ units: campaign.units.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, ...values } : candidate) });
    elements.pfkCampaignForm.append(
      campaignField(`unit-${index}`, `${unit.unitId} Ünite adı`, unit.unitName, (value) => patchUnit({ unitName: value })),
      campaignField(`pnom-${index}`, `${unit.unitId} Pnom [MW]`, unit.pnomMw, (value) => patchUnit({ pnomMw: value }), "number"),
      campaignField(`rpmax-${index}`, `${unit.unitId} RPmax [MW]`, unit.rpmaxMw, (value) => patchUnit({ rpmaxMw: value }), "number"),
      campaignToggle(`included-${index}`, `${unit.unitId} teste dahil`, unit.included !== false, (value) => patchUnit({ included: value }))
    );
  });
  elements.pfkCampaignForm.append(element("div", { className: "campaign-note", text: "Kampanya CSV'lerinde CAMPAIGN_ID, FACILITY_ID, TEST_SCOPE, ENTITY_TYPE, ENTITY_ID, UNIT_ID, UNIT_NAME, UNIT_COUNT, STEP_ID, EVENT_ID ve RUN_ID zorunludur. Kayıt rotası ünite ve çalıştırma kimliğiyle ayrılır." }));
}

function makeStatus(record) {
  if (!record) return element("span", { className: "status pending", text: "Bekleniyor" });
  const value = record.analysis.status;
  const kind = value === "GEÇTİ" ? "pass" : value === "KALDI" ? "fail" : value.includes("ÖN") ? "draft" : "info";
  return element("span", { className: `status ${kind}`, text: value });
}

function renderSteps() {
  const config = configFor(state.service, state.plant);
  const campaign = getPfkCampaign(state);
  elements.stepList.replaceChildren();
  for (const step of config.steps) {
    const unitRecords = campaign?.enabled
      ? campaign.units.map((unit) => state.records.get(recordKey(state.service, state.plant, step.id, { campaignId: campaign.campaignId, unitId: unit.unitId, runId: campaign.runId }))).filter(Boolean)
      : [];
    const record = campaign?.enabled ? unitRecords[0] : state.records.get(recordKey(state.service, state.plant, step.id));
    const card = element("article", { className: "step-card" });
    const heading = element("div", { className: "step-card-heading" });
    const title = element("h4", { text: step.name });
    heading.append(title, makeStatus(record));
    const details = element("p", {
      className: "step-detail",
      text: campaign?.enabled
        ? `${unitRecords.length}/${campaign.units.length} ünite kaydı · ${step.id} · ${step.sampleMs} ms · ${step.columns.length} sütun`
        : record ? `${record.name} · ${record.rows.length.toLocaleString("tr-TR")} satır · ${record.analysis.detail}` : `${step.id} · ${step.sampleMs} ms · ${step.columns.length} sütun`
    });
    const actions = element("div", { className: "step-actions" });
    const uploadLabel = element("label", { className: "button secondary small", text: record ? "CSV Değiştir" : "CSV Yükle" });
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.className = "visually-hidden";
    input.dataset.stepId = step.id;
    uploadLabel.append(input);
    input.addEventListener("change", async () => {
      if (!input.files?.length) return;
      await processFiles([...input.files], { expected: { service: state.service, plant: state.plant, stepId: step.id } });
      input.value = "";
    });
    const templateButton = element("button", { className: "button ghost small", text: "Şablon İndir" });
    templateButton.type = "button";
    templateButton.addEventListener("click", () => downloadTemplate(step, campaign?.enabled ? campaign.units[0] : null));
    actions.append(uploadLabel, templateButton);
    card.append(heading, details, actions);
    elements.stepList.append(card);
  }
}

async function downloadTemplate(step, unit = null) {
  const campaign = getPfkCampaign(state);
  const metadata = {
    ...getModeMetadata(state),
    TEST_SERVICE: state.service,
    PLANT_TYPE: state.plant,
    STEP_ID: step.id,
    SAMPLE_PERIOD_MS: step.sampleMs,
    ...(campaign?.enabled && unit ? {
      CAMPAIGN_ID: campaign.campaignId,
      FACILITY_ID: campaign.facilityId,
      TEST_SCOPE: "MULTI_UNIT",
      ENTITY_TYPE: "UNIT",
      ENTITY_ID: unit.unitId,
      UNIT_ID: unit.unitId,
      UNIT_NAME: unit.unitName,
      UNIT_COUNT: campaign.units.length,
      EVENT_ID: campaign.eventId,
      RUN_ID: campaign.runId
    } : {})
  };
  const csv = makeCsvTemplate(metadata, step.columns);
  try {
    const saved = await saveBinary(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${state.service}_${state.plant}_${unit?.unitId ? `${unit.unitId}_` : ""}${step.id}.csv`, "text/csv;charset=utf-8", state.documentSettings.outputDirectory);
    showSavedToast("CSV şablonu hazırlandı", saved);
  } catch (error) {
    showToast(`CSV şablonu kaydedilemedi: ${error.message}`, "error");
  }
}

async function downloadAllTemplates() {
  const config = configFor(state.service, state.plant);
  const zip = allTemplatesZip({ service: state.service, plant: state.plant, config, metadata: getModeMetadata(state) });
  try {
    const saved = await saveBinary(zip, `${state.service}_${state.plant}_tum_test_sablonlari.zip`, "application/zip", state.documentSettings.outputDirectory);
    showSavedToast(`${config.steps.length} test şablonu ZIP olarak hazırlandı`, saved);
  } catch (error) {
    showToast(`ZIP kaydedilemedi: ${error.message}`, "error");
  }
}

async function downloadPfkCampaignTemplates() {
  const campaign = getPfkCampaign(state);
  if (!campaign?.enabled) return;
  const zip = await pfkCampaignTemplatesZip({ plant: state.plant, config: configFor(state.service, state.plant), metadata: getModeMetadata(state), campaign });
  try {
    const saved = await saveBinary(zip, `PFK_${state.plant}_${safeFilename(campaign.campaignId)}_kampanya_sablonlari.zip`, "application/zip", state.documentSettings.outputDirectory);
    showSavedToast(`${campaign.units.length} üniteli PFK kampanya şablonları ZIP olarak hazırlandı`, saved);
  } catch (error) {
    showToast(`Kampanya ZIP'i kaydedilemedi: ${error.message}`, "error");
  }
}

async function fileBytes(file) {
  if (file.bytes instanceof Uint8Array) return file.bytes;
  return new Uint8Array(await file.arrayBuffer());
}

function metadataForForm(route, parsedMetadata) {
  const allowed = new Set(route.config.meta.map(([key]) => key));
  return Object.fromEntries(Object.entries(parsedMetadata).filter(([key]) => allowed.has(key)));
}

async function processOneFile(file, expected) {
  const bytes = await fileBytes(file);
  if (!hasUtf8Bom(bytes)) throw new Error("UTF-8 BOM bulunamadı");
  const parsed = parseCsv(bytes);
  const route = resolveCsvRoute(parsed.metadata);
  if (expected && (route.service !== expected.service || route.plant !== expected.plant || route.stepId !== expected.stepId)) {
    throw new Error(`dosya rotası ${route.service}/${route.plant}/${route.stepId}; beklenen ${expected.service}/${expected.plant}/${expected.stepId}`);
  }
  const validation = validateParsedCsv(parsed, route);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  if (route.isPfkCampaign) {
    const fileUnitValues = {
      pnomMw: String(parsed.metadata.UNIT_PNOM_MW ?? parsed.metadata.PNOM_MW ?? "").trim(),
      rpmaxMw: String(parsed.metadata.RPMAX_MW ?? "").trim()
    };
    const applyFileUnitValues = (unit) => ({
      ...unit,
      unitName: unit.unitId === route.campaign.unitId ? route.campaign.unitName : unit.unitName,
      pnomMw: unit.unitId === route.campaign.unitId ? (unit.pnomMw || fileUnitValues.pnomMw) : unit.pnomMw,
      rpmaxMw: unit.unitId === route.campaign.unitId ? (unit.rpmaxMw || fileUnitValues.rpmaxMw) : unit.rpmaxMw
    });
    const existingCampaign = getPfkCampaign(state, route.service, route.plant);
    const units = existingCampaign?.campaignId === route.campaign.campaignId
      ? existingCampaign.units.map(applyFileUnitValues)
      : Array.from({ length: route.campaign.unitCount }, (_, index) => applyFileUnitValues({ unitId: `U${index + 1}`, unitName: `Ünite ${index + 1}`, pnomMw: "", rpmaxMw: "" }));
    const unitIndex = units.findIndex((unit) => unit.unitId === route.campaign.unitId);
    if (unitIndex >= 0) units[unitIndex] = applyFileUnitValues({ ...units[unitIndex], unitId: route.campaign.unitId });
    else units.push({ unitId: route.campaign.unitId, unitName: route.campaign.unitName, ...fileUnitValues });
    setPfkCampaign(state, route.service, route.plant, { enabled: true, ...route.campaign, units });
  } else if (route.service === "PFK" && getPfkCampaign(state, route.service, route.plant)?.enabled) {
    throw new Error("Etkin PFK çok üniteli kampanyada kampanya/ünite metadata alanları zorunludur.");
  }
  const key = recordKey(route.service, route.plant, route.stepId, route.isPfkCampaign ? route.campaign : {});
  const existing = state.records.get(key);
  if (existing) {
    const replace = await askReplace(`${route.service}/${route.plant}/${route.stepId} için “${existing.name}” yüklü. “${file.name}” ile değiştirilsin mi?`);
    if (!replace) return { skipped: true, route };
  }
  patchModeMetadata(state, route.service, route.plant, metadataForForm(route, parsed.metadata));
  const record = {
    name: file.name,
    service: route.service,
    plant: route.plant,
    step: route.step,
    rows: validation.rows,
    validation,
    sourceMetadata: { ...parsed.metadata },
    evidence: await rawCsvEvidence({ bytes, filename: file.name, route, validation, rows: validation.rows }),
    _recordKey: key
  };
  record.analysis = evaluateRecord(record, {
    service: route.service,
    plant: route.plant,
    metadata: getModeMetadata(state, route.service, route.plant)
  });
  state.records.set(key, record);
  state.reportDirty = true;
  return { skipped: false, route, warnings: validation.warnings };
}

async function processFiles(files, options = {}) {
  const results = [];
  for (const file of files) {
    try {
      const result = await processOneFile(file, options.expected);
      results.push({ name: file.name, ok: true, ...result });
    } catch (error) {
      results.push({ name: file.name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const passed = results.filter((result) => result.ok && !result.skipped).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.filter((result) => !result.ok);
  renderBulkSummary(files.length, passed, skipped, failed);
  renderWorkspace();
  if (failed.length) showToast(`${files.length} dosyanın ${failed.length} adedi reddedildi.`, "error");
  else showToast(`${passed} CSV doğrulandı ve yönlendirildi${skipped ? `; ${skipped} dosya atlandı` : ""}.`, "success");
  return results;
}

function renderBulkSummary(total, passed, skipped, failed) {
  elements.bulkSummary.replaceChildren();
  if (!total) return;
  const summary = element("div", { className: failed.length ? "summary-box warning" : "summary-box success" });
  summary.append(element("strong", { text: `${total} dosya · ${passed} başarılı · ${failed.length} hatalı${skipped ? ` · ${skipped} atlandı` : ""}` }));
  if (failed.length) {
    const list = document.createElement("ul");
    failed.forEach((item) => list.append(element("li", { text: `${item.name}: ${item.error}` })));
    summary.append(list);
  }
  elements.bulkSummary.append(summary);
}

function renderGraphSelector() {
  const config = configFor(state.service, state.plant);
  const selectionKey = modeKey(state.service, state.plant);
  const campaign = getPfkCampaign(state);
  const loadedRecords = campaign?.enabled
    ? recordsForMode(state)
    : config.steps.map((step) => state.records.get(recordKey(state.service, state.plant, step.id))).filter(Boolean);
  elements.graphStep.replaceChildren();
  if (!loadedRecords.length) {
    const option = element("option", { text: "Önce CSV yükleyin" });
    option.value = "";
    elements.graphStep.append(option);
    elements.graphStep.disabled = true;
    elements.graphInfo.value = "Yüklü kayıt yok";
    return;
  }
  elements.graphStep.disabled = false;
  let selected = state.graphSelection.get(selectionKey);
  if (!loadedRecords.some((record) => record._recordKey === selected)) selected = loadedRecords[0]._recordKey;
  state.graphSelection.set(selectionKey, selected);
  for (const record of loadedRecords) {
    const option = element("option", { text: record.sourceMetadata?.UNIT_ID ? `${record.sourceMetadata.UNIT_ID} — ${record.step.name}` : record.step.name });
    option.value = record._recordKey;
    option.selected = record._recordKey === selected;
    elements.graphStep.append(option);
  }
  const record = state.records.get(selected);
  elements.graphInfo.value = record ? `${record.name} · ${record.rows.length.toLocaleString("tr-TR")} satır` : "";
}

function renderPfkChartScope() {
  const campaign = getPfkCampaign(state);
  const visible = state.service === "PFK" && campaign?.enabled;
  elements.pfkChartScope.hidden = !visible;
  if (!visible) return;
  const key = modeKey(state.service, state.plant);
  const active = state.pfkChartScopeByMode.get(key) ?? "unit";
  document.querySelectorAll("[data-pfk-chart-scope]").forEach((button) => {
    const selected = button.dataset.pfkChartScope === active;
    button.classList.toggle("primary", selected);
    button.classList.toggle("ghost", !selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function campaignChartRecord(record) {
  const campaign = getPfkCampaign(state);
  const scope = state.pfkChartScopeByMode.get(modeKey(state.service, state.plant)) ?? "unit";
  if (!campaign?.enabled || scope === "unit") return record;
  const matching = campaign.units.filter((unit) => unit.included !== false).map((unit) => ({ unit, record: state.records.get(recordKey("PFK", state.plant, record.step.id, { campaignId: campaign.campaignId, unitId: unit.unitId, runId: campaign.runId })) })).filter((item) => item.record);
  if (!matching.length) return record;
  const timeOf = (row) => Number.isFinite(row.timestamp_ms) ? row.timestamp_ms : row.time_s * 1000;
  const timestamps = [...new Set(matching.flatMap(({ record: item }) => item.rows.map(timeOf).filter(Number.isFinite)))].sort((left, right) => left - right);
  const sampleMs = Math.max(...matching.map(({ record: item }) => Number(item.validation?.stats?.sampleMs) || item.step.sampleMs || 100));
  const toleranceMs = Math.max(20, sampleMs * 0.6);
  const closest = (rows, target) => {
    let low = 0; let high = rows.length - 1;
    while (low <= high) { const middle = Math.floor((low + high) / 2); if (timeOf(rows[middle]) < target) low = middle + 1; else high = middle - 1; }
    const best = [rows[low], rows[high]].filter(Boolean).sort((left, right) => Math.abs(timeOf(left) - target) - Math.abs(timeOf(right) - target))[0];
    return best && Math.abs(timeOf(best) - target) <= toleranceMs ? best : null;
  };
  const metadata = getModeMetadata(state);
  const baselines = new Map(matching.map(({ unit, record: item }) => {
    const values = item.rows.slice(0, Math.min(200, item.rows.length)).map((row) => row.active_power_mw).filter(Number.isFinite);
    return [unit.unitId, values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN];
  }));
  let gaps = 0;
  const rows = timestamps.map((timestamp, index) => {
    const row = { timestamp_ms: timestamp, time_s: (timestamp - timestamps[0]) / 1000, sira_no: index + 1, zaman: new Date(timestamp).toLocaleString("tr-TR") };
    let total = 0; let expected = 0; let complete = true;
    matching.forEach(({ unit, record: item }) => {
      const source = closest(item.rows, timestamp);
      const active = source?.active_power_mw;
      const baseline = baselines.get(unit.unitId);
      const rpmax = Number(unit.rpmaxMw || metadata.RPMAX_MW);
      const reference = source?.active_power_reference_mw;
      const pset = Number(item.sourceMetadata.PSET_MW ?? (item.step.id.includes("MAX") ? metadata.PSET_MAX_MW : metadata.PSET_MIN_MW));
      const expectedUnit = Number.isFinite(reference) ? reference : (Number.isFinite(pset) ? pset + (item.step.id.includes("NEG200") ? 1 : item.step.id.includes("POS200") ? -1 : 0) * (Number.isFinite(rpmax) ? rpmax : 0) : Number.NaN);
      row[unit.unitId] = active;
      row[`normalized_${unit.unitId}`] = Number.isFinite(active) && Number.isFinite(baseline) && Number.isFinite(rpmax) && rpmax > 0 ? (active - baseline) / rpmax : Number.NaN;
      if (Number.isFinite(active) && Number.isFinite(expectedUnit)) { total += active; expected += expectedUnit; } else complete = false;
    });
    row.plant_total_active_power_mw = complete ? total : Number.NaN;
    row.expected_active_power_mw = complete ? expected : Number.NaN;
    if (!complete) gaps += 1;
    return row;
  });
  const seriesSets = scope === "comparison"
    ? [{ title: "Ünite Aktif Güç Karşılaştırması", series: matching.map(({ unit }) => [unit.unitId, `${unit.unitId} Aktif Güç`, "left", "MW"]) }, { title: "Normalize PFK Cevabı — Ri(t) = ΔPi(t) / RPmax_i", series: matching.map(({ unit }) => [`normalized_${unit.unitId}`, `${unit.unitId} Ri(t)`, "left", "pu"]) }]
    : [{ title: "Santral Toplam P / Beklenen P", series: [["plant_total_active_power_mw", "Tesis Toplam P", "left", "MW"], ["expected_active_power_mw", "Beklenen P", "left", "MW"]] }];
  return { ...record, name: `${record.step.name} — ${scope === "comparison" ? "Ünite karşılaştırması" : "Santral toplamı"}`, rows, seriesSets, dataQualityWarning: gaps ? `${gaps} zaman damgasında ünite verisi tolerans içinde hizalanamadı; bu noktalar toplamdan dışlandı.` : "" };
}

function renderCharts() {
  renderGraphSelector();
  renderPfkChartScope();
  const selected = state.graphSelection.get(modeKey(state.service, state.plant));
  const record = selected ? state.records.get(selected) : null;
  if (!record) {
    elements.chartArea.replaceChildren(element("div", { className: "empty-state", text: "Grafik oluşturmak için bu modda en az bir CSV yükleyin." }));
    return;
  }
  const chartRecord = campaignChartRecord(record);
  chartManager.render(elements.chartArea, chartRecord, state.service, `${modeKey(state.service, state.plant)}:${state.pfkChartScopeByMode.get(modeKey(state.service, state.plant)) ?? "unit"}`);
  if (chartRecord.dataQualityWarning) elements.chartArea.prepend(element("div", { className: "warning-note", text: chartRecord.dataQualityWarning }));
}

function renderReportTypes() {
  const types = configFor(state.service, state.plant).reports;
  const currentMode = modeKey(state.service, state.plant);
  const previous = state.reportTypeByMode.get(currentMode) ?? elements.reportType.value;
  elements.reportType.replaceChildren();
  for (const type of types) {
    const option = element("option", { text: type });
    option.value = type;
    elements.reportType.append(option);
  }
  const selected = types.includes(previous) ? previous : (types.find((type) => type.includes("Rapor")) ?? types[0]);
  elements.reportType.value = selected;
  state.reportTypeByMode.set(currentMode, selected);
  elements.pfkCampaignCertificates.hidden = !(state.service === "PFK" && getPfkCampaign(state)?.enabled);
}

function criteriaCard(title, items, ordered = false) {
  const card = element("article", { className: "card criteria-card" });
  card.append(element("h3", { text: title }));
  const list = document.createElement(ordered ? "ol" : "ul");
  for (const item of items) list.append(element("li", { text: item }));
  card.append(list);
  return card;
}

function renderCriteria() {
  const config = configFor(state.service, state.plant);
  const detailed = DETAILED_CRITERIA[modeKey(state.service, state.plant)];
  const procedures = procedureFor(state.service, state.plant);
  const criteria = [...config.criteria];
  if (detailed?.steps) {
    for (const [stepId, values] of Object.entries(detailed.steps)) {
      criteria.push(`${stepId}: ${values.join(" ")}`);
    }
  }
  elements.criteriaContent.replaceChildren(
    criteriaCard("Test Nasıl Yapılır", procedures, true),
    criteriaCard("Kontroller", controlsFor(state.service, state.plant)),
    criteriaCard("Değerlendirme", criteria)
  );
  const campaign = getPfkCampaign(state);
  if (state.service === "PFK" && campaign?.enabled) {
    const campaignCard = element("article", { className: "card criteria-card" });
    campaignCard.append(element("h3", { text: "PFK Çok Ünite Adım Kontrolü" }));
    campaign.units.forEach((unit) => {
      const unitDetails = document.createElement("details");
      unitDetails.className = "criteria-step";
      const unitSummary = document.createElement("summary");
      unitSummary.textContent = `${unit.unitId} — ${unit.unitName}`;
      unitDetails.append(unitSummary);
      config.steps.forEach((step) => {
        const stepDetails = document.createElement("details");
        stepDetails.className = "criteria-step";
        const stepSummary = document.createElement("summary");
        stepSummary.textContent = `${step.id}: ${step.name}`;
        const body = element("div", { className: "criteria-step-content", text: (detailed?.steps?.[step.id] ?? ["Kanal, süre, örnekleme ve sonuç kanıtını ünite bazında doğrulayın."]).join(" ") });
        stepDetails.append(stepSummary, body);
        unitDetails.append(stepDetails);
      });
      campaignCard.append(unitDetails);
    });
    elements.criteriaContent.append(campaignCard);
  }
  if (isDraftMode(state.service, state.plant)) {
    const note = element("div", { className: "warning-note", text: "Bu hizmet/tesis kombinasyonu için çıktı yalnız Teknik Ön Değerlendirme / Taslak statüsündedir; resmî sertifika yerine geçmez." });
    elements.criteriaContent.prepend(note);
  }
}

function settingControl(label, value, type, onInput, hint = "") {
  const group = element("div", { className: "field-group" });
  const fieldLabel = element("label", { text: label });
  const control = document.createElement(type === "textarea" ? "textarea" : "input");
  if (type === "checkbox") {
    control.type = "checkbox";
    control.checked = Boolean(value);
    group.classList.add("settings-check");
    control.addEventListener("change", () => onInput(control.checked));
  } else {
    if (type !== "textarea") control.type = type;
    control.value = String(value ?? "");
    if (type === "textarea") control.rows = 3;
    if (type === "number") { control.step = "0.01"; control.min = "0"; control.max = "1"; }
    control.addEventListener("input", () => onInput(control.value));
  }
  fieldLabel.htmlFor = control.id || "";
  group.append(fieldLabel, control);
  if (hint) group.append(element("small", { className: "source-note", text: hint }));
  return group;
}

function settingsSelect(label, value, options, onChange) {
  const group = element("div", { className: "field-group" });
  const fieldLabel = element("label", { text: label });
  const control = document.createElement("select");
  options.forEach(({ value: optionValue, label: optionLabel }) => {
    const option = element("option", { text: optionLabel });
    option.value = optionValue;
    control.append(option);
  });
  control.value = value;
  control.addEventListener("change", () => onChange(control.value));
  group.append(fieldLabel, control);
  return group;
}

function outputDirectoryControl(settings) {
  const group = element("div", { className: "field-group output-directory-control" });
  const label = element("label", { text: "Çıktı klasörü" });
  const path = document.createElement("input");
  path.type = "text";
  path.readOnly = true;
  path.value = settings.outputDirectory || "Seçilmedi — Tauri'de kaydederken dosya konumu sorulur.";
  const actions = element("div", { className: "output-directory-actions" });
  const choose = element("button", { className: "button secondary small", text: "Klasör Seç" });
  choose.type = "button";
  choose.addEventListener("click", async () => {
    if (!isTauriRuntime()) {
      showToast("Çıktı klasörü seçimi yalnız Tauri masaüstü uygulamasında kullanılabilir; web indirme davranışı değişmez.", "info");
      return;
    }
    try {
      const outputDirectory = await chooseOutputDirectory();
      if (!outputDirectory) return;
      updateSettings({ outputDirectory });
      renderSettings();
      showToast(`Çıktı klasörü seçildi: ${outputDirectory}`, "success");
    } catch (error) {
      showToast(`Çıktı klasörü seçilemedi: ${error.message}`, "error");
    }
  });
  const clear = element("button", { className: "button ghost small", text: "Temizle" });
  clear.type = "button";
  clear.disabled = !settings.outputDirectory;
  clear.addEventListener("click", () => {
    updateSettings({ outputDirectory: "" });
    renderSettings();
  });
  actions.append(choose, clear);
  group.append(label, path, actions, element("small", { className: "source-note", text: "Tauri'de PDF, Word, ZIP ve kanıt manifesti seçilen klasöre kaydedilir; bildirimde gerçek dosya yolu gösterilir." }));
  return group;
}

function updateSettings(values) {
  patchDocumentSettings(state, values);
  state.reportDirty = true;
  clearTimeout(settingsPreviewTimer);
  settingsPreviewTimer = setTimeout(() => {
    if (state.reportModel) previewReport(true);
  }, 220);
}

function renderSettings() {
  if (!elements.settingsContent) return;
  const settings = state.documentSettings;
  const section = (title, controls, className = "") => {
    const card = element("article", { className: "card settings-card" });
    card.append(element("h3", { text: title }));
    const form = element("div", { className: `form-grid settings-grid ${className}`.trim() });
    form.append(...controls);
    card.append(form);
    return card;
  };
  const top = [
    settingControl("Kurum adı", settings.institutionName, "text", (value) => updateSettings({ institutionName: value })),
    settingControl("Rapor üst bilgi", settings.reportHeader, "text", (value) => updateSettings({ reportHeader: value })),
    settingControl("Rapor alt bilgi", settings.reportFooter, "text", (value) => updateSettings({ reportFooter: value })),
    settingControl("İl", settings.city, "text", (value) => updateSettings({ city: value })),
    settingControl("Mevzuat referansı", settings.regulationReference, "text", (value) => updateSettings({ regulationReference: value })),
    settingControl("Belge hazırlayan birim", settings.preparedBy, "text", (value) => updateSettings({ preparedBy: value })),
    settingControl("Varsayılan imza rolleri (; ile ayırın)", settings.defaultSignatureRoles, "text", (value) => updateSettings({ defaultSignatureRoles: value })),
    settingControl("TEİAŞ amblemini göster", settings.showLogo, "checkbox", (value) => updateSettings({ showLogo: value })),
    settingControl("TEİAŞ filigranını göster (PDF ve Word arka planı)", settings.showWatermark, "checkbox", (value) => updateSettings({ showWatermark: value })),
    settingControl("Filigran şeffaflığı", settings.watermarkOpacity, "number", (value) => updateSettings({ watermarkOpacity: Number(value) })),
    outputDirectoryControl(settings)
  ];
  const context = state.settingsContext;
  const serviceOptions = MENU.map((item) => ({ value: item.service, label: `${item.service} — ${SERVICE_NAMES[item.service] ?? item.label}` }));
  const supportedDocumentTypes = (service) => {
    const reports = MENU.find((item) => item.service === service)?.plants.flatMap(([plant]) => configFor(service, plant).reports) ?? [];
    return [
      { value: "report", label: "Rapor" },
      ...(reports.some((type) => isMinutesReport(type)) ? [{ value: "minutes", label: "Tutanak" }] : []),
      ...(reports.some((type) => type.includes("Sertifika")) ? [{ value: "certificate", label: "Sertifika" }] : [])
    ];
  };
  const documentOptions = supportedDocumentTypes(context.service);
  if (!documentOptions.some((item) => item.value === context.documentType)) context.documentType = "report";
  const textGroups = {
    report: { label: "Performans Test Raporu", fields: [["reportIntroduction", "Rapor giriş metni"], ["technicalData", "Teknik veri açıklaması"], ["testResult", "Test değerlendirme metni"], ["reportConclusion", "Sonuç metni"]] },
    minutes: { label: "Test Tutanağı", fields: [["minutesIntroduction", "Tutanak başlangıç metni"], ["operationSafety", "İşletme güvenliği beyanı"], ["testMethod", "Test yöntemi açıklaması"], ["minutesResult", "Tutanak sonuç/beyan metni"], ["copyDelivery", "Nüsha/teslim metni"], ["attachmentsDescription", "Ekler açıklaması"]] },
    certificate: { label: "Test Sertifikası", fields: [["certificateIntroduction", "Sertifika açıklama metni"], ["certificateResult", "Sertifika sonuç metni"], ["certificateValidityText", "Sertifika geçerlilik metni"], ["draftWarning", "Taslak / imza öncesi uyarısı"]] }
  };
  const textGroup = textGroups[context.documentType];
  const scopedValue = (key) => settings.scopedTexts?.[context.service]?.[context.documentType]?.[key] ?? settings.texts[key] ?? "";
  const textControls = textGroup.fields.map(([key, label]) => settingControl(
    `${context.service} > ${textGroup.label} > ${label}`,
    scopedValue(key), "textarea",
    (value) => updateSettings({ scopedTexts: { [context.service]: { [context.documentType]: { [key]: value } } } }),
    `Kullanıldığı belge: ${context.service} ${textGroup.label}`
  ));
  const placeholderDetails = document.createElement("details");
  placeholderDetails.className = "settings-placeholders";
  placeholderDetails.append(element("summary", { text: "Kullanılabilir değişkenler" }), element("p", { text: AVAILABLE_PLACEHOLDERS.map((key) => `{{${key}}}`).join(" · ") }));
  const textCard = section(`B) Belge metinleri — ${context.service} > ${textGroup.label}`, [
    settingsSelect("Hizmet", context.service, serviceOptions, (service) => {
      state.settingsContext = { service, documentType: "report" };
      renderSettings();
    }),
    settingsSelect("Belge", context.documentType, documentOptions, (documentType) => {
      state.settingsContext = { ...state.settingsContext, documentType };
      renderSettings();
    }),
    element("div", { className: "settings-breadcrumb", text: `${context.service} > ${textGroup.label}` }),
    placeholderDetails,
    ...textControls
  ], "settings-document-grid");
  const defaultLabels = {
    facilityName: "Tesis adı varsayılanı", operatorName: "Şirket / işletmeci varsayılanı", city: "Şehir varsayılanı",
    turbineGenerator: "Türbin / jeneratör açıklaması", unitOperationMode: "Ünite işletme modu"
  };
  const defaults = Object.entries(defaultLabels).map(([key, label]) => settingControl(label, settings.defaults[key], "text", (value) => updateSettings({ defaults: { [key]: value } })));
  const equipmentLabels = {
    deviceType: "Cihaz türü", brand: "Marka", model: "Model", serialNo: "Seri no", software: "Yazılım",
    accuracyClass: "Doğruluk sınıfı", calibrationNo: "Kalibrasyon no", calibrationDate: "Kalibrasyon tarihi"
  };
  const equipment = Object.entries(equipmentLabels).map(([key, label]) => settingControl(label, settings.defaults.equipment?.[key], "text", (value) => updateSettings({ defaults: { equipment: { [key]: value } } })));
  elements.settingsContent.replaceChildren(
    section("A) Kurumsal belge ve çıktı ayarları", top),
    textCard,
    section("C) Tesis / ünite varsayılan bilgileri", defaults),
    section("D) Test ekipmanı varsayılanları", equipment)
  );
}

async function reportAssets() {
  logoDataUrlPromise ??= urlToDataUrl(TEIAS_LOGO_URL);
  return { logoDataUrl: await logoDataUrlPromise };
}

async function buildCurrentReport() {
  const records = recordsForMode(state);
  if (!records.length) throw new Error("Rapor için bu modda en az bir CSV yükleyin.");
  const assets = await reportAssets();
  const model = buildReportModel({
    service: state.service,
    plant: state.plant,
    config: configFor(state.service, state.plant),
    metadata: getModeMetadata(state),
    reportType: elements.reportType.value,
    reportNote: elements.reportNote.value,
    records,
    chartProvider: elements.reportType.value.includes("Sertifika") ? () => [] : (record) => chartManager.renderRecordImages(record, state.service),
    campaign: getPfkCampaign(state),
    settings: state.documentSettings,
    ...assets
  });
  state.reportModel = model;
  state.reportDirty = false;
  return model;
}

async function exportPfkCampaignCertificates() {
  const campaign = getPfkCampaign(state);
  if (!campaign?.enabled) return;
  const button = elements.pfkCampaignCertificates;
  const initialText = button.textContent;
  button.disabled = true;
  button.textContent = "Hazırlanıyor…";
  try {
    const assets = await reportAssets();
    const files = {};
    const manifestRows = ["UNIT_ID;UNIT_NAME;FILE_NAME;LOADED_STEP_COUNT"];
    for (const unit of campaign.units) {
      const records = recordsForMode(state).filter((record) => record.sourceMetadata?.CAMPAIGN_ID === campaign.campaignId && record.sourceMetadata?.UNIT_ID === unit.unitId && record.sourceMetadata?.RUN_ID === campaign.runId);
      const unitMetadata = records.find((record) => record.sourceMetadata)?.sourceMetadata ?? {};
      const pnomMw = unit.pnomMw || unitMetadata.UNIT_PNOM_MW || unitMetadata.PNOM_MW || getModeMetadata(state).PNOM_MW;
      const rpmaxMw = unit.rpmaxMw || unitMetadata.UNIT_RPMAX_MW || unitMetadata.RPMAX_MW || getModeMetadata(state).RPMAX_MW;
      const model = buildReportModel({
        service: "PFK",
        plant: state.plant,
        config: configFor("PFK", state.plant),
        metadata: {
          ...getModeMetadata(state), ...unitMetadata,
          UNIT_ID: unit.unitId,
          UNIT_NAME: unit.unitName || unitMetadata.UNIT_NAME || unit.unitId,
          PNOM_MW: pnomMw,
          RPMAX_MW: rpmaxMw
        },
        reportType: "Test Sertifikası",
        reportNote: elements.reportNote.value,
        records,
        chartProvider: () => [],
        campaign: { ...campaign, units: [unit], expectedSteps: configFor("PFK", state.plant).steps.length },
        settings: state.documentSettings,
        ...assets
      });
      const filename = `${unit.unitId}_PFK_Test_Sertifikasi.docx`;
      files[filename] = new Uint8Array(await (await createDocxBlob(model)).arrayBuffer());
      manifestRows.push(`${unit.unitId};${unit.unitName};${filename};${records.length}`);
    }
    files["sertifika_manifest.csv"] = new TextEncoder().encode(`\uFEFF${manifestRows.join("\r\n")}\r\n`);
    const saved = await saveBinary(zipSync(files, { level: 6 }), `PFK_${safeFilename(campaign.campaignId)}_unit_sertifikalari.zip`, "application/zip", state.documentSettings.outputDirectory);
    showSavedToast("Ünite sertifikaları ZIP olarak hazırlandı", saved);
  } catch (error) {
    showToast(`Sertifika ZIP'i oluşturulamadı: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = initialText;
  }
}

async function exportRawEvidenceManifest() {
  try {
    const records = recordsForMode(state);
    if (!records.length) throw new Error("Kanıt manifesti için en az bir CSV yükleyin.");
    const csv = rawEvidenceManifestCsv(records.map((record) => record.evidence).filter(Boolean));
    const saved = await saveBinary(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${state.service}_${state.plant}_ham_csv_kanit_manifesti.csv`, "text/csv;charset=utf-8", state.documentSettings.outputDirectory);
    showSavedToast("Ham CSV SHA-256 kanıt manifesti hazırlandı", saved);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function currentReport() {
  return state.reportDirty || !state.reportModel ? await buildCurrentReport() : state.reportModel;
}

async function previewReport(quiet = false) {
  const request = ++reportPreviewRequest;
  try {
    const model = await buildCurrentReport();
    if (request !== reportPreviewRequest) return;
    elements.reportPaper.innerHTML = renderReportPreview(model);
    if (!quiet) showToast("Rapor önizlemesi oluşturuldu.", "success");
  } catch (error) {
    if (request !== reportPreviewRequest) return;
    state.reportModel = null;
    elements.reportPaper.replaceChildren(element("div", { className: "empty-state", text: `Önizleme oluşturulamadı: ${error.message}` }));
    showToast(error.message, "error");
  }
}

async function exportReport(kind) {
  const button = kind === "pdf" ? elements.pdfReport : elements.docxReport;
  const initialText = button.textContent;
  button.disabled = true;
  button.textContent = "Oluşturuluyor…";
  try {
    const model = await currentReport();
    const base = safeFilename(`${model.service}-${model.plant}-${model.metadata.TESIS_ADI || "rapor"}`);
    const saved = kind === "pdf"
      ? await saveBinary(await createPdfBlob(model), `${base}.pdf`, "application/pdf", state.documentSettings.outputDirectory)
      : await saveBinary(await createDocxBlob(model), `${base}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", state.documentSettings.outputDirectory);
    showSavedToast(`${kind === "pdf" ? "PDF" : "Word"} raporu hazırlandı`, saved);
  } catch (error) {
    console.error(error);
    showToast(`Rapor oluşturulamadı: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = initialText;
  }
}

function renderWorkspace() {
  renderSidebar();
  renderModeHeader();
  renderMetaForm();
  renderPfkCampaign();
  renderSteps();
  renderGraphSelector();
  renderReportTypes();
  if (state.activeTab === "chartsPanel") renderCharts();
  if (state.activeTab === "criteriaPanel") renderCriteria();
  if (state.activeTab === "settingsPanel") renderSettings();
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));
  elements.graphStep.addEventListener("change", () => {
    state.graphSelection.set(modeKey(state.service, state.plant), elements.graphStep.value);
    renderCharts();
  });
  elements.bulkFiles.addEventListener("change", async () => {
    if (elements.bulkFiles.files?.length) await processFiles([...elements.bulkFiles.files]);
    elements.bulkFiles.value = "";
  });
  elements.nativeBulkOpen.addEventListener("click", async () => {
    const files = await openCsvFilesNative();
    if (files.length) await processFiles(files);
  });
  elements.downloadAllTemplates.addEventListener("click", downloadAllTemplates);
  elements.pfkCampaignSetup.addEventListener("click", () => {
    const campaign = getPfkCampaign(state);
    if (campaign?.enabled) setPfkCampaign(state, state.service, state.plant, null);
    else setPfkCampaign(state, state.service, state.plant, createPfkCampaign(getModeMetadata(state)));
    renderWorkspace();
  });
  elements.pfkCampaignZip.addEventListener("click", downloadPfkCampaignTemplates);
  document.querySelectorAll("[data-pfk-chart-scope]").forEach((button) => button.addEventListener("click", () => {
    if (!(state.service === "PFK" && getPfkCampaign(state)?.enabled)) return;
    state.pfkChartScopeByMode.set(modeKey(state.service, state.plant), button.dataset.pfkChartScope);
    renderCharts();
  }));
  elements.makeReport.addEventListener("click", previewReport);
  elements.pdfReport.addEventListener("click", () => exportReport("pdf"));
  elements.docxReport.addEventListener("click", () => exportReport("docx"));
  elements.pfkCampaignCertificates.addEventListener("click", exportPfkCampaignCertificates);
  elements.rawEvidenceManifest.addEventListener("click", exportRawEvidenceManifest);
  elements.printReport.addEventListener("click", async () => {
    if (state.reportDirty || !state.reportModel) await previewReport();
    setActiveTab("reportsPanel");
    window.print();
  });
  elements.reportType.addEventListener("change", async () => {
    state.reportTypeByMode.set(modeKey(state.service, state.plant), elements.reportType.value);
    state.reportDirty = true;
    state.reportModel = null;
    reportPreviewRequest += 1;
    if (recordsForMode(state).length) {
      await previewReport(true);
    } else {
      elements.reportPaper.replaceChildren(element("div", { className: "empty-state", text: "Seçili belge türü için önizleme oluşturmak üzere en az bir CSV yükleyin." }));
    }
  });
  elements.reportNote.addEventListener("input", () => { state.reportDirty = true; });
  elements.resetSettings.addEventListener("click", () => {
    resetDocumentSettings(state);
    renderSettings();
    if (state.reportModel) previewReport(true);
    showToast("Belge ayarları varsayılan değerlere döndürüldü.", "success");
  });
  elements.sideToggle.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 620px)").matches) document.body.classList.toggle("mobile-menu-open");
    else document.body.classList.toggle("sidebar-collapsed");
  });
}

function cacheElements() {
  [
    "sidebar", "crumb", "workTitle", "modeTag", "metaForm", "pfkCampaignCard", "pfkCampaignSetup", "pfkCampaignZip", "pfkCampaignForm", "bulkFiles", "nativeBulkOpen", "downloadAllTemplates", "bulkSummary", "stepList",
    "graphStep", "graphInfo", "chartArea", "reportType", "reportNote", "makeReport", "pdfReport", "docxReport", "printReport",
    "reportPaper", "criteriaContent", "toastRegion", "sideToggle", "teiasLogo", "runtimeBadge", "pfkChartScope", "pfkCampaignCertificates", "rawEvidenceManifest", "settingsContent", "resetSettings"
  ].forEach((id) => { elements[id] = byId(id); });
}

const chartManager = new ChartManager(state, saveBinary);

function boot() {
  if (booted) return;
  booted = true;
  window.__YHDA_READY__ = false;
  cacheElements();
  elements.teiasLogo.src = TEIAS_LOGO_URL;
  const native = isTauriRuntime();
  elements.runtimeBadge.textContent = native ? "Tauri Masaüstü" : "Web";
  document.title = `TEİAŞ-YHDA v${APP_VERSION}`;
  elements.nativeBulkOpen.hidden = !native;
  bindEvents();
  renderWorkspace();
  window.__YHDA_STATE__ = state;
  window.__YHDA_READY__ = true;
}

boot();
