import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/csv/parser.js";
import { resolveCsvRoute } from "../../src/csv/metadata.js";
import { validateParsedCsv } from "../../src/csv/validator.js";

describe("metadata routing and validation", () => {
  it("routes TEST_SERVICE/PLANT_TYPE/STEP_ID", () => {
    const route = resolveCsvRoute({ TEST_SERVICE: "pfk", PLANT_TYPE: "hes", STEP_ID: "sens_50_005" });
    expect(route.configKey).toBe("PFK:HES");
    expect(route.step.id).toBe("SENS_50_005");
  });

  it("rejects missing route metadata", () => {
    expect(() => resolveCsvRoute({ TEST_SERVICE: "PFK" })).toThrow(/PLANT_TYPE, STEP_ID/);
  });

  it("reports missing required columns", () => {
    const route = resolveCsvRoute({ TEST_SERVICE: "PFK", PLANT_TYPE: "HES", STEP_ID: "SENS_50_005" });
    const parsed = parseCsv("# TEST_SERVICE=PFK\n# PLANT_TYPE=HES\n# STEP_ID=SENS_50_005\ntime_s;grid_frequency_hz\n0;50\n");
    const result = validateParsedCsv(parsed, route);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/eksik sütun/);
  });

  it("rejects non-monotonic time", () => {
    const route = resolveCsvRoute({ TEST_SERVICE: "HFK", PLANT_TYPE: "EDUEDT", STEP_ID: "FREQ_SUPPORT_LOWER" });
    const columns = route.step.columns.join(";");
    const row = route.step.columns.map((column) => column === "time_s" ? "0" : "1").join(";");
    const parsed = parseCsv(`# TEST_SERVICE=HFK\n# PLANT_TYPE=EDUEDT\n# STEP_ID=FREQ_SUPPORT_LOWER\n${columns}\n${row}\n${row}\n`);
    expect(validateParsedCsv(parsed, route).errors.join(" ")).toMatch(/monoton/);
  });
});
