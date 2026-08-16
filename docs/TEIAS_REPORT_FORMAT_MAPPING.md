# TEİAŞ Rapor Formatı → YHDA Alan Eşlemesi

Bu belge, `docs/test_dosyaları` içindeki korunan örnek/formatlardan çıkarılan alan yapısını uygulamadaki YHDA modeline eşler. Kaynak belgeler salt format referansıdır; imzalı belge veya kişi bilgisi kopyalanmaz.

## Ortak üst bilgi ve güvenlik statüsü

| Kaynak format alanı | YHDA alanı / kaynağı | Çıktı davranışı |
| --- | --- | --- |
| Tesis, il, ünite, rapor no, test tarihi | `TESIS_ADI`, `CITY`, `UNIT_ID`, `REPORT_NO`, `TEST_DATE` | A4 kapakta yer alır. |
| Katılımcılar ve raporu hazırlayan | `TEST_TEAM`, `REPORT_PREPARED_BY`, imza rolleri | Boşsa `—`; isim uydurulmaz. |
| Test ekipmanı / kalibrasyon | `equipment[]`: marka, model, seri no, kalibrasyon no/tarihi | Sertifika/tutanak ve rapor teknik veri bölümünde tablo olarak gösterilir. |
| Kanal, ölçek, birim, kaynak | `channels[]`: kanal, sinyal, ölçek, birim, kaynak | Teknik veri ekinde altı sütunlu tablo. |
| Sonuç / imza | `officialStatus`, `signatures[]` | Tam olmayan veya doğrulanmamış dosya `Taslak / İnceleme gerekli`; tamamlanmış dosya `İmza öncesi`dir. |

## PFK — performans raporu, tutanak, sertifika

| Kaynak bölüm | YHDA bölüm / alan | Veri ve değerlendirme |
| --- | --- | --- |
| A) Test katılımcı listesi | `participants` | Test ekibi, gözlemci, tesis yetkilisi, hazırlayan. |
| B) Teknik veriler | `technicalData` | Ünite/güç bilgisi, governor ayarları, test ekipmanı, kanallar, ölçekler, simüle edilen frekans ve çalışma ayarları. |
| C) Maksimum çıkış gücü rezerv testleri | `records: RES_MAX_* / BESS_MAX_*` | Her adım için Δtd, t50, t100, TRP-A/B/C, örnekleme ve süre. |
| D) Minimum çıkış gücü rezerv testleri | `records: RES_MIN_* / BESS_MIN_*` | Her adım için aynı KPI'lar; adım kimliği ayrı satırda tutulur. |
| E) Hassasiyet testi | `records: HASSASIYET` | Dört frekans segmenti, tek sürekli `ZAMAN;SIRA_NO` CSV kaydında; simüle frekans ve aktif güç tepkisi birlikte değerlendirilir. |
| F) Doğrulama testleri | `records: *VALIDATION*` | Gerçek şebeke frekansı, süre ve veri bütünlüğü. |
| G) Sonuç | `summary` | Adım bazlı durum, eksik kayıt, resmî statü ve imza öncesi kontrol. |
| Tutanak / sertifika | `reportType` şablonu | Katılımcı, ekipman/kalibrasyon, sonuç matrisi ve imza alanları; sertifika resmî imza yerine geçmez. |

### PFK çok üniteli kampanya uzantısı

PFK dışındaki hiçbir hizmette uygulanmaz. CSV kimliği:

`CAMPAIGN_ID`, `FACILITY_ID`, `TEST_SCOPE`, `ENTITY_TYPE`, `ENTITY_ID`, `UNIT_ID`, `UNIT_NAME`, `UNIT_COUNT`, `STEP_ID`, `EVENT_ID`, `RUN_ID`.

Kayıt rotası `campaign + service + plant + unit + step + run` bağlamını taşır. Her ünite için `Pnom`, `RPmax` ve “teste dahil” alanı tutulur. Kampanya raporu C/D/E/F altında üniteleri ayrı verir; tesis toplamı yalnız ortak zaman damgasında/örnekleme toleransında eşleşen noktalarla hesaplanır ve beklenen P, referans kanalı veya `Pset ± RPmax` üzerinden gelir. ZIP yapısı `campaign.csv`, `manifest.csv`, `U1/...`, `U2/...` ve kanıt manifesti (dosya adı, SHA-256, ünite, adım) içerir.

## RGDH — C1 ve C2 ayrımı

| Kaynak format | Kaynak başlıkları | YHDA şablon eşlemesi |
| --- | --- | --- |
| E17.C1 | C) Aşırı ikaz, D) Düşük ikaz, E) Değerlendirme, F) Sonuç | `RGDH:C1`: OE/UE kapasite adımları, Q hedefi, Q ortalaması, kararlılık ve sonuç. |
| E17.C2 | C) Maksimum, D) Orta / %50, E) Düşük / %20, F) Gerilim kontrolü, G) Sonuç | `RGDH:C2`: OE/UE çalışma noktaları ayrı alt bölümlerde; +/− gerilim referansı, 200 ms ve 1 s tepki, 2 s denge kaydı. |
| İmzalı rapor/cert/tutanak | Genel rapor, tutanak, sertifika ve test ekipmanı listesi | Aynı ortak üst bilgi/equipment/channels yapısı; tesis türlerinin birleşik resmî rapora dönüşmesi yalnız kullanıcı tarafından sağlanan birleşik veri ile mümkündür. |

RGDH kapasite sonucu `Yüklendi` değildir: her adım için Q hedefi, kuyruk ortalaması, değişim/kararlılık ve eşik sonucu üretilir. Gerilim kontrolünde Vref basamağı, ilk tepki, 1 s erişim ve 2 s stabilizasyon metrikleri gösterilir; veri/parametre eksikse `İnceleme gerekli` kalır.

## SFK ve taslak hizmetler

| Kaynak / hizmet | YHDA bölümü | İçerik |
| --- | --- | --- |
| SFK imzalı rapor | 1) Giriş, 2) durum/alarm, 2.1 LFC, 2.2 setpoint, 3) testler, 4) sonuç, ekler | LMIN, LMAX, LLOC, LREM, LMAN, LMIC, LPWR, GenStat, PFCO; kapasite/rampa; PFK devre dışı/devrede; setpoint/feedback tutarlılığı. |
| HFK / SFHM | Teknik ön değerlendirme | Resmî format bulunmadığından yalnız taslak ve inceleme statüsü. |

## Nihai çıktı kuralları

- PDF ve DOCX'te kapak ayrı A4 sayfadır.
- Format kaynak görseli nihai rapora eklenmez; yalnız geliştirme/önizleme bağlamında kullanılabilir.
- Kısa ya da boş bir bölüm yeni sayfaya zorlanmaz; uzun test/grafik blokları sayfa bütünlüğü korunarak bölünür.
- Değişken tabloları altı sütun taşır: değişken, açıklama, değer, birim, kaynak, CSV/metadata alanı.
- Sertifika, grafik taşımayan iki A4 sayfadır: ilk sayfa tesis/cihaz bilgileri, ikinci sayfa sonuç tablosu ve imza alanlarıdır. Kanıt özeti elektronik imza değildir.
