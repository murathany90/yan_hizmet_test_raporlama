/**
 * PFK sahası için tek teknik kriter kaynağı.
 *
 * Değerler E.17.A uygulama esaslarındaki 100 ms kayıt, -/+200 mHz olayları,
 * 15/30 s dinamik sınırlar, 900 s sürdürme ve TRP bantlarının %90 kabul
 * oranından türetilmiştir. Bu nesne değerlendirme, grafik ve raporun ortak
 * sözleşmesidir; kullanıcı arayüzü buradaki değerleri sessizce değiştirmez.
 */
export const PFK_CRITERIA = Object.freeze({
  id: "YDA-PFK-2026.08.18",
  source: "E.17.A PFK uygulama esasları ve TEİAŞ PFK veri/rapor formatı",
  sampling: Object.freeze({ requiredMs: 100, toleranceRatio: 0.02 }),
  reserve: Object.freeze({
    nominalFrequencyHz: 50,
    eventTargetsHz: Object.freeze({ NEG200: 49.8, POS200: 50.2 }),
    eventTargetToleranceHz: 0.035,
    nominalToleranceHz: 0.03,
    officialOnsetDeviationHz: 0.1,
    debounceMs: 500,
    preEventWindowSeconds: 20,
    postEventWindowSeconds: 900,
    responseDelayLimitSeconds: Object.freeze({ HES: 4, DEFAULT: 2 }),
    t50LimitSeconds: 15,
    t100LimitSeconds: 30,
    sustainSeconds: 900,
    trpPassRatio: 0.9,
    trpBands: Object.freeze([
      Object.freeze({ id: "TRP_A", start: "response", endSeconds: 30, tolerancePnomRatio: 0.02 }),
      Object.freeze({ id: "TRP_B", startSeconds: 30, endSeconds: 90, tolerancePnomRatio: 0.02 }),
      Object.freeze({ id: "TRP_C", startSeconds: 90, endSeconds: 900, tolerancePnomRatio: 0.01 })
    ])
  }),
  sensitivity: Object.freeze({
    requiredSteps: 4,
    thresholdHz: 0.01,
    targetsHz: Object.freeze([49.995, 50.005, 49.990, 50.010]),
    targetToleranceHz: 0.0025,
    minimumPlateauSeconds: 5,
    guideResponseMinimumPct: 0.1,
    deadbandLimitMhz: 10
  }),
  validation24h: Object.freeze({
    minimumSeconds: 86_399,
    expectedPowerTolerancePnomRatio: 0.01,
    passRatio: 0.9
  })
});

function reserveDirection(direction) {
  if (direction === "NEG200" || direction === "UNDER_FREQUENCY" || direction === 1) return 1;
  if (direction === "POS200" || direction === "OVER_FREQUENCY" || direction === -1) return -1;
  throw new Error(`Bilinmeyen PFK rezerv yönü: ${direction}`);
}

function orderedRange(first, second) {
  return { lower: Math.min(first, second), upper: Math.max(first, second) };
}

/**
 * TEİAŞ PFK rezerv yanıtı için tek resmî hedef/tolerans sözleşmesi.
 * Evaluator ve FigureModel bu fonksiyonu birlikte kullanır; böylece Pset
 * tabanlı resmî zarf ile grafikte görülen zarf ayrışmaz.
 */
export function buildOfficialReserveEnvelope({ direction, pSet, rpMax, pNom, responseDelay = 0, t = 0 }) {
  const sign = reserveDirection(direction);
  const setpoint = Number(pSet);
  const reserve = Number(rpMax);
  const nominal = Number(pNom);
  const delay = Math.max(0, Number(responseDelay) || 0);
  const time = Number(t) || 0;
  const responseRatio = Math.max(0, Math.min(1, (time - delay) / Math.max(0.001, 30 - delay)));
  const onePercent = 0.01 * nominal;
  const twoPercent = 0.02 * nominal;
  const finalTarget = setpoint + sign * reserve;
  const expected = setpoint + sign * responseRatio * reserve;

  const trpA = sign > 0
    ? orderedRange(setpoint + responseRatio * (reserve - onePercent), setpoint + reserve + twoPercent)
    : orderedRange(setpoint - reserve - twoPercent, setpoint - responseRatio * (reserve - onePercent));
  const trpB = sign > 0
    ? orderedRange(setpoint + reserve - onePercent, setpoint + reserve + twoPercent)
    : orderedRange(setpoint - reserve - twoPercent, setpoint - reserve + onePercent);
  const trpC = orderedRange(finalTarget - onePercent, finalTarget + onePercent);

  return Object.freeze({
    direction: sign > 0 ? "NEG200" : "POS200",
    responseRatio,
    expected,
    finalTarget,
    trpA,
    trpB,
    trpC
  });
}

const CLASSIC_PFK_PLANTS = new Set(["PFK:HES", "PFK:DGKCS", "PFK:TES"]);

const LEGACY_RESERVE_ALIASES = Object.freeze({
  RES_MAX_NEG200: Object.freeze({ stepId: "MAKSIMUM_REZERV", eventId: "NEG200" }),
  RES_MAX_POS200: Object.freeze({ stepId: "MAKSIMUM_REZERV", eventId: "POS200" }),
  RES_MIN_NEG200: Object.freeze({ stepId: "MINIMUM_REZERV", eventId: "NEG200" }),
  RES_MIN_POS200: Object.freeze({ stepId: "MINIMUM_REZERV", eventId: "POS200" }),
  VALIDATION: Object.freeze({ stepId: "DOGRULAMA_24H" })
});

export function pfkLegacyStepAlias(stepId) {
  return LEGACY_RESERVE_ALIASES[String(stepId || "").trim().toUpperCase()] ?? null;
}

function findLegacyStep(steps, id) {
  const step = steps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`PFK klasik yapılandırmasında ${id} bulunamadı.`);
  return step;
}

/**
 * Klasik üretim tesislerinde dört fiziksel CSV oluşturur. Eski altı dosyalı
 * girişler metadata router üzerinden okunmaya devam eder; yalnız yeni şablon
 * ve ZIP üretimi bu dört kanonik adı kullanır.
 */
export function applyPfkClassicVNext(configs) {
  for (const [key, config] of Object.entries(configs)) {
    if (!CLASSIC_PFK_PLANTS.has(key)) continue;
    const maximum = findLegacyStep(config.steps, "RES_MAX_NEG200");
    const minimum = findLegacyStep(config.steps, "RES_MIN_NEG200");
    const sensitivity = findLegacyStep(config.steps, "HASSASIYET");
    const validation = findLegacyStep(config.steps, "VALIDATION");
    config.steps = [
      {
        ...maximum,
        id: "MAKSIMUM_REZERV",
        name: "Maksimum rezerv — −200 mHz ve +200 mHz olayları",
        kind: "reserve_sequence",
        eventSequence: ["NEG200", "POS200"],
        legacyAliases: ["RES_MAX_NEG200", "RES_MAX_POS200"],
        note: "Tek fiziksel CSV içinde sıralı −200 mHz ve +200 mHz olayları bulunur."
      },
      {
        ...minimum,
        id: "MINIMUM_REZERV",
        name: "Minimum rezerv — −200 mHz ve +200 mHz olayları",
        kind: "reserve_sequence",
        eventSequence: ["NEG200", "POS200"],
        legacyAliases: ["RES_MIN_NEG200", "RES_MIN_POS200"],
        note: "Tek fiziksel CSV içinde sıralı −200 mHz ve +200 mHz olayları bulunur."
      },
      {
        ...sensitivity,
        id: "HASSASIYET",
        name: "Hassasiyet testi — birleşik frekans adımları",
        kind: "sensitivity",
        sensitivityTargets: ["49.990", "49.995", "50.005", "50.010"],
        note: "49,990 / 49,995 / 50,005 / 50,010 Hz adımları tek CSV içinde sıralı kaydedilir."
      },
      {
        ...validation,
        id: "DOGRULAMA_24H",
        name: "24 saat doğrulama — gerçek şebeke frekansı",
        kind: "validation",
        legacyAliases: ["VALIDATION"],
        note: "En az 24 saatlik gerçek şebeke frekansı ve aktif güç kaydı."
      }
    ];
  }
  return configs;
}
