export function reportTitle(service, plant, reportType) {
  if (service === "PFK") {
    if (reportType.includes("Tutanak")) return "PRİMER FREKANS KONTROL PERFORMANS TESTLERİ TUTANAĞI";
    if (reportType.includes("Sertifika")) return "PRİMER FREKANS KONTROL HİZMETİ TEST SERTİFİKASI";
    return "PRİMER FREKANS KONTROL PERFORMANS TEST RAPORU";
  }
  if (service === "RGDH") {
    const name = plant === "KONV" ? "REAKTİF GÜÇ DESTEK HİZMETİ" : "SİSTEM BAĞLANTI NOKTASINDA REAKTİF GÜÇ DESTEK HİZMETİ";
    if (reportType.includes("Tutanak")) return `${name} PERFORMANS TESTLERİ TUTANAĞI`;
    if (reportType.includes("Sertifika")) return `${name} TEST SERTİFİKASI`;
    return `${name} PERFORMANS TEST RAPORU`;
  }
  if (service === "SFK") return "SEKONDER FREKANS KONTROL TEST RAPORU";
  return `${service === "HFK" ? "HIZLI FREKANS KONTROL HİZMETİ" : "SINIRLI FREKANS HASSASİYET MODU"} TEKNİK ÖN DEĞERLENDİRME RAPORU`;
}

const recordsFor = (records, predicate) => records.filter(predicate);
const stepIds = (records) => records.map((record) => record.stepId);

function campaignGroups(records, campaign, prefix, predicate, withDirections = false) {
  return campaign.units.filter((unit) => unit.included !== false).map((unit, index) => {
    const unitRecords = recordsFor(records, (record) => record.campaign?.unitId === unit.unitId && predicate(record));
    const number = `${prefix}.${index + 1}`;
    const heading = `${number} ${unit.unitId} — ${unit.unitName}`;
    if (!withDirections) return { heading, stepIds: stepIds(unitRecords) };
    const negative = unitRecords.find((record) => record.stepId.includes("NEG200"));
    const positive = unitRecords.find((record) => record.stepId.includes("POS200"));
    return {
      heading,
      items: [
        { heading: `${number}.a Δf = -200 mHz`, stepIds: negative ? [negative.stepId] : [] },
        { heading: `${number}.b Δf = +200 mHz`, stepIds: positive ? [positive.stepId] : [] }
      ]
    };
  });
}

function pfkReportSections(records, campaign) {
  const top = [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
    { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "C", (record) => record.stepId.includes("MAX"), true) : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, (record) => record.stepId.includes("MAX"))) },
    { heading: "D) MİNİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "D", (record) => record.stepId.includes("MIN"), true) : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, (record) => record.stepId.includes("MIN"))) },
    { heading: "E) HASSASİYET TESTLERİ", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "E", (record) => record.stepId === "HASSASIYET") : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, (record) => record.stepId === "HASSASIYET")) },
    { heading: "F) 24 SAATLİK DOĞRULAMA", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "F", (record) => record.stepId.includes("VALIDATION")) : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, (record) => record.stepId.includes("VALIDATION"))) }
  ];
  if (campaign) top.push({ heading: "PFK KAMPANYA / ÜNİTE ÖZETİ", type: "campaign-summary" });
  top.push({ heading: "G) SONUÇ", type: "summary" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" });
  return top;
}

function pfkMinutesSections(records) {
  return [
    { heading: "TEST TUTANAĞI", type: "minutes" },
    { heading: "TEKNİK VERİLER, ÖLÇÜM EKİPMANI VE KANALLAR", type: "technical" },
    { heading: "UYGULANAN TEST ADIMLARI VE EKLER", type: "records", stepIds: stepIds(records) },
    { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" },
    { heading: "KATILIMCI / İMZA MATRİSİ", type: "participants" },
    { heading: "SONUÇ VE NÜSHA TESLİMİ", type: "summary" }
  ];
}

function rgdhSections(records, plant) {
  if (plant === "KONV") return [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" }, { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) AŞIRI İKAZ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.stepId.includes("OE"))) },
    { heading: "D) DÜŞÜK İKAZ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.stepId.includes("UE"))) },
    { heading: "E) DEĞERLENDİRME", type: "summary" }, { heading: "F) SONUÇ", type: "summary" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
  return [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" }, { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ / AŞIRI İKAZ KAPASİTE TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.stepId.includes("OE_MAX"))) },
    { heading: "D) ORTA ÇALIŞMA NOKTASI / %50 TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.stepId.includes("MID") || record.stepId.includes("P50"))) },
    { heading: "E) DÜŞÜK ÇALIŞMA NOKTASI / %20 TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.stepId.includes("UE") || record.stepId.includes("P20"))) },
    { heading: "F) GERİLİM KONTROLCÜSÜ PERFORMANS TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => record.kind === "voltage_control")) },
    { heading: "G) SONUÇ", type: "summary" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
}

export function sectionsForReport({ service, plant, reportType, records, campaign }) {
  if (reportType.includes("Sertifika")) return [{ heading: "SERTİFİKA", type: "certificate" }];
  if (service === "PFK") return reportType.includes("Tutanak") ? pfkMinutesSections(records) : pfkReportSections(records, campaign);
  if (service === "RGDH") return rgdhSections(records, plant);
  if (service === "SFK") return [
    { heading: "1. GİRİŞ VE TEST KAPSAMI", type: "participants" }, { heading: "2. TEKNİK VERİLER", type: "technical" },
    { heading: "3. SEKONDER FREKANS KONTROL TESTLERİ", type: "records", stepIds: stepIds(records) }, { heading: "4. SONUÇ", type: "summary" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
  return [{ heading: "TEKNİK VERİLER", type: "technical" }, { heading: "TEST SONUÇLARI", type: "records", stepIds: stepIds(records) }, { heading: "SONUÇ", type: "summary" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }];
}
