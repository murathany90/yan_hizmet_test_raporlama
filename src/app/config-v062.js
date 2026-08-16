import {
  CONFIGS as LEGACY_CONFIGS,
  DETAILED_CRITERIA,
  MENU,
  REPORT_REF_MAP,
  REPORT_VARIABLES
} from "./config.js";

const TIME_COLUMNS = ["zaman", "sira_no"];
const EQUIPMENT_FIELDS = [
  ["MEASUREMENT_DEVICE_TYPE", "Ölçüm cihazı türü", "text", "Veri toplama cihazı"],
  ["MEASUREMENT_BRAND", "Ölçüm cihazı markası", "text", ""],
  ["MEASUREMENT_MODEL", "Ölçüm cihazı modeli", "text", ""],
  ["MEASUREMENT_SERIAL_NO", "Ölçüm cihazı seri no", "text", ""],
  ["CALIBRATION_NO", "Kalibrasyon no", "text", ""],
  ["TURBINE_GENERATOR_DESCRIPTION", "Türbin / jeneratör açıklaması", "text", ""],
  ["UNIT_OPERATION_MODE", "Ünite işletme modu", "text", ""]
];

function withTimeColumns(columns) {
  return [...TIME_COLUMNS, ...columns.filter((column) => column !== "time_s" && !TIME_COLUMNS.includes(column))];
}

function mergeSensitivitySteps(config) {
  const sensitivity = config.steps.filter((step) => /SENS/.test(step.id));
  if (!sensitivity.length) return;
  const first = sensitivity[0];
  const targets = sensitivity.map((step) => step.id.replace(/^BESS_SENS_/, "").replace(/^SENS_/, "").replaceAll("_", "."));
  const combined = {
    ...first,
    id: "HASSASIYET",
    name: "Hassasiyet testi — tek sürekli zaman serisi",
    kind: "sensitivity",
    sensitivityTargets: targets,
    note: "Frekans basamakları tek CSV içinde sıralı olarak kaydedilir."
  };
  const firstIndex = config.steps.indexOf(first);
  config.steps = config.steps.filter((step) => !sensitivity.includes(step));
  config.steps.splice(firstIndex, 0, combined);
}

function applyV062Configuration(configs) {
  for (const [key, config] of Object.entries(configs)) {
    config.steps.forEach((step) => { step.columns = withTimeColumns(step.columns); });
    if (key.startsWith("PFK:")) mergeSensitivitySteps(config);
    const present = new Set(config.meta.map(([field]) => field));
    for (const field of EQUIPMENT_FIELDS) if (!present.has(field[0])) config.meta.push([...field]);
  }
  return configs;
}

export const CONFIGS = applyV062Configuration(LEGACY_CONFIGS);
export { DETAILED_CRITERIA, MENU, REPORT_REF_MAP, REPORT_VARIABLES };
