import { CONFIGS } from "../app/config-v062.js";

export const REQUIRED_ROUTE_METADATA = ["TEST_SERVICE", "PLANT_TYPE", "STEP_ID"];
export const PFK_CAMPAIGN_METADATA = [
  "CAMPAIGN_ID", "FACILITY_ID", "TEST_SCOPE", "ENTITY_TYPE", "ENTITY_ID",
  "UNIT_ID", "UNIT_NAME", "UNIT_COUNT", "STEP_ID", "EVENT_ID", "RUN_ID"
];
const PFK_CAMPAIGN_MARKERS = PFK_CAMPAIGN_METADATA.filter((field) => !["STEP_ID", "UNIT_ID"].includes(field));

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
  let step = config.steps.find((candidate) => candidate.id === route.stepId);
  const legacySensitivityStepId = route.service === "PFK" && /^(SENS_|BESS_SENS_)/.test(route.stepId) ? route.stepId : "";
  if (!step && legacySensitivityStepId) step = config.steps.find((candidate) => candidate.id === "HASSASIYET");
  if (!step) {
    throw new Error(`${route.service} ${route.plant} için STEP_ID=${route.stepId} bulunamadı.`);
  }
  const markedCampaignFields = PFK_CAMPAIGN_MARKERS.filter((field) => String(metadata[field] ?? "").trim());
  if (route.service !== "PFK" && markedCampaignFields.length) {
    throw new Error("Kampanya/ünite metadata alanları yalnız PFK çok üniteli çalışma alanında kullanılabilir.");
  }
  const isPfkCampaign = route.service === "PFK" && markedCampaignFields.length > 0;
  if (!isPfkCampaign) return { ...route, stepId: step.id, configKey, config, step, legacySensitivityStepId, isPfkCampaign: false };

  const campaignMissing = PFK_CAMPAIGN_METADATA.filter((field) => !String(metadata[field] ?? "").trim());
  if (campaignMissing.length) {
    throw new Error(`PFK çok üniteli CSV metadata alanı eksik: ${campaignMissing.join(", ")}`);
  }
  const testScope = String(metadata.TEST_SCOPE).trim().toUpperCase();
  if (testScope !== "MULTI_UNIT") {
    throw new Error("PFK çok üniteli CSV için TEST_SCOPE=MULTI_UNIT olmalıdır.");
  }
  const unitCount = Number.parseInt(String(metadata.UNIT_COUNT).trim(), 10);
  if (!Number.isInteger(unitCount) || unitCount < 2) {
    throw new Error("PFK çok üniteli CSV için UNIT_COUNT en az 2 olmalıdır.");
  }
  return {
    ...route,
    stepId: step.id,
    configKey,
    config,
    step,
    isPfkCampaign: true,
    campaign: {
      campaignId: String(metadata.CAMPAIGN_ID).trim(),
      facilityId: String(metadata.FACILITY_ID).trim(),
      testScope,
      entityType: String(metadata.ENTITY_TYPE).trim(),
      entityId: String(metadata.ENTITY_ID).trim(),
      unitId: String(metadata.UNIT_ID).trim().toUpperCase(),
      unitName: String(metadata.UNIT_NAME).trim(),
      unitCount,
      eventId: String(metadata.EVENT_ID).trim(),
      runId: String(metadata.RUN_ID).trim(),
      legacySensitivityStepId
    }
  };
}
