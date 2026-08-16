const STORAGE_KEY = "teias-yhda-document-settings-v062";

export const DEFAULT_DOCUMENT_SETTINGS = Object.freeze({
  institutionName: "Türkiye Elektrik İletim A.Ş.",
  reportHeader: "TEİAŞ Yan Hizmetler Doğrulama Aracı",
  reportFooter: "TEİAŞ-YHDA | İmza öncesi teknik çıktı",
  city: "",
  regulationReference: "Elektrik Şebeke Yönetmeliği Ek-17",
  preparedBy: "",
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
    equipmentDefaults: ""
  },
  texts: {
    reportIntroduction: "{{TESIS_ADI}} tesisinde {{REGULATION_REFERENCE}} kapsamında gerçekleştirilen yan hizmetler testi bu raporda değerlendirilmiştir.",
    technicalData: "Teknik veriler, ölçüm zinciri ve kanal tanımları yüklenen CSV metadata ve kayıt kanallarından izlenebilir biçimde oluşturulmuştur.",
    minutesIntroduction: "{{TESIS_ADI}} tesisinde {{TEST_START_DATE}} - {{TEST_END_DATE}} tarihleri arasında gerçekleştirilen test çalışmaları aşağıda özetlenmiştir.",
    operationSafety: "İşletme güvenliğinin tesis personeli tarafından sağlandığı beyanı üzerine test çalışmalarına başlanmıştır.",
    testMethod: "Test kayıtları tanımlı örnekleme süresiyle alınmış, frekans simülasyonu ve işletme modu teknik veri bölümünde belirtilmiştir.",
    testResult: "Sonuçlar, yüklenen ham CSV kayıtları ve uygulanan kabul kontrolleri üzerinden teknik değerlendirme amacıyla sunulmaktadır.",
    copyDelivery: "Bu tutanak, taraflara teslim edilmek üzere düzenlenmiş imza öncesi nüsha niteliğindedir.",
    certificateIntroduction: "{{TESIS_ADI}} için {{REGULATION_REFERENCE}} kapsamındaki test sonuçları, bu sertifikanın eki olan değerlendirme kayıtlarıyla birlikte düzenlenmiştir.",
    certificateResult: "Bu belge, imza/onay süreci tamamlanmadan resmî kabul veya uygunluk belgesi yerine geçmez.",
    draftWarning: "İMZA ÖNCESİ / TASLAK"
  }
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_SETTINGS));
}

function deepMerge(base, input) {
  return {
    ...base,
    ...(input ?? {}),
    defaults: { ...base.defaults, ...(input?.defaults ?? {}) },
    texts: { ...base.texts, ...(input?.texts ?? {}) }
  };
}

export function loadDocumentSettings() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
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
