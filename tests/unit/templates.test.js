import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { CONFIGS } from "../../src/app/config-runtime.js";
import { allTemplatesZip, pfkCampaignTemplatesZip } from "../../src/csv/templates.js";
import { hasUtf8Bom, parseCsv } from "../../src/csv/parser.js";

describe("ZIP CSV templates", () => {
  it("creates BOM-protected templates for every selected service step", () => {
    const config = CONFIGS["RGDH:RESGES"];
    const files = unzipSync(allTemplatesZip({ service: "RGDH", plant: "RESGES", config, metadata: { TESIS_ADI: "İğdır" } }));
    expect(Object.keys(files)).toHaveLength(config.steps.length);
    const first = files["RGDH_RESGES_OE_MAX.csv"];
    expect(hasUtf8Bom(first)).toBe(true);
    expect(parseCsv(first).metadata.TESIS_ADI).toBe("İğdır");
  });

  it("creates a PFK multi-unit ZIP with campaign and evidence manifests", async () => {
    const config = CONFIGS["PFK:HES"];
    const files = unzipSync(await pfkCampaignTemplatesZip({
      plant: "HES",
      config,
      metadata: { TESIS_ADI: "İğdır" },
      campaign: { campaignId: "PFK-IĞDIR", facilityId: "IGDIR", eventId: "E1", runId: "R1", units: [{ unitId: "U1", unitName: "Ünite 1" }, { unitId: "U2", unitName: "Ünite 2" }] }
    }));
    expect(Object.keys(files)).toContain("campaign.csv");
    expect(Object.keys(files)).toContain("manifest.csv");
    expect(Object.keys(files)).toContain("U1/MAKSIMUM_REZERV.csv");
    expect(Object.keys(files)).toHaveLength(10);
    const parsed = parseCsv(files["U2/MAKSIMUM_REZERV.csv"]);
    expect(parsed.metadata).toMatchObject({ CAMPAIGN_ID: "PFK-IĞDIR", UNIT_ID: "U2", TEST_SCOPE: "MULTI_UNIT" });
    expect(new TextDecoder().decode(files["manifest.csv"])).toContain("SHA256");
  });
});
