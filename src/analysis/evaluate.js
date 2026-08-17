import { parseLocaleNumber } from "../csv/parser.js";
import { PFK_CRITERIA } from "../criteria/pfk.js";

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

function responsePercent(responses, reserve, seconds) {
  const values = responses.filter((item) => item.time >= 0 && item.time <= seconds).map((item) => item.value);
  const response = values.length ? Math.max(...values) : Number.NaN;
  return Number.isFinite(response) && reserve ? (response / Math.abs(reserve)) * 100 : Number.NaN;
}

function pfkEventTime(rows) {
  const baselineFrequency = average(rows.slice(0, Math.min(200, rows.length)).map((row) => number(row.test_frequency_hz)));
  const event = rows.find((row) => Math.abs(number(row.test_frequency_hz) - baselineFrequency) >= 0.03);
  return event ? number(event.time_s) : 0;
}

function evaluatePfkReserve(record, metadata, plant) {
  const rows = record.rows;
  const pnom = number(metadata.PNOM_MW, 500);
  const reserve = number(metadata.RPMAX_MW, 25);
  const direction = record.step.id.includes("NEG200") ? 1 : -1;
  const eventTime = pfkEventTime(rows);
  const baseline = average(rows.filter((row) => number(row.time_s) < eventTime).slice(-200).map((row) => number(row.active_power_mw)));
  const responses = rows.map((row) => ({ time: number(row.time_s) - eventTime, value: direction * (number(row.active_power_mw) - baseline) }));
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
  const trpA = responsePercent(responses, reserve, delayLimit);
  const trpB = responsePercent(responses, reserve, 15);
  const trpC = responsePercent(responses, reserve, 30);
  return {
    status: passed ? "GEÇTİ" : "KALDI",
    detail: `Δtd=${formatMetric(delay)} s; t50=${formatMetric(t50)} s; t100=${formatMetric(t100)} s; TRP-A/B/C=${formatMetric(trpA, 1)}/${formatMetric(trpB, 1)}/${formatMetric(trpC, 1)} %; dt=${formatMetric(sampleSeconds * 1000, 0)} ms`,
    metrics: { delaySeconds: delay, t50Seconds: t50, t100Seconds: t100, trpA, trpB, trpC, sampleMs: sampleSeconds * 1000, durationSeconds: duration(rows) }
  };
}

function atOrAfter(rows, startIndex, seconds) {
  const start = number(rows[startIndex]?.time_s);
  for (let index = startIndex; index < rows.length; index += 1) {
    if (number(rows[index].time_s) - start >= seconds) return index;
  }
  return rows.length - 1;
}

function statusFromChecks(checks, missing = false) {
  if (missing) return "İNCELEME GEREKLİ";
  return checks.every(Boolean) ? "GEÇTİ" : "KALDI";
}

/** Returns stable -200/+200 mHz plateaus from a single canonical reserve CSV. */
export function segmentPfkReserveEvents(rows, criteria = PFK_CRITERIA) {
  const settings = criteria.reserve;
  const sampleSeconds = median(sampleDeltas(rows));
  const debounceRows = Math.max(3, Math.ceil((settings.debounceMs / 1000) / (sampleSeconds || 0.1)));
  const events = [];
  let index = 0;
  while (index < rows.length) {
    const frequency = number(rows[index].test_frequency_hz);
    const eventId = Object.entries(settings.eventTargetsHz).find(([, target]) => Math.abs(frequency - target) <= settings.eventTargetToleranceHz)?.[0];
    if (!eventId) {
      index += 1;
      continue;
    }
    const startIndex = index;
    while (index < rows.length && Math.abs(number(rows[index].test_frequency_hz) - settings.eventTargetsHz[eventId]) <= settings.eventTargetToleranceHz) index += 1;
    const endIndex = index - 1;
    if (endIndex - startIndex + 1 >= debounceRows) {
      events.push({
        eventId,
        startIndex,
        endIndex,
        startTimeSeconds: number(rows[startIndex].time_s),
        durationSeconds: number(rows[endIndex].time_s) - number(rows[startIndex].time_s)
      });
    }
  }
  return { events, sampleSeconds, debounceRows };
}

function evaluateReserveEvent(rows, event, metadata, plant, criteria = PFK_CRITERIA) {
  const settings = criteria.reserve;
  const pnom = number(metadata.PNOM_MW, Number.NaN);
  const reserve = number(metadata.RPMAX_MW, Number.NaN);
  const start = event.startIndex;
  const end = Math.min(event.endIndex, atOrAfter(rows, start, settings.sustainSeconds));
  const before = rows.slice(Math.max(0, start - 200), start)
    .filter((row) => Math.abs(number(row.test_frequency_hz) - settings.nominalFrequencyHz) <= settings.nominalToleranceHz);
  const baselineRows = before.length ? before : rows.slice(Math.max(0, start - 200), start);
  const baseline = average(baselineRows.map((row) => number(row.active_power_mw)));
  const direction = event.eventId === "NEG200" ? 1 : -1;
  const eventRows = rows.slice(start, end + 1);
  const relative = eventRows.map((row) => ({ row, time: number(row.time_s) - number(rows[start].time_s), response: direction * (number(row.active_power_mw) - baseline) }));
  const noise = standardDeviation(baselineRows.map((row) => direction * (number(row.active_power_mw) - baseline)));
  const threshold = Math.max(3 * (Number.isFinite(noise) ? noise : 0), 0.0005 * (Number.isFinite(pnom) ? pnom : 0), 0.005 * (Number.isFinite(reserve) ? reserve : 0));
  let delay = Number.NaN;
  let t50 = Number.NaN;
  let t100 = Number.NaN;
  for (const item of relative) {
    if (!Number.isFinite(delay) && item.response >= threshold) delay = item.time;
    if (!Number.isFinite(t50) && item.response >= 0.5 * reserve) t50 = item.time;
    if (!Number.isFinite(t100) && item.response >= 0.98 * reserve) t100 = item.time;
  }
  const trp = Object.fromEntries(settings.trpBands.map((band) => {
    const startSeconds = band.start === "response" ? (Number.isFinite(delay) ? delay : Number.POSITIVE_INFINITY) : band.startSeconds;
    const selected = relative.filter((item) => item.time >= startSeconds && item.time <= band.endSeconds && Number.isFinite(item.response));
    const toleranceMw = band.tolerancePnomRatio * pnom;
    const inside = selected.filter((item) => {
      const expected = reserve * Math.max(0, Math.min(1, (item.time - (Number.isFinite(delay) ? delay : 0)) / Math.max(1, settings.t100LimitSeconds - (Number.isFinite(delay) ? delay : 0))));
      return Math.abs(item.response - expected) <= toleranceMw;
    }).length;
    const percentage = selected.length ? (inside / selected.length) * 100 : Number.NaN;
    return [band.id, { percentage, samples: selected.length, inside, toleranceMw }];
  }));
  const delayLimit = settings.responseDelayLimitSeconds[plant] ?? settings.responseDelayLimitSeconds.DEFAULT;
  const sampleSeconds = median(sampleDeltas(eventRows));
  const sustained = event.durationSeconds + (sampleSeconds || 0) >= settings.sustainSeconds;
  const checks = [
    Number.isFinite(pnom) && pnom > 0,
    Number.isFinite(reserve) && reserve > 0,
    Number.isFinite(baseline),
    sampleSeconds <= (criteria.sampling.requiredMs / 1000) * (1 + criteria.sampling.toleranceRatio),
    delay <= delayLimit,
    t50 <= settings.t50LimitSeconds,
    t100 <= settings.t100LimitSeconds,
    sustained,
    ...Object.values(trp).map((item) => item.percentage >= settings.trpPassRatio * 100)
  ];
  const missing = !Number.isFinite(pnom) || !Number.isFinite(reserve) || !Number.isFinite(baseline);
  const chartRows = rows.slice(Math.max(0, start - Math.ceil(settings.preEventWindowSeconds / (sampleSeconds || 0.1))), end + 1).map((row) => {
    const time = number(row.time_s) - number(rows[start].time_s);
    const expectedResponse = time < 0 ? 0 : reserve * Math.max(0, Math.min(1, (time - (Number.isFinite(delay) ? delay : 0)) / Math.max(1, settings.t100LimitSeconds - (Number.isFinite(delay) ? delay : 0))));
    const expectedActive = baseline + direction * expectedResponse;
    const tolerance = (time >= 0 ? (time <= 90 ? 0.02 : 0.01) : 0.02) * pnom;
    return {
      ...row,
      time_s: time,
      expected_active_power_mw: expectedActive,
      tolerance_lower_mw: expectedActive - tolerance,
      tolerance_upper_mw: expectedActive + tolerance
    };
  });
  return {
    ...event,
    direction: direction > 0 ? "UNDER_FREQUENCY" : "OVER_FREQUENCY",
    status: statusFromChecks(checks, missing),
    baselinePowerMw: baseline,
    reserveMw: reserve,
    delaySeconds: delay,
    t50Seconds: t50,
    t100Seconds: t100,
    sampleMs: sampleSeconds * 1000,
    sustainSeconds: event.durationSeconds,
    trp,
    chartRows,
    detail: `Δtd=${formatMetric(delay)} s; t50=${formatMetric(t50)} s; t100=${formatMetric(t100)} s; TRP-A/B/C=${formatMetric(trp.TRP_A.percentage, 1)}/${formatMetric(trp.TRP_B.percentage, 1)}/${formatMetric(trp.TRP_C.percentage, 1)} %.`
  };
}

function evaluatePfkReserveSequence(record, metadata, plant) {
  const segmentation = segmentPfkReserveEvents(record.rows);
  const expected = record.legacyReserveEventId ? [record.legacyReserveEventId] : ["NEG200", "POS200"];
  const selected = [];
  const warnings = [];
  let cursor = 0;
  for (const eventId of expected) {
    const found = segmentation.events.findIndex((event, index) => index >= cursor && event.eventId === eventId);
    if (found < 0) {
      warnings.push(`${eventId === "NEG200" ? "−200" : "+200"} mHz olayı bulunamadı.`);
      continue;
    }
    selected.push(evaluateReserveEvent(record.rows, segmentation.events[found], metadata, plant));
    cursor = found + 1;
  }
  const outOfOrder = !record.legacyReserveEventId && segmentation.events.some((event, index) => index && event.eventId === "NEG200" && segmentation.events[index - 1].eventId === "POS200");
  if (outOfOrder) warnings.push("Olay sırası −200 mHz, ardından +200 mHz olmalıdır.");
  const allPassed = selected.length === expected.length && selected.every((event) => event.status === "GEÇTİ") && !outOfOrder;
  const status = allPassed ? "GEÇTİ" : (selected.length !== expected.length || outOfOrder ? "İNCELEME GEREKLİ" : "KALDI");
  const summary = selected.map((event) => `${event.eventId === "NEG200" ? "−200" : "+200"} mHz: ${event.status}`).join("; ");
  return {
    status,
    detail: `${summary || "Olay segmenti bulunamadı."}${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
    metrics: {
      criteriaId: PFK_CRITERIA.id,
      events: selected,
      segmentation: { detectedCount: segmentation.events.length, debounceRows: segmentation.debounceRows, warnings },
      sampleMs: segmentation.sampleSeconds * 1000
    }
  };
}

function evaluatePfkValidation(record, metadata) {
  const pnom = number(metadata.PNOM_MW, Number.NaN);
  const reserve = number(metadata.RPMAX_MW, Number.NaN);
  const rows = record.rows;
  const baselineReference = average(rows.slice(0, Math.min(600, rows.length)).map((row) => number(row.active_power_reference_mw)));
  const valid = rows.filter((row) => Number.isFinite(number(row.grid_frequency_hz)) && Number.isFinite(number(row.active_power_mw)));
  const derivedRows = valid.map((row) => {
    const reference = number(row.active_power_reference_mw, baselineReference);
    const expected = reference + reserve * Math.max(-1, Math.min(1, (PFK_CRITERIA.reserve.nominalFrequencyHz - number(row.grid_frequency_hz)) / 0.2));
    const tolerance = pnom * PFK_CRITERIA.validation24h.expectedPowerTolerancePnomRatio;
    return { ...row, expected_active_power_mw: expected, tolerance_lower_mw: expected - tolerance, tolerance_upper_mw: expected + tolerance };
  });
  const inside = derivedRows.filter((row) => Math.abs(number(row.active_power_mw) - row.expected_active_power_mw) <= pnom * PFK_CRITERIA.validation24h.expectedPowerTolerancePnomRatio).length;
  const ratio = derivedRows.length ? (inside / derivedRows.length) * 100 : Number.NaN;
  const sampleSeconds = median(sampleDeltas(rows));
  const durationSeconds = duration(rows);
  const positiveIndex = derivedRows.reduce((best, row, index) => !best || number(row.grid_frequency_hz) > number(derivedRows[best].grid_frequency_hz) ? index : best, 0);
  const negativeIndex = derivedRows.reduce((best, row, index) => !best || number(row.grid_frequency_hz) < number(derivedRows[best].grid_frequency_hz) ? index : best, 0);
  const window = (index) => derivedRows.slice(Math.max(0, index - 600), Math.min(derivedRows.length, index + 601));
  const missing = !Number.isFinite(pnom) || !Number.isFinite(reserve) || !Number.isFinite(baselineReference);
  const passed = !missing && durationSeconds + (sampleSeconds || 0) >= PFK_CRITERIA.validation24h.minimumSeconds && ratio >= PFK_CRITERIA.validation24h.passRatio * 100;
  return {
    status: statusFromChecks([passed], missing),
    detail: `24 saat uygunluk oranı=${formatMetric(ratio, 1)} %; süre=${formatMetric(durationSeconds, 0)} s; kabul ≥${PFK_CRITERIA.validation24h.passRatio * 100} % ve ≥${PFK_CRITERIA.validation24h.minimumSeconds} s.`,
    metrics: { criteriaId: PFK_CRITERIA.id, durationSeconds, sampleMs: sampleSeconds * 1000, compliancePercent: ratio, validationRows: derivedRows, positiveCriticalWindow: window(positiveIndex), negativeCriticalWindow: window(negativeIndex) }
  };
}

function evaluatePfkBessReserve(record, metadata) {
  const reserve = number(metadata.RPMAX_MW, 25);
  const direction = record.step.id.includes("NEG200") ? 1 : -1;
  const eventTime = pfkEventTime(record.rows);
  const baseline = average(record.rows.filter((row) => number(row.time_s) < eventTime).slice(-200).map((row) => number(row.active_power_mw)));
  let delay = Number.NaN;
  let t50 = Number.NaN;
  let t100 = Number.NaN;
  for (const row of record.rows) {
    const time = number(row.time_s) - eventTime;
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

function evaluatePfkSensitivity(record, metadata) {
  const rows = record.rows;
  const baselineFrequency = average(rows.slice(0, Math.min(100, rows.length)).map((row) => number(row.test_frequency_hz)));
  const segments = [];
  let active = null;
  for (const row of rows) {
    const frequency = number(row.test_frequency_hz);
    const target = Number.isFinite(frequency) && Math.abs(frequency - baselineFrequency) >= 0.002 ? frequency.toFixed(3) : "";
    if (target !== active?.target) {
      if (active?.rows.length >= 5) segments.push(active);
      active = target ? { target, rows: [row] } : null;
    } else if (active) active.rows.push(row);
  }
  if (active?.rows.length >= 5) segments.push(active);
  const baselinePower = average(rows.slice(0, Math.min(100, rows.length)).map((row) => number(row.active_power_mw)));
  const pnom = number(metadata.PNOM_MW, 1);
  const results = segments.slice(0, 4).map((segment) => {
    const meanPower = average(segment.rows.map((row) => number(row.active_power_mw)));
    return { frequencyHz: Number(segment.target), deltaPowerMw: meanPower - baselinePower, sensitivityMwPerHz: (meanPower - baselinePower) / (Number(segment.target) - baselineFrequency) };
  });
  const passed = results.length >= 4 && results.every((item) => Number.isFinite(item.deltaPowerMw) && Math.abs(item.deltaPowerMw) <= Math.max(pnom * 0.04, 10));
  return {
    status: passed ? "GEÇTİ" : "İNCELEME GEREKLİ",
    detail: results.length ? `Tek CSV içinde ${results.length}/4 hassasiyet basamağı tespit edildi: ${results.map((item) => `${item.frequencyHz.toFixed(3)} Hz / ΔP=${formatMetric(item.deltaPowerMw, 3)} MW`).join("; ")}` : "Hassasiyet frekans basamakları tek CSV içinde tespit edilemedi.",
    metrics: { sensitivityResults: results, segmentCount: results.length }
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
    const reference = record.rows.map((row) => number(row.voltage_reference_kv)).filter(Number.isFinite);
    if (voltage.length < 3 || reference.length < 2) {
      return { status: "İNCELEME GEREKLİ", detail: "Gerilim kontrolü için sistem gerilimi ve gerilim referansı kanalları yeterli değil.", metrics: {} };
    }
    const baseline = average(voltage.slice(0, Math.min(5, voltage.length)));
    const target = reference.at(-1);
    const expectedChange = target - reference[0];
    const threshold = Math.abs(expectedChange) * 0.2;
    const eventIndex = reference.findIndex((value) => Math.abs(value - reference[0]) >= Math.max(0.001, threshold));
    const eventTime = eventIndex >= 0 ? number(record.rows[eventIndex].time_s) : number(record.rows[0].time_s);
    const direction = Math.sign(expectedChange || target - baseline) || 1;
    const responseIndex = record.rows.findIndex((row, index) => index >= Math.max(eventIndex, 0) && direction * (number(row.system_voltage_kv ?? row.bus_voltage_kv) - baseline) >= Math.max(0.001, threshold));
    const responseTime = responseIndex >= 0 ? number(record.rows[responseIndex].time_s) - eventTime : Number.NaN;
    const oneSecond = record.rows.filter((row) => number(row.time_s) >= eventTime + 1).at(0);
    const twoSecond = record.rows.filter((row) => number(row.time_s) >= eventTime + 2);
    const oneSecondError = oneSecond ? Math.abs(number(oneSecond.system_voltage_kv ?? oneSecond.bus_voltage_kv) - target) : Number.NaN;
    const stabilityStd = standardDeviation(twoSecond.map((row) => number(row.system_voltage_kv ?? row.bus_voltage_kv)));
    const stable = Number.isFinite(stabilityStd) && stabilityStd <= Math.max(0.01, Math.abs(target) * 0.002);
    const passed = responseTime <= 0.2 && oneSecondError <= Math.max(0.02, Math.abs(expectedChange) * 0.1) && stable;
    return {
      status: passed ? "GEÇTİ" : "KALDI",
      detail: `Vctrl: tepki=${formatMetric(responseTime, 3)} s (200 ms); 1 s hata=${formatMetric(oneSecondError, 3)} kV; 2 s σ=${formatMetric(stabilityStd, 3)} kV; Vmin=${formatMetric(Math.min(...voltage))} kV; Vmax=${formatMetric(Math.max(...voltage))} kV.`,
      metrics: { voltageMinKv: Math.min(...voltage), voltageMaxKv: Math.max(...voltage), voltageResponseSeconds: responseTime, voltageOneSecondErrorKv: oneSecondError, voltageStabilityStdKv: stabilityStd, voltageTargetKv: target }
    };
  }
  const qColumn = record.rows[0] && "reactive_power_mvar" in record.rows[0] ? "reactive_power_mvar" : "total_reactive_power_mvar";
  const defaultTarget = record.step.id.includes("UE") || record.step.id.includes("CHARGE_UE")
    ? number(metadata.Q_REQUIRED_UE_MVAR)
    : number(metadata.Q_REQUIRED_OE_MVAR);
  const target = number(metadata.STEP_Q_TARGET_MVAR, defaultTarget);
  if (!Number.isFinite(target)) {
    return { status: "İNCELEME GEREKLİ", detail: "Q zorunlu değeri girildiğinde otomatik kapasite değerlendirmesi yapılır.", metrics: {} };
  }
  const tail = record.rows.slice(Math.max(0, record.rows.length - 600));
  const meanReactivePower = average(tail.map((row) => number(row[qColumn])));
  const stabilityStd = standardDeviation(tail.map((row) => number(row[qColumn])));
  const stabilityPercent = Math.abs(meanReactivePower) > 1e-9 ? (stabilityStd / Math.abs(meanReactivePower)) * 100 : Number.NaN;
  const passed = Math.abs(meanReactivePower) >= 0.9 * Math.abs(target) && stabilityPercent <= 5;
  return {
    status: passed ? "GEÇTİ" : "KALDI",
    detail: `Qort=${formatMetric(meanReactivePower)} MVAr; zorunlu Q=${formatMetric(target)} MVAr; σ=${formatMetric(stabilityStd)} MVAr; kararlılık=${formatMetric(stabilityPercent, 2)} %.`,
    metrics: { meanReactivePowerMvar: meanReactivePower, targetReactivePowerMvar: target, stabilityStdMvar: stabilityStd, stabilityPercent, durationSeconds: duration(record.rows) }
  };
}

function evaluateSfk(record, metadata, plant) {
  if (record.step.kind !== "agc_step") {
    const signalColumns = ["lmin", "lmax", "lloc", "lrem", "lman", "lmic", "lpwr", "genstat", "pfco"].filter((key) => key in (record.rows[0] ?? {}));
    return { status: "İNCELEME GEREKLİ", detail: `AGC/LFC durum ve alarm sinyalleri (${signalColumns.join(", ") || "uygun kanal yok"}) grafik incelemesine hazır; otomatik kabul sonucu üretilmez.`, metrics: { signalColumns } };
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
    status: "TEKNİK ÖN DEĞERLENDİRME",
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
  if (service === "PFK" && record.step.kind === "reserve_sequence") return evaluatePfkReserveSequence(record, metadata, plant);
  if (service === "PFK" && record.step.kind === "bess_reserve") return evaluatePfkBessReserve(record, metadata);
  if (service === "PFK" && record.step.kind === "sensitivity") return evaluatePfkSensitivity(record, metadata);
  if (service === "PFK" && record.step.kind === "validation") return evaluatePfkValidation(record, metadata);
  if (service === "HFK") return evaluateHfk(record, metadata);
  if (service === "RGDH") return evaluateRgdh(record, metadata);
  if (service === "SFK") return evaluateSfk(record, metadata, plant);
  if (service === "SFHM") return evaluateSfhm(record, metadata);
  const sampleMs = median(sampleDeltas(record.rows)) * 1000;
  return {
    status: "İNCELEME GEREKLİ",
    detail: `Veri yüklendi; ${record.rows.length} satır, dt=${formatMetric(sampleMs, 1)} ms. Otomatik kabul ölçütü tanımlı değildir.`,
    metrics: { rowCount: record.rows.length, sampleMs, durationSeconds: duration(record.rows) }
  };
}
