const STORAGE_KEY = "yda-document-settings-v070";
const LEGACY_STORAGE_KEY = "teias-yhda-document-settings-v062";

export const DEFAULT_DOCUMENT_SETTINGS = Object.freeze({
  institutionName: "Türkiye Elektrik İletim A.Ş.",
  reportHeader: "YDA (Yan Hizmetler Doğrulama Aracı)",
  reportFooter: "YDA | İmza öncesi teknik çıktı",
  city: "",
  regulationReference: "Elektrik Şebeke Yönetmeliği Ek-17",
  preparedBy: "",
  outputDirectory: "",
  defaultSignatureRoles: "TEİAŞ Gözlemcisi; Tesis Yetkilisi; Testi Gerçekleştiren",
  showLogo: true,
  showWatermark: true,
  watermarkOpacity: 0.08,
  defaults: {
    facilityName: "",
    operatorName: "",
    city: "",
    turbineGenerator: "",
    unitOperationMode: "",
    equipmentDefaults: "",
    equipment: {
      deviceType: "", brand: "", model: "", serialNo: "", software: "",
      accuracyClass: "", calibrationNo: "", calibrationDate: ""
    }
  },
  texts: {
    reportIntroduction: "{{TESIS_ADI}} tesisinde {{REGULATION_REFERENCE}} kapsamında gerçekleştirilen yan hizmetler testi bu raporda değerlendirilmiştir.",
    technicalData: "Teknik veriler, ölçüm zinciri ve kanal tanımları yüklenen CSV metadata ve kayıt kanallarından izlenebilir biçimde oluşturulmuştur.",
    minutesIntroduction: "{{TESIS_ADI}} tesisinde {{TEST_START_DATE}} - {{TEST_END_DATE}} tarihleri arasında gerçekleştirilen test çalışmaları aşağıda özetlenmiştir.",
    operationSafety: "İşletme güvenliğinin tesis personeli tarafından sağlandığı beyanı üzerine test çalışmalarına başlanmıştır.",
    testMethod: "Test kayıtları tanımlı örnekleme süresiyle alınmış, frekans simülasyonu ve işletme modu teknik veri bölümünde belirtilmiştir.",
    testResult: "Sonuçlar, yüklenen ham CSV kayıtları ve uygulanan kabul kontrolleri üzerinden teknik değerlendirme amacıyla sunulmaktadır.",
    reportConclusion: "Nihai uygunluk kararı, imza ve onay sürecinde teknik kanıtlar birlikte incelenerek verilir.",
    copyDelivery: "Bu tutanak, taraflara teslim edilmek üzere düzenlenmiş imza öncesi nüsha niteliğindedir.",
    minutesResult: "Tutanak kapsamındaki test uygulaması ve tespitler taraflarca kayda alınmıştır.",
    attachmentsDescription: "Ekler, yüklenen ham CSV kayıtları ve SHA-256 bütünlük manifestinden oluşur.",
    certificateIntroduction: "{{TESIS_ADI}} için {{REGULATION_REFERENCE}} kapsamındaki test sonuçları, bu sertifikanın eki olan değerlendirme kayıtlarıyla birlikte düzenlenmiştir.",
    certificateResult: "Bu belge, imza/onay süreci tamamlanmadan resmî kabul veya uygunluk belgesi yerine geçmez.",
    certificateValidityText: "Geçerlilik, yetkili imza ve onay sürecinin tamamlanmasıyla birlikte ilgili mevzuat ve sertifika numarası kapsamında değerlendirilir.",
    draftWarning: "İMZA ÖNCESİ / TASLAK"
  },
  scopedTexts: {}
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_SETTINGS));
}

function deepMerge(base, input) {
  const scopedTexts = { ...base.scopedTexts };
  for (const [service, documents] of Object.entries(input?.scopedTexts ?? {})) {
    scopedTexts[service] = { ...(base.scopedTexts?.[service] ?? {}) };
    for (const [documentType, texts] of Object.entries(documents ?? {})) {
      scopedTexts[service][documentType] = { ...(base.scopedTexts?.[service]?.[documentType] ?? {}), ...(texts ?? {}) };
    }
  }
  return {
    ...base,
    ...(input ?? {}),
    defaults: { ...base.defaults, ...(input?.defaults ?? {}), equipment: { ...base.defaults.equipment, ...(input?.defaults?.equipment ?? {}) } },
    texts: { ...base.texts, ...(input?.texts ?? {}) },
    scopedTexts
  };
}

export function loadDocumentSettings() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
    return stored ? deepMerge(cloneDefaults(), JSON.parse(stored)) : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveDocumentSettings(settings) {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage is optional */ }
  return settings;
}

export function patchDocumentSettings(settings, patch) {
  return saveDocumentSettings(deepMerge(settings, patch));
}

export function resetDocumentSettings() {
  const defaults = cloneDefaults();
  try { globalThis.localStorage?.removeItem(STORAGE_KEY); } catch { /* storage is optional */ }
  return defaults;
}

export function interpolateDocumentText(template, values) {
  return String(template ?? "").replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(values[key] ?? "—"));
}

export function isMinutesReport(reportType = "") {
  return String(reportType).toLocaleLowerCase("tr-TR").includes("tutan");
}

export function documentTypeForReport(reportType = "") {
  if (isMinutesReport(reportType)) return "minutes";
  if (reportType.includes("Sertifika")) return "certificate";
  return "report";
}

export function documentTextTemplates(settings, service, reportType) {
  const documentType = documentTypeForReport(reportType);
  return { ...(settings?.texts ?? {}), ...(settings?.scopedTexts?.[service]?.[documentType] ?? {}) };
}

export const AVAILABLE_PLACEHOLDERS = Object.freeze([
  "TESIS_ADI", "COMPANY", "UNIT_ID", "UNIT_NAME", "PNOM_MW", "RPMAX_MW",
  "REPORT_NO", "TEST_START_DATE", "TEST_END_DATE", "CITY", "PLANT_TYPE", "REGULATION_REFERENCE"
]);
