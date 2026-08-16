const HEADER_ALIASES = {
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

export function decodeUtf8(input) {
  if (typeof input === "string") return input.replace(/^\uFEFF/, "");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return decoded.replace(/^\uFEFF/, "");
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
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) text = text.replaceAll(".", "").replace(",", ".");
    else text = text.replaceAll(",", "");
  } else if (comma >= 0) {
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
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/\[[^\]]*]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[normalized] ?? normalized ?? "";
}

export function parseDelimitedRows(text, delimiter = ";") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV içinde kapanmamış çift tırnak bulundu.");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
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
      if (equals > 0) {
        metadata[body.slice(0, equals).trim().toUpperCase()] = body.slice(equals + 1).trim();
      }
      continue;
    }
    firstDataLine = index;
    break;
  }

  if (firstDataLine < 0) throw new Error("CSV başlık/veri satırı bulunamadı.");
  const headerLine = physicalLines[firstDataLine];
  if (!headerLine.includes(";")) {
    throw new Error("CSV sütun ayırıcısı ';' olmalıdır.");
  }

  const matrix = parseDelimitedRows(physicalLines.slice(firstDataLine).join("\n"), ";");
  if (!matrix.length) throw new Error("CSV başlık satırı bulunamadı.");
  const headers = matrix[0].map(normalizeHeader);
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`Tekrarlanan CSV sütunu: ${[...new Set(duplicates)].join(", ")}`);

  const rowErrors = [];
  const rows = matrix.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      rowErrors.push({ row: rowIndex + 2, expected: headers.length, actual: values.length });
    }
    return Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]));
  });

  return { metadata, headers, rows, rowErrors, delimiter: ";" };
}

export function convertRows(parsed, step) {
  return parsed.rows.map((rawRow, index) => {
    const row = {};
    for (const column of step.columns) {
      let value = rawRow[column];
      if (column === "time_s" && value === undefined && rawRow.timestamp !== undefined) {
        value = index * (step.sampleMs / 1000);
      }
      row[column] = parseLocaleNumber(value);
    }
    return row;
  });
}

export function makeCsvTemplate(metadata, columns) {
  const lines = Object.entries(metadata).map(([key, value]) => `# ${key}=${value ?? ""}`);
  lines.push(columns.join(";"));
  lines.push(columns.map((column) => (column === "time_s" ? "0" : column.includes("frequency_hz") ? "50,000" : "")).join(";"));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

