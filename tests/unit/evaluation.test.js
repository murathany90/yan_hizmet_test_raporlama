import { describe, expect, it } from "vitest";
import { evaluateRecord } from "../../src/analysis/evaluate.js";

function record(step, rows) {
  return { step, rows };
}

describe("service evaluation", () => {
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
