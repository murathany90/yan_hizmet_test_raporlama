import { describe, expect, it } from "vitest";
import { minMaxDownsample, visibleSlice } from "../../src/charts/downsample.js";

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
});
