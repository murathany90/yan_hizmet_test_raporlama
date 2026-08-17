export function seriesSetsFor(record, service) {
  if (service === "PFK" && record.eventAnalysis) {
    const label = record.eventAnalysis.eventId === "NEG200" ? "Δf = −200 mHz" : "Δf = +200 mHz";
    return [{
      title: `${label} olay analizi — güç, hedef ve tolerans bandı`,
      rows: record.rows,
      eventId: record.eventAnalysis.eventId,
      series: [
        ["active_power_mw", "Ölçülen aktif güç", "left", "MW"],
        ["expected_active_power_mw", "Beklenen güç", "left", "MW"],
        ["tolerance_lower_mw", "Alt tolerans", "left", "MW"],
        ["tolerance_upper_mw", "Üst tolerans", "left", "MW"],
        ["test_frequency_hz", "Simüle frekans", "right", "Hz"]
      ]
    }];
  }
  if (service === "PFK" && record.analysis?.metrics?.validationRows) {
    const metrics = record.analysis.metrics;
    const graph = (title, rows) => ({
      title,
      rows,
      series: [
        ["active_power_mw", "Ölçülen aktif güç", "left", "MW"],
        ["expected_active_power_mw", "Beklenen güç", "left", "MW"],
        ["tolerance_lower_mw", "Alt tolerans", "left", "MW"],
        ["tolerance_upper_mw", "Üst tolerans", "left", "MW"],
        ["grid_frequency_hz", "Şebeke frekansı", "right", "Hz"]
      ]
    });
    return [
      graph("24 saat doğrulama — güç, hedef ve tolerans bandı", metrics.validationRows),
      graph("24 saat pozitif frekans kritik penceresi", metrics.positiveCriticalWindow),
      graph("24 saat negatif frekans kritik penceresi", metrics.negativeCriticalWindow)
    ];
  }
  const columns = new Set(record.step.columns);
  const include = (definition) => columns.has(definition[0]);
  const sets = [];

  if (service === "PFK") {
    sets.push({
      title: "Aktif Güç / Frekans",
      series: [
        ["active_power_mw", "Aktif Güç", "left", "MW"],
        ["active_power_reference_mw", "P Referans", "left", "MW"],
        ["grid_frequency_hz", "Şebeke Frekansı", "right", "Hz"],
        ["test_frequency_hz", "Simüle Frekans", "right", "Hz"]
      ].filter(include)
    });
    const auxiliary = [
      ["guide_vane_pct", "Ayar Kanadı", "left", "%"],
      ["fuel_valve_pct", "Yakıt Vanası", "left", "%"],
      ["regulator_valve_pct", "Reglaj Vanası", "left", "%"],
      ["steam_pressure_bar", "Buhar Basıncı", "right", "bar"],
      ["steam_temperature_c", "Buhar Sıcaklığı", "right", "°C"],
      ["soc_pct", "SoC", "right", "%"],
      ["stored_energy_mwh", "Depolanmış Enerji", "left", "MWh"],
      ["dc_power_mw", "DC Güç", "left", "MW"]
    ].filter(include);
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
  return series.map(([key, label, axis, unit]) => ({ key, label, axis, unit }));
}
