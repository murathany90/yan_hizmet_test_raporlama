import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("loads PFK files, renders charts, criteria and reports without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__YHDA_READY__)).toBe(true);
  await expect(page.locator("#workTitle")).toContainText("Primer Frekans Kontrolü");

  const fixtures = [
    "MAKSIMUM_REZERV_ORNEK.csv", "MINIMUM_REZERV_ORNEK.csv", "HASSASIYET_ORNEK.csv", "DOGRULAMA_24H_ORNEK.csv"
  ].map((name) => resolve("Ornek_Veriler", "PFK", "HES", name));
  await page.locator("#bulkFiles").setInputFiles(fixtures);
  await expect(page.locator("#bulkSummary")).toContainText("4 dosya · 4 başarılı");
  await page.getByRole("button", { name: "3. Raporlar" }).click();
  const evidenceDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ham CSV Kanıt Manifesti" }).click();
  const evidenceDownload = await evidenceDownloadPromise;
  const evidenceText = new TextDecoder("utf-8").decode(await readFile(await evidenceDownload.path()));
  expect(evidenceText).toContain("Dosya;SHA256;Hizmet");
  expect(evidenceText).toMatch(/[a-f0-9]{64}/);

  await page.getByRole("button", { name: "2. Grafikler" }).click();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  const rangeInput = page.locator(".chart-range input").first();
  const before = await rangeInput.inputValue();
  await page.getByRole("button", { name: "Zoom +" }).first().click();
  await expect.poll(async () => rangeInput.inputValue()).not.toBe(before);
  await page.locator("details.chart-details").first().locator("summary").click();
  await expect(page.locator("details.chart-details").first()).not.toHaveAttribute("open", "");
  await page.locator("details.chart-details").first().locator("summary").click();
  await expect(page.locator("details.chart-details").first()).toHaveAttribute("open", "");
  const legend = page.locator(".legend-item").first();
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Zoom +" }).first().click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "4. Kriterler" }).click();
  await expect(page.getByRole("heading", { name: "Test Nasıl Yapılır" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kontroller" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Değerlendirme" })).toBeVisible();

  await page.getByRole("button", { name: "3. Raporlar" }).click();
  await page.getByRole("button", { name: "Önizleme Oluştur" }).click();
  await expect(page.locator("#reportPaper")).toContainText("PRİMER FREKANS KONTROL PERFORMANS TEST RAPORU");
  await expect(page.locator("#reportPaper")).toContainText("B) TEKNİK VERİLER");
  await expect(page.locator("#reportPaper")).toContainText("HAM CSV SHA-256 KANIT MANİFESTİ");
  await expect(page.locator("#reportPaper")).toContainText("TASLAK / EKSİK BİLGİ");
  await expect(page.locator("#reportPaper")).not.toContainText("ORİJİNAL FORMAT / KAYNAK BELGE REFERANSI");
  await page.locator("#reportType").selectOption({ label: "Test Tutanağı" });
  await expect(page.locator("#reportPaper")).toContainText("PRİMER FREKANS KONTROL PERFORMANS TESTLERİ TUTANAĞI");
  await expect(page.locator("#reportPaper")).toContainText("SONUÇ VE NÜSHA TESLİMİ");
  for (const reportType of ["Performans Test Raporu", "Test Tutanağı", "Test Sertifikası"]) {
    await page.locator("#reportType").selectOption({ label: reportType });
    const wordDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Word Raporu" }).click();
    const wordDownload = await wordDownloadPromise;
    expect(wordDownload.suggestedFilename()).toMatch(/\.docx$/i);
    const wordBytes = await readFile(await wordDownload.path());
    expect(String.fromCharCode(...wordBytes.slice(0, 2))).toBe("PK");
  }
  expect(errors).toEqual([]);
});

test("downloads Turkish UTF-8 BOM CSV and keeps PFK campaign controls scoped", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__YHDA_READY__)).toBe(true);
  await page.locator("#meta-TESIS_ADI").fill("Iğdır Şaşı Üretim Tesisi");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Şablon İndir" }).first().click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const bytes = await readFile(downloadPath);
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = new TextDecoder("utf-8").decode(bytes);
  expect(text).toContain("# TESIS_ADI=Iğdır Şaşı Üretim Tesisi");
  expect(text).not.toMatch(/Ã|Ä|Å/);

  await expect(page.locator("#pfkCampaignCard")).toBeVisible();
  await page.locator("#pfkCampaignSetup").click();
  await expect(page.getByRole("heading", { name: "Santral / Ünite Yapısı" })).toBeVisible();
  await expect(page.locator("#pfkCampaignZip")).toBeVisible();
  await page.getByRole("button", { name: "2. Grafikler" }).click();
  await expect(page.getByRole("button", { name: "Ünite", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Karşılaştırma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Santral", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "4. Kriterler" }).click();
  await expect(page.getByRole("heading", { name: "PFK Çok Ünite Adım Kontrolü" })).toBeVisible();
  await expect(page.locator("#criteriaContent details.criteria-step")).toHaveCount(10);
});

test("treats CSV metadata as text and keeps mobile navigation usable", async ({ page }) => {
  const rows = Array.from({ length: 401 }, (_, index) => {
    const time = (index / 10).toFixed(1);
    return `${time};50;50.005;100;100;45`;
  });
  const marker = `<img data-xss src=x onerror="window.__XSS=true">İğdır`;
  const csv = `\uFEFF# TEST_SERVICE=PFK\r\n# PLANT_TYPE=HES\r\n# STEP_ID=SENS_50_005\r\n# SAMPLE_PERIOD_MS=100\r\n# TESIS_ADI=${marker}\r\ntime_s;grid_frequency_hz;test_frequency_hz;active_power_mw;active_power_reference_mw;guide_vane_pct\r\n${rows.join("\r\n")}\r\n`;
  await page.goto("/");
  await page.locator("#bulkFiles").setInputFiles({ name: "guvenlik.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await expect(page.locator("#bulkSummary")).toContainText("1 dosya · 1 başarılı");
  await expect(page.locator("#meta-TESIS_ADI")).toHaveValue(marker);
  await page.getByRole("button", { name: "3. Raporlar" }).click();
  await page.getByRole("button", { name: "Önizleme Oluştur" }).click();
  await expect(page.locator("#reportPaper")).toContainText(marker);
  expect(await page.locator("#reportPaper img[data-xss]").count()).toBe(0);
  expect(await page.evaluate(() => window.__XSS)).not.toBe(true);

  await page.locator("#reportType").selectOption({ label: "Test Tutanağı" });
  await expect(page.locator("#reportPaper")).toContainText("TEST TUTANAĞI");
  await page.getByRole("button", { name: "5. Ayarlar" }).click();
  await page.locator("#settingsContent select").nth(1).selectOption("minutes");
  await page.locator("#settingsContent textarea").first().fill("Özel tutanak kapsamı: {{TESIS_ADI}}");
  await page.getByRole("button", { name: "3. Raporlar" }).click();
  await expect(page.locator("#reportPaper")).toContainText("Özel tutanak kapsamı:");

  await page.setViewportSize({ width: 600, height: 900 });
  await page.locator("#sideToggle").click();
  await expect(page.locator("body")).toHaveClass(/mobile-menu-open/);
});
