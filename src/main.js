import { CONFIGS, DETAILED_CRITERIA, MENU } from "./app/config.js";
import { TEIAS_LOGO_URL } from "./app/assets.js";
import {
  APP_VERSION,
  configFor,
  createPfkCampaign,
  createAppState,
  getModeMetadata,
  getPfkCampaign,
  modeKey,
  patchModeMetadata,
  recordKey,
  recordsForMode,
  setPfkCampaign
} from "./app/state.js";
import { ChartManager } from "./charts/engine.js";
import { controlsFor, isDraftMode, procedureFor } from "./criteria/procedures.js";
import { evaluateRecord } from "./analysis/evaluate.js";
import { hasUtf8Bom, makeCsvTemplate, parseCsv } from "./csv/parser.js";
import { resolveCsvRoute } from "./csv/metadata.js";
import { validateParsedCsv } from "./csv/validator.js";
import { allTemplatesZip, pfkCampaignTemplatesZip } from "./csv/templates.js";
import { askReplace, isTauriRuntime, openCsvFilesNative, saveBinary } from "./platform/files.js";
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

function updateCampaign(values) {
  const current = getPfkCampaign(state);
  if (!current) return;
  const next = { ...current, ...values };
  if (values.unitCount !== undefined) {
    const count = Math.max(2, Math.min(20, Number.parseInt(values.unitCount, 10) || 2));
    next.units = Array.from({ length: count }, (_, index) => current.units[index] ?? ({ unitId: `U${index + 1}`, unitName: `Ünite ${index + 1}` }));
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
    elements.pfkCampaignForm.append(campaignField(`unit-${index}`, `${unit.unitId} UNIT_NAME`, unit.unitName, (value) => {
      const nextUnits = campaign.units.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, unitName: value } : candidate);
      updateCampaign({ units: nextUnits });
    }));
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
  await saveBinary(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${state.service}_${state.plant}_${unit?.unitId ? `${unit.unitId}_` : ""}${step.id}.csv`, "text/csv;charset=utf-8");
}

async function downloadAllTemplates() {
  const config = configFor(state.service, state.plant);
  const zip = allTemplatesZip({ service: state.service, plant: state.plant, config, metadata: getModeMetadata(state) });
  await saveBinary(zip, `${state.service}_${state.plant}_tum_test_sablonlari.zip`, "application/zip");
  showToast(`${config.steps.length} test şablonu ZIP olarak hazırlandı.`, "success");
}

async function downloadPfkCampaignTemplates() {
  const campaign = getPfkCampaign(state);
  if (!campaign?.enabled) return;
  const zip = await pfkCampaignTemplatesZip({ plant: state.plant, config: configFor(state.service, state.plant), metadata: getModeMetadata(state), campaign });
  await saveBinary(zip, `PFK_${state.plant}_${safeFilename(campaign.campaignId)}_kampanya_sablonlari.zip`, "application/zip");
  showToast(`${campaign.units.length} üniteli PFK kampanya şablonları ZIP olarak hazırlandı.`, "success");
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
    const existingCampaign = getPfkCampaign(state, route.service, route.plant);
    const units = existingCampaign?.campaignId === route.campaign.campaignId
      ? existingCampaign.units.map((unit) => unit.unitId === route.campaign.unitId ? { ...unit, unitName: route.campaign.unitName } : unit)
      : Array.from({ length: route.campaign.unitCount }, (_, index) => ({ unitId: `U${index + 1}`, unitName: `Ünite ${index + 1}` }));
    const unitIndex = units.findIndex((unit) => unit.unitId === route.campaign.unitId);
    if (unitIndex >= 0) units[unitIndex] = { unitId: route.campaign.unitId, unitName: route.campaign.unitName };
    else units.push({ unitId: route.campaign.unitId, unitName: route.campaign.unitName });
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
  const matching = campaign.units.map((unit) => state.records.get(recordKey("PFK", state.plant, record.step.id, { campaignId: campaign.campaignId, unitId: unit.unitId, runId: campaign.runId }))).filter(Boolean);
  if (!matching.length) return record;
  const rows = matching[0].rows.map((baseRow, index) => {
    const row = { time_s: baseRow.time_s };
    matching.forEach((item) => { row[item.sourceMetadata.UNIT_ID] = item.rows[index]?.active_power_mw; });
    row.plant_total_active_power_mw = matching.reduce((sum, item) => sum + (Number(item.rows[index]?.active_power_mw) || 0), 0);
    row.expected_active_power_mw = Number(getModeMetadata(state).PLANT_TOTAL_INSTALLED_MW || getModeMetadata(state).PNOM_MW || Number.NaN);
    return row;
  });
  const seriesSets = scope === "comparison"
    ? [{ title: "Ünite Aktif Güç Karşılaştırması", series: matching.map((item) => [item.sourceMetadata.UNIT_ID, `${item.sourceMetadata.UNIT_ID} Aktif Güç`, "left", "MW"]) }]
    : [{ title: "Santral Toplam P / Beklenen P", series: [["plant_total_active_power_mw", "Tesis Toplam P", "left", "MW"], ["expected_active_power_mw", "Beklenen P", "left", "MW"]] }];
  return { ...record, name: `${record.step.name} — ${scope === "comparison" ? "Ünite karşılaştırması" : "Santral toplamı"}`, rows, seriesSets };
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
}

function renderReportTypes() {
  const types = configFor(state.service, state.plant).reports;
  const previous = elements.reportType.value;
  elements.reportType.replaceChildren();
  for (const type of types) {
    const option = element("option", { text: type });
    option.value = type;
    elements.reportType.append(option);
  }
  if (types.includes(previous)) elements.reportType.value = previous;
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
    chartProvider: (record) => chartManager.renderRecordImages(record, state.service),
    campaign: getPfkCampaign(state),
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
      const records = recordsForMode(state).filter((record) => record.sourceMetadata?.UNIT_ID === unit.unitId);
      const model = buildReportModel({
        service: "PFK",
        plant: state.plant,
        config: configFor("PFK", state.plant),
        metadata: { ...getModeMetadata(state), UNIT_ID: unit.unitId },
        reportType: "Test Sertifikası",
        reportNote: elements.reportNote.value,
        records,
        chartProvider: (record) => chartManager.renderRecordImages(record, "PFK"),
        ...assets
      });
      const filename = `${unit.unitId}_PFK_Test_Sertifikasi.docx`;
      files[filename] = new Uint8Array(await (await createDocxBlob(model)).arrayBuffer());
      manifestRows.push(`${unit.unitId};${unit.unitName};${filename};${records.length}`);
    }
    files["sertifika_manifest.csv"] = new TextEncoder().encode(`\uFEFF${manifestRows.join("\r\n")}\r\n`);
    await saveBinary(zipSync(files, { level: 6 }), `PFK_${safeFilename(campaign.campaignId)}_unit_sertifikalari.zip`, "application/zip");
    showToast("Ünite sertifikaları ZIP olarak hazırlandı.", "success");
  } catch (error) {
    showToast(`Sertifika ZIP'i oluşturulamadı: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = initialText;
  }
}

async function currentReport() {
  return state.reportDirty || !state.reportModel ? await buildCurrentReport() : state.reportModel;
}

async function previewReport() {
  try {
    const model = await buildCurrentReport();
    elements.reportPaper.innerHTML = renderReportPreview(model);
    showToast("Rapor önizlemesi oluşturuldu.", "success");
  } catch (error) {
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
    if (kind === "pdf") await saveBinary(await createPdfBlob(model), `${base}.pdf`, "application/pdf");
    else await saveBinary(await createDocxBlob(model), `${base}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    showToast(`${kind === "pdf" ? "PDF" : "Word"} raporu hazırlandı.`, "success");
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
  elements.printReport.addEventListener("click", async () => {
    if (state.reportDirty || !state.reportModel) await previewReport();
    setActiveTab("reportsPanel");
    window.print();
  });
  elements.reportType.addEventListener("change", () => { state.reportDirty = true; });
  elements.reportNote.addEventListener("input", () => { state.reportDirty = true; });
  elements.sideToggle.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 620px)").matches) document.body.classList.toggle("mobile-menu-open");
    else document.body.classList.toggle("sidebar-collapsed");
  });
}

function cacheElements() {
  [
    "sidebar", "crumb", "workTitle", "modeTag", "metaForm", "pfkCampaignCard", "pfkCampaignSetup", "pfkCampaignZip", "pfkCampaignForm", "bulkFiles", "nativeBulkOpen", "downloadAllTemplates", "bulkSummary", "stepList",
    "graphStep", "graphInfo", "chartArea", "reportType", "reportNote", "makeReport", "pdfReport", "docxReport", "printReport",
    "reportPaper", "criteriaContent", "toastRegion", "sideToggle", "teiasLogo", "runtimeBadge", "pfkChartScope", "pfkCampaignCertificates"
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
