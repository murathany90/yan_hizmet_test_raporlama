# TEİAŞ-YHDA v0.6.1 Başlangıç Denetimi

Tarih: 2026-08-16
Referans başlangıç commit'i: `8963b47bd26c0569fb8568697f6626f51665543d`

## Git ve çalışma alanı

| Kontrol | Bulgusu |
| --- | --- |
| Dal | `main` |
| Remote | `origin` → `https://github.com/murathany90/yan_hizmet_test_raporlama.git` |
| Başlangıç geçmişi | `8963b47`, `2368989`, `368bf75`, `c65eaf9`, `4084eed` |
| Başlangıç iş ağacı | Yalnızca kullanıcı tarafından sağlanan, izlenmeyen `TEIAS_YHDA_v0_6_1_AGENT_PROMPT.md` |
| Korunan kaynaklar | `docs/test_dosyaları/**` ve imzalı/ham format kaynakları değiştirilmez, commit'e alınmaz. |

## Kaynak envanteri ve v0.6.0 durumu

- Uygulama Vite tabanlı modüler JavaScript yapısındadır: `src/app`, `csv`, `analysis`, `charts`, `criteria`, `report`, `platform`.
- Tauri kabuğu `src-tauri` altında bulunur; web çalıştırma/test altyapısı Vite, Vitest ve Playwright ile kuruludur.
- 87 CSV şablonu ve 87 örnek veri dosyası sürüm/doğrulama betikleriyle kapsanır.
- CSV ayrıştırıcı UTF-8 BOM algılar; `makeCsvTemplate` BOM'lu metin üretir ve `saveBinary` web/Tauri için ortak bayt yazım yolunu kullanır.
- Mevcut rota anahtarı `service:plant:step` olduğundan, PFK çok üniteli kampanyada çakışmayı önleyecek kampanya/ünite bağlamı eklenmelidir.
- Mevcut grafikler zoom, pan, akordeon ve PNG/SVG çıktılarını taşır; seri bazlı aç/kapa kalıcılığı henüz yoktur.
- Mevcut RGDH değerlendiricisi gerilim kontrolünde yalnız `Yüklendi` durumu üretmektedir; C1/C2 ayrımı, Q ortalaması, kararlılık ve gerilim denetimi geliştirilecektir.
- Mevcut rapor üreticisi PFK A–G yapısını kısmen taşır. Ancak kapak ayrı bir A4 sayfa değildir, format referans görselini nihai rapora ekler ve RGDH C1/C2 eşlemesini ayırmaz.

## v0.6.1 riskleri ve uygulama yaklaşımı

1. PFK çok ünite, yalnız PFK çalışma alanında opt-in bir kampanya kartı ile etkinleştirilecektir; sol menü ve diğer hizmetlerin veri giriş akışı değişmeyecektir.
2. Çok üniteli CSV'ler için kampanya/tesis/ünite/adım/çalıştırma alanları doğrulanacak; kayıt anahtarı kampanya ve üniteyle genişletilecektir. Klasik tek ünite rotası aynen korunacaktır.
3. Tüm şablonların ZIP indirilmesi ve PFK kampanya ZIP'i için tarayıcı uyumlu ZIP üretimi eklenecektir.
4. Rapor modeli, resmi statü güvenliği, PFK teknik veri alanları, RGDH C1/C2 ve PFK kampanya özetleri için sürümlenecektir. Nihai PDF/DOCX önizlemelerinde kaynak format görseli bulunmayacaktır.
5. Tarayıcı indirme, PFK rota/çok ünite, seri görünürlüğü, kriterler, rapor şablonları ve RGDH C1/C2 davranışı odaklı testlerle doğrulanacaktır.
6. Tauri komutları ayrıca çalıştırılacak; makine aracının eksik olması halinde bu durum sürüm notunda dürüstçe kaydedilecektir.

## Değişiklik sınırları

- Hiçbir imzalı rapor, ham test verisi veya `docs/test_dosyaları` kaynağı düzenlenmeyecek ya da Git'e eklenecek değildir.
- Test ve örnek veriler yalnız uygulamanın mevcut `CSV_Sablonlari` / `Ornek_Veriler` yapısında kullanılacaktır.
- Resmî değerlendirmeyi desteklemeyen veri, `Taslak / İnceleme gerekli / İmza öncesi` statüsünden daha güçlü bir iddia ile sunulmayacaktır.

## Uygulama ve doğrulama kanıtı

| Kapı | Sonuç |
| --- | --- |
| JavaScript söz dizimi | `35/35 PASS` |
| CSV envanteri | `87/87` şablon ve `87/87` örnek PASS; üç adet 24 saatlik PFK fixture için beklenen 1000 ms çözünürlük uyarısı korunur. |
| Birim/rapor testleri | Vitest `29/29 PASS`; PFK çok ünite rota/ZIP, UTF-8 BOM, RGDH C1/C2, PFK kampanya raporu ve değerlendirme metrikleri kapsanır. |
| Tarayıcı | Playwright `3/3 PASS`; Türkçe/BOM indirme, XSS metin güvenliği, PFK-kapsamlı kontroller, grafik seri kalıcılığı ve rapor önizlemesi kapsanır. |
| Web paket | Vite production build PASS. |
| PDF/DOCX görsel QA | `qa_artifacts/v061-render` altında A4 render alındı; kapak ayrı sayfa, teknik tablolar okunur, kaynak format referans sayfası yok. |
| Tauri bilgi | `npm.cmd run tauri -- info` PASS; WebView2, MSVC, Rust/Cargo ve stable MSVC toolchain hazır. |
| Tauri native | `cargo check` PASS. `tauri dev` ile `teias-yhda.exe` açıldı ve masaüstü pencere başlığı doğrulandı; smoke sonrasında yardımcı süreçler kapatıldı. |

Sürüm senkronizasyonu `package.json`, Tauri manifestleri, uygulama sürümü, 87 şablon ve 87 örnek metadata'sına `0.6.1` olarak uygulanmıştır.
