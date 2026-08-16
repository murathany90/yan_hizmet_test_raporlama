import { CONFIGS } from "../app/config.js";

export const REQUIRED_ROUTE_METADATA = ["TEST_SERVICE", "PLANT_TYPE", "STEP_ID"];

export function normalizeRouteMetadata(metadata) {
  return {
    service: String(metadata.TEST_SERVICE ?? "").trim().toUpperCase(),
    plant: String(metadata.PLANT_TYPE ?? "").trim().toUpperCase(),
    stepId: String(metadata.STEP_ID ?? "").trim().toUpperCase()
  };
}

export function resolveCsvRoute(metadata, configs = CONFIGS) {
  const missing = REQUIRED_ROUTE_METADATA.filter((field) => !String(metadata[field] ?? "").trim());
  if (missing.length) {
    throw new Error(`CSV metadata alanı eksik: ${missing.join(", ")}`);
  }

  const route = normalizeRouteMetadata(metadata);
  const configKey = `${route.service}:${route.plant}`;
  const config = configs[configKey];
  if (!config) {
    throw new Error(`Desteklenmeyen TEST_SERVICE/PLANT_TYPE: ${route.service}/${route.plant}`);
  }
  const step = config.steps.find((candidate) => candidate.id === route.stepId);
  if (!step) {
    throw new Error(`${route.service} ${route.plant} için STEP_ID=${route.stepId} bulunamadı.`);
  }
  return { ...route, configKey, config, step };
}

