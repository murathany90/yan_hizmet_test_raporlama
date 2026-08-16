# TEİAŞ-YHDA v0.6.0

TEİAŞ Yan Hizmetler Doğrulama Aracı; PFK, RGDH, HFK, SFHM ve SFK test kayıtlarını yerel olarak doğrulayan, grafikleyen ve ortak bir rapor modelinden PDF/DOCX çıktısı üreten çevrimdışı odaklı bir web/Tauri uygulamasıdır.

> HFK, SFHM ve resmî ayrıntılı formatı repository kaynaklarında bulunmayan EDÜ/EDT-SFK çıktıları yalnız **Teknik Ön Değerlendirme / Taslak** statüsündedir; resmî TEİAŞ raporu veya sertifikası yerine geçmez.

## Öne çıkanlar

- `TEST_SERVICE`, `PLANT_TYPE`, `STEP_ID` metadata alanlarıyla hizmet/tesis/adım otomatik yönlendirmesi
- UTF-8 BOM, `;` ayırıcı, zorunlu sütun, satır uzunluğu, NaN, monoton zaman, örnekleme ve asgari süre doğrulaması
- 87 CSV şablonu ve 87 gerçekçi örnek veri için otomatik regresyon kapısı
- Aynı test adımı için kullanıcı onaylı değiştirme ve ayrıntılı toplu yükleme özeti
- Büyük kayıtlar için binary-search görünür dilim, extrema koruyan min/max downsample ve iptal edilebilir `requestAnimationFrame`
- Zoom, pan, sayısal zaman aralığı, accordion durumunun korunması, PNG/SVG grafik dışa aktarımı
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
5. Raporlar sekmesinde rapor tipini seçip önizleme, PDF, Word veya yazdırma aksiyonunu kullanın.
6. Kriterler sekmesinde test prosedürü, teknik kriterler ve ön kontrol/sinyal listesini birlikte inceleyin.

## CSV sözleşmesi

CSV dosyaları UTF-8 BOM ve `;` ayırıcı kullanır. Ondalık sayılarda hem `12.34` hem `12,34` kabul edilir. En az şu metadata alanları zorunludur:

```text
# TEST_SERVICE=PFK
# PLANT_TYPE=HES
# STEP_ID=RES_MAX_NEG200
# SAMPLE_PERIOD_MS=100
```

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
CSV templates: 87/87 PASS
Example CSV: 87/87 PASS
```

## Mimari

```text
index.html
└─ src/main.js                 UI orkestrasyonu ve tek bootstrap
   ├─ app/                     sabit konfigürasyon, varlıklar, state
   ├─ csv/                     parser, metadata router, validator
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
- Sürüm değişiklikleri: [`CHANGELOG.md`](CHANGELOG.md)
- Eski tek-dosya uygulama yalnız karşılaştırma/migrasyon referansı olarak `TEIAS_YHDA_v0_5_1.html` içinde korunur.
