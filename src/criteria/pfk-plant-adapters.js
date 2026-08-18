/**
 * PFK tesis-adapter sözleşmesi. Değerlendirme ve belge katmanları tesis
 * adına değil, yalnızca PLANT_TYPE ve kayıt kolonlarına göre davranır.
 */
export const PFK_PLANT_ADAPTERS = Object.freeze({
  HES: Object.freeze({
    profile: "PFK_CLASSIC",
    primaryControlSignal: "guide_vane_pct",
    primaryControlLabel: "Ayar kanadı",
    primaryControlUnit: "%",
    extraSignals: Object.freeze([])
  }),
  DGKCS: Object.freeze({
    profile: "PFK_CLASSIC",
    primaryControlSignal: "fuel_valve_pct",
    primaryControlLabel: "Yakıt vanası",
    primaryControlUnit: "%",
    extraSignals: Object.freeze([])
  }),
  TES: Object.freeze({
    profile: "PFK_CLASSIC",
    primaryControlSignal: "regulator_valve_pct",
    primaryControlLabel: "Reglaj vanası",
    primaryControlUnit: "%",
    extraSignals: Object.freeze([
      Object.freeze({ key: "steam_pressure_bar", label: "Buhar basıncı", unit: "bar" }),
      Object.freeze({ key: "steam_temperature_c", label: "Buhar sıcaklığı", unit: "°C" })
    ])
  }),
  EDUEDT: Object.freeze({
    profile: "PFK_STORAGE",
    primaryControlSignal: "soc_pct",
    primaryControlLabel: "SoC",
    primaryControlUnit: "%",
    extraSignals: Object.freeze([
      Object.freeze({ key: "stored_energy_mwh", label: "Depolanmış enerji", unit: "MWh" }),
      Object.freeze({ key: "dc_power_mw", label: "DC aktif güç", unit: "MW" })
    ])
  })
});

const DEFAULT_ADAPTER = PFK_PLANT_ADAPTERS.HES;

export function getPfkPlantAdapter(plant) {
  return PFK_PLANT_ADAPTERS[String(plant ?? "").trim().toUpperCase()] ?? DEFAULT_ADAPTER;
}

export function pfkProfileForPlant(plant) {
  return getPfkPlantAdapter(plant).profile;
}

export function plantForPfkRecord(record = {}, fallback = "HES") {
  return String(record.plant ?? record.sourceMetadata?.PLANT_TYPE ?? record.metadata?.PLANT_TYPE ?? fallback).trim().toUpperCase() || fallback;
}

export function pfkProcessSignalDefinitions(plant) {
  const adapter = getPfkPlantAdapter(plant);
  return [
    { key: adapter.primaryControlSignal, label: adapter.primaryControlLabel, unit: adapter.primaryControlUnit, primary: true },
    ...adapter.extraSignals
  ];
}

export function pfkAdapterMetadataDefaults(plant) {
  // Varsayımlar yalnız tanımlayıcıdır; ölçüm, kanal veya cihaz değeri uydurmaz.
  return { PLANT_TYPE: String(plant ?? "").trim().toUpperCase() };
}
