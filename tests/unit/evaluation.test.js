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

  it("reports loaded RGDH voltage-control data", () => {
    const result = evaluateRecord(record({ id: "VOLTAGE_STEP", kind: "voltage_control" }, [
      { time_s: 0, system_voltage_kv: 378 }, { time_s: 1, system_voltage_kv: 382 }
    ]), { service: "RGDH", plant: "KONV", metadata: {} });
    expect(result.status).toBe("YÜKLENDİ");
    expect(result.metrics.voltageMinKv).toBe(378);
  });

  it("keeps EDÜ SFK in draft status", () => {
    const result = evaluateRecord(record({ id: "LFC_SIGNAL_CHECK", kind: "signal_check" }, [{ time_s: 0 }]), {
      service: "SFK", plant: "EDUEDT", metadata: {}
    });
    expect(result.status).toBe("TEKNİK ÖN DEĞERLENDİRME");
  });
});
