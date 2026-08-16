import { parseLocaleNumber } from "../csv/parser.js";

const number = (value, fallback = Number.NaN) => parseLocaleNumber(value, fallback);
const finite = (values) => values.filter(Number.isFinite);

export function average(values) {
  const valid = finite(values);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : Number.NaN;
}

export function median(values) {
  const valid = finite(values).sort((left, right) => left - right);
  if (!valid.length) return Number.NaN;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

export function standardDeviation(values) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

export function formatMetric(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function sampleDeltas(rows) {
  const deltas = [];
  for (let index = 1; index < rows.length; index += 1) {
    const delta = number(rows[index].time_s) - number(rows[index - 1].time_s);
    if (delta > 0) deltas.push(delta);
  }
  return deltas;
}

function duration(rows) {
  if (rows.length < 2) return 0;
  return number(rows.at(-1).time_s) - number(rows[0].time_s);
}

function evaluatePfkReserve(record, metadata, plant) {
  const rows = record.rows;
  const pnom = number(metadata.PNOM_MW, 500);
  const reserve = number(metadata.RPMAX_MW, 25);
  const direction = record.step.id.includes("NEG200") ? 1 : -1;
  const baseline = average(rows.filter((row) => number(row.time_s) < 0 && number(row.time_s) >= -20).map((row) => number(row.active_power_mw)));
  const responses = rows.map((row) => ({ time: number(row.time_s), value: direction * (number(row.active_power_mw) - baseline) }));
  const noise = standardDeviation(responses.filter((item) => item.time < 0).map((item) => item.value));
  const detectionThreshold = Math.max(3 * noise, 0.0005 * pnom, 0.005 * reserve);
  let delay = Number.NaN;
  let t50 = Number.NaN;
  let t100 = Number.NaN;
  for (const response of responses) {
    if (response.time < 0) continue;
    if (!Number.isFinite(delay) && response.value >= detectionThreshold) delay = response.time;
    if (!Number.isFinite(t50) && response.value >= 0.5 * reserve) t50 = response.time;
    if (!Number.isFinite(t100) && response.value >= 0.98 * reserve) t100 = response.time;
  }
  const sampleSeconds = median(sampleDeltas(rows));
  const delayLimit = plant === "HES" ? 4 : 2;
  const passed = sampleSeconds <= 0.1005 && delay <= delayLimit && t50 <= 15 && t100 <= 30 && duration(rows) >= 900;
  return {
    status: passed ? "GEÇTİ" : "KALDI",
    detail: `Δtd=${formatMetric(delay)} s; t50=${formatMetric(t50)} s; t100=${formatMetric(t100)} s; dt=${formatMetric(sampleSeconds * 1000, 0)} ms`,
    metrics: { delaySeconds: delay, t50Seconds: t50, t100Seconds: t100, sampleMs: sampleSeconds * 1000, durationSeconds: duration(rows) }
  };
}

function evaluatePfkBessReserve(record, metadata) {
  const reserve = number(metadata.RPMAX_MW, 25);
  const direction = record.step.id.includes("NEG200") ? 1 : -1;
  const baseline = average(record.rows.filter((row) => number(row.time_s) < 0).map((row) => number(row.active_power_mw)));
  let delay = Number.NaN;
  let t50 = Number.NaN;
  let t100 = Number.NaN;
  for (const row of record.rows) {
    const time = number(row.time_s);
    const response = direction * (number(row.active_power_mw) - baseline);
    if (time < 0) continue;
    if (!Number.isFinite(delay) && response >= 0.01 * reserve) delay = time;
    if (!Number.isFinite(t50) && response >= 0.5 * reserve) t50 = time;
    if (!Number.isFinite(t100) && response >= 0.98 * reserve) t100 = time;
  }
  const passed = delay <= 2 && t50 <= 15 && t100 <= 30;
  return {
    status: passed ? "GEÇTİ" : "KALDI",
    detail: `Δtd=${formatMetric(delay)} s; t50=${formatMetric(t50)} s; t100=${formatMetric(t100)} s`,
    metrics: { delaySeconds: delay, t50Seconds: t50, t100Seconds: t100 }
  };
}

function evaluateHfk(record, metadata) {
  const sampleSeconds = median(sampleDeltas(record.rows));
  const trigger = record.rows.find((row) => number(row.trigger) >= 0.5);
  const triggerTime = trigger ? number(trigger.time_s) : 0;
  const baseline = average(record.rows.filter((row) => number(row.time_s) < triggerTime).map((row) => number(row.active_power_mw)));
  const reserve = number(metadata.HFK_RESERVE_MW, 20);
  const direction = record.step.id.includes("LOWER") ? -1 : 1;
  let fullReserveSeconds = Number.NaN;
  for (const row of record.rows) {
    if (number(row.time_s) >= triggerTime && direction * (number(row.active_power_mw) - baseline) >= 0.98 * reserve) {
      fullReserveSeconds = number(row.time_s) - triggerTime;
      break;
    }
  }
  const limit = record.step.kind === "sync_support" ? 0.2 : 1;
  const looksSuitable = sampleSeconds <= 0.0205 && fullReserveSeconds <= limit;
  return {
    status: "TEKNİK ÖN DEĞERLENDİRME",
    detail: `${looksSuitable ? "Teknik eşiklerle uyumlu görünüm" : "Mühendislik incelemesi gerekli"}; dt=${formatMetric(sampleSeconds * 1000, 1)} ms; tam rezerv=${formatMetric(fullReserveSeconds * 1000, 1)} ms / ${formatMetric(limit * 1000, 0)} ms`,
    metrics: { sampleMs: sampleSeconds * 1000, fullReserveMs: fullReserveSeconds * 1000, limitMs: limit * 1000 }
  };
}

function evaluateRgdh(record, metadata) {
  if (record.step.kind !== "capacity") {
    const voltage = record.rows.map((row) => number(row.system_voltage_kv ?? row.bus_voltage_kv)).filter(Number.isFinite);
    return {
      status: "YÜKLENDİ",
      detail: `Gerilim kontrolcüsü kaydı yüklendi; Vmin=${formatMetric(Math.min(...voltage))} kV, Vmax=${formatMetric(Math.max(...voltage))} kV.`,
      metrics: { voltageMinKv: voltage.length ? Math.min(...voltage) : Number.NaN, voltageMaxKv: voltage.length ? Math.max(...voltage) : Number.NaN }
    };
  }
  const qColumn = record.rows[0] && "reactive_power_mvar" in record.rows[0] ? "reactive_power_mvar" : "total_reactive_power_mvar";
  const defaultTarget = record.step.id.includes("UE") || record.step.id.includes("CHARGE_UE")
    ? number(metadata.Q_REQUIRED_UE_MVAR)
    : number(metadata.Q_REQUIRED_OE_MVAR);
  const target = number(metadata.STEP_Q_TARGET_MVAR, defaultTarget);
  if (!Number.isFinite(target)) {
    return { status: "YÜKLENDİ", detail: "Q zorunlu değeri girildiğinde otomatik kapasite değerlendirmesi yapılır.", metrics: {} };
  }
  const tail = record.rows.slice(Math.max(0, record.rows.length - 600));
  const meanReactivePower = average(tail.map((row) => number(row[qColumn])));
  const passed = Math.abs(meanReactivePower) >= 0.9 * Math.abs(target);
  return {
    status: passed ? "GEÇTİ" : "KALDI",
    detail: `Son bölüm Qort=${formatMetric(meanReactivePower)} MVAr; zorunlu Q=${formatMetric(target)} MVAr`,
    metrics: { meanReactivePowerMvar: meanReactivePower, targetReactivePowerMvar: target }
  };
}

function evaluateSfk(record, metadata, plant) {
  if (record.step.kind !== "agc_step") {
    return { status: plant === "EDUEDT" ? "TEKNİK ÖN DEĞERLENDİRME" : "YÜKLENDİ", detail: "AGC/LFC durum ve alarm sinyalleri grafik incelemesine hazır.", metrics: {} };
  }
  const pnom = number(metadata.PNOM_MW, 100);
  const delays = [];
  let maximumRamp = 0;
  for (let index = 1; index < record.rows.length; index += 1) {
    const previousSetpoint = number(record.rows[index - 1].agc_setpoint_mw);
    const currentSetpoint = number(record.rows[index].agc_setpoint_mw);
    if (Math.abs(currentSetpoint - previousSetpoint) > 0.1) {
      const startTime = number(record.rows[index].time_s);
      const startPower = number(record.rows[index - 1].active_power_mw);
      const direction = Math.sign(currentSetpoint - previousSetpoint);
      for (let cursor = index; cursor < record.rows.length; cursor += 1) {
        if (number(record.rows[cursor].time_s) - startTime > 60) break;
        if (direction * (number(record.rows[cursor].active_power_mw) - startPower) >= Math.max(0.2, 0.002 * pnom)) {
          delays.push(number(record.rows[cursor].time_s) - startTime);
          break;
        }
      }
    }
    const deltaTime = number(record.rows[index].time_s) - number(record.rows[index - 1].time_s);
    const ramp = Math.abs((number(record.rows[index].active_power_mw) - number(record.rows[index - 1].active_power_mw)) / deltaTime);
    if (Number.isFinite(ramp)) maximumRamp = Math.max(maximumRamp, ramp);
  }
  const maximumDelay = delays.length ? Math.max(...delays) : Number.NaN;
  const detail = `Gecikme=${formatMetric(maximumDelay, 1)} s; max rampa=${formatMetric(maximumRamp)} MW/s`;
  return {
    status: plant === "EDUEDT" ? "TEKNİK ÖN DEĞERLENDİRME" : "YÜKLENDİ",
    detail,
    metrics: { maximumDelaySeconds: maximumDelay, maximumRampMwPerSecond: maximumRamp }
  };
}

function evaluateSfhm(record, metadata) {
  const reserve = number(metadata.SFHM_RESERVE_MW, 20);
  const baseline = average(record.rows.slice(0, Math.min(20, record.rows.length)).map((row) => number(row.active_power_mw)));
  const direction = record.step.id.includes("49_6") ? 1 : -1;
  let delay = Number.NaN;
  let t50 = Number.NaN;
  let t100 = Number.NaN;
  for (const row of record.rows) {
    const time = number(row.time_s);
    const response = direction * (number(row.active_power_mw) - baseline);
    if (time < 0) continue;
    if (!Number.isFinite(delay) && response >= 0.01 * reserve) delay = time;
    if (!Number.isFinite(t50) && response >= 0.5 * reserve) t50 = time;
    if (!Number.isFinite(t100) && response >= 0.98 * reserve) t100 = time;
  }
  return {
    status: "TEKNİK ÖN DEĞERLENDİRME",
    detail: `Δtd=${formatMetric(delay)} s; t50=${formatMetric(t50)} s; t100=${formatMetric(t100)} s`,
    metrics: { delaySeconds: delay, t50Seconds: t50, t100Seconds: t100 }
  };
}

export function evaluateRecord(record, context) {
  const { service, plant, metadata } = context;
  if (service === "PFK" && record.step.kind === "reserve") return evaluatePfkReserve(record, metadata, plant);
  if (service === "PFK" && record.step.kind === "bess_reserve") return evaluatePfkBessReserve(record, metadata);
  if (service === "HFK") return evaluateHfk(record, metadata);
  if (service === "RGDH") return evaluateRgdh(record, metadata);
  if (service === "SFK") return evaluateSfk(record, metadata, plant);
  if (service === "SFHM") return evaluateSfhm(record, metadata);
  const sampleMs = median(sampleDeltas(record.rows)) * 1000;
  return {
    status: "YÜKLENDİ",
    detail: `Veri yüklendi; ${record.rows.length} satır, dt=${formatMetric(sampleMs, 1)} ms.`,
    metrics: { rowCount: record.rows.length, sampleMs, durationSeconds: duration(record.rows) }
  };
}

