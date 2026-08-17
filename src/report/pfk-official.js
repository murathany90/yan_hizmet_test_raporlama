/**
 * PFK official-document helpers shared by HTML preview and PDF/DOCX exports.
 * The diagram deliberately describes the test topology; it never reproduces
 * scanned signatures, seals, or raster material from a reference document.
 */
export function pfkSimulationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="190" viewBox="0 0 720 190" role="img" aria-label="PFK frekans simülasyon blok şeması"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#245c88"/></marker></defs><rect width="720" height="190" fill="#fbfdff"/><g fill="#eaf2f7" stroke="#245c88" stroke-width="2"><rect x="18" y="64" width="118" height="48" rx="6"/><rect x="184" y="64" width="142" height="48" rx="6"/><rect x="378" y="64" width="130" height="48" rx="6"/><rect x="558" y="64" width="142" height="48" rx="6"/><rect x="378" y="132" width="130" height="34" rx="6"/></g><g stroke="#245c88" stroke-width="2" marker-end="url(#arrow)"><path d="M136 88H184"/><path d="M326 88H378"/><path d="M508 88H558"/><path d="M443 132V114"/></g><g font-family="Arial,sans-serif" font-size="13" fill="#172630" text-anchor="middle"><text x="77" y="84">f_şebeke +</text><text x="77" y="101">Test Sinyali</text><text x="255" y="84">Simülasyon</text><text x="255" y="101">Yöntemi</text><text x="443" y="84">f_simüle</text><text x="443" y="101">Toplama noktası</text><text x="629" y="84">Hız</text><text x="629" y="101">Regülatörü</text><text x="443" y="154">f_ref</text></g></svg>`;
}

function display(value) {
  return String(value ?? "").trim() || "Bilgi girilmedi";
}

export function pfkMinutesDetails(model) {
  const validation = model.records.find((record) => record.stepId === "DOGRULAMA_24H");
  const rows = validation?.metrics?.validationRows ?? [];
  const start = rows.at(0)?.zaman ?? rows.at(0)?.timestamp ?? validation?.evidence?.start;
  const end = rows.at(-1)?.zaman ?? rows.at(-1)?.timestamp ?? validation?.evidence?.end;
  const meta = model.metadata;
  return [
    ["Test dönemi", `${display(meta.TEST_START_DATE || meta.TEST_DATE)} – ${display(meta.TEST_END_DATE || meta.TEST_DATE)}`],
    ["Belge düzenleme tarihi", display(meta.DOCUMENT_DATE || meta.TEST_END_DATE || meta.TEST_DATE)],
    ["24 saat doğrulama başlangıcı", display(start)],
    ["24 saat doğrulama bitişi", display(end)],
    ["Örnekleme", `${Number.isFinite(Number(validation?.metrics?.sampleMs)) ? Number(validation.metrics.sampleMs).toFixed(0) : "100"} ms`],
    ["Tesis toplam kurulu güç", `${display(meta.PLANT_TOTAL_INSTALLED_MW)} MW`],
    ["Ünite Pnom / RPmax", `${display(meta.UNIT_PNOM_MW || meta.PNOM_MW)} MW / ${display(meta.RPMAX_MW)} MW`],
    ["İşletme modu", display(meta.UNIT_OPERATION_MODES || meta.UNIT_OPERATION_MODE || meta.PFK_OPERATION_MODE)],
    ["Droop / ölü bant", `${display(meta.DROOP_PERCENT || meta.DROOP_RANGE_PERCENT)} % / ${display(meta.DEADBAND_MHZ)} mHz`],
    ["Çevre / kot", `${display(meta.AMBIENT_TEMPERATURE_C)} °C / ${display(meta.ALTITUDE_M)} m`]
  ];
}
