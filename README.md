# YDA (Yan Hizmetler Doğrulama Aracı) v0.7.0

YDA (Yan Hizmetler Doğrulama Aracı); PFK, RGDH, HFK, SFHM ve SFK test kayıtlarını yerel olarak doğrulayan, grafikleyen ve ortak bir rapor modelinden PDF/DOCX çıktısı üreten çevrimdışı odaklı bir web/Tauri uygulamasıdır.

## v0.7.0 — YDA markası ve 4-CSV klasik PFK

- Uygulama, installer, taskbar/EXE ve web favicon için `docs/icon.png` temelli YDA ikonu kullanılır.
- Klasik PFK HES/DGKÇS/TES yeni şablonları `MAKSIMUM_REZERV.csv`, `MINIMUM_REZERV.csv`, `HASSASIYET.csv` ve `DOGRULAMA_24H.csv` olarak üretilir. Maksimum/minimum dosyası kendi içinde −200/+200 mHz olaylarını barındırır ve ayırır.
- Her rezerv olayı ayrı gecikme, t50, t100, 900 s ve TRP-A/B/C sonucuyla; grafiklerde ölçülen/hesaplanan hedef/tolerans bantlarıyla gösterilir. PDF, DOCX ve HTML önizleme aynı ReportModel’i kullanır.
- Eski `RES_*` ve `VALIDATION` metadata değerleri yalnız geri uyumlu içe aktarma için okunur; yeni ZIP/şablon üretiminde yer almaz.

> HFK, SFHM ve resmî ayrıntılı formatı repository kaynaklarında bulunmayan EDÜ/EDT-SFK çıktıları yalnız **Teknik Ön Değerlendirme / Taslak** statüsündedir; resmî TEİAŞ raporu veya sertifikası yerine geçmez.

## v0.6.5 — native PDF/Word kayıt izni ve doğru dosya türü

- Tauri dosya sistemi yetkisi, kullanıcı seçimiyle alınan klasörlere PDF/DOCX/ZIP/CSV yazmayı destekler; PDF ve Word kaydı artık seçilen klasörde tamamlanır.
- Yerel kaydetme penceresi PDF için `PDF belgesi (*.pdf)`, Word için `Word belgesi (*.docx)` türünü gösterir ve uzantıyı korur.
- Yerel hata nesnesi metin veya nesne olarak dönse de uygulamada anlamlı hata mesajı gösterilir; `Rapor oluşturulamadı: undefined` gösterilmez.

## v0.6.4 — native kayıt, belge türü ve metin eşlemesi

- Tauri masaüstü uygulamasında seçilen çıktı klasörü PDF, Word, ZIP ve SHA-256 manifestinin varsayılan kaydetme konumudur; kaydedilen tam yol bildirimde gösterilir. Web indirme akışı değişmez.
- Rapor türü değiştiğinde yeni `ReportModel` hemen üretilir ve önizleme eski belgeyi göstermez. Türkçe “Tutanağı” ekli tür adları da doğru tutanak akışına yönlenir.
- Ayarlar; hizmet ve belge türü seçicisiyle yalnız ilgili metinleri gösterir. Rapor, tutanak ve sertifika metinleri HTML/PDF/DOCX çıktılarında kendi bölümlerine bağlıdır.

## v0.6.3 — rapor güvenilirliği ve Word çıktısı

- Word raporu, tutanağı ve sertifikası Browser/Tauri yolunda indirilebilir DOCX paketi üretir. PDF, DOCX ve HTML önizleme aynı `ReportModel` ve belge metinlerini kullanır.
- Çok üniteli PFK raporu, her kaydı `CAMPAIGN_ID + UNIT_ID + STEP_ID + RUN_ID` kimliğiyle seçer; birim sertifikasında yalnız ilgili birimin adı, Pnom ve RPmax değeri kullanılır.
- Ayarlar metinleri hizmet ve belge türü bağlamında düzenlenir; `{{TESIS_ADI}}`, `{{UNIT_NAME}}`, `{{PNOM_MW}}` dahil desteklenen placeholder’lar arayüzde görünür.
- SHA-256 dosya bütünlüğünü doğrular; elektronik imza değildir.

Taşınabilir Windows çıktısı için her güncellemeden sonra aşağıdaki komut kullanılabilir. Komut, Tauri release ikilisini `dist/YDA_v<sürüm>_portable_<YYYYMMDD-HHMMSS>.exe` adına kopyalar; web varlıkları ayrı `dist/web` dizininde tutulur.

```powershell
npm.cmd run release:portable
```

## v0.6.2 — gerçek zaman ekseni, kanıt zinciri ve belge ayarları

- Yeni oluşturulan tüm CSV şablonları `ZAMAN;SIRA_NO` ile başlar. `12.3.2026 11:09:19,1s` biçimindeki gerçek zaman damgası grafik, rapor ve doğrulama ekseninde korunur; eski `time_s` dosyaları yalnız geriye dönük okuma için kabul edilir.
- PFK hassasiyet testi, tesis başına dört ayrı adım yerine tek `HASSASIYET` zaman serisidir. Konfigürasyon envanteri 75 şablondur; buna iki üniteli HES kampanya örneğinin 12 test kaydı eklenerek 87 doğrulanan test kaydı sağlanır.
- Her yüklenen ham CSV baytı için SHA-256 kanıt kaydı oluşturulur. “Ham CSV Kanıt Manifesti” indirimi, bu özeti rapor/tutanak ekiyle aynı alanlarda verir; özet elektronik imza değildir.
- Çok üniteli PFK, sadece ortak zaman damgalarında/örnekleme toleransında hizalanan değerleri toplar. Beklenen güç, gerçek referans kanalı ya da `Pset ± RPmax` ile ünite bazında hesaplanır; kurulu güçle indeks bazlı toplama yapılmaz.
- Beşinci sekmedeki Ayarlar alanı; kurum/üst-alt bilgi, TEİAŞ amblemi ve filigranı, imza rolleri, tesis varsayılanları ve standart rapor/tutanak/sertifika metinlerini saklar.
- Rapor ve tutanak PFK A–G / ek / kanıt hiyerarşisini, sertifika ise grafik içermeyen iki A4 sayfayı kullanır.

## v0.6.1 — PFK kampanya ve resmî raporlama güvenliği

- PFK için varsayılan tek ünite akışını koruyan, isteğe bağlı çok üniteli kampanya kartı: `CAMPAIGN_ID + tesis + ünite + adım + RUN_ID` rotası.
- PFK kampanya şablon ZIP'i (`campaign.csv`, SHA-256 kanıt alanlı `manifest.csv`, `U1/...`) ve tüm seçili hizmet/tesis şablonlarını ZIP indirme.
- Çok üniteli PFK'da Ünite / Karşılaştırma / Santral grafikleri, ünite KPI özeti ve birim sertifikalarının ZIP dışa aktarımı.
- Seri bazında görünürlük anahtarları; görünür serilere göre otomatik ölçek ve PNG/SVG dışa aktarımı, rapor için zorunlu serilerin korunması.
- A4 kapaklı PDF/DOCX, test ekipmanı-kalibrasyon ve kanal/ölçek tabloları, PFK A–G yapısı, RGDH C1/C2 eşlemesi ve SFK sinyal/AGC kapsamı.
- Nihai çıktıda kaynak format görseli bulunmaz. Statü, veri tamamlığına göre `Taslak / İnceleme gerekli / İmza öncesi` ile sınırlandırılır.

## Öne çıkanlar

- `TEST_SERVICE`, `PLANT_TYPE`, `STEP_ID` metadata alanlarıyla hizmet/tesis/adım otomatik yönlendirmesi
- UTF-8 BOM, `;` ayırıcı, zorunlu sütun, satır uzunluğu, NaN, monoton zaman, örnekleme ve asgari süre doğrulaması
- 75 CSV şablonu ve 87 gerçekçi test kaydı için otomatik regresyon kapısı; ek üç manifest kayıt sayısına dahil edilmez
- Aynı test adımı için kullanıcı onaylı değiştirme ve ayrıntılı toplu yükleme özeti
- Büyük kayıtlar için binary-search görünür dilim, extrema koruyan min/max downsample ve iptal edilebilir `requestAnimationFrame`
- Zoom, pan, gerçek zaman seçicisi, accordion durumunun korunması, PNG/SVG grafik dışa aktarımı
- Tek `ReportModel` üzerinden HTML önizleme, gerçek A4 PDF, gerçek DOCX ve yazdırma
- Web indirme desteği ile Tauri v2 dialog/fs yerel dosya köprüsü
- Türkçe karakter bütünlüğü ve Playwright tabanlı gerçek tarayıcı testi

## Gereksinimler

- Node.js 22 veya üzeri
- Web geliştirme/üretim derlemesi için npm
- Tauri masaüstü derlemesi için ayrıca Rust stable, Cargo, Microsoft C++ Build Tools ve Windows SDK

Tauri Windows önkoşulları için resmî Tauri v2 dokümantasyonunu izleyin. Rust ve MSVC yalnız web sürümünü çalıştırmak için gerekli değildir.

## Kurulum ve çalıştırma

```powershell
npm.cmd install
npm.cmd run dev
```

Tarayıcıda `http://127.0.0.1:1420` adresini açın.

Üretim web paketi:

```powershell
npm.cmd run build
npm.cmd run preview
```

Tauri geliştirme modu (Rust/MSVC hazır olduğunda):

```powershell
npm.cmd run tauri -- dev
```

Windows kurulum paketi:

```powershell
npm.cmd run tauri -- build
```

## Kullanım

1. Sol menüden hizmet ve tesis tipini seçin veya farklı modlara ait CSV dosyalarını topluca yükleyin.
2. `Dosyaları Seç` ile birden çok CSV ekleyin. Uygulama metadata üzerinden her dosyayı doğru moda ve test adımına yönlendirir.
3. Hatalı dosyalar state'e alınmaz; sonuç panelinde dosya adıyla birlikte gerekçe gösterilir.
4. Grafikler sekmesinde adımı seçin; tekerlek/düğmelerle zoom, sürüklemeyle pan yapın veya zaman aralığını sayısal girin.
5. Raporlar sekmesinde rapor tipini seçip önizleme, PDF, Word, ham CSV kanıt manifesti veya yazdırma aksiyonunu kullanın.
6. Kriterler sekmesinde test prosedürü, teknik kriterler ve ön kontrol/sinyal listesini birlikte inceleyin.
7. Ayarlar sekmesinden belge üst/alt bilgisi, standart metinler, filigran ve varsayılan teknik bilgileri yönetin.
8. Çok üniteli PFK gerekiyorsa yalnız PFK çalışma alanındaki **Santral / Ünite Yapısı** kartından etkinleştirin; kampanya ZIP'indeki CSV'leri değiştirmeden kullanın.

## CSV sözleşmesi

CSV dosyaları UTF-8 BOM ve `;` ayırıcı kullanır. Ondalık sayılarda hem `12.34` hem `12,34` kabul edilir. En az şu metadata alanları zorunludur:

```text
# TEST_SERVICE=PFK
# PLANT_TYPE=HES
# STEP_ID=MAKSIMUM_REZERV
# SAMPLE_PERIOD_MS=100
```

Yeni şablonlarda ilk iki veri kolonu mutlaka aşağıdaki sıradadır:

```text
ZAMAN;SIRA_NO;...
12.3.2026 11:09:19,1s;1;...
```

`ZAMAN` monoton artmalı, `SIRA_NO` 1’den başlayarak ardışık olmalıdır. Eski `time_s` başlığı yalnız mevcut saha/arşiv dosyalarını okuyabilmek için desteklenir; yeni veri ve şablon üretiminde kullanılmaz.

PFK çok üniteli kampanya CSV'lerinde buna ek olarak `CAMPAIGN_ID`, `FACILITY_ID`, `TEST_SCOPE=MULTI_UNIT`, `ENTITY_TYPE`, `ENTITY_ID`, `UNIT_ID`, `UNIT_NAME`, `UNIT_COUNT`, `EVENT_ID` ve `RUN_ID` zorunludur. Bu alanlar PFK dışındaki rotalarda kabul edilmez.

Yeni dosya üretirken `CSV_Sablonlari/` altındaki ilgili şablonu kullanın. `Ornek_Veriler/` altındaki kayıtlar yazılım doğrulama fixture’larıdır; gerçek saha verisi değildir.

### 24 saatlik PFK fixture notu

Klasik PFK doğrulama için üç örnek dosya 86.400 satır ve 1000 ms çözünürlüktedir. Bunlar uzun süreli uygulama/grafik performansı içindir. Resmî saha kayıt çözünürlüğü olan 100 ms’nin yerine geçmez; validator bu farkı açık bir uyarı olarak raporlar.

## Testler

```powershell
npm.cmd run check:js
npm.cmd run validate:csv
npm.cmd run test
npm.cmd run build
npm.cmd run test:ui
```

Tüm kapıları sırayla çalıştırmak için:

```powershell
npm.cmd run test:all
```

Beklenen CSV envanteri:

```text
CSV templates: 69/69 PASS
Example CSV: 77/77 PASS
```

## Mimari

```text
index.html
└─ src/main.js                 UI orkestrasyonu ve tek bootstrap
   ├─ app/                     v0.6.2 konfigürasyonu, belge ayarları, varlıklar, state
   ├─ csv/                     parser, metadata router, validator, ham kanıt özeti
   ├─ analysis/                saf hizmet değerlendirmeleri
   ├─ charts/                  seri seçimi, downsample, Canvas/SVG motoru
   ├─ criteria/                prosedür ve ön kontroller
   ├─ report/                  ReportModel, HTML, PDF, DOCX adaptörleri
   └─ platform/                web/Tauri dosya açma-kaydetme köprüsü
```

Rapor görselleri Vite/Tauri paketine göreli asset olarak alınır; çalışma zamanında CDN veya internet erişimi gerekmez.

## Bilinen sınırlar

- Repository’deki rapor referanslarının çoğu yalnız kapak veya tek sayfalık görseldir. Tam resmî alan/bölüm yapısı bulunmayan formatlarda bu eksiklik raporda açıkça belirtilir.
- HFK ve SFHM için resmî ayrıntılı rapor şablonu mevcut değildir; çıktı taslaktır.
- EDÜ/EDT-SFK ayrıntılı performans prosedürü kaynak setinde tam değildir; çıktı taslaktır.
- CSV parse ve grafik hazırlama tarayıcı ana iş parçacığındadır. Mevcut 108.001 satırlık en büyük fixture test edilmiştir; daha büyük saha kayıtları için Worker ölçüm sonrası değerlendirilebilir.
- Tauri binary üretimi, makinede Rust/Cargo ve MSVC/Windows SDK kurulmasını gerektirir.

## Denetim ve sürüm notları

- Ayrıntılı ilk durum, kök nedenler ve doğrulama kanıtları: [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md)
- v0.7.0 kaynak/uyumluluk denetimi: [`docs/YDA_VNEXT_AUDIT.md`](docs/YDA_VNEXT_AUDIT.md)
- v0.6.1 başlangıç denetimi: [`docs/V061_AUDIT.md`](docs/V061_AUDIT.md)
- v0.6.2 zaman/veri/rapor denetimi: [`docs/V062_AUDIT.md`](docs/V062_AUDIT.md)
- Kaynak format → YHDA alan eşlemesi: [`docs/TEIAS_REPORT_FORMAT_MAPPING.md`](docs/TEIAS_REPORT_FORMAT_MAPPING.md)
- Sürüm değişiklikleri: [`CHANGELOG.md`](CHANGELOG.md)
- Eski tek-dosya uygulama yalnız karşılaştırma/migrasyon referansı olarak `TEIAS_YHDA_v0_5_1.html` içinde korunur.
