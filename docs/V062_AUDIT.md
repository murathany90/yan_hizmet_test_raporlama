# TEİAŞ-YHDA v0.6.2 Düzeltme ve İyileştirme Denetimi

Tarih: 2026-08-16
Başlangıç commit'i: `718a7ce`

## Kapsam ve korunan kaynaklar

Denetim; uygulama kaynakları, `CSV_Sablonlari/`, `Ornek_Veriler/` ve kullanıcı tarafından sağlanan v0.6.2 görev metni üzerinde yürütülmüştür. `docs/test_dosyaları/**` yalnız okunmuştur; imzalı belge, ham saha kaydı veya referans logo/kimlik bilgisi uygulama çıktısına kopyalanmamış ve Git'e eklenmemiştir.

İncelenen yerel referanslar:

| Referans | Denetim bulgusu | Uygulama karşılığı |
| --- | --- | --- |
| `pfk_test/örnek_hes/KOPRU_U1_MINIMUM_REZERV.csv` | `ZAMAN;SIRA_NO` ve `12.3.2026 11:09:19,1s` biçimli zaman damgası | Kanonik CSV zaman ekseni, başlıklar ve ayrıştırıcı |
| Köprü HES U1/U2 ham kayıt paketi | Ünite bazlı PFK, rezerv, hassasiyet ve uzun doğrulama kayıtları | İki üniteli `HES_MULTI_UNIT` sentetik regresyon seti |
| Atlas/Köprü rapor, tutanak ve sertifika örnekleri | PFK A–G hiyerarşisi; teknik ekipman, kanal, ek, imza ve iki sayfalık sertifika akışı | Rapor/tutanak/sertifika şablonları ve teknik veri tabloları |

Referans belgeler sayfa görüntüsüne dönüştürülerek yalnız görsel yapı doğrulaması için incelenmiştir. Uygulama, üçüncü taraf akreditasyon veya sertifika logolarını kullanmaz.

## CSV sözleşmesi ve envanter

- Yeni şablon ve örnek kayıtların ilk iki kolonu `ZAMAN;SIRA_NO`'dur.
- `ZAMAN` gerçek zaman damgasıdır; `SIRA_NO` 1'den başlayan ardışık kayıttır. Validator monotonluk, sıra numarası, örnekleme ve süre kontrollerini uygular.
- Eski `time_s` kayıtları yalnız geriye dönük içe alma için desteklenir. Yeni şablon/migrasyon çıktısı `time_s` üretmez.
- PFK'de dört eski hassasiyet dosyası tesis başına tek `HASSASIYET` kaydına birleştirildi; segment kimlikleri metadata'da korunur.
- Beklenen envanter 75 şablon ve 87 test kaydıdır. Buna dört tesis için 75 standart kayıt ile HES çok üniteli örneğinin U1/U2 için 12 kaydı dahildir. Kök örnek manifesti ile kampanya/manifest CSV'leri test kaydı sayısına dahil edilmez.

`npm.cmd run validate:csv` sonucu: **75/75 şablon PASS, 87/87 test kaydı PASS**. Beş uzun süreli performans fixture'ı için 1000 ms metadata örneklemesi uyarısı bilinçli olarak korunur; bunlar resmî saha çözünürlüğü iddiası taşımaz.

## Uygulanan geliştirmeler

1. PFK kampanya modeli her ünitede `Pnom`, `RPmax` ve dahil durumu taşır. Grafik toplamı zaman damgası hizası/toleransla oluşturulur; eksik eşleşmeler uyarılır ve toplamdan çıkarılır. Beklenen P, referans kanalı yoksa `Pset ± RPmax` ile hesaplanır. Normalize tepki `Ri(t) = ΔPi(t) / RPmax_i` olarak sunulur.
2. Ham dosya baytları yükleme anında SHA-256 ile özetlenir. Kanıt manifesti; dosya, özet, hizmet, tesis, ünite, adım, satır, başlangıç/bitiş ve örnekleme alanlarını indirir. Özetin elektronik imza olmadığı tüm çıktılarda açıkça belirtilir.
3. Beşinci sekmede belge ayarları eklenmiştir: kurum, üst/alt bilgi, mevzuat, hazırlayan, imza rolleri, amblem/filigran, tesis varsayılanları ve standart rapor-tutanak-sertifika metinleri. Metinler güvenli placeholder değişimiyle rapora yansır.
4. ReportModel teknik ekipmanı gerçek alanlarıyla, kanalları ise yüklenen CSV sütunlarından üretir. PFK performans raporu A–G, tutanak ek/teslim yapısı, sertifika ise grafik taşımayan iki sayfa olarak üretir.

## Doğrulama kanıtı

| Kapı | Sonuç |
| --- | --- |
| JavaScript söz dizimi | `39/39 PASS` |
| CSV envanteri | `75/75` şablon, `87/87` test kaydı PASS; 5 beklenen uzun-fixture uyarısı |
| Birim/rapor testleri | Vitest `30/30 PASS` |
| Tarayıcı | Playwright `3/3 PASS`: gerçek zaman grafiği, kanıt manifesti, UTF-8/XSS güvenliği, PFK kapsamı ve Ayarlar metni |
| Web paketi | Vite production build PASS |
| DOCX/PDF görsel QA | `qa_artifacts/v062-docx-report-render`, `v062-docx-certificate-render`, `v062-pdf-report-render` ve `v062-pdf-certificate-render` altında A4 sayfa, tablo, imza, filigran, grafik ve iki sayfalık sertifika doğrulandı |
| Tauri | `tauri info`, `cargo check` ve masaüstü smoke PASS; v0.6.2 için MSI ve NSIS paketleri üretildi |

Sertifika PDF/DOCX çıktısı görsel incelemede A4 iki sayfa olarak açılmış; ilk sayfada tesis/cihaz bilgileri, ikinci sayfada sonuç/imza alanları görülmüş ve grafik bulunmadığı doğrulanmıştır.

Windows paket çıktıları: `src-tauri/target/release/bundle/msi/TEİAŞ-YHDA_0.6.2_x64_tr-TR.msi` ve `src-tauri/target/release/bundle/nsis/TEİAŞ-YHDA_0.6.2_x64-setup.exe`.
