import { getPfkPlantAdapter, pfkProcessSignalDefinitions, plantForPfkRecord } from "../criteria/pfk-plant-adapters.js";

export const OFFICIAL_TEIAS_PFK = "OFFICIAL_TEIAS_PFK";

const officialColors = Object.freeze({
  grid: "#bd2f2f",
  test: "#df5959",
  power: "#16875c",
  process: "#2166ac",
  setpoint: "#174a8b",
  limit: "#bd2f2f",
  expected: "#174a8b"
});

const officialPowerSeries = [
  ["active_power_mw", "Ölçülen aktif güç", "left", "MW", officialColors.power],
  ["p_set_mw", "Pset", "left", "MW", officialColors.setpoint, "solid"],
  ["expected_active_power_mw", "Resmî hedef", "left", "MW", officialColors.expected, "solid"],
  ["tolerance_lower_mw", "Alt tolerans", "left", "MW", officialColors.limit, "dashed"],
  ["tolerance_upper_mw", "Üst tolerans", "left", "MW", officialColors.limit, "dashed"]
];

const officialScatterPowerSeries = [
  ["active_power_mw", "Gerçekleşen çıkış gücü", "left", "MW", officialColors.power, "solid", "points"],
  ["expected_active_power_mw", "Beklenen çıkış gücü", "left", "MW", officialColors.expected, "solid", "line"],
  ["tolerance_lower_mw", "Beklenen çıkış gücü alt sınırı", "left", "MW", officialColors.limit, "dashed", "line"],
  ["tolerance_upper_mw", "Beklenen çıkış gücü üst sınırı", "left", "MW", officialColors.limit, "dashed", "line"]
];

function finite(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function validationAnnotation(metrics, rows) {
  const first = rows.find((row) => Number.isFinite(row.active_power_reference_mw) || Number.isFinite(row.expected_active_power_mw)) ?? {};
  const tolerance = Number(first.tolerance_upper_mw) - Number(first.expected_active_power_mw);
  return `Pset=${finite(first.active_power_reference_mw)} MW | ±1% Pnom=${finite(tolerance)} MW | Başarı: %${finite(metrics.compliancePercent, 3)} | Uygun: ${metrics.compliantSamples ?? "—"}/${metrics.evaluationSamples ?? "—"}`;
}

function sensitivityMarkers(results) {
  return results.flatMap((result) => [
    Number.isFinite(result.startTimeSeconds) ? { label: `${result.targetFrequencyHz.toFixed(3)} Hz başlangıç`, value: result.startTimeSeconds } : null,
    Number.isFinite(result.endTimeSeconds) ? { label: `${result.targetFrequencyHz.toFixed(3)} Hz bitiş`, value: result.endTimeSeconds } : null
  ]).filter(Boolean);
}

export function pfkEventFigureRecord(record, event) {
  const label = event.eventId === "NEG200" ? "Δf = −200 mHz" : "Δf = +200 mHz";
  return {
    ...record,
    name: `${record.name} — ${label}`,
    rows: event.chartRows ?? record.rows,
    eventAnalysis: event,
    analysis: { ...record.analysis, status: event.status, detail: event.detail, metrics: event }
  };
}

function reserveEventAnnotation(event) {
  const trp = event.trp ?? {};
  return `Δtd=${finite(event.delaySeconds, 2)} s | t50=${finite(event.t50Seconds, 2)} s | Etkinleşme=${finite(event.officialActivationTimeSeconds, 2)} s | TRP A/B/C=${finite(trp.TRP_A?.percentage, 1)}/${finite(trp.TRP_B?.percentage, 1)}/${finite(trp.TRP_C?.percentage, 1)} %`;
}

export function pfkEventFigureRecords(record, service) {
  const events = service === "PFK" && record.step?.kind === "reserve_sequence" ? record.analysis?.metrics?.events ?? [] : [];
  return events.length ? [record, ...events.map((event) => pfkEventFigureRecord(record, event))] : [record];
}

function officialReserveOverview(record) {
  const plant = plantForPfkRecord(record);
  const adapter = getPfkPlantAdapter(plant);
  const definitions = [
    ["grid_frequency_hz", "Şebeke frekansı", "Hz", officialColors.grid],
    ["test_frequency_hz", "Simüle frekans", "Hz", officialColors.test],
    ["active_power_mw", "Aktif güç", "MW", officialColors.power],
    [adapter.primaryControlSignal, adapter.primaryControlLabel, adapter.primaryControlUnit, officialColors.process]
  ];
  return definitions.filter(([key]) => record.step.columns.includes(key)).map(([key, label, unit, color]) => ({
    title: `Rezerv genel kayıt — ${label}`,
    profile: OFFICIAL_TEIAS_PFK,
    xMode: "REAL_TIME",
    series: [[key, label, "left", unit, color]]
  }));
}

export function seriesSetsFor(record, service) {
  if (service === "PFK" && record.eventAnalysis) {
    const label = record.eventAnalysis.eventId === "NEG200" ? "Δf = −200 mHz" : "Δf = +200 mHz";
    const inRange = (minimum, maximum) => record.rows.filter((row) => row.time_s >= minimum && row.time_s <= maximum);
    return [
      { title: `${label} yanıt penceresi (−30…120 s)`, rows: inRange(-30, 120), eventId: record.eventAnalysis.eventId, profile: OFFICIAL_TEIAS_PFK, xMode: "RELATIVE_SECONDS", markers: [{ label: "Δtd", value: record.eventAnalysis.delaySeconds }, { label: "t50", value: record.eventAnalysis.t50Seconds }, { label: "Etkinleştirme", value: record.eventAnalysis.officialActivationTimeSeconds }, { label: "15 s", value: 15 }, { label: "30 s", value: 30 }], series: officialPowerSeries },
      { title: `${label} sürdürme penceresi (90…900 s)`, rows: inRange(90, 900), eventId: record.eventAnalysis.eventId, profile: OFFICIAL_TEIAS_PFK, xMode: "RELATIVE_SECONDS", markers: [{ label: "90 s", value: 90 }, { label: "900 s", value: 900 }], series: officialPowerSeries }
    ];
  }
  if (service === "PFK" && record.analysis?.metrics?.validationRows) {
    const plant = plantForPfkRecord(record);
    const adapter = getPfkPlantAdapter(plant);
    const metrics = record.analysis.metrics;
    const graph = (title, rows, series) => ({
      title,
      rows,
      profile: OFFICIAL_TEIAS_PFK,
      xMode: "REAL_TIME",
      series
    });
    const general = metrics.validationRows;
    const scatterRows = general.filter((row) => Number.isFinite(row.grid_frequency_hz) && Number.isFinite(row.active_power_mw));
    const power = [["active_power_mw", "Aktif güç", "left", "MW", officialColors.power], ["expected_active_power_mw", "Beklenen PFK gücü", "left", "MW", officialColors.expected], ["tolerance_lower_mw", "Alt ±1% Pnom", "left", "MW", officialColors.limit, "dashed"], ["tolerance_upper_mw", "Üst ±1% Pnom", "left", "MW", officialColors.limit, "dashed"]];
    return [
      graph("24 saat genel — aktif güç", general, power),
      graph(`24 saat genel — ${adapter.primaryControlLabel.toLocaleLowerCase("tr-TR")}`, general, [[adapter.primaryControlSignal, adapter.primaryControlLabel, "left", adapter.primaryControlUnit, officialColors.process]]),
      graph("24 saat genel — şebeke frekansı", general, [["grid_frequency_hz", "Şebeke frekansı", "left", "Hz", officialColors.grid]]),
      graph("24 saat pozitif frekans kritik penceresi — frekans", metrics.positiveCriticalWindow, [["grid_frequency_hz", "Şebeke frekansı", "left", "Hz", officialColors.grid]]),
      graph("24 saat pozitif frekans kritik penceresi — aktif güç", metrics.positiveCriticalWindow, power),
      graph("24 saat negatif frekans kritik penceresi — frekans", metrics.negativeCriticalWindow, [["grid_frequency_hz", "Şebeke frekansı", "left", "Hz", officialColors.grid]]),
      graph("24 saat negatif frekans kritik penceresi — aktif güç", metrics.negativeCriticalWindow, power),
      {
        title: "24 saat Frekans–Güç saçılımı ve PFK zarfı",
        annotation: validationAnnotation(metrics, scatterRows),
        rows: scatterRows,
        profile: OFFICIAL_TEIAS_PFK,
        xMode: "VALUE",
        xKey: "grid_frequency_hz",
        chartType: "scatter",
        series: officialScatterPowerSeries
      }
    ];
  }
  if (service === "PFK" && record.step.kind === "sensitivity" && record.analysis?.metrics?.sensitivityResults?.length) {
    const plant = plantForPfkRecord(record);
    const processSeries = pfkProcessSignalDefinitions(plant).map((signal, index) => [signal.key, signal.label, index ? "right" : "left", signal.unit, index ? "#7550a0" : officialColors.process]);
    const results = record.analysis.metrics.sensitivityResults;
    const available = (series) => series.filter(([key]) => record.rows.some((row) => Number.isFinite(row[key])));
    const groupTitle = "Hassasiyet Testi — Birleşik Frekans Adımları";
    const annotation = `Tespit edilen adımlar: ${results.map((result) => result.targetFrequencyHz.toFixed(3)).join(" / ")} Hz`;
    const shared = { figureGroup: "PFK_SENSITIVITY_COMBINED", groupTitle, annotation, rows: record.rows, profile: OFFICIAL_TEIAS_PFK, xMode: "RELATIVE_SECONDS", markers: sensitivityMarkers(results) };
    return [
      { ...shared, title: `${groupTitle} — frekans`, series: available([["grid_frequency_hz", "Şebeke frekansı", "left", "Hz", officialColors.grid], ["test_frequency_hz", "Simüle frekans", "left", "Hz", officialColors.test]]) },
      { ...shared, title: `${groupTitle} — aktif güç`, series: available([["active_power_mw", "Aktif güç", "left", "MW", officialColors.power]]) },
      { ...shared, title: `${groupTitle} — proses sinyali`, series: available(processSeries) }
    ].filter((set) => set.series.length);
  }
  if (service === "PFK" && record.step.kind === "reserve_sequence") return officialReserveOverview(record);
  const columns = new Set(record.step.columns);
  const include = (definition) => columns.has(definition[0]);
  const sets = [];

  if (service === "PFK") {
    const plant = plantForPfkRecord(record);
    sets.push({
      title: "Aktif Güç / Frekans",
      series: [
        ["active_power_mw", "Aktif Güç", "left", "MW"],
        ["active_power_reference_mw", "P Referans", "left", "MW"],
        ["grid_frequency_hz", "Şebeke Frekansı", "right", "Hz"],
        ["test_frequency_hz", "Simüle Frekans", "right", "Hz"]
      ].filter(include)
    });
    const auxiliary = pfkProcessSignalDefinitions(plant)
      .map((signal, index) => [signal.key, signal.label, index ? "right" : "left", signal.unit])
      .filter(include);
    if (auxiliary.length) sets.push({ title: "Yardımcı / Proses Sinyalleri", series: auxiliary });
  } else if (service === "RGDH") {
    sets.push({
      title: "Aktif / Reaktif Güç ve Sistem Gerilimi",
      series: [
        ["active_power_mw", "P", "left", "MW"],
        ["total_active_power_mw", "Toplam P", "left", "MW"],
        ["reactive_power_mvar", "Q", "left", "MVAr"],
        ["total_reactive_power_mvar", "Toplam Q", "left", "MVAr"],
        ["system_voltage_kv", "Sistem Gerilimi", "right", "kV"],
        ["bus_voltage_kv", "Bara Gerilimi", "right", "kV"],
        ["voltage_reference_kv", "Gerilim Referansı", "right", "kV"]
      ].filter(include)
    });
    const auxiliary = [
      ["terminal_voltage_kv", "Terminal Gerilimi", "left", "kV"],
      ["excitation_current_a", "İkaz Akımı", "right", "A"],
      ["stator_current_a", "Stator Akımı", "right", "A"],
      ["power_factor", "Güç Faktörü", "right", "pu"],
      ["main_source_active_power_mw", "Ana Kaynak P", "left", "MW"],
      ["main_source_reactive_power_mvar", "Ana Kaynak Q", "left", "MVAr"],
      ["aux_source_active_power_mw", "Yardımcı Kaynak P", "left", "MW"],
      ["aux_source_reactive_power_mvar", "Yardımcı Kaynak Q", "left", "MVAr"],
      ["soc_pct", "SoC", "right", "%"]
    ].filter(include);
    if (auxiliary.length) sets.push({ title: "Ünite / Kaynak Yardımcı Sinyalleri", series: auxiliary });
  } else if (service === "HFK") {
    sets.push({ title: "Hızlı Aktif Güç / Frekans", series: [["active_power_mw", "Aktif Güç", "left", "MW"], ["frequency_hz", "Frekans", "right", "Hz"]].filter(include) });
    sets.push({
      title: "Batarya / RoCoF / Hat Akışı",
      series: [
        ["dc_power_mw", "DC Güç", "left", "MW"],
        ["tie_line_flow_mw", "Bağlantı Hattı", "left", "MW"],
        ["rocof_hz_s", "RoCoF", "right", "Hz/s"],
        ["soc_pct", "SoC", "right", "%"]
      ].filter(include)
    });
  } else if (service === "SFHM") {
    sets.push({
      title: "SFHM Aktif Güç / Frekans",
      series: [
        ["active_power_mw", "Aktif Güç", "left", "MW"],
        ["active_power_reference_mw", "P Referans", "left", "MW"],
        ["grid_frequency_hz", "Şebeke Frekansı", "right", "Hz"]
      ].filter(include)
    });
    const auxiliary = [["soc_pct", "SoC", "right", "%"], ["stored_energy_mwh", "Enerji", "left", "MWh"], ["dc_power_mw", "DC Güç", "left", "MW"]].filter(include);
    if (auxiliary.length) sets.push({ title: "Depolama Sinyalleri", series: auxiliary });
  } else if (service === "SFK") {
    sets.push({
      title: "AGC Setpoint / Gerçek Aktif Güç",
      series: [
        ["agc_setpoint_mw", "AGC Setpoint", "left", "MW"],
        ["active_power_mw", "Gerçek P", "left", "MW"],
        ["setpoint_feedback_mw", "Setpoint Feedback", "left", "MW"]
      ].filter(include)
    });
    sets.push({
      title: "Frekans / Limit ve Durum Sinyalleri",
      series: [
        ["grid_frequency_hz", "Şebeke Frekansı", "right", "Hz"],
        ["lmin", "LMIN", "left", "0/1"],
        ["lmax", "LMAX", "left", "0/1"],
        ["lloc", "LLOC", "left", "0/1"],
        ["lrem", "LREM", "left", "0/1"],
        ["pfco", "PFCO", "left", "0/1"],
        ["soc_pct", "SoC", "right", "%"]
      ].filter(include)
    });
  }

  return sets.filter((set) => set.series.length);
}

export function normalizeSeries(series) {
  return series.map(([key, label, axis, unit, color, lineStyle, renderType]) => ({ key, label, axis, unit, color, lineStyle, renderType }));
}
