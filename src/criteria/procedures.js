const COMMON_PRECHECKS = [
  "Ölçüm cihazlarının doğruluk sınıfını ve güncel kalibrasyon sertifikalarını doğrula.",
  "CSV kanal adlarını, birimleri ve beklenen örnekleme periyodunu kayıt başlamadan kontrol et.",
  "Tüm veri kaynaklarında ortak zaman senkronizasyonunu doğrula.",
  "Aktif/reaktif güç işaret yönü ile frekans ve gerilim sinyali polaritesini kontrol et.",
  "Pset, limiter, droop ve deadband ayarlarını kayıt altına al.",
  "Koruma, alarm ve işletme kısıtlarının test boyunca izlenebilir olduğunu doğrula."
];

const PROCEDURES = {
  PFK: [
    "Test ekipmanlarını bağla ve izolasyon/güvenlik kontrollerini tamamla.",
    "Kalibrasyon, kanal eşlemesi ve zaman senkronizasyonunu doğrula.",
    "Üniteyi maksimum güç test Pset değerine getir ve kararlı durumu kaydet.",
    "Governor/primer kontrolün devrede olduğunu doğrula; droop ve ölü bant ayarlarını kaydet.",
    "Veri kaydını başlat ve test öncesi baz çizgisini oluştur.",
    "49,8 Hz simülasyonunu uygula; tepkiyi ve rezerv sürdürülebilirliğini kaydet.",
    "50 Hz'e dön, kararlı durumdan sonra 50,2 Hz testini uygula.",
    "Maksimum güçteki pozitif/negatif rezerv adımlarını tamamla.",
    "Üniteyi minimum güç test Pset değerine getir ve iki yönlü testleri tekrarla.",
    "50,005 / 50,010 / 49,995 / 49,990 Hz hassasiyet kayıtlarını al.",
    "Gerçek şebeke frekansı doğrulama kaydını başlat; olay ve sapmaları işaretle.",
    "Ham kayıtları değiştirmeden sakla, test notlarını ve katılımcıları tamamla."
  ],
  RGDH: [
    "Gerilim, aktif güç ve reaktif güç kanallarını aynı zaman tabanında doğrula.",
    "Tesisin gerilim kontrol modu ile Pset/Q hedefini kayıt altına al.",
    "Aşırı ikaz ve düşük ikaz yönlerinde hedef çalışma noktalarını sırayla uygula.",
    "Her çalışma noktasında kararlı reaktif güç kapasitesi için yeterli süre kayıt al.",
    "Gerilim referansına +%1 ve -%1 basamakları uygula; etkileştirme ve dengeleme davranışını kaydet.",
    "Limit, akım, güç faktörü ve yardımcı kaynak sinyallerini grafiklerle birlikte incele."
  ],
  HFK: [
    "EDÜ/EDT SoC ve kullanılabilir güç/enerji rezervini doğrula.",
    "20 ms örnekleme ve tetik sinyalinin zaman senkronizasyonunu kontrol et.",
    "Pozitif ve negatif frekans destek tetiklerini ayrı kayıtlarla uygula.",
    "Senkron bağlantı desteği senaryolarını pozitif/negatif yönde uygula.",
    "Aktif güç, frekans, RoCoF, DC güç ve bağlantı hattı akışını birlikte kaydet.",
    "Çıktıyı yalnız Teknik Ön Değerlendirme / Taslak statüsünde yorumla."
  ],
  SFHM: [
    "Çalışma noktası, droop ve kullanılabilir rezervi kaydet.",
    "Frekansı düşük frekans senaryosu için 49,6 Hz bölgesine getir.",
    "Aktif güç tepkisi ile rezervin etkinleşme/sürdürme davranışını kaydet.",
    "Frekansı yüksek frekans senaryosu için 50,4 Hz bölgesine getir ve testi tekrarla.",
    "Depolama tesislerinde SoC, enerji ve DC güç sinyallerini birlikte incele.",
    "Çıktıyı yalnız Teknik Ön Değerlendirme / Taslak statüsünde yorumla."
  ],
  SFK: [
    "AGC/LFC haberleşmesi, setpoint ve feedback sinyallerini doğrula.",
    "LMIN, LMAX, LLOC, LREM, LMAN, LMIC, LPWR, GENSTAT ve PFCO durumlarını kontrol et.",
    "MAXC bölgesinde yük alma ve yük atma kayıtlarını ayrı dosyalarla al.",
    "MINC bölgesinde yük alma ve yük atma kayıtlarını ayrı dosyalarla al.",
    "PFK devredeyken yük alma/yük atma testlerini tekrarla.",
    "Gecikme, rampa, setpoint takibi ve feedback tutarlılığını ham veriden hesapla.",
    "EDÜ/EDT için enerji rezervi ve SoC yeterliliğini ayrıca kaydet."
  ]
};

const PLANT_NOTES = {
  "PFK:HES": "Ayar kanadı ve ünite hız sinyallerini governor tepkisiyle birlikte kaydet.",
  "PFK:DGKCS": "Yakıt vanası, türbin/HRSG limitleri ve kombine çevrim koordinasyonunu kaydet.",
  "PFK:TES": "Reglaj vanası, buhar basıncı ve buhar sıcaklığını aktif güç tepkisiyle birlikte kaydet.",
  "PFK:EDUEDT": "SoC, depolanmış enerji ve DC güç limitlerini pozitif/negatif rezerv yönleri için doğrula.",
  "RGDH:RESGES": "PCC ölçümleri ve santral gerilim kontrolcüsünün türbin/inverter toplam davranışını kullan.",
  "RGDH:EDUEDT": "Şarj ve deşarj çalışma noktalarında kapasiteyi ve SoC kısıtlarını ayrı değerlendir.",
  "SFK:EDUEDT": "AGC adımlarında kullanılabilir yukarı/aşağı rezerv ile en az iki saatlik enerji yeterliliğini kontrol et."
};

export function procedureFor(service, plant) {
  const steps = [...(PROCEDURES[service] ?? [])];
  const note = PLANT_NOTES[`${service}:${plant}`];
  if (note) steps.splice(Math.min(4, steps.length), 0, note);
  return steps;
}

export function controlsFor(service, plant) {
  const controls = [...COMMON_PRECHECKS];
  if (service === "PFK") controls.push("Governor/primer kontrol modu", "Aktif güç Pset [MW]", "Droop [%]", "Ölü bant [mHz]");
  if (service === "RGDH") controls.push("Gerilim kontrol modu", "P/Q işaret yönü", "Gerilim referansı [kV]", "İkaz/akım limiter durumu");
  if (service === "HFK") controls.push("Tetik sinyali", "RoCoF [Hz/s]", "SoC [%]", "DC güç [MW]", "Bağlantı hattı akışı [MW]");
  if (service === "SFHM") controls.push("LFSM-O/LFSM-U modu", "Droop [%]", "SoC [%]", "Kullanılabilir rezerv [MW]");
  if (service === "SFK") controls.push("AGC/LFC modu", "Setpoint/feedback", "MAXC/MINC [MW]", "LFC alarm ve durum bitleri", "PFK devre durumu");
  if (plant === "EDUEDT") controls.push("Enerji kapasitesi [MWh]", "Başlangıç/bitiş SoC [%]", "Şarj/deşarj güç sınırları [MW]");
  return controls;
}

export function isDraftMode(service, plant) {
  return service === "HFK" || service === "SFHM" || (service === "SFK" && plant === "EDUEDT");
}

