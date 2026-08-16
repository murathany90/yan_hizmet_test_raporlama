import { describe, expect, it } from "vitest";
import { decodeUtf8, hasUtf8Bom, makeCsvTemplate, parseCsv, parseLocaleNumber } from "../../src/csv/parser.js";

describe("CSV parser", () => {
  it.each([
    ["12.34", 12.34],
    ["12,34", 12.34],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["-0,25", -0.25]
  ])("parses localized number %s", (input, expected) => {
    expect(parseLocaleNumber(input)).toBeCloseTo(expected);
  });

  it("parses quoted semicolons and escaped quotes", () => {
    const parsed = parseCsv("# TEST_SERVICE=PFK\n# PLANT_TYPE=HES\n# STEP_ID=X\na;b\n\"1;2\";\"x\"\"y\"\n");
    expect(parsed.rows[0]).toEqual({ a: "1;2", b: 'x"y' });
  });

  it("creates BOM and CRLF templates", () => {
    const csv = makeCsvTemplate({ TEST_SERVICE: "PFK", TESIS_ADI: "İğdır Üretim Şaşı" }, ["time_s", "active_power_mw"]);
    const bytes = new TextEncoder().encode(csv);
    expect(hasUtf8Bom(bytes)).toBe(true);
    expect(csv).toContain("\r\n");
    expect(decodeUtf8(bytes)).toContain("İğdır Üretim Şaşı");
  });
});
