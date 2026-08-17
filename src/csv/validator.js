import { convertRows, parseLocaleNumber } from "./parser.js";
import { PFK_CRITERIA } from "../criteria/pfk.js";

function median(values) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function minimumDurationSeconds(route) {
  const { service, plant, step } = route;
  if (service === "PFK" && ["reserve", "reserve_sequence"].includes(step.kind)) return 900;
  if (service === "PFK" && step.kind === "sensitivity") return 40;
  if (service === "PFK" && step.kind === "validation") return plant === "EDUEDT" ? 10_800 : PFK_CRITERIA.validation24h.minimumSeconds;
  if (service === "PFK" && step.kind === "bess_reserve") return 900;
  if (service === "PFK" && step.kind === "bess_sensitivity") return 40;
  if (service === "RGDH" && step.kind === "capacity") return 600;
  if (service === "RGDH" && step.kind === "voltage_control") return 60;
  if (service === "HFK") return 10;
  if (service === "SFHM") return 900;
  if (service === "SFK") return 300;
  return 1;
}

export function validateParsedCsv(parsed, route, options = {}) {
  const { allowEmpty = false, sampleTolerance = 0.02 } = options;
  const errors = [];
  const warnings = [];
  const hasLegacyTime = parsed.headers.includes("time_s");
  const missingColumns = route.step.columns.filter((column) => {
    if (column === "zaman") return !parsed.headers.includes("zaman") && !hasLegacyTime;
    if (column === "sira_no") return !parsed.headers.includes("sira_no") && !hasLegacyTime;
    return !parsed.headers.includes(column);
  });
  if (missingColumns.length) {
    errors.push(`eksik sütun: ${missingColumns.join(", ")}`);
  }
  for (const rowError of parsed.rowErrors) {
    errors.push(`satır ${rowError.row}: ${rowError.actual}/${rowError.expected} sütun`);
  }
  if (!parsed.rows.length && !allowEmpty) errors.push("veri satırı bulunamadı");

  const rows = missingColumns.length ? [] : convertRows(parsed, route.step);
  let nanCount = 0;
  let firstNan = null;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (const column of route.step.columns.filter((column) => !["zaman", "sira_no"].includes(column))) {
      if (!Number.isFinite(rows[rowIndex][column])) {
        nanCount += 1;
        firstNan ??= { row: rowIndex + 2, column };
      }
    }
  }
  if (nanCount) {
    errors.push(`sayısal olmayan/boş değer: ${nanCount} adet (ilk: satır ${firstNan.row}, ${firstNan.column})`);
  }

  const deltas = [];
  let monotonic = true;
  for (let index = 1; index < rows.length; index += 1) {
    const delta = rows[index].time_s - rows[index - 1].time_s;
    if (!Number.isFinite(delta) || delta <= 0) monotonic = false;
    else deltas.push(delta);
  }
  if (rows.length > 1 && !monotonic) errors.push(hasLegacyTime ? "time_s monoton artmıyor" : "ZAMAN monoton artmıyor");
  if (!hasLegacyTime && rows.length) {
    const invalidSequence = rows.some((row, index) => !Number.isInteger(row.sira_no) || row.sira_no !== index + 1);
    if (invalidSequence) errors.push("SIRA_NO 1’den başlayan ardışık kayıt numarası olmalıdır");
  }

  const sampleSeconds = median(deltas);
  const metadataSampleMs = parseLocaleNumber(parsed.metadata.SAMPLE_PERIOD_MS);
  const expectedSampleMs = Number.isFinite(metadataSampleMs) ? metadataSampleMs : route.step.sampleMs;
  const expectedSampleSeconds = expectedSampleMs / 1000;
  if (Number.isFinite(sampleSeconds)) {
    const difference = Math.abs(sampleSeconds - expectedSampleSeconds);
    if (difference > Math.max(1e-9, expectedSampleSeconds * sampleTolerance)) {
      errors.push(`örnekleme ${sampleSeconds * 1000} ms; beklenen ${expectedSampleMs} ms`);
    }
  }

  if (Number.isFinite(metadataSampleMs) && Math.abs(metadataSampleMs - route.step.sampleMs) > 1e-9) {
    warnings.push(
      `Metadata örneklemesi ${metadataSampleMs} ms, kriter konfigürasyonu ${route.step.sampleMs} ms. Bu dosya yazılım/performance fixture'ı olarak değerlendirilir; resmî saha kayıt çözünürlüğünün yerine geçmez.`
    );
  }

  const durationSeconds = rows.length > 1 ? rows.at(-1).time_s - rows[0].time_s : 0;
  const minimumDuration = minimumDurationSeconds(route);
  if (!allowEmpty && Number.isFinite(durationSeconds) && durationSeconds + expectedSampleSeconds < minimumDuration) {
    errors.push(`kayıt süresi ${durationSeconds.toFixed(3)} s; asgari ${minimumDuration} s`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rows,
    stats: {
      rowCount: rows.length,
      sampleMs: Number.isFinite(sampleSeconds) ? sampleSeconds * 1000 : Number.NaN,
      expectedSampleMs,
      durationSeconds,
      monotonic,
      nanCount
    }
  };
}
