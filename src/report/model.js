import { REPORT_REF_MAP, REPORT_VARIABLES } from "../app/config.js";
import { inferUnit } from "../utils/text.js";
import { isDraftMode } from "../criteria/procedures.js";

function reportTitle(service, plant, reportType) {
  if (service === "PFK") {
    if (reportType.includes("Tutanak")) return "PRİMER FREKANS KONTROL PERFORMANS TESTLERİ TUTANAĞI";
    if (reportType.includes("Sertifika")) return "PRİMER FREKANS KONTROL HİZMETİ TEST SERTİFİKASI";
    return "PRİMER FREKANS KONTROL PERFORMANS TEST RAPORU";
  }
  if (service === "RGDH") {
    const prefix = plant === "KONV" ? "REAKTİF GÜÇ DESTEK HİZMETİ" : "SİSTEM BAĞLANTI NOKTASINDA REAKTİF GÜÇ DESTEK HİZMETİ";
    if (reportType.includes("Tutanak")) return `${prefix} PERFORMANS TESTLERİ TUTANAĞI`;
    if (reportType.includes("Sertifika")) return `${prefix} TEST SERTİFİKASI`;
    return `${prefix} PERFORMANS TEST RAPORU`;
  }
  if (service === "SFK") return "SEKONDER FREKANS KONTROL TEST RAPORU";
  const name = service === "HFK" ? "HIZLI FREKANS KONTROL HİZMETİ" : "SINIRLI FREKANS HASSASİYET MODU";
  return `${name} TEKNİK ÖN DEĞERLENDİRME RAPORU`;
}

function variableRows(configKey, config, metadata) {
  const configured = REPORT_VARIABLES[configKey] ?? [];
  const rows = configured.map(([key, description, source]) => ({
    key,
    description,
    value: metadata[key] ?? "",
    unit: inferUnit(key, description),
    source: source || "CSV metadata / kullanıcı",
    field: `# ${key}`
  }));
  if (rows.length) return rows;
  return config.meta.map(([key, description]) => ({
    key,
    description,
    value: metadata[key] ?? "",
    unit: inferUnit(key, description),
    source: "CSV metadata / kullanıcı",
    field: `# ${key}`
  }));
}

function groupSections(service, plant, reportType, records) {
  const by = (predicate) => records.filter(predicate).map((record) => record.stepId);
  if (service === "PFK" && !reportType.includes("Tutanak") && !reportType.includes("Sertifika")) {
    return [
      { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
      { heading: "B) TEKNİK VERİLER", type: "variables" },
      { heading: "C) MAKSİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: "records", stepIds: by((record) => record.stepId.startsWith("RES_MAX") || record.stepId.startsWith("BESS_MAX")) },
      { heading: "D) MİNİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: "records", stepIds: by((record) => record.stepId.startsWith("RES_MIN") || record.stepId.startsWith("BESS_MIN")) },
      { heading: "E) HASSASİYET TESTİ", type: "records", stepIds: by((record) => record.stepId.includes("SENS")) },
      { heading: "F) DOĞRULAMA TESTLERİ", type: "records", stepIds: by((record) => record.stepId.includes("VALIDATION")) },
      { heading: "G) SONUÇ", type: "summary" }
    ];
  }
  if (service === "RGDH" && !reportType.includes("Tutanak") && !reportType.includes("Sertifika")) {
    return [
      { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
      { heading: "B) TEKNİK VERİLER", type: "variables" },
      { heading: "C) AŞIRI İKAZ / KAPASİTE TESTLERİ", type: "records", stepIds: by((record) => record.stepId.includes("OE")) },
      { heading: "D) DÜŞÜK İKAZ / KAPASİTE TESTLERİ", type: "records", stepIds: by((record) => record.stepId.includes("UE")) },
      { heading: "E-F) GERİLİM KONTROLCÜSÜ PERFORMANS TESTLERİ", type: "records", stepIds: by((record) => record.kind === "voltage_control") },
      { heading: "G) SONUÇ", type: "summary" }
    ];
  }
  if (service === "SFK") {
    return [
      { heading: "2. SEKONDER FREKANS KONTROLUNA İLİŞKİN BİLGİLERİN KONTROLÜ", type: "variables" },
      { heading: "2.1 LFC SİSTEMİ ÇALIŞMA KONUMU VE ALARM BİLGİLERİ", type: "records", stepIds: by((record) => record.kind === "signal_check") },
      { heading: "2.2 SETPOINT BİLGİLERİNİN KONTROLÜ", type: "records", stepIds: by((record) => record.kind === "agc_step") },
      { heading: "3. SEKONDER FREKANS KONTROL TESTLERİ", type: "records", stepIds: records.map((record) => record.stepId) },
      { heading: "4. SONUÇ", type: "summary" }
    ];
  }
  return [
    { heading: reportType.includes("Tutanak") ? "TEST TUTANAĞI" : "TEKNİK VERİLER", type: "variables" },
    { heading: "TEST SONUÇLARI", type: "records", stepIds: records.map((record) => record.stepId) },
    { heading: "SONUÇ", type: "summary" }
  ];
}

function overallStatus(records, missingSteps, draft) {
  if (draft) return "TEKNİK ÖN DEĞERLENDİRME / TASLAK";
  if (missingSteps.length) return "EKSİK TEST";
  if (records.some((record) => record.status === "KALDI")) return "KALDI";
  if (records.length && records.every((record) => record.status === "GEÇTİ")) return "GEÇTİ";
  return "MÜHENDİSLİK DEĞERLENDİRMESİ GEREKLİ";
}

export function buildReportModel({ service, plant, config, metadata, reportType, reportNote, records, chartProvider, logoDataUrl = "", referenceDataUrl = "" }) {
  const configKey = `${service}:${plant}`;
  const expectedIds = config.steps.map((step) => step.id);
  const loadedIds = new Set(records.map((record) => record.step.id));
  const missingSteps = config.steps.filter((step) => !loadedIds.has(step.id)).map((step) => ({ stepId: step.id, name: step.name }));
  const reportRecords = records.map((record) => ({
    stepId: record.step.id,
    name: record.step.name,
    kind: record.step.kind,
    filename: record.name,
    rowCount: record.rows.length,
    status: record.analysis.status,
    detail: record.analysis.detail,
    metrics: record.analysis.metrics ?? {},
    warnings: record.validation?.warnings ?? [],
    charts: chartProvider ? chartProvider(record) : []
  }));
  const draft = isDraftMode(service, plant);
  const referenceMap = REPORT_REF_MAP[configKey] ?? {};
  const referenceId = referenceMap[reportType] ?? referenceMap.default ?? "";
  const title = reportTitle(service, plant, reportType);
  return Object.freeze({
    schemaVersion: 1,
    appVersion: "0.6.0",
    createdAt: new Date().toISOString(),
    service,
    plant,
    configKey,
    reportType,
    title,
    draft,
    sourceNote: config.sourceNote,
    reportNote,
    metadata: { ...metadata },
    expectedStepCount: expectedIds.length,
    loadedStepCount: reportRecords.length,
    missingSteps,
    overallStatus: overallStatus(reportRecords, missingSteps, draft),
    records: reportRecords,
    variables: variableRows(configKey, config, metadata),
    sections: groupSections(service, plant, reportType, reportRecords),
    referenceId,
    assets: { logoDataUrl, referenceDataUrl },
    signatures: [
      { role: "TEİAŞ Gözlemcisi", name: "Ad Soyad / İmza" },
      { role: "Tesis Yetkilisi", name: "Ad Soyad / İmza" },
      { role: "Testi Gerçekleştiren", name: metadata.TEST_ENGINEER || "Ad Soyad / İmza" }
    ]
  });
}

