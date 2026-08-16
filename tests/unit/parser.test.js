import { describe, expect, it } from "vitest";
import { convertRows, decodeUtf8, hasUtf8Bom, makeCsvTemplate, parseCsv, parseLocaleNumber, parseTurkishTimestamp } from "../../src/csv/parser.js";

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
    const csv = makeCsvTemplate({ TEST_SERVICE: "PFK", TESIS_ADI: "İğdır Üretim Şaşı", TEST_DATE: "2026-03-12" }, ["zaman", "sira_no", "active_power_mw"]);
    const bytes = new TextEncoder().encode(csv);
    expect(hasUtf8Bom(bytes)).toBe(true);
    expect(csv).toContain("\r\n");
    expect(decodeUtf8(bytes)).toContain("İğdır Üretim Şaşı");
    expect(csv).toContain("ZAMAN;SIRA_NO;active_power_mw");
  });

  it("uses Turkish ZAMAN/SIRA_NO as the canonical axis and accepts legacy time_s", () => {
    const canonical = parseCsv("ZAMAN;SIRA_NO;active_power_mw\n12.3.2026 11:09:19,1s;1;100\n12.3.2026 11:09:19,2s;2;101\n");
    const step = { sampleMs: 100, columns: ["zaman", "sira_no", "active_power_mw"] };
    const rows = convertRows(canonical, step);
    expect(parseTurkishTimestamp(canonical.rows[0].zaman)).toBe(rows[0].timestamp_ms);
    expect(rows[1].time_s).toBeCloseTo(0.1);

    const legacy = parseCsv("time_s;active_power_mw\n0;100\n0,1;101\n");
    expect(convertRows(legacy, step).map((row) => row.time_s)).toEqual([0, 0.1]);
  });
});
