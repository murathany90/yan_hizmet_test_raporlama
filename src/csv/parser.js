const HEADER_ALIASES = {
  zaman: "zaman",
  time_s: "time_s",
  sira_no: "sira_no",
  sıra_no: "sira_no",
  bara_gerilimi: "system_voltage_kv",
  bara_set_gerilimi: "voltage_reference_kv",
  aktif_guc: "total_active_power_mw",
  reaktif_guc: "total_reactive_power_mvar",
  aktif_cikis_gucu: "active_power_mw",
  simule_frekans: "test_frequency_hz",
  sebeke_frekansi: "grid_frequency_hz",
  tesis_toplam_aktif_cikis_gucu: "total_active_power_mw",
  tesis_toplam_reaktif_cikis_gucu: "total_reactive_power_mvar",
  sistem_gerilimi: "system_voltage_kv",
  gerilim_referans_degeri: "voltage_reference_kv"
};

export const CSV_HEADER_LABELS = Object.freeze({ zaman: "ZAMAN", sira_no: "SIRA_NO" });

export function decodeUtf8(input) {
  if (typeof input === "string") return input.replace(/^\uFEFF/, "");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
}

export function hasUtf8Bom(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

export function parseLocaleNumber(value, fallback = Number.NaN) {
  if (value === null || value === undefined || value === "") return fallback;
  let text = String(value).trim().replace(/[\s\u00a0]/g, "");
  if (!text) return fallback;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) text = comma > dot ? text.replaceAll(".", "").replace(",", ".") : text.replaceAll(",", "");
  else if (comma >= 0) {
    const parts = text.split(",");
    text = parts.length > 2 ? `${parts.slice(0, -1).join("")}.${parts.at(-1)}` : text.replace(",", ".");
  } else if ((text.match(/\./g) ?? []).length > 1) {
    const parts = text.split(".");
    text = `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeHeader(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ğ", "g")
    .replaceAll("ü", "u").replaceAll("ö", "o").replaceAll("ç", "c")
    .replace(/\[[^\]]*]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[normalized] ?? normalized;
}

export function parseTurkishTimestamp(value) {
  const text = String(value ?? "").trim().replace(/s$/i, "");
  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:,(\d{1,3}))?$/);
  if (match) {
    const [, day, month, year, hour, minute, second, fraction = "0"] = match;
    const milliseconds = Number(`${fraction}`.padEnd(3, "0").slice(0, 3));
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), milliseconds);
    return Number.isNaN(date.valueOf()) ? Number.NaN : date.valueOf();
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatTurkishTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const fraction = String(date.getMilliseconds()).padStart(3, "0").replace(/0+$/, "") || "0";
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")},${fraction}s`;
}

export function parseDelimitedRows(text, delimiter = ";") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((entry) => entry !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV içinde kapanmamış çift tırnak bulundu.");
  row.push(field.trim());
  if (row.some((entry) => entry !== "")) rows.push(row);
  return rows;
}

export function parseCsv(input) {
  const text = decodeUtf8(input).replaceAll("\0", "");
  const physicalLines = text.split(/\r?\n/);
  const metadata = {};
  let firstDataLine = -1;
  for (let index = 0; index < physicalLines.length; index += 1) {
    const line = physicalLines[index].trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const body = line.slice(1).trim();
      const equals = body.indexOf("=");
      if (equals > 0) metadata[body.slice(0, equals).trim().toUpperCase()] = body.slice(equals + 1).trim();
      continue;
    }
    firstDataLine = index;
    break;
  }
  if (firstDataLine < 0) throw new Error("CSV başlık/veri satırı bulunamadı.");
  if (!physicalLines[firstDataLine].includes(";")) throw new Error("CSV sütun ayıracısı ';' olmalıdır.");
  const matrix = parseDelimitedRows(physicalLines.slice(firstDataLine).join("\n"), ";");
  if (!matrix.length) throw new Error("CSV başlık satırı bulunamadı.");
  const headers = matrix[0].map(normalizeHeader);
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`Tekrarlanan CSV sütunu: ${[...new Set(duplicates)].join(", ")}`);
  const rowErrors = [];
  const rows = matrix.slice(1).map((values, index) => {
    if (values.length !== headers.length) rowErrors.push({ row: index + 2, expected: headers.length, actual: values.length });
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
  return { metadata, headers, rows, rowErrors, delimiter: ";" };
}

export function convertRows(parsed, step) {
  const firstTimestamp = parsed.rows.map((row) => parseTurkishTimestamp(row.zaman)).find(Number.isFinite);
  return parsed.rows.map((rawRow, index) => {
    const row = {};
    const timestampMs = parseTurkishTimestamp(rawRow.zaman);
    const legacyTime = parseLocaleNumber(rawRow.time_s);
    for (const column of step.columns) {
      if (column === "zaman") row.zaman = rawRow.zaman ?? "";
      else if (column === "sira_no") row.sira_no = parseLocaleNumber(rawRow.sira_no, index + 1);
      else row[column] = parseLocaleNumber(rawRow[column]);
    }
    row.timestamp_ms = timestampMs;
    row.time_s = Number.isFinite(timestampMs) && Number.isFinite(firstTimestamp)
      ? (timestampMs - firstTimestamp) / 1000
      : (Number.isFinite(legacyTime) ? legacyTime : index * (step.sampleMs / 1000));
    if (!("zaman" in row) && Number.isFinite(timestampMs)) row.zaman = rawRow.zaman;
    if (!("sira_no" in row)) row.sira_no = parseLocaleNumber(rawRow.sira_no, index + 1);
    return row;
  });
}

function templateTimestamp(metadata) {
  const value = String(metadata.TEST_DATE ?? "").trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[3])}.${Number(match[2])}.${match[1]} 00:00:00,0s` : "1.1.2026 00:00:00,0s";
}

export function csvHeaderLabel(column) { return CSV_HEADER_LABELS[column] ?? column; }

export function makeCsvTemplate(metadata, columns) {
  const lines = Object.entries(metadata).map(([key, value]) => `# ${key}=${value ?? ""}`);
  lines.push(columns.map(csvHeaderLabel).join(";"));
  lines.push(columns.map((column) => {
    if (column === "zaman") return templateTimestamp(metadata);
    if (column === "sira_no") return "1";
    if (column.includes("frequency_hz")) return "50,000";
    return "";
  }).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
