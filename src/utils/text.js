export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeFilename(value, fallback = "TEIAS-YHDA-raporu") {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || fallback;
}

export function csvSafeValue(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function inferUnit(key, label = "") {
  const source = `${key} ${label}`.toUpperCase();
  if (/MVAR/.test(source)) return "MVAr";
  if (/MWH/.test(source)) return "MWh";
  if (/\bMW\b|_MW/.test(source)) return "MW";
  if (/\bKV\b|_KV/.test(source)) return "kV";
  if (/MHZ/.test(source)) return "mHz";
  if (/\bHZ\b|_HZ/.test(source)) return "Hz";
  if (/\bMS\b|_MS/.test(source)) return "ms";
  if (/PERCENT|YÜZDE|\[%\]|_PCT/.test(source)) return "%";
  if (/\bRPM\b|_RPM/.test(source)) return "rpm";
  if (/\bBAR\b|_BAR/.test(source)) return "bar";
  if (/\bAKIM\b|\[A\]|CURRENT_A\b|(?:^|_)A$/.test(source)) return "A";
  return "—";
}

export function dataUrlToUint8Array(dataUrl) {
  const [, base64 = ""] = String(dataUrl).split(",", 2);
  if (typeof atob === "function") {
    const raw = atob(base64);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export async function urlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Varlık yüklenemedi: ${url}`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
