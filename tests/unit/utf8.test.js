import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIGS, MENU } from "../../src/app/config-runtime.js";
import { inferUnit } from "../../src/utils/text.js";

describe("UTF-8 integrity", () => {
  it("keeps critical Turkish UI and report phrases intact", () => {
    const index = readFileSync(resolve("index.html"), "utf8");
    expect(index).toContain("YDA (Yan Hizmetler Testleri Doğrulama Aracı)");
    expect(index).toContain("Yan Hizmetler Testleri Doğrulama Aracı");
    expect(index).toContain("Önizleme Oluştur");
    expect(MENU.map((item) => item.label).join(" ")).toContain("Sınırlı Frekans Hassasiyet Modu");
    const expected = ["TEİAŞ", "Ünite", "Çıkış", "Gücü", "Ölçüm", "İşletme", "Doğrulama", "Şebeke"];
    const authored = `${index}\n${JSON.stringify(CONFIGS)}`;
    for (const phrase of expected) expect(authored).toContain(phrase);
    expect(CONFIGS["PFK:HES"].criteria.join(" ")).toContain("Örnekleme");
  });

  it("contains no common UTF-8 mojibake markers in authored sources", () => {
    const files = ["index.html", "package.json", "src/main.js", "src/report/model.js", "src/report/preview.js", "src/app/config.js"];
    for (const file of files) {
      const text = readFileSync(resolve(file), "utf8");
      expect(text, file).not.toMatch(/Ã.|Ä.|Å.|â€|ï»¿/u);
      expect(text, file).not.toContain("\uFFFD");
      expect(text, file).not.toContain("TEİA�?");
    }
  });

  it("does not infer ampere from ordinary metadata names", () => {
    expect(inferUnit("TESIS_ADI", "Tesis Adı")).toBe("—");
    expect(inferUnit("GRID_CURRENT_A", "Şebeke Akımı [A]")).toBe("A");
  });
});
