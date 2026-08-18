import { REPORT_VARIABLES } from "../app/config-runtime.js";
import { documentTextTemplates, interpolateDocumentText, isMinutesReport } from "../app/settings.js";
import { inferUnit } from "../utils/text.js";
import { isDraftMode } from "../criteria/procedures.js";
import { pfkAdapterMetadataDefaults, pfkProcessSignalDefinitions } from "../criteria/pfk-plant-adapters.js";
import { pfkEventFigureRecord } from "../charts/series.js";
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

function channelRows(records, metadata, plant) {
  const columns = [...new Set(records.flatMap((record) => record.step.columns))].filter((column) => !["zaman", "sira_no", "time_s"].includes(column));
  const adapterColumns = plant ? pfkProcessSignalDefinitions(plant).map((signal) => signal.key) : [];
  const visibleColumns = [...new Set([...columns, ...adapterColumns.filter((column) => columns.includes(column))])];
  if (!visibleColumns.length) return [{ signal: "Bilgi girilmedi", connectionPoint: "Bilgi girilmedi", measurementRange: "Bilgi girilmedi", signalType: "Bilgi girilmedi", scaleM: "Bilgi girilmedi", scaleB: "Bilgi girilmedi", unit: "Bilgi girilmedi" }];
  return visibleColumns.map((channel) => {
    const key = keyForChannel(channel);
    const signal = SIGNAL_LABELS[channel] ?? channel.replaceAll("_", " ");
    return {
      signal,
      connectionPoint: metadata[`CHANNEL_${key}_CONNECTION`] || "Bilgi girilmedi",
      measurementRange: metadata[`CHANNEL_${key}_RANGE`] || "Bilgi girilmedi",
      signalType: metadata[`CHANNEL_${key}_TYPE`] || "Bilgi girilmedi",
      scaleM: metadata[`CHANNEL_${key}_M`] || "Bilgi girilmedi",
      scaleB: metadata[`CHANNEL_${key}_B`] || "Bilgi girilmedi",
      unit: inferUnit(channel, signal) || "Bilgi girilmedi"
    };
  });
}

function technicalData(metadata, records, plant) {
  const accuracy = String(metadata.MEASUREMENT_ACCURACY_PERCENT ?? "").trim();
  const equipment = [{
    deviceType: metadata.MEASUREMENT_DEVICE_TYPE || "Veri toplama cihazı",
    brand: metadata.MEASUREMENT_BRAND || "—",
    model: metadata.MEASUREMENT_MODEL || metadata.MEASUREMENT_DEVICE || "—",
    serialNo: metadata.MEASUREMENT_SERIAL_NO || "—",
    software: metadata.MEASUREMENT_SOFTWARE || "—",
    accuracyClass: accuracy ? (/^[\d.,]+$/.test(accuracy) ? `${accuracy} %` : accuracy) : "—",
    calibrationNo: metadata.CALIBRATION_NO || metadata.CALIBRATION_CERT_NO || "—",
    calibrationDate: metadata.CALIBRATION_DATE || "—"
  }];
  Object.entries(metadata).filter(([key]) => /^TRANSDUCER_\d+$/.test(key)).sort(([left], [right]) => left.localeCompare(right)).forEach(([, value]) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    const [, brand = "—", model = "—", serialNo = "—"] = text.match(/^([^\s]+)\s+(.+?)(?:\s+\(([^)]+)\))?$/) ?? [];
    equipment.push({ deviceType: "Ölçü transdüseri", brand, model, serialNo, software: "—", accuracyClass: "—", calibrationNo: "—", calibrationDate: "—" });
  });
  const generator = String(metadata.SIGNAL_GENERATOR ?? "").trim();
  if (generator) {
    const omicron = generator.match(/(Omicron)\s+(CMC\s*\d+)\s*(?:\(([^)]+)\))?/i);
    if (omicron) equipment.push({ deviceType: "Frekans simülasyon cihazı", brand: omicron[1], model: omicron[2], serialNo: omicron[3] || "—", software: "—", accuracyClass: "—", calibrationNo: "—", calibrationDate: "—" });
    const scada = generator.match(/(?:ve|\/|;)\s*([^;]+Scada)/i);
    if (scada) equipment.push({ deviceType: "Frekans simülasyon yazılımı", brand: "Alstom", model: scada[1].replace(/^Alstom\s*/i, "") || "Scada", serialNo: "—", software: scada[1], accuracyClass: "—", calibrationNo: "—", calibrationDate: "—" });
  }
  const computer = String(metadata.RECORDING_COMPUTER ?? "").trim();
  if (computer) {
    const [brand = "—", ...modelParts] = computer.split(/\s+/);
    equipment.push({ deviceType: "Veri kayıt bilgisayarı", brand, model: modelParts.join(" ") || "—", serialNo: "—", software: "—", accuracyClass: "—", calibrationNo: "—", calibrationDate: "—" });
  }
  return {
    equipment,
    channels: channelRows(records, metadata, plant)
  };
}

function mergeMetadata(primary = {}, fallback = {}) {
  const merged = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (value === 0 || value === false || String(value ?? "").trim()) merged[key] = value;
  }
  return merged;
}

function officialStatus(records, missingSteps, draft, completeness = []) {
  if (draft) return "TASLAK / İNCELEME GEREKLİ";
  if (completeness.length) return "TASLAK / EKSİK BİLGİ";
  if (missingSteps.length || !records.length) return "İNCELEME GEREKLİ";
  if (records.some((record) => ["KALDI", "İNCELEME GEREKLİ", "TEKNİK ÖN DEĞERLENDİRME"].includes(record.status))) return "İNCELEME GEREKLİ";
  return records.every((record) => record.status === "GEÇTİ") ? "İMZA ÖNCESİ" : "İNCELEME GEREKLİ";
}

function completenessChecks(service, metadata, records, missingSteps, plant) {
  if (service !== "PFK") return [];
  const required = [
    ["TESIS_ADI", "Tesis adı"], ["UNIT_ID", "Ünite kimliği"], ["PNOM_MW", "Pnom"], ["RPMAX_MW", "RPmax"],
    ["REPORT_NO", "Rapor numarası"], ["TEST_DATE", "Test tarihi"], ["TEST_TEAM", "Test katılımcıları"]
  ];
  const missingMetadata = required.filter(([key]) => !String(metadata[key] ?? "").trim()).map(([key, label]) => ({ kind: "metadata", key, label }));
  const missingEvents = records.flatMap((record) => record.stepId === "MAKSIMUM_REZERV" || record.stepId === "MINIMUM_REZERV"
    ? ["NEG200", "POS200"].filter((eventId) => !record.events?.some((event) => event.eventId === eventId)).map((eventId) => ({ kind: "event", key: `${record.stepId}/${eventId}`, label: `${record.name}: ${eventId} olayı` }))
    : []);
  const processSignals = pfkProcessSignalDefinitions(plant);
  const missingProcessSignals = records.flatMap((record) => ["reserve_sequence", "sensitivity", "validation", "bess_sensitivity"].includes(record.kind)
    ? processSignals.filter((signal) => !record.columns?.includes(signal.key)).map((signal) => ({ kind: "signal", key: `${record.stepId}/${signal.key}`, label: `${record.name}: ${signal.label} kanalı` }))
    : []);
  return [...missingMetadata, ...missingEvents, ...missingProcessSignals, ...missingSteps.map((step) => ({ kind: "step", key: step.stepId, label: step.name }))];
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
  const equipment = settings.defaults?.equipment ?? {};
  return {
    ...metadata,
    TESIS_ADI: metadata.TESIS_ADI || settings.defaults.facilityName,
    COMPANY: metadata.COMPANY || settings.defaults.operatorName,
    CITY: metadata.CITY || settings.city || settings.defaults.city,
    TURBINE_GENERATOR_DESCRIPTION: metadata.TURBINE_GENERATOR_DESCRIPTION || settings.defaults.turbineGenerator,
    UNIT_OPERATION_MODE: metadata.UNIT_OPERATION_MODE || settings.defaults.unitOperationMode,
    MEASUREMENT_DEVICE: metadata.MEASUREMENT_DEVICE || settings.defaults?.equipmentDefaults,
    MEASUREMENT_DEVICE_TYPE: metadata.MEASUREMENT_DEVICE_TYPE || equipment.deviceType,
    MEASUREMENT_BRAND: metadata.MEASUREMENT_BRAND || equipment.brand,
    MEASUREMENT_MODEL: metadata.MEASUREMENT_MODEL || equipment.model,
    MEASUREMENT_SERIAL_NO: metadata.MEASUREMENT_SERIAL_NO || equipment.serialNo,
    MEASUREMENT_SOFTWARE: metadata.MEASUREMENT_SOFTWARE || equipment.software,
    MEASUREMENT_ACCURACY_PERCENT: metadata.MEASUREMENT_ACCURACY_PERCENT || equipment.accuracyClass,
    CALIBRATION_NO: metadata.CALIBRATION_NO || equipment.calibrationNo,
    CALIBRATION_DATE: metadata.CALIBRATION_DATE || equipment.calibrationDate,
    REPORT_PREPARED_BY: metadata.REPORT_PREPARED_BY || settings.preparedBy
  };
}

function campaignMetadata(campaign) {
  if (!campaign) return {};
  return {
    ...(campaign.metadata ?? {}),
    CAMPAIGN_ID: campaign.campaignId,
    FACILITY_ID: campaign.facilityId,
    TEST_SCOPE: campaign.testScope,
    EVENT_ID: campaign.eventId,
    RUN_ID: campaign.runId
  };
}

function csvRange(records) {
  const rows = records.flatMap((record) => record.rows ?? []);
  const first = rows.at(0);
  const last = rows.at(-1);
  const display = (row) => row?.zaman ?? row?.timestamp ?? "";
  return { start: display(first), end: display(last) };
}

function resolveDocumentDates(metadata, records) {
  const range = csvRange(records);
  const testStart = metadata.TEST_START_DATE || metadata.TEST_DATE || range.start || "";
  const testEnd = metadata.TEST_END_DATE || metadata.TEST_DATE || range.end || testStart;
  const documentDate = metadata.DOCUMENT_DATE || metadata.TEST_DATE || testStart;
  return {
    ...metadata,
    TEST_START_DATE: testStart,
    TEST_END_DATE: testEnd,
    DOCUMENT_DATE: documentDate,
    VALIDATION_START_DATETIME: metadata.VALIDATION_START_DATETIME || metadata.VALIDATION_START || range.start || "",
    VALIDATION_END_DATETIME: metadata.VALIDATION_END_DATETIME || metadata.VALIDATION_END || range.end || ""
  };
}

function participantRows(metadata) {
  const source = String(metadata.PARTICIPANTS || metadata.TEST_TEAM || "").trim();
  if (!source) return [{ name: "Ad Soyad", company: "Kurum", title: "Ünvan", role: "Rol", signature: "İmza" }];
  return source.split(";").map((item) => item.trim()).filter(Boolean).map((item, index) => {
    const [name, company, title, role] = item.split("|").map((part) => part.trim());
    return { name: name || "Ad Soyad", company: company || "Kurum", title: title || "Ünvan", role: role || (index === 0 ? "Test katılımcısı" : "Katılımcı"), signature: "İmza" };
  });
}

function eventReportRecord(record, event, chartProvider) {
  const eventLabel = event.eventId === "NEG200" ? "Δf = −200 mHz" : "Δf = +200 mHz";
  const synthetic = pfkEventFigureRecord(record, event);
  const { chartRows, ...metrics } = event;
  return {
    eventId: event.eventId,
    label: eventLabel,
    status: event.status,
    detail: event.detail,
    metrics,
    metadata: record.metadata,
    charts: chartProvider ? chartProvider(synthetic) : []
  };
}

export function buildReportModel({ service, plant, config, metadata, reportType, reportNote, records, chartProvider, logoDataUrl = "", campaign = null, settings }) {
  const documentSettings = settings ?? { texts: {}, defaults: {}, defaultSignatureRoles: "" };
  const expectedIds = config.steps.map((step) => step.id);
  const activeCampaign = service === "PFK" && campaign?.enabled ? { ...campaign, expectedSteps: config.steps.length } : null;
  const activeUnitIds = new Set(activeCampaign?.units.filter((unit) => unit.included !== false).map((unit) => unit.unitId));
  const activeRecords = activeCampaign
    ? records.filter((record) => record.sourceMetadata?.CAMPAIGN_ID === activeCampaign.campaignId && record.sourceMetadata?.UNIT_ID && activeUnitIds.has(record.sourceMetadata.UNIT_ID) && record.sourceMetadata?.RUN_ID === activeCampaign.runId)
    : records;
  const singleUnitScope = !activeCampaign || activeUnitIds.size === 1;
  const sourceUnitName = singleUnitScope ? activeRecords.find((record) => record.sourceMetadata?.UNIT_NAME)?.sourceMetadata?.UNIT_NAME : "";
  const sourceMetadata = activeRecords.reduce((merged, record) => mergeMetadata(record.sourceMetadata, merged), {});
  // Değer önceliği: kayıt metadata > kampanya metadata > kullanıcı/proje alanları > adapter varsayılanları.
  const userMetadata = { ...metadata, UNIT_NAME: metadata.UNIT_NAME || sourceUnitName };
  const adapterMetadata = pfkAdapterMetadataDefaults(plant);
  const projectMetadata = mergeMetadata(userMetadata, adapterMetadata);
  const campaignLevelMetadata = mergeMetadata(campaignMetadata(activeCampaign), projectMetadata);
  const effectiveMetadata = resolveDocumentDates(applyDefaults(mergeMetadata(sourceMetadata, campaignLevelMetadata), documentSettings), activeRecords);
  const missingSteps = activeCampaign
    ? activeCampaign.units.filter((unit) => unit.included !== false).flatMap((unit) => config.steps.filter((step) => !activeRecords.some((record) => record.step.id === step.id && record.sourceMetadata?.UNIT_ID === unit.unitId)).map((step) => ({ stepId: `${unit.unitId}/${step.id}`, name: step.name })))
    : config.steps.filter((step) => !activeRecords.some((record) => record.step.id === step.id)).map((step) => ({ stepId: step.id, name: step.name }));
  const reportRecords = activeRecords.map((record) => {
    const { events: rawEvents = [], ...analysisMetrics } = record.analysis.metrics ?? {};
    const recordMetadata = resolveDocumentDates(applyDefaults(mergeMetadata(record.sourceMetadata, effectiveMetadata), documentSettings), [record]);
    const reportRecord = {
      ...record,
      metadata: recordMetadata
    };
    const events = rawEvents.map((event) => eventReportRecord(reportRecord, event, chartProvider));
    return ({
    stepId: record.step.id,
    recordKey: record.sourceMetadata?.CAMPAIGN_ID ? [record.sourceMetadata.CAMPAIGN_ID, record.sourceMetadata.UNIT_ID, record.step.id, record.sourceMetadata.RUN_ID].join("\u001f") : "",
    name: record.sourceMetadata?.CAMPAIGN_ID && record.sourceMetadata?.UNIT_ID ? `${record.sourceMetadata.UNIT_ID} — ${record.step.name}` : record.step.name,
    kind: record.step.kind, columns: record.step.columns, filename: record.name, rowCount: record.rows.length, status: record.analysis.status, detail: record.analysis.detail,
    metrics: { ...analysisMetrics, finalActivePowerMw: record.rows.at(-1)?.active_power_mw },
    metadata: recordMetadata,
    warnings: record.validation?.warnings ?? [], evidence: record.evidence ?? null,
    campaign: record.sourceMetadata?.CAMPAIGN_ID ? { campaignId: record.sourceMetadata.CAMPAIGN_ID, unitId: record.sourceMetadata.UNIT_ID, unitName: record.sourceMetadata.UNIT_NAME, runId: record.sourceMetadata.RUN_ID } : null,
    events,
    charts: chartProvider ? chartProvider(reportRecord) : []
    });
  });
  const completeness = completenessChecks(service, effectiveMetadata, reportRecords, missingSteps, plant);
  const draft = isDraftMode(service, plant);
  const values = {
    TESIS_ADI: effectiveMetadata.TESIS_ADI, COMPANY: effectiveMetadata.COMPANY, UNIT_ID: effectiveMetadata.UNIT_ID,
    UNIT_NAME: effectiveMetadata.UNIT_NAME || effectiveMetadata.UNIT_ID || "Tesis kapsamı", PNOM_MW: effectiveMetadata.PNOM_MW,
    RPMAX_MW: effectiveMetadata.RPMAX_MW, REPORT_NO: effectiveMetadata.REPORT_NO, TEST_START_DATE: effectiveMetadata.TEST_START_DATE || effectiveMetadata.TEST_DATE,
    TEST_END_DATE: effectiveMetadata.TEST_END_DATE || effectiveMetadata.TEST_DATE, CITY: effectiveMetadata.CITY,
    PLANT_TYPE: plant, REGULATION_REFERENCE: documentSettings.regulationReference
  };
  const text = Object.fromEntries(Object.entries(documentTextTemplates(documentSettings, service, reportType)).map(([key, template]) => [key, interpolateDocumentText(template, values)]));
  const roles = String(documentSettings.defaultSignatureRoles || "TEİAŞ Gözlemcisi; Tesis Yetkilisi; Testi Gerçekleştiren").split(";").map((role) => role.trim()).filter(Boolean);
  return Object.freeze({
    schemaVersion: 7, appVersion: "0.7.2", createdAt: new Date().toISOString(), service, plant, configKey: `${service}:${plant}`,
    reportType, title: reportTitle(service, plant, reportType), draft, reportNote, metadata: effectiveMetadata,
    expectedStepCount: activeCampaign ? config.steps.length * activeCampaign.units.filter((unit) => unit.included !== false).length : expectedIds.length,
    loadedStepCount: reportRecords.length, missingSteps, completeness,
    overallStatus: evaluationStatus(reportRecords, missingSteps, draft),
    evaluationStatus: evaluationStatus(reportRecords, missingSteps, draft),
    officialStatus: officialStatus(reportRecords, missingSteps, draft, completeness),
    documentStatus: officialStatus(reportRecords, missingSteps, draft, completeness),
    records: reportRecords, variables: variableRows(`${service}:${plant}`, config, effectiveMetadata), technicalData: technicalData(effectiveMetadata, activeRecords, service === "PFK" ? plant : ""),
    participants: participantRows(effectiveMetadata),
    campaign: activeCampaign, campaignSummary: campaignSummary(activeRecords, activeCampaign, effectiveMetadata),
    evidence: reportRecords.map((record) => record.evidence).filter(Boolean), sections: sectionsForReport({ service, plant, reportType, records: reportRecords, campaign: activeCampaign, includeEvidenceAppendix: documentSettings.includeEvidenceAppendix === true }),
    settings: documentSettings, documentText: text, assets: { logoDataUrl: documentSettings.showLogo === false ? "" : logoDataUrl },
    figureProfile: service === "PFK" ? (documentSettings.includeEvidenceAppendix === true && reportType.includes("Teknik Kanıt") ? "YDA_TECHNICAL_EVIDENCE" : (isMinutesReport(reportType) ? "OFFICIAL_TEIAS_PFK_MINUTES" : "OFFICIAL_TEIAS_PFK_REPORT")) : "DEFAULT",
    watermark: service === "PFK" ? (documentSettings.showPfkOfficialWatermark === true ? { text: "TEİAŞ", opacity: Math.max(0, Math.min(0.25, Number(documentSettings.watermarkOpacity) || 0.08)) } : null) : (documentSettings.showWatermark !== false ? { text: "TEİAŞ", opacity: Math.max(0, Math.min(0.25, Number(documentSettings.watermarkOpacity) || 0.08)) } : null),
    signatures: roles.map((role, index) => ({ role, name: index === roles.length - 1 ? effectiveMetadata.TEST_ENGINEER || "Ad Soyad / İmza" : "Ad Soyad / İmza" }))
  });
}
