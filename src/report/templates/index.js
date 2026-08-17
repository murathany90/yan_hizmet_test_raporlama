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
      { heading: `${prefix}.1.a Δf = −200 mHz`, stepIds: stepIds(selected), eventId: "NEG200" },
      { heading: `${prefix}.1.b Δf = +200 mHz`, stepIds: stepIds(selected), eventId: "POS200" }
    ]
  }];
}

function pfkReportSections(records, campaign, plant) {
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
  if (campaign) top.push({ heading: "PFK KAMPANYA / ÜNİTE ÖZETİ", type: "campaign-summary" });
  top.push({ heading: "G) SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" });
  return top;
}

function minutesSections(records) {
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

export function sectionsForReport({ service, plant, reportType, records, campaign }) {
  if (reportType.includes("Sertifika")) return [{ heading: "SERTİFİKA", type: "certificate" }];
  if (isMinutesReport(reportType)) return minutesSections(records);
  if (service === "PFK") return pfkReportSections(records, campaign, plant);
  if (service === "RGDH") return rgdhSections(records, plant);
  if (service === "SFK") return [
    { heading: "1. GİRİŞ VE TEST KAPSAMI", type: "participants" }, { heading: "2. TEKNİK VERİLER", type: "technical" },
    { heading: "3. SEKONDER FREKANS KONTROL TESTLERİ", type: "records", stepIds: stepIds(records) }, { heading: "4. SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }
  ];
  return [{ heading: "TEKNİK VERİLER", type: "technical" }, { heading: "TEST SONUÇLARI", type: "records", stepIds: stepIds(records) }, { heading: "SONUÇ", type: "conclusion" }, { heading: "HAM CSV SHA-256 KANIT MANİFESTİ", type: "evidence" }];
}
