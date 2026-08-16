import { REPORT_VARIABLES } from "../app/config-v062.js";
import { interpolateDocumentText } from "../app/settings.js";
import { inferUnit } from "../utils/text.js";
import { isDraftMode } from "../criteria/procedures.js";
import { reportTitle, sectionsForReport } from "./templates/index.js";

const SIGNAL_LABELS = {
  grid_frequency_hz: "Şebeke frekansı", test_frequency_hz: "Simüle frekans", active_power_mw: "Aktif çıkış gücü",
  active_power_reference_mw: "Aktif güç referansı", guide_vane_pct: "Ayar kanadı açıklığı", fuel_valve_pct: "Yakıt vanası",
  regulator_valve_pct: "Reglaj vanası", steam_pressure_bar: "Buhar basıncı", steam_temperature_c: "Buhar sıcaklığı",
  reactive_power_mvar: "Reaktif güç", total_reactive_power_mvar: "Toplam reaktif güç", system_voltage_kv: "Sistem gerilimi",
  bus_voltage_kv: "Bara gerilimi", voltage_reference_kv: "Gerilim referansı", agc_setpoint_mw: "AGC setpoint",
  setpoint_feedback_mw: "Setpoint geri bildirimi", soc_pct: "Şarj durumu", dc_power_mw: "DC güç"
};

function variableRows(configKey, config, metadata) {
  const configured = REPORT_VARIABLES[configKey] ?? config.meta.map(([key, description]) => [key, description, "CSV metadata / kullanıcı"]);
  return configured.map(([key, description, source]) => ({ key, description, value: metadata[key] ?? "", unit: inferUnit(key, description), source: source || "CSV metadata / kullanıcı", field: `# ${key}` }));
}

function keyForChannel(key) { return key.toUpperCase().replace(/[^A-Z0-9]/g, "_"); }

function channelRows(records, metadata) {
  const columns = [...new Set(records.flatMap((record) => record.step.columns))].filter((column) => !["zaman", "sira_no", "time_s"].includes(column));
  return columns.map((channel) => {
    const key = keyForChannel(channel);
    const signal = SIGNAL_LABELS[channel] ?? channel.replaceAll("_", " ");
    return {
      signal,
      connectionPoint: metadata[`CHANNEL_${key}_CONNECTION`] || "CSV kayıt kanalı",
      measurementRange: metadata[`CHANNEL_${key}_RANGE`] || "—",
      signalType: metadata[`CHANNEL_${key}_TYPE`] || "Analog",
      scaleM: metadata[`CHANNEL_${key}_M`] || "1",
      scaleB: metadata[`CHANNEL_${key}_B`] || "0",
      unit: inferUnit(channel, signal) || "—"
    };
  });
}

function technicalData(metadata, records) {
  return {
    equipment: [{
      deviceType: metadata.MEASUREMENT_DEVICE_TYPE || "Veri toplama cihazı",
      brand: metadata.MEASUREMENT_BRAND || "—",
      model: metadata.MEASUREMENT_MODEL || metadata.MEASUREMENT_DEVICE || "—",
      serialNo: metadata.MEASUREMENT_SERIAL_NO || "—",
      software: metadata.MEASUREMENT_SOFTWARE || "—",
      accuracyClass: metadata.MEASUREMENT_ACCURACY_PERCENT ? `${metadata.MEASUREMENT_ACCURACY_PERCENT} %` : "—",
      calibrationNo: metadata.CALIBRATION_NO || metadata.CALIBRATION_CERT_NO || "—",
      calibrationDate: metadata.CALIBRATION_DATE || "—"
    }],
    channels: channelRows(records, metadata)
  };
}

function officialStatus(records, missingSteps, draft) {
  if (draft) return "TASLAK / İNCELEME GEREKLİ";
  if (missingSteps.length || !records.length) return "İNCELEME GEREKLİ";
  if (records.some((record) => ["KALDI", "İNCELEME GEREKLİ", "TEKNİK ÖN DEĞERLENDİRME"].includes(record.status))) return "İNCELEME GEREKLİ";
  return records.every((record) => record.status === "GEÇTİ") ? "İMZA ÖNCESİ" : "İNCELEME GEREKLİ";
}

function evaluationStatus(records, missingSteps, draft) {
  if (draft) return "TEKNİK ÖN DEĞERLENDİRME / TASLAK";
  if (missingSteps.length) return "EKSİK TEST";
  if (records.some((record) => record.status === "KALDI")) return "KALDI";
  if (records.length && records.every((record) => record.status === "GEÇTİ")) return "GEÇTİ";
  return "MÜHENDİSLİK DEĞERLENDİRMESİ GEREKLİ";
}

function latestExpectedPower(record, unit, metadata) {
  const reference = record.rows.map((row) => row.active_power_reference_mw).findLast(Number.isFinite);
  if (Number.isFinite(reference)) return reference;
  const pset = Number(record.sourceMetadata?.PSET_MW ?? (record.step.id.includes("MAX") ? metadata.PSET_MAX_MW : metadata.PSET_MIN_MW));
  const fallbackPset = Number.isFinite(pset) ? pset : record.rows[0]?.active_power_mw;
  const rpmax = Number(unit.rpmaxMw ?? metadata.RPMAX_MW);
  if (!Number.isFinite(fallbackPset)) return Number.NaN;
  if (!record.step.id.includes("NEG200") && !record.step.id.includes("POS200")) return fallbackPset;
  return fallbackPset + (record.step.id.includes("NEG200") ? 1 : -1) * (Number.isFinite(rpmax) ? rpmax : 0);
}

function campaignSummary(records, campaign, metadata) {
  if (!campaign) return null;
  const units = campaign.units.filter((unit) => unit.included !== false).map((unit) => {
    const unitRecords = records.filter((record) => record.sourceMetadata?.UNIT_ID === unit.unitId);
    const last = unitRecords.at(-1);
    const activePowerMw = last?.analysis?.metrics?.finalActivePowerMw
      ?? last?.rows?.at(-1)?.active_power_mw
      ?? Number.NaN;
    const expectedPowerMw = last ? latestExpectedPower(last, unit, metadata) : Number.NaN;
    return {
      ...unit, loadedSteps: unitRecords.length, expectedSteps: campaign.expectedSteps,
      status: unitRecords.length === campaign.expectedSteps && unitRecords.every((record) => record.status === "GEÇTİ") ? "GEÇTİ" : "İNCELEME GEREKLİ",
      activePowerMw, expectedPowerMw
    };
  });
  const sum = (key) => units.map((unit) => unit[key]).filter(Number.isFinite).reduce((total, value) => total + value, 0);
  const totalActivePowerMw = sum("activePowerMw");
  const expectedPowerMw = sum("expectedPowerMw");
  return { ...campaign, units, totalActivePowerMw, expectedPowerMw, expectedPowerDifferenceMw: totalActivePowerMw - expectedPowerMw };
}

function applyDefaults(metadata, settings) {
  return {
    ...metadata,
    TESIS_ADI: metadata.TESIS_ADI || settings.defaults.facilityName,
    COMPANY: metadata.COMPANY || settings.defaults.operatorName,
    CITY: metadata.CITY || settings.city || settings.defaults.city,
    TURBINE_GENERATOR_DESCRIPTION: metadata.TURBINE_GENERATOR_DESCRIPTION || settings.defaults.turbineGenerator,
    UNIT_OPERATION_MODE: metadata.UNIT_OPERATION_MODE || settings.defaults.unitOperationMode,
    MEASUREMENT_DEVICE: metadata.MEASUREMENT_DEVICE || settings.defaults.equipmentDefaults,
    REPORT_PREPARED_BY: metadata.REPORT_PREPARED_BY || settings.preparedBy
  };
}

export function buildReportModel({ service, plant, config, metadata, reportType, reportNote, records, chartProvider, logoDataUrl = "", campaign = null, settings }) {
  const documentSettings = settings ?? { texts: {}, defaults: {}, defaultSignatureRoles: "" };
  const effectiveMetadata = applyDefaults(metadata, documentSettings);
  const expectedIds = config.steps.map((step) => step.id);
  const activeCampaign = service === "PFK" && campaign?.enabled ? { ...campaign, expectedSteps: config.steps.length } : null;
  const missingSteps = activeCampaign
    ? activeCampaign.units.filter((unit) => unit.included !== false).flatMap((unit) => config.steps.filter((step) => !records.some((record) => record.step.id === step.id && record.sourceMetadata?.UNIT_ID === unit.unitId)).map((step) => ({ stepId: `${unit.unitId}/${step.id}`, name: step.name })))
    : config.steps.filter((step) => !records.some((record) => record.step.id === step.id)).map((step) => ({ stepId: step.id, name: step.name }));
  const reportRecords = records.map((record) => ({
    stepId: record.step.id,
    name: record.sourceMetadata?.CAMPAIGN_ID && record.sourceMetadata?.UNIT_ID ? `${record.sourceMetadata.UNIT_ID} — ${record.step.name}` : record.step.name,
    kind: record.step.kind, filename: record.name, rowCount: record.rows.length, status: record.analysis.status, detail: record.analysis.detail,
    metrics: { ...(record.analysis.metrics ?? {}), finalActivePowerMw: record.rows.at(-1)?.active_power_mw },
    warnings: record.validation?.warnings ?? [], evidence: record.evidence ?? null,
    campaign: record.sourceMetadata?.CAMPAIGN_ID ? { campaignId: record.sourceMetadata.CAMPAIGN_ID, unitId: record.sourceMetadata.UNIT_ID, unitName: record.sourceMetadata.UNIT_NAME, runId: record.sourceMetadata.RUN_ID } : null,
    charts: chartProvider ? chartProvider(record) : []
  }));
  const draft = isDraftMode(service, plant);
  const values = {
    TESIS_ADI: effectiveMetadata.TESIS_ADI, UNIT_NAME: effectiveMetadata.UNIT_ID, TEST_START_DATE: effectiveMetadata.TEST_DATE,
    TEST_END_DATE: effectiveMetadata.TEST_END_DATE || effectiveMetadata.TEST_DATE, CITY: effectiveMetadata.CITY,
    PLANT_TYPE: plant, REGULATION_REFERENCE: documentSettings.regulationReference
  };
  const text = Object.fromEntries(Object.entries(documentSettings.texts ?? {}).map(([key, template]) => [key, interpolateDocumentText(template, values)]));
  const roles = String(documentSettings.defaultSignatureRoles || "TEİAŞ Gözlemcisi; Tesis Yetkilisi; Testi Gerçekleştiren").split(";").map((role) => role.trim()).filter(Boolean);
  return Object.freeze({
    schemaVersion: 3, appVersion: "0.6.2", createdAt: new Date().toISOString(), service, plant, configKey: `${service}:${plant}`,
    reportType, title: reportTitle(service, plant, reportType), draft, reportNote, metadata: effectiveMetadata,
    expectedStepCount: activeCampaign ? config.steps.length * activeCampaign.units.filter((unit) => unit.included !== false).length : expectedIds.length,
    loadedStepCount: reportRecords.length, missingSteps, overallStatus: evaluationStatus(reportRecords, missingSteps, draft), officialStatus: officialStatus(reportRecords, missingSteps, draft),
    records: reportRecords, variables: variableRows(`${service}:${plant}`, config, effectiveMetadata), technicalData: technicalData(effectiveMetadata, records),
    campaign: activeCampaign, campaignSummary: campaignSummary(records, activeCampaign, effectiveMetadata),
    evidence: reportRecords.map((record) => record.evidence).filter(Boolean), sections: sectionsForReport({ service, plant, reportType, records: reportRecords, campaign: activeCampaign }),
    settings: documentSettings, documentText: text, assets: { logoDataUrl: documentSettings.showLogo === false ? "" : logoDataUrl },
    watermark: documentSettings.showWatermark !== false ? { text: "TEİAŞ", opacity: Math.max(0, Math.min(0.25, Number(documentSettings.watermarkOpacity) || 0.08)) } : null,
    signatures: roles.map((role, index) => ({ role, name: index === roles.length - 1 ? effectiveMetadata.TEST_ENGINEER || "Ad Soyad / İmza" : "Ad Soyad / İmza" }))
  });
}
