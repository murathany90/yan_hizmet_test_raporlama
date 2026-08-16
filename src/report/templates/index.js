export function reportTitle(service, plant, reportType) {
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

function recordSteps(records, predicate) {
  return records.filter(predicate).map((record) => record.stepId);
}

function pfkSections(records, reportType, campaign) {
  if (reportType.includes("Tutanak")) {
    return [
      { heading: "TEST TUTANAĞI", type: "participants" },
      { heading: "TEST EKİPMANI VE KALİBRASYON", type: "technical" },
      { heading: "UYGULANAN TEST ADIMLARI", type: "records", stepIds: records.map((record) => record.stepId) },
      { heading: "SONUÇ VE İMZA ÖNCESİ KONTROL", type: "summary" }
    ];
  }
  if (reportType.includes("Sertifika")) {
    return [
      { heading: "SERTİFİKA KİMLİK VE KAPSAM BİLGİLERİ", type: "participants" },
      { heading: "TEST EKİPMANI / KALİBRASYON", type: "technical" },
      { heading: "SONUÇ MATRİSİ", type: "summary" }
    ];
  }
  return [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
    { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.startsWith("RES_MAX") || record.stepId.startsWith("BESS_MAX")) },
    { heading: "D) MİNİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.startsWith("RES_MIN") || record.stepId.startsWith("BESS_MIN")) },
    { heading: "E) HASSASİYET TESTİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("SENS")) },
    { heading: "F) DOĞRULAMA TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("VALIDATION")) },
    ...(campaign ? [{ heading: "PFK KAMPANYA / ÜNİTE ÖZETİ", type: "campaign-summary" }] : []),
    { heading: "G) SONUÇ", type: "summary" }
  ];
}

function rgdhSections(records, plant) {
  if (plant === "KONV") {
    return [
      { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
      { heading: "B) TEKNİK VERİLER", type: "technical" },
      { heading: "C) AŞIRI İKAZ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("OE")) },
      { heading: "D) DÜŞÜK İKAZ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("UE")) },
      { heading: "E) DEĞERLENDİRME", type: "summary" },
      { heading: "F) SONUÇ", type: "summary" }
    ];
  }
  return [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
    { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ / AŞIRI İKAZ KAPASİTE TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("OE_MAX")) },
    { heading: "D) ORTA ÇALIŞMA NOKTASI / %50 TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("MID") || record.stepId.includes("P50")) },
    { heading: "E) DÜŞÜK ÇALIŞMA NOKTASI / %20 TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.stepId.includes("UE") || record.stepId.includes("P20")) },
    { heading: "F) GERİLİM KONTROLCÜSÜ PERFORMANS TESTLERİ", type: "records", stepIds: recordSteps(records, (record) => record.kind === "voltage_control") },
    { heading: "G) SONUÇ", type: "summary" }
  ];
}

export function sectionsForReport({ service, plant, reportType, records, campaign }) {
  if (service === "PFK") return pfkSections(records, reportType, campaign);
  if (service === "RGDH") return rgdhSections(records, plant);
  if (service === "SFK") {
    return [
      { heading: "1. GİRİŞ VE TEST KAPSAMI", type: "participants" },
      { heading: "2. SEKONDER FREKANS KONTROLUNA İLİŞKİN BİLGİLERİN KONTROLÜ", type: "technical" },
      { heading: "2.1 LFC SİSTEMİ ÇALIŞMA KONUMU VE ALARM BİLGİLERİ", type: "records", stepIds: recordSteps(records, (record) => record.kind === "signal_check") },
      { heading: "2.2 SETPOINT BİLGİLERİNİN KONTROLÜ", type: "records", stepIds: recordSteps(records, (record) => record.kind === "agc_step") },
      { heading: "3. SEKONDER FREKANS KONTROL TESTLERİ", type: "records", stepIds: records.map((record) => record.stepId) },
      { heading: "4. SONUÇ", type: "summary" }
    ];
  }
  return [
    { heading: "TEKNİK VERİLER", type: "technical" },
    { heading: "TEST SONUÇLARI", type: "records", stepIds: records.map((record) => record.stepId) },
    { heading: "SONUÇ", type: "summary" }
  ];
}
