import { strToU8, zipSync } from "fflate";
import { makeCsvTemplate } from "./parser.js";

function metadataForStep(service, plant, metadata, step, campaign = null, unit = null) {
  const result = {
    ...metadata,
    TEST_SERVICE: service,
    PLANT_TYPE: plant,
    STEP_ID: step.id,
    SAMPLE_PERIOD_MS: step.sampleMs
  };
  if (campaign && unit) {
    Object.assign(result, {
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
    });
  }
  return result;
}

function csvBytes(text) {
  return strToU8(text);
}

function plainCsv(headers, rows) {
  return `\uFEFF${headers.join(";")}\r\n${rows.map((row) => row.map((cell) => String(cell ?? "").replaceAll(";", ",")).join(";")).join("\r\n")}\r\n`;
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) return "NOT_AVAILABLE";
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function allTemplatesZip({ service, plant, config, metadata }) {
  const files = {};
  for (const step of config.steps) {
    const name = `${service}_${plant}_${step.id}.csv`;
    files[name] = csvBytes(makeCsvTemplate(metadataForStep(service, plant, metadata, step), step.columns));
  }
  return zipSync(files, { level: 6 });
}

export async function pfkCampaignTemplatesZip({ plant, config, metadata, campaign }) {
  const files = {};
  const manifestRows = [];
  for (const unit of campaign.units) {
    for (const step of config.steps) {
      const path = `${unit.unitId}/${step.id}.csv`;
      const bytes = csvBytes(makeCsvTemplate(metadataForStep("PFK", plant, metadata, step, campaign, unit), step.columns));
      files[path] = bytes;
      manifestRows.push([path, await sha256Hex(bytes), campaign.campaignId, campaign.facilityId, unit.unitId, unit.unitName, step.id, campaign.eventId, campaign.runId]);
    }
  }
  files["campaign.csv"] = csvBytes(plainCsv(
    ["CAMPAIGN_ID", "FACILITY_ID", "TEST_SCOPE", "UNIT_COUNT", "EVENT_ID", "RUN_ID"],
    [[campaign.campaignId, campaign.facilityId, "MULTI_UNIT", campaign.units.length, campaign.eventId, campaign.runId]]
  ));
  files["manifest.csv"] = csvBytes(plainCsv(
    ["FILE_NAME", "SHA256", "CAMPAIGN_ID", "FACILITY_ID", "UNIT_ID", "UNIT_NAME", "STEP_ID", "EVENT_ID", "RUN_ID"],
    manifestRows
  ));
  return zipSync(files, { level: 6 });
}

export { metadataForStep };
