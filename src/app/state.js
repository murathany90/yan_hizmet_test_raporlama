import { CONFIGS } from "./config-runtime.js";
import { loadDocumentSettings, patchDocumentSettings as patchSettings, resetDocumentSettings as resetSettings } from "./settings.js";

export const APP_VERSION = "0.7.1";

export function modeKey(service, plant) {
  return `${service}:${plant}`;
}

export function recordKey(service, plant, stepId, context = {}) {
  if (service !== "PFK" || !context.campaignId || !context.unitId) {
    return `${modeKey(service, plant)}:${stepId}`;
  }
  const runId = context.runId || "RUN-001";
  return `${modeKey(service, plant)}:CAMPAIGN:${context.campaignId}:UNIT:${context.unitId}:STEP:${stepId}:RUN:${runId}`;
}

export function configFor(service, plant) {
  const config = CONFIGS[modeKey(service, plant)];
  if (!config) throw new Error(`Desteklenmeyen hizmet/tesis kombinasyonu: ${service}/${plant}`);
  return config;
}

export function makeDefaultMetadata(service, plant) {
  const config = configFor(service, plant);
  const metadata = Object.fromEntries(config.meta.map(([key, , , defaultValue]) => [key, defaultValue ?? ""]));
  metadata.TEST_SERVICE = service;
  metadata.PLANT_TYPE = plant;
  // YHDA_VERSION eski CSV alıcıları için korunur; yeni üretim YDA adını kullanır.
  metadata.YDA_VERSION = APP_VERSION;
  metadata.YHDA_VERSION = APP_VERSION;
  metadata.REPORT_PREPARED_BY = String(metadata.REPORT_PREPARED_BY ?? "").replace(/^YHDA\b/i, "YDA");
  return metadata;
}

export function createAppState() {
  return {
    service: "PFK",
    plant: "HES",
    activeTab: "uploadPanel",
    records: new Map(),
    metadataByMode: new Map(),
    pfkCampaignsByMode: new Map(),
    openMenuServices: new Set(["PFK"]),
    graphSelection: new Map(),
    pfkChartScopeByMode: new Map(),
    chartViews: new Map(),
    chartOpenState: new Map(),
    chartSeriesVisibility: new Map(),
    documentSettings: loadDocumentSettings(),
    reportTypeByMode: new Map(),
    settingsContext: { service: "PFK", documentType: "report" },
    reportModel: null,
    reportDirty: true
  };
}

export function createPfkCampaign(metadata = {}, unitCount = 2) {
  const count = Math.max(2, Math.min(20, Number.parseInt(unitCount, 10) || 2));
  const date = String(metadata.TEST_DATE || new Date().toISOString().slice(0, 10)).replaceAll("-", "");
  const facilityId = String(metadata.TESIS_ADI || "TESIS").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "TESIS";
  return {
    enabled: true,
    campaignId: `PFK-${facilityId}-${date}`,
    facilityId,
    testScope: "MULTI_UNIT",
    eventId: "EVENT-001",
    runId: "RUN-001",
    units: Array.from({ length: count }, (_, index) => ({
      unitId: `U${index + 1}`,
      unitName: `Ünite ${index + 1}`,
      pnomMw: String(metadata.UNIT_PNOM_MW || metadata.PNOM_MW || ""),
      rpmaxMw: String(metadata.RPMAX_MW || ""),
      included: true
    }))
  };
}

export function getPfkCampaign(state, service = state.service, plant = state.plant) {
  return state.pfkCampaignsByMode.get(modeKey(service, plant)) ?? null;
}

export function setPfkCampaign(state, service, plant, campaign) {
  const key = modeKey(service, plant);
  if (service !== "PFK" || !campaign?.enabled) {
    state.pfkCampaignsByMode.delete(key);
  } else {
    const units = campaign.units?.length ? campaign.units : createPfkCampaign(getModeMetadata(state, service, plant)).units;
    state.pfkCampaignsByMode.set(key, {
      ...campaign,
      enabled: true,
      campaignId: String(campaign.campaignId || "PFK-CAMPAIGN").trim(),
      facilityId: String(campaign.facilityId || "TESIS").trim(),
      testScope: "MULTI_UNIT",
      eventId: String(campaign.eventId || "EVENT-001").trim(),
      runId: String(campaign.runId || "RUN-001").trim(),
      units: units.map((unit, index) => ({
        unitId: String(unit.unitId || `U${index + 1}`).trim().toUpperCase(),
        unitName: String(unit.unitName || `Ünite ${index + 1}`).trim(),
        pnomMw: String(unit.pnomMw ?? unit.pnomMW ?? ""),
        rpmaxMw: String(unit.rpmaxMw ?? unit.rpmaxMW ?? ""),
        included: unit.included !== false
      }))
    });
  }
  state.reportDirty = true;
  return getPfkCampaign(state, service, plant);
}

export function getModeMetadata(state, service = state.service, plant = state.plant) {
  const key = modeKey(service, plant);
  if (!state.metadataByMode.has(key)) {
    state.metadataByMode.set(key, makeDefaultMetadata(service, plant));
  }
  return state.metadataByMode.get(key);
}

export function patchModeMetadata(state, service, plant, values) {
  const metadata = getModeMetadata(state, service, plant);
  const allowed = new Set(configFor(service, plant).meta.map(([key]) => key));
  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key) || ["TEST_SERVICE", "PLANT_TYPE", "YDA_VERSION", "YHDA_VERSION"].includes(key)) {
      metadata[key] = value;
    }
  }
  metadata.TEST_SERVICE = service;
  metadata.PLANT_TYPE = plant;
  metadata.YDA_VERSION = APP_VERSION;
  metadata.YHDA_VERSION = APP_VERSION;
  metadata.REPORT_PREPARED_BY = String(metadata.REPORT_PREPARED_BY ?? "").replace(/^YHDA\b/i, "YDA");
  state.reportDirty = true;
  return metadata;
}

export function recordsForMode(state, service = state.service, plant = state.plant) {
  const config = configFor(service, plant);
  const campaign = getPfkCampaign(state, service, plant);
  if (service === "PFK" && campaign?.enabled) {
    return campaign.units.filter((unit) => unit.included !== false).flatMap((unit) => config.steps
      .map((step) => state.records.get(recordKey(service, plant, step.id, { campaignId: campaign.campaignId, unitId: unit.unitId, runId: campaign.runId })))
      .filter(Boolean));
  }
  return config.steps
    .map((step) => state.records.get(recordKey(service, plant, step.id)))
    .filter(Boolean);
}

export function patchDocumentSettings(state, values) {
  state.documentSettings = patchSettings(state.documentSettings, values);
  state.reportDirty = true;
  return state.documentSettings;
}

export function resetDocumentSettings(state) {
  state.documentSettings = resetSettings();
  state.reportDirty = true;
  return state.documentSettings;
}
