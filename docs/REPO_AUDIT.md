# TEİAŞ-YHDA Repository Denetimi

Denetim tarihi: 2026-08-16  
Başlangıç sürümü: TEİAŞ-YHDA v0.5.1  
Başlangıç çalışma ağacı: Git metadata'sı bulunmayan yerel klasör

Bu belge, kaynak kod değişikliklerinden önce yapılan salt-okunur incelemenin bulgularını kaydeder. İlk tablo denetim anındaki durumu korur; uygulama sonrası kapanış matrisi belgenin sonunda yer alır.

## Bulgu Özeti

| ID | Önem | Alan | Dosya/Satır | Problem | Kök Neden | Önerilen Çözüm | Durum |
|---|---|---|---|---|---|---|---|
| AUD-001 | CRITICAL | Başlatma | `TEIAS_YHDA_v0_5_1.html:487,645` | Uygulama iki ayrı noktadan başlatılıyor ve iki kez render ediliyor. | Sonradan eklenen güvenli boot yaması eski doğrudan `renderAll()` çağrısını kaldırmamış. | Tek, açık bir bootstrap noktası oluştur; başlangıç sırasını unit/UI testiyle koru. | Açık |
| AUD-002 | HIGH | JavaScript | `TEIAS_YHDA_v0_5_1.html:253-319,335-378,462-627` | Altı fonksiyon adı birden fazla kez, `renderCriteria` üç kez tanımlı. | Tek HTML'e art arda yama eklenmesi ve function hoisting ile override'a güvenilmesi. | Fonksiyonları modüllere ayır, her public işlev için tek tanım kullan. | Açık |
| AUD-003 | HIGH | CSV Toplu Yükleme | `TEIAS_YHDA_v0_5_1.html:197-206` | Toplu yükleme `TEST_SERVICE` ve `PLANT_TYPE` ile yönlendirmiyor; yalnız açık ekrandaki `STEP_ID` aranıyor. | Routing yalnız `cfg()` üzerinden mevcut moda bağlı. | Üç metadata alanını birlikte doğrulayan bağımsız router yaz. | Açık |
| AUD-004 | HIGH | CSV Doğrulama | `TEIAS_YHDA_v0_5_1.html:157-191` | Zorunlu sütun, satır uzunluğu, NaN, monoton zaman ve örnekleme doğrulaması yok. | Parser ve dönüştürme katmanları validation katmanı olmadan doğrudan state'e yazıyor. | Parser/validator/metadata katmanlarını ayır; açıklayıcı hata üret. | Açık |
| AUD-005 | HIGH | Güvenlik | `TEIAS_YHDA_v0_5_1.html:122-124,139,143-150,304,380-456` | CSV metadata, dosya adı ve kullanıcı rapor notu `innerHTML` şablonlarına kaçışsız giriyor. | Güvenilir ve güvenilmeyen veri ayrımı yapılmamış. | DOM API veya merkezi HTML escape kullan; formül/CSV injection önlemleri ekle. | Açık |
| AUD-006 | HIGH | Raporlama | `TEIAS_YHDA_v0_5_1.html:300-317,400-459` | Ortak ReportModel yok; rapor üretimi DOM'a bağlı ve iki ayrı implementasyon içeriyor. | PDF/print özelliği tek HTML içinde evrilmiş. | Saf ReportModel oluştur; HTML/PDF/DOCX adaptörlerini aynı modelden besle. | Açık |
| AUD-007 | HIGH | DOCX | Repository geneli | Word/DOCX çıktısı bulunmuyor. | Raporlama yalnız browser print olarak uygulanmış. | Offline paketlenen `docx` tabanlı üretici ve Tauri/browser save köprüsü ekle. | Açık |
| AUD-008 | HIGH | Test | Repository geneli | Unit, UI, encoding, rapor ve CSV regresyon testleri yok. | Paket/build/test altyapısı hiç kurulmamış. | Vitest + Playwright + bağımsız 87/87 validator ve rapor smoke testleri ekle. | Açık |
| AUD-009 | HIGH | Tauri | Repository geneli | `package.json`, `src-tauri`, Cargo manifesti ve capability tanımı yok. | Proje yalnız çift tıklanan tek HTML olarak dağıtılmış. | Tauri v2 vanilla/Vite yapısı, dialog/fs pluginleri ve güvenli capability ekle. | Açık |
| AUD-010 | MEDIUM | Grafik Performansı | `TEIAS_YHDA_v0_5_1.html:344-368` | Her zoom/pan çiziminde bütün ham veri `filter` ediliyor; mousemove her olayda yeni RAF kuyruğu açıyor. | Görünür aralık için indeks/binary search ve RAF iptali yok. | Binary search görünür dilim, tek RAF scheduler ve ölçümlü redraw uygula. | Açık |
| AUD-011 | MEDIUM | Downsample | `TEIAS_YHDA_v0_5_1.html:355-357,476-485` | Basit stride örnekleme pik/çukur değerlerini kaybedebilir. | Görsel veri azaltmada extrema korunmuyor. | Çok serili min/max bucket algoritması kullan; ham veriyi değiştirme. | Açık |
| AUD-012 | MEDIUM | Grafik UI | `TEIAS_YHDA_v0_5_1.html:371-378` | `details` açılma anında redraw/ResizeObserver yok; her render tüm panelleri açık olarak yeniden kuruyor. | Accordion açık/kapalı state'i ve boyut gözlemi tutulmuyor. | Açık state'i sakla; toggle sonrası RAF ve ResizeObserver ile çiz. | Açık |
| AUD-013 | MEDIUM | Grafik Export | Repository geneli | Grafik başına PNG/SVG dışa aktarımı yok. | Canvas yalnız ekran/rapor içi kullanılıyor. | Her grafik kartına PNG ve SVG indirme/save aksiyonu ekle. | Açık |
| AUD-014 | MEDIUM | CSV Replace | `TEIAS_YHDA_v0_5_1.html:203-206` | Aynı route/STEP_ID sessizce eziliyor. | Duplicate policy tanımlı değil. | Web/Tauri uyumlu kullanıcı onayı ve güvenli batch sonucu ekle. | Açık |
| AUD-015 | MEDIUM | CSV UX | `TEIAS_YHDA_v0_5_1.html:155,197-206` | Toplu yükleme sonunda başarı/hata özeti yok; her hata ayrı `alert`. | Batch sonuç modeli bulunmuyor. | Tek özet panel/toast içinde toplam, başarılı ve nedenli hataları göster. | Açık |
| AUD-016 | MEDIUM | CSV Uyumluluğu | `TEIAS_YHDA_v0_5_1.html:161` | Parser ayırıcıyı `,` olarak da kabul ediyor; standart `;` şartı uygulanmıyor. | Otomatik separator tahmini kullanılmış. | `;` zorunlu tut; ondalık `,` ve `.` desteğini number parser'da çöz. | Açık |
| AUD-017 | MEDIUM | Encoding | `TEIAS_YHDA_v0_5_1.html:208-212` | İndirilen yeni CSV şablonuna UTF-8 BOM eklenmiyor. | Blob metni BOM'suz oluşturuluyor. | `\uFEFF` ekle; Türkçe round-trip testi yaz. | Açık |
| AUD-018 | MEDIUM | CSV Matrisi | `CONFIGS` PFK `VALIDATION`; üç örnek dosya | Üç 24 saat PFK örneği metadata'da 1000 ms, config'te resmî saha örneklemesine göre 100 ms. | Yazılım performans fixture'ı ile resmî saha kriteri aynı `STEP_ID` altında. | Metadata örneklemesini fixture doğrulamasında esas al; 1000 ms dosyayı açıkça resmî olmayan performans örneği olarak işaretle. | Açık |
| AUD-019 | MEDIUM | PDF | `TEIAS_YHDA_v0_5_1.html:317,459` | “PDF” ayrı dosya üretmiyor; yalnız `window.print()` var. | Browser print diyaloğuna bağımlı mimari. | Ortak modelden A4 PDF blob üret; yazdırmayı ikincil seçenek olarak koru. | Açık |
| AUD-020 | MEDIUM | Rapor Değişkenleri | `TEIAS_YHDA_v0_5_1.html:380-383` | Tablo 4 kolonlu; `Birim` ve `CSV/Metadata Alanı` yok. | Değişken şeması yalnız üç elemanlı tuple olarak tutuluyor. | Birim çıkarımı ve kaynak alanını içeren 6 kolonlu model üret. | Açık |
| AUD-021 | MEDIUM | Rapor Tamlığı | `TEIAS_YHDA_v0_5_1.html:393-455` | Rapor yalnız yüklenen kayıtları listeliyor; eksik testleri üst seviyede açıkça göstermiyor. | `loadedRecs()` eksik adımları modelden atıyor. | Beklenen/yüklenen/eksik adımları ortak rapor özetine ekle. | Açık |
| AUD-022 | MEDIUM | Regülasyon | `TEIAS_YHDA_v0_5_1.html:329-332` ve JPG referanslar | Ayrıntılı kriterler büyük ölçüde inline; repo içindeki formatların çoğu yalnız kapak/tek sayfa görüntüsü, tam kaynak izlenebilirliği yok. | Referans seti tam resmî dokümanları içermiyor. | Kaynak/statü alanını görünür yap; HFK/SFHM ve kaynak bulunmayan EDÜ-SFK çıktısını “Teknik Ön Değerlendirme / Taslak” tut. | Açık |
| AUD-023 | LOW | Asset Boyutu | `TEIAS_YHDA_v0_5_1.html:52,332,390` | Logo ve JPG'ler base64 olarak tekrar gömülü; HTML 1,69 MB. | Çift tıklama/offline hedefi için bütün varlıklar tek dosyada paketlenmiş. | Yeni build'de göreli asset URL'leri kullan; Vite/Tauri bundle içine al. | Açık |
| AUD-024 | LOW | Erişilebilirlik | `TEIAS_YHDA_v0_5_1.html` | Form label'ları `for` ile inputlara bağlı değil; bildirimler `aria-live` kullanmıyor; canvas için açıklama yok. | Hızlı inline UI üretimi. | ID/for bağları, aria-live durum bölgesi, tooltip ve grafik açıklaması ekle. | Açık |
| AUD-025 | LOW | Sürümleme | `README.md`, HTML ve CSV metadata | v0.5, v0.5.1 ve v0.5.1.1 değerleri tutarsız. | Sürüm tek merkezden yönetilmiyor. | `package.json` v0.6.0'ı kaynak kabul et; görünür sürümü ve üretilen şablon metadata'sını eşitle. | Açık |
| AUD-026 | LOW | Git Hijyeni | Repository geneli | `.gitignore` ve geçmiş yok; başlangıçta tüm dosyalar untracked. | Yerel paket Git repository olarak teslim edilmemiş. | Güvenli ignore kuralları, secret taraması, anlamlı commitler ve doğrulanmış origin ekle. | Açık |

## Fonksiyonel Hatalar

- Çift başlangıç/render ve fonksiyon override zinciri deterministikliği zayıflatıyor.
- Toplu yükleme metadata'ya göre farklı hizmet/tesis ekranlarına yönlenmiyor.
- Eksik sütunlar yükleme anında reddedilmiyor.
- Aynı test adımı sessizce değiştiriliyor.
- Eksik test adımları rapor sonuçlarında açık bir eksik listesi olarak gösterilmiyor.

## UI/UX Problemleri

- Hata iletişimi çok sayıda bloklayıcı `alert` üzerinden ilerliyor.
- Batch özet, yükleme ilerlemesi ve kalıcı durum bildirimi yok.
- Form label/input ilişkileri ve birim ipuçları eksik.
- Rapor butonları gerçek PDF/DOCX dosya üretimini temsil etmiyor.

## Grafik Problemleri

- Accordion açık state'i renderlar arasında korunmuyor.
- Gizli/dar canvas için açılma anında güvenilir redraw yok.
- Min/max korumayan stride downsample kritik pikleri kaçırabilir.
- Pan çizimi iptal edilebilir tek RAF yerine olay başına kuyruklanıyor.
- PNG/SVG export ve seçili zaman aralığı girişi yok.

## CSV Problemleri

- Parser `;` standardını zorunlu tutmuyor.
- Zorunlu metadata/sütun/NaN/monoton zaman/örnekleme katmanı yok.
- Bulk route yalnız açık config'e bağlı.
- Uygulama içinden indirilen şablon BOM'suz.
- Üç PFK 24 saat fixture'ı bilinçli 1 s performans verisi; resmî 100 ms şartından ayrı statü gerektiriyor.

## Unicode/Türkçe Problemleri

- Mevcut HTML ve 174 hedef CSV UTF-8 olarak okunuyor; 87 şablon ve 87 örnek BOM içeriyor.
- Otomatik round-trip testi yok.
- DOCX/PDF üretimi olmadığı için rapor katmanında Türkçe glyph doğrulaması yok.

## Raporlama Problemleri

- PDF yalnız browser print.
- DOCX yok.
- Ortak rapor modeli yok.
- Değişken tablosu eksik kolonlu.
- Referans görselleri büyük base64 olarak gömülü ve çoğu yalnız ilk sayfa.

## Performans Problemleri

- 100.000+ satırda görünür aralık için her çizimde tam dizi taraması.
- Offscreen grafik stride örneklemesi tepe değerleri korumuyor.
- Pan sırasında üst üste RAF çizimleri oluşabiliyor.
- CSV parse UI thread üzerinde; önce ölçüm/test yapılmadan Worker karmaşıklığı eklenmemeli.

## Tauri/EXE Uyumluluk Problemleri

- Tauri v2 iskeleti, capability ve dialog/fs köprüsü yok.
- WebView bundle yerine tek `file://` HTML çalışma biçimi esas alınmış.
- Rust/Cargo mevcut çalışma ortamında kurulu değil; gerçek build bu ortamda çalıştırılamaz.

## Teknik Borç

- 1,69 MB tek HTML, büyük JSON/data URI blokları ve override edilen global fonksiyonlar.
- Config, state, parser, evaluator, chart ve report katmanları birbirine global state üzerinden bağlı.
- Sürüm değeri birden çok yerde farklı.

## Güvenlik Problemleri

- Güvenilmeyen CSV metadata/dosya adlarının kaçışsız `innerHTML` kullanımı.
- Gelecekte Tauri IPC yetkileri eklendiğinde bu XSS riski daha yüksek etkiye sahip olabilir.
- `.gitignore` ve otomatik secret/local-path kontrolü yok.

## İlk Doğrulama Kanıtı

- JavaScript parse/syntax: PASS (`new Function` ile script parse edildi).
- CSV şablon encoding/metadata/delimiter: 87/87 PASS.
- Örnek CSV encoding/metadata/delimiter: 87/87 PASS.
- Örnek CSV sütun/NaN/monoton zaman: 87/87 PASS.
- Config örnekleme değeriyle birebir karşılaştırma: 84/87; üç belgelenmiş 24 saat/1 s PFK performans fixture'ı farklı.
- In-app Browser: kullanılabilir oturum bulunamadı; repository Playwright testi gerektiriyor.
- Rust/Cargo: ortamda bulunamadı.

## Uygulama Sonrası Kapanış Matrisi

| Bulgular | Son durum | Kanıt |
|---|---|---|
| AUD-001–002 | Düzeltildi | `src/main.js` tek `boot()` çağrısı; modüler tekil fonksiyonlar; `npm run check:js` PASS. |
| AUD-003–004, AUD-014–018 | Düzeltildi | `src/csv/*`; metadata router; duplicate onayı; batch özeti; BOM/`;`/sütun/NaN/zaman/örnekleme/süre kontrolleri; 87/87 + 87/87 PASS. |
| AUD-005 | Düzeltildi | Yükleme/kriter/UI alanları DOM API ile kurulur; rapor preview tüm dinamik metni escape eder; injection regresyonu UI test kapsamındadır. |
| AUD-006–007, AUD-019–021 | Düzeltildi | Ortak immutable `ReportModel`; HTML/PDF/DOCX adaptörleri; 6 kolon, eksik adımlar, imza ve kaynak referansı. PDF/DOCX binary testleri ve sayfa render QA tamamlandı. |
| AUD-008 | Düzeltildi | Vitest birim/rapor/UTF-8 testleri, Playwright UI testi ve bağımsız CSV matrisi eklendi. |
| AUD-009 | Uygulandı; ortam sınırlı | Tauri v2 config/capability/plugins/icons CLI tarafından okundu. Rust/Cargo ve MSVC bulunmadığından binary build bu makinede çalıştırılamadı. |
| AUD-010–013 | Düzeltildi | Binary visible slice, extrema koruyan min/max bucket, iptal edilen RAF, ResizeObserver, accordion state, PNG/SVG export. |
| AUD-022 | Kabul edilen kaynak sınırı | Kaynak/statü görünür; HFK/SFHM ve EDÜ-SFK taslak. Referansların çoğunun tek sayfa olması README ve raporda belirtilir. |
| AUD-023–025 | Düzeltildi | Göreli Vite assetleri, label/aria-live/canvas açıklamaları ve v0.6.0 sürüm birliği. |
| AUD-026 | Tamamlandı | Ignore kuralları, secret/local-path taraması, anlamlı commitler ve origin push doğrulaması kapanışta kaydedildi. |

## Nihai Doğrulama Kanıtı

- JavaScript syntax: PASS.
- CSV templates: 87/87 PASS.
- Example CSV: 87/87 PASS; üç belgelenmiş 1000 ms performans fixture uyarısı.
- Vitest: PASS.
- Vite production build: PASS.
- Playwright Chromium UI: PASS; 9/9 PFK yükleme, zoom, accordion, kriter ve rapor akışı.
- PDF: gerçek `%PDF` binary, 7 A4 sayfa; Poppler render ve Türkçe metin çıkarımı PASS.
- DOCX: gerçek OOXML ZIP, 8 A4 sayfa; paketlenmiş `render_docx.py` + LibreOffice/Poppler render PASS.
- Tauri `info`: config ve JS/Rust paket sürümleri okunuyor; Rust/Cargo ve MSVC/SDK eksikliği nedeniyle masaüstü binary build çalıştırılmadı.
