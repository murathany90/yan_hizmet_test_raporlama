import { REPORT_VARIABLES } from "../app/config.js";
import { inferUnit } from "../utils/text.js";
import { isDraftMode } from "../criteria/procedures.js";
import { reportTitle, sectionsForReport } from "./templates/index.js";

function variableRows(configKey, config, metadata) {
  const configured = REPORT_VARIABLES[configKey] ?? config.meta.map(([key, description]) => [key, description, "CSV metadata / kullanıcı"]);
  return configured.map(([key, description, source]) => ({
    key,
    description,
    value: metadata[key] ?? "",
    unit: inferUnit(key, description),
    source: source || "CSV metadata / kullanıcı",
    field: `# ${key}`
  }));
}

function technicalData(metadata, variables) {
  const equipment = [{
    purpose: "Ölçüm / kayıt sistemi",
    brandModel: metadata.MEASUREMENT_DEVICE || "—",
    serialNo: metadata.MEASUREMENT_SOFTWARE || "—",
    calibration: [metadata.CALIBRATION_CERT_NO, metadata.CALIBRATION_DATE].filter(Boolean).join(" / ") || "—",
    accuracy: metadata.MEASUREMENT_ACCURACY_PERCENT ? `${metadata.MEASUREMENT_ACCURACY_PERCENT} %` : "—"
  }];
  const channels = variables.slice(0, 18).map((variable) => ({
    channel: variable.key,
    signal: variable.description,
    scale: variable.value || "—",
    unit: variable.unit || "—",
    source: variable.source,
    field: variable.field
  }));
  return { equipment, channels };
}

function officialStatus(records, missingSteps, draft) {
  if (draft) return "TASLAK / İNCELEME GEREKLİ";
  if (missingSteps.length || !records.length) return "İNCELEME GEREKLİ";
  if (records.some((record) => ["KALDI", "İNCELEME GEREKLİ", "TEKNİK ÖN DEĞERLENDİRME"].includes(record.status))) return "İNCELEME GEREKLİ";
  if (records.every((record) => record.status === "GEÇTİ")) return "İMZA ÖNCESİ";
  return "İNCELEME GEREKLİ";
}

function evaluationStatus(records, missingSteps, draft) {
  if (draft) return "TEKNİK ÖN DEĞERLENDİRME / TASLAK";
  if (missingSteps.length) return "EKSİK TEST";
  if (records.some((record) => record.status === "KALDI")) return "KALDI";
  if (records.length && records.every((record) => record.status === "GEÇTİ")) return "GEÇTİ";
  return "MÜHENDİSLİK DEĞERLENDİRMESİ GEREKLİ";
}

function campaignSummary(records, campaign, metadata) {
  if (!campaign) return null;
  const expectedPower = Number(metadata.PLANT_TOTAL_INSTALLED_MW || metadata.PNOM_MW || Number.NaN);
  const units = campaign.units.map((unit) => {
    const unitRecords = records.filter((record) => record.campaign?.unitId === unit.unitId);
    const latestPower = unitRecords.map((record) => record.metrics?.finalActivePowerMw).findLast(Number.isFinite) ?? Number.NaN;
    return {
      unitId: unit.unitId,
      unitName: unit.unitName,
      loadedSteps: unitRecords.length,
      expectedSteps: campaign.expectedSteps,
      status: unitRecords.length === campaign.expectedSteps && unitRecords.every((record) => record.status === "GEÇTİ") ? "GEÇTİ" : "İNCELEME GEREKLİ",
      activePowerMw: latestPower
    };
  });
  const totalActivePowerMw = units.map((unit) => unit.activePowerMw).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  return { ...campaign, units, totalActivePowerMw, expectedPowerMw: expectedPower, expectedPowerDifferenceMw: Number.isFinite(expectedPower) ? totalActivePowerMw - expectedPower : Number.NaN };
}

export function buildReportModel({ service, plant, config, metadata, reportType, reportNote, records, chartProvider, logoDataUrl = "", campaign = null }) {
  const configKey = `${service}:${plant}`;
  const expectedIds = config.steps.map((step) => step.id);
  const loadedIds = new Set(records.map((record) => record.step.id));
  const missingSteps = (campaign?.enabled
    ? campaign.units.flatMap((unit) => config.steps.filter((step) => !records.some((record) => record.step.id === step.id && record.sourceMetadata?.UNIT_ID === unit.unitId)).map((step) => ({ stepId: `${unit.unitId}/${step.id}`, name: step.name })))
    : config.steps.filter((step) => !loadedIds.has(step.id)).map((step) => ({ stepId: step.id, name: step.name })));
  const reportRecords = records.map((record) => ({
    stepId: record.step.id,
    name: record.sourceMetadata?.CAMPAIGN_ID && record.sourceMetadata?.UNIT_ID ? `${record.sourceMetadata.UNIT_ID} — ${record.step.name}` : record.step.name,
    kind: record.step.kind,
    filename: record.name,
    rowCount: record.rows.length,
    status: record.analysis.status,
    detail: record.analysis.detail,
    metrics: {
      ...(record.analysis.metrics ?? {}),
      finalActivePowerMw: record.rows.at(-1)?.active_power_mw
    },
    warnings: record.validation?.warnings ?? [],
    campaign: record.sourceMetadata?.CAMPAIGN_ID ? {
      campaignId: record.sourceMetadata.CAMPAIGN_ID,
      unitId: record.sourceMetadata.UNIT_ID,
      unitName: record.sourceMetadata.UNIT_NAME,
      runId: record.sourceMetadata.RUN_ID
    } : null,
    charts: chartProvider ? chartProvider(record) : []
  }));
  const activeCampaign = service === "PFK" && campaign?.enabled ? { ...campaign, expectedSteps: config.steps.length } : null;
  const draft = isDraftMode(service, plant);
  const variables = variableRows(configKey, config, metadata);
  return Object.freeze({
    schemaVersion: 2,
    appVersion: "0.6.1",
    createdAt: new Date().toISOString(),
    service,
    plant,
    configKey,
    reportType,
    title: reportTitle(service, plant, reportType),
    draft,
    reportNote,
    metadata: { ...metadata },
    expectedStepCount: activeCampaign ? config.steps.length * activeCampaign.units.length : expectedIds.length,
    loadedStepCount: reportRecords.length,
    missingSteps,
    overallStatus: evaluationStatus(reportRecords, missingSteps, draft),
    officialStatus: officialStatus(reportRecords, missingSteps, draft),
    records: reportRecords,
    variables,
    technicalData: technicalData(metadata, variables),
    campaign: activeCampaign,
    campaignSummary: campaignSummary(reportRecords, activeCampaign, metadata),
    sections: sectionsForReport({ service, plant, reportType, records: reportRecords, campaign: activeCampaign }),
    assets: { logoDataUrl },
    signatures: [
      { role: "TEİAŞ Gözlemcisi", name: "Ad Soyad / İmza" },
      { role: "Tesis Yetkilisi", name: "Ad Soyad / İmza" },
      { role: "Testi Gerçekleştiren", name: metadata.TEST_ENGINEER || "Ad Soyad / İmza" }
    ]
  });
}
