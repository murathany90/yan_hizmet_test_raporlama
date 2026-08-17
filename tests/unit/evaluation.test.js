import { describe, expect, it } from "vitest";
import { evaluateRecord } from "../../src/analysis/evaluate.js";
import { CONFIGS } from "../../src/app/config-runtime.js";
import { buildOfficialReserveEnvelope } from "../../src/criteria/pfk.js";

function record(step, rows) {
  return { step, rows };
}

describe("service evaluation", () => {
  it("uses the official Pset-based asymmetric PFK reserve envelope in both directions", () => {
    const negative = buildOfficialReserveEnvelope({ direction: "NEG200", pSet: 100, rpMax: 10, pNom: 100, responseDelay: 4, t: 20 });
    const positive = buildOfficialReserveEnvelope({ direction: "POS200", pSet: 100, rpMax: 10, pNom: 100, responseDelay: 4, t: 20 });
    expect(negative.trpA.lower).toBeCloseTo(105.53846, 5);
    expect(negative.trpA.upper).toBe(112);
    expect(negative.trpB).toEqual({ lower: 109, upper: 112 });
    expect(negative.trpC).toEqual({ lower: 109, upper: 111 });
    expect(positive.trpA.lower).toBe(88);
    expect(positive.trpA.upper).toBeCloseTo(94.46154, 5);
    expect(positive.trpB).toEqual({ lower: 88, upper: 91 });
    expect(positive.trpC).toEqual({ lower: 89, upper: 91 });
  });

  it("passes a compliant HES PFK reserve response", () => {
    const rows = Array.from({ length: 9_201 }, (_, index) => {
      const time_s = -20 + index * 0.1;
      const response = time_s < 0 ? 0 : Math.min(25, time_s * 2.5);
      return { time_s, active_power_mw: 400 + response };
    });
    const result = evaluateRecord(record({ id: "RES_MAX_NEG200", kind: "reserve" }, rows), {
      service: "PFK", plant: "HES", metadata: { PNOM_MW: 500, RPMAX_MW: 25 }
    });
    expect(result.status).toBe("GEÇTİ");
    expect(result.metrics.t100Seconds).toBeLessThanOrEqual(30);
    expect(result.metrics.trpC).toBeGreaterThanOrEqual(98);
  });

  it("segments a canonical four-CSV reserve source into ordered −200/+200 mHz events", () => {
    const step = CONFIGS["PFK:HES"].steps.find((item) => item.id === "MAKSIMUM_REZERV");
    const rows = Array.from({ length: 18_901 }, (_, index) => {
      const time_s = index / 10;
      const secondEvent = time_s >= 950;
      const inEvent = (time_s >= 20 && time_s < 920) || (time_s >= 950 && time_s < 1850);
      const direction = secondEvent ? -1 : 1;
      const start = secondEvent ? 950 : 20;
      const response = inEvent ? 25 * Math.min(1, Math.max(0, (time_s - start - 1) / 20)) : 0;
      return {
        time_s,
        test_frequency_hz: inEvent ? (direction > 0 ? 49.8 : 50.2) : 50,
        grid_frequency_hz: 50,
        active_power_mw: 400 + direction * response,
        active_power_reference_mw: 400 + direction * response
      };
    });
    const result = evaluateRecord(record(step, rows), { service: "PFK", plant: "HES", metadata: { PNOM_MW: 500, RPMAX_MW: 25 } });
    expect(result.status).toBe("GEÇTİ");
    expect(result.metrics.events.map((event) => event.eventId)).toEqual(["NEG200", "POS200"]);
    expect(result.metrics.events.every((event) => event.trp.TRP_C.percentage >= 90)).toBe(true);
  });

  it("keeps HFK output in technical pre-evaluation status", () => {
    const rows = Array.from({ length: 600 }, (_, index) => ({
      time_s: index * 0.02,
      active_power_mw: index < 10 ? 0 : Math.min(20, (index - 10) * 2),
      trigger: index >= 10 ? 1 : 0
    }));
    const result = evaluateRecord(record({ id: "FREQ_SUPPORT_RAISE", kind: "frequency_support" }, rows), {
      service: "HFK", plant: "EDUEDT", metadata: { HFK_RESERVE_MW: 20 }
    });
    expect(result.status).toBe("TEKNİK ÖN DEĞERLENDİRME");
  });

  it("evaluates RGDH C2 voltage control with response and stability metrics", () => {
    const rows = Array.from({ length: 31 }, (_, index) => {
      const time_s = index / 10;
      const voltage_reference_kv = time_s < 1 ? 380 : 384;
      const system_voltage_kv = time_s < 1.1 ? 380 : Math.min(384, 380 + (time_s - 1) * 20);
      return { time_s, system_voltage_kv, voltage_reference_kv };
    });
    const result = evaluateRecord(record({ id: "VCTRL_PLUS1", kind: "voltage_control" }, rows), { service: "RGDH", plant: "RESGES", metadata: {} });
    expect(result.status).toBe("GEÇTİ");
    expect(result.metrics.voltageResponseSeconds).toBeLessThanOrEqual(0.2);
    expect(result.metrics.voltageStabilityStdKv).toBeLessThanOrEqual(0.01);
  });

  it("keeps SFK signal-only data in review status", () => {
    const result = evaluateRecord(record({ id: "LFC_SIGNAL_CHECK", kind: "signal_check" }, [{ time_s: 0 }]), {
      service: "SFK", plant: "EDUEDT", metadata: {}
    });
    expect(result.status).toBe("İNCELEME GEREKLİ");
  });
});
