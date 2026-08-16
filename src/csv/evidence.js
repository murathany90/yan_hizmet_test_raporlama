const encoder = new TextEncoder();

export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) return "NOT_AVAILABLE";
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function rawCsvEvidence({ bytes, filename, route, validation, rows }) {
  return {
    filename,
    sha256: await sha256Hex(bytes),
    service: route.service,
    plant: route.plant,
    unitId: route.campaign?.unitId ?? "",
    stepId: route.stepId,
    rowCount: validation.stats.rowCount,
    start: rows[0]?.zaman ?? "",
    end: rows.at(-1)?.zaman ?? "",
    sampleMs: validation.stats.sampleMs
  };
}

export function rawEvidenceManifestCsv(evidenceRows) {
  const headers = ["Dosya", "SHA256", "Hizmet", "Tesis", "Ünite", "STEP_ID", "Satır", "Başlangıç", "Bitiş", "Örnekleme_ms"];
  const rows = evidenceRows.map((item) => [
    item.filename, item.sha256, item.service, item.plant, item.unitId, item.stepId, item.rowCount,
    item.start, item.end, Number.isFinite(item.sampleMs) ? item.sampleMs.toFixed(3) : ""
  ]);
  const escaped = (value) => String(value ?? "").replaceAll(";", ",").replaceAll("\r", " ").replaceAll("\n", " ");
  return `\uFEFF${headers.join(";")}\r\n${rows.map((row) => row.map(escaped).join(";")).join("\r\n")}\r\n`;
}

export function rawEvidenceManifestBytes(evidenceRows) {
  return encoder.encode(rawEvidenceManifestCsv(evidenceRows));
}
