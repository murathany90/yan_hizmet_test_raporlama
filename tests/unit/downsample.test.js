import { describe, expect, it } from "vitest";
import { minMaxDownsample, visibleSlice } from "../../src/charts/downsample.js";
import { chartToSvg, chartViewForRows } from "../../src/charts/engine.js";

describe("chart downsampling", () => {
  it("preserves extrema and endpoints", () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ time_s: index, power: index === 5_123 ? 9_999 : Math.sin(index / 20) }));
    const sampled = minMaxDownsample(rows, ["power"], 500);
    expect(sampled.length).toBeLessThanOrEqual(502);
    expect(sampled.some((row) => row.power === 9_999)).toBe(true);
    expect(sampled[0]).toBe(rows[0]);
    expect(sampled.at(-1)).toBe(rows.at(-1));
  });

  it("uses binary bounds for visible range", () => {
    const rows = Array.from({ length: 100 }, (_, time_s) => ({ time_s }));
    const visible = visibleSlice(rows, 20, 30);
    expect(visible[0].time_s).toBe(19);
    expect(visible.at(-1).time_s).toBe(31);
    expect(visible.some((row) => row.time_s === 20)).toBe(true);
    expect(visible.some((row) => row.time_s === 30)).toBe(true);
  });

  it("uses the real frequency extent and preserves mixed scatter render types for unsorted 24h rows", () => {
    const rows = [50.01, 49.99, 50.005, 49.995].map((grid_frequency_hz, index) => ({
      time_s: index,
      grid_frequency_hz,
      active_power_mw: 100 + index,
      expected_active_power_mw: 100 + index / 2,
      tolerance_lower_mw: 99 + index / 2,
      tolerance_upper_mw: 101 + index / 2
    }));
    const options = { xMode: "VALUE", xKey: "grid_frequency_hz", chartType: "scatter" };
    const view = chartViewForRows(rows, options);
    expect(view).toMatchObject({ minimum: 49.99, maximum: 50.01, fullMin: 49.99, fullMax: 50.01 });
    const svg = chartToSvg(rows, [
      { key: "active_power_mw", label: "Ölçülen", axis: "left", unit: "MW", renderType: "points" },
      { key: "expected_active_power_mw", label: "Beklenen", axis: "left", unit: "MW", renderType: "line" },
      { key: "tolerance_lower_mw", label: "Alt", axis: "left", unit: "MW", lineStyle: "dashed", renderType: "line" }
    ], view, "Frekans–Güç saçılımı ve PFK zarfı", 800, 400, options);
    expect(svg).toContain("<circle ");
    expect(svg).toContain("<polyline ");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).not.toContain("Gösterilecek seri seçilmedi");
  });
});
