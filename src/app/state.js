import { CONFIGS } from "./config.js";

export const APP_VERSION = "0.6.0";

export function modeKey(service, plant) {
  return `${service}:${plant}`;
}

export function recordKey(service, plant, stepId) {
  return `${modeKey(service, plant)}:${stepId}`;
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
  metadata.YHDA_VERSION = APP_VERSION;
  return metadata;
}

export function createAppState() {
  return {
    service: "PFK",
    plant: "HES",
    activeTab: "uploadPanel",
    records: new Map(),
    metadataByMode: new Map(),
    openMenuServices: new Set(["PFK"]),
    graphSelection: new Map(),
    chartViews: new Map(),
    chartOpenState: new Map(),
    reportModel: null,
    reportDirty: true
  };
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
    if (allowed.has(key) || ["TEST_SERVICE", "PLANT_TYPE", "YHDA_VERSION"].includes(key)) {
      metadata[key] = value;
    }
  }
  metadata.TEST_SERVICE = service;
  metadata.PLANT_TYPE = plant;
  metadata.YHDA_VERSION = APP_VERSION;
  state.reportDirty = true;
  return metadata;
}

export function recordsForMode(state, service = state.service, plant = state.plant) {
  const config = configFor(service, plant);
  return config.steps
    .map((step) => state.records.get(recordKey(service, plant, step.id)))
    .filter(Boolean);
}
