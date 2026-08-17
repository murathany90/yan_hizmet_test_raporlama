import { isMinutesReport } from "../../app/settings.js";

export function reportTitle(service, plant, reportType) {
  if (service === "PFK") {
    if (isMinutesReport(reportType)) return "PRİMER FREKANS KONTROL PERFORMANS TESTLERİ TUTANAĞI";
    if (reportType.includes("Sertifika")) return "PRİMER FREKANS KONTROL HİZMETİ TEST SERTİFİKASI";
    return "PRİMER FREKANS KONTROL PERFORMANS TEST RAPORU";
  }
  if (service === "RGDH") {
    const name = plant === "KONV" ? "REAKTİF GÜÇ DESTEK HİZMETİ" : "SİSTEM BAĞLANTI NOKTASINDA REAKTİF GÜÇ DESTEK HİZMETİ";
    if (isMinutesReport(reportType)) return `${name} PERFORMANS TESTLERİ TUTANAĞI`;
    if (reportType.includes("Sertifika")) return `${name} TEST SERTİFİKASI`;
    return `${name} PERFORMANS TEST RAPORU`;
  }
  if (service === "SFK") return "SEKONDER FREKANS KONTROL TEST RAPORU";
  return `${service === "HFK" ? "HIZLI FREKANS KONTROL HİZMETİ" : "SINIRLI FREKANS HASSASİYET MODU"} TEKNİK ÖN DEĞERLENDİRME RAPORU`;
}

const recordsFor = (records, predicate) => records.filter(predicate);
const stepIds = (records) => records.map((record) => record.stepId);
const recordKeys = (records) => records.map((record) => record.recordKey).filter(Boolean);

function campaignGroups(records, campaign, prefix, predicate, withDirections = false) {
  return campaign.units.filter((unit) => unit.included !== false).map((unit, index) => {
    const unitRecords = recordsFor(records, (record) => record.campaign?.campaignId === campaign.campaignId && record.campaign?.unitId === unit.unitId && record.campaign?.runId === campaign.runId && predicate(record));
    const number = `${prefix}.${index + 1}`;
    const heading = `${number} ${unit.unitId} — ${unit.unitName}`;
    if (!withDirections) return { heading, recordKeys: recordKeys(unitRecords) };
    const negative = unitRecords.filter((record) => record.events?.some((event) => event.eventId === "NEG200"));
    const positive = unitRecords.filter((record) => record.events?.some((event) => event.eventId === "POS200"));
    const negativeRecords = negative.length ? negative : unitRecords;
    const positiveRecords = positive.length ? positive : unitRecords;
    return {
      heading,
      items: [
        { heading: `${number}.0 Genel kayıt`, recordKeys: recordKeys(unitRecords), overview: true },
        { heading: `${number}.a Δf = −200 mHz`, recordKeys: recordKeys(negativeRecords), eventId: "NEG200" },
        { heading: `${number}.b Δf = +200 mHz`, recordKeys: recordKeys(positiveRecords), eventId: "POS200" }
      ]
    };
  });
}

function reserveGroups(records, prefix, predicate) {
  const selected = recordsFor(records, predicate);
  return [{
    heading: `${prefix}.1 Ünite / tesis kapsamı`,
    items: [
      { heading: `${prefix}.1.0 Genel kayıt`, stepIds: stepIds(selected), overview: true },
      { heading: `${prefix}.1.a Δf = −200 mHz`, stepIds: stepIds(selected), eventId: "NEG200" },
      { heading: `${prefix}.1.b Δf = +200 mHz`, stepIds: stepIds(selected), eventId: "POS200" }
    ]
  }];
}

function pfkReportSections(records, campaign, plant, includeEvidenceAppendix = false) {
  const pairedReserve = plant !== "EDUEDT";
  const maximum = (record) => pairedReserve ? record.stepId === "MAKSIMUM_REZERV" : record.stepId.includes("MAX");
  const minimum = (record) => pairedReserve ? record.stepId === "MINIMUM_REZERV" : record.stepId.includes("MIN");
  const validation = (record) => pairedReserve ? record.stepId === "DOGRULAMA_24H" : record.stepId.includes("VALIDATION");
  const top = [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" },
    { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: pairedReserve ? "grouped-records" : (campaign ? "grouped-records" : "records"), groups: pairedReserve ? (campaign ? campaignGroups(records, campaign, "C", maximum, true) : reserveGroups(records, "C", maximum)) : (campaign ? campaignGroups(records, campaign, "C", maximum) : undefined), stepIds: !pairedReserve && !campaign ? stepIds(recordsFor(records, maximum)) : undefined },
    { heading: "D) MİNİMUM ÇIKIŞ GÜCÜ SEVİYESİ REZERV TESTLERİ", type: pairedReserve ? "grouped-records" : (campaign ? "grouped-records" : "records"), groups: pairedReserve ? (campaign ? campaignGroups(records, campaign, "D", minimum, true) : reserveGroups(records, "D", minimum)) : (campaign ? campaignGroups(records, campaign, "D", minimum) : undefined), stepIds: !pairedReserve && !campaign ? stepIds(recordsFor(records, minimum)) : undefined },
    { heading: "E) HASSASİYET TESTLERİ", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "E", (record) => record.stepId === "HASSASIYET") : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, (record) => record.stepId === "HASSASIYET")) },
    { heading: "F) 24 SAATLİK DOĞRULAMA", type: campaign ? "grouped-records" : "records", groups: campaign ? campaignGroups(records, campaign, "F", validation) : undefined, stepIds: campaign ? undefined : stepIds(recordsFor(records, validation)) }
  ];
  top.push({ heading: "G) SONUÇ", type: "pfk-conclusion" });
  if (includeEvidenceAppendix) top.push({ heading: "YDA TEKNİK KANIT EKİ", type: "evidence" });
  return top;
}

function pfkMinutesGroups(records, campaign) {
  if (campaign) return campaign.units.filter((unit) => unit.included !== false).map((unit, index) => ({
    heading: `EK-${index + 1} ${unit.unitId} — ${unit.unitName || unit.unitId} GRAFİKLERİ`,
    items: [{ heading: "Rezerv, hassasiyet ve 24 saat doğrulama grafik seti", recordKeys: recordKeys(recordsFor(records, (record) => record.campaign?.campaignId === campaign.campaignId && record.campaign?.unitId === unit.unitId && record.campaign?.runId === campaign.runId)) }]
  }));
  return [{ heading: "EK-1 ÜNİTE / TESİS GRAFİKLERİ", items: [{ heading: "Rezerv, hassasiyet ve 24 saat doğrulama grafik seti", stepIds: stepIds(records) }] }];
}

function minutesSections(records, { service, campaign, includeEvidenceAppendix = false }) {
  if (service === "PFK") {
    const sections = [
      { heading: "TEST TUTANAĞI", type: "minutes" },
      { heading: "TESİS, CİHAZLAR VE KAYIT DÜZENİ", type: "technical" },
      { heading: "FREKANS SİMÜLASYONU VE BLOK ŞEMA", type: "pfk-simulation" },
      { heading: "PFK AYARLARI, ÇEVRE VE DOĞRULAMA TARİHLERİ", type: "pfk-minutes-details" },
      { heading: "UYGULANAN TESTLER VE GRAFİK EKLERİ", type: "grouped-records", groups: pfkMinutesGroups(records, campaign) },
      { heading: "KATILIMCI / İMZA MATRİSİ", type: "participants" },
      { heading: "SONUÇ, UYGUNSUZLUK DEĞERLENDİRMESİ VE NÜSHA TESLİMİ", type: "summary" }
    ];
    if (includeEvidenceAppendix) sections.push({ heading: "YDA TEKNİK KANIT EKİ", type: "evidence" });
    return sections;
  }
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
    { heading: "E) DEĞERLENDİRME", type: "evaluation" }, { heading: "F) SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
  return [
    { heading: "A) TEST KATILIMCI LİSTESİ", type: "participants" }, { heading: "B) TEKNİK VERİLER", type: "technical" },
    { heading: "C) MAKSİMUM ÇIKIŞ / AŞIRI İKAZ KAPASİTE TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => ["OE_MAX", "UE_MAX"].includes(record.stepId))) },
    { heading: "D) ORTA ÇALIŞMA NOKTASI / %50 TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => ["OE_P50", "UE_P50"].includes(record.stepId))) },
    { heading: "E) DÜŞÜK ÇALIŞMA NOKTASI / %20 TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => ["OE_P20", "UE_P20"].includes(record.stepId))) },
    { heading: "F) GERİLİM KONTROLCÜSÜ PERFORMANS TESTLERİ", type: "records", stepIds: stepIds(recordsFor(records, (record) => ["VCTRL_PLUS1", "VCTRL_MINUS1"].includes(record.stepId) || record.kind === "voltage_control")) },
    { heading: "G) SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
}

export function sectionsForReport({ service, plant, reportType, records, campaign, includeEvidenceAppendix = false }) {
  if (reportType.includes("Sertifika")) return [{ heading: "SERTİFİKA", type: "certificate" }];
  if (isMinutesReport(reportType)) return minutesSections(records, { service, campaign, includeEvidenceAppendix });
  if (service === "PFK") return pfkReportSections(records, campaign, plant, includeEvidenceAppendix);
  if (service === "RGDH") return rgdhSections(records, plant);
  if (service === "SFK") return [
    { heading: "1. GİRİŞ VE TEST KAPSAMI", type: "participants" }, { heading: "2. TEKNİK VERİLER", type: "technical" },
    { heading: "3. SEKONDER FREKANS KONTROL TESTLERİ", type: "records", stepIds: stepIds(records) }, { heading: "4. SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
  return [{ heading: "TEKNİK VERİLER", type: "technical" }, { heading: "TEST SONUÇLARI", type: "records", stepIds: stepIds(records) }, { heading: "SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }];
}
