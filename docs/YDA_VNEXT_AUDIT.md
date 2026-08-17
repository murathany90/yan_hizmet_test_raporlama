# YDA vNext Başlangıç Denetimi

Denetim tarihi: 2026-08-17
Başlangıç HEAD: `51a6b305815492b7201bc7fa01d18a19cf214d19`
Başlangıç sürümü: `0.6.5`

## Çalışma ağacı ve sürüm durumu

- Dal: `main`; başlangıçta `origin/main` ile eşitti.
- İzlenmeyen yerel kaynaklar: önceki geliştirme promptları, bu vNext promptu ve `docs/icon.png`. Bunlar denetim için okunur; promptlar commit edilmez. `docs/icon.png` kullanıcı tarafından uygulama ikonu olarak özellikle verildiği için ürün varlığı olarak commit kapsamındadır.
- Başlangıç sürüm alanları `package.json`, `package-lock.json`, Tauri yapılandırması, uygulama durumu, ReportModel, README ve CHANGELOG içinde `0.6.5` ile tutarlıydı.
- Adlandırma tutarsızdı: ürün adı, pencere başlığı, paket/portable dosya adı, toastlar ve web başlığı `TEİAŞ-YHDA`/`YHDA` kullanıyordu. Paket kimliği (`tr.gov.teias.yhda`), storage anahtarı ve eski CSV `YHDA_VERSION` metadata anahtarı geriye dönük uyumluluk için korunmalı veya güvenli şekilde migrate edilmelidir.

## Kaynak matrisi

| Kaynak | Konu | Otorite | Uygulamada kullanım | Not |
|---|---|---:|---|---|
| `şebeke_yönetmeliği_yh_testleri.docx`, E.17.A | PFK test sırası, kayıt, rezerv, hassasiyet ve doğrulama | 1 | Merkezi PFK kriterleri ve evaluator | 100 ms, ±200 mHz sırası, 15/30/900 s, HES 4 s/diğer 2 s, her TRP için %90 ve ayrı ünite sertifikası doğrulandı. |
| `PFK Performans Testleri Sırasında Kayıt Edilen Verinin Formatı 20032025` | Fiziksel kayıt dosyası yapısı | 2 | PFK 4-CSV şablonları | Maksimum/minimum rezerv kaydının tek dosya; 24 saat doğrulamanın tek dosya teslim edildiği doğrulandı. |
| `Primer Frekans Kontrol Test Raporu Formatı 20032025` | A-G rapor hiyerarşisi | 2 | Ortak ReportModel bölümleri | Kaynak Word dosyası yerelde bir süreç tarafından kilitliydi; aynı yapı, aşağıdaki imzalı örneğin görsel denetiminden de doğrulandı. |
| `PFK Test Tutanak Formatı 20032025` | Tutanak kapak, dayanak, saha, ekipman ve teslim | 2 | Tutanak section modeli | Düzenlenebilir metinler, çoklu ekipman, sinyaller, ekler ve imza rolleri korunacak. |
| Yerel Köprü HES rapor/tutanak/sertifika PDF örnekleri | Gerçek saha düzeni ve grafikler | 3 | Görsel/semantik referans | Yerelde render edilerek A-G, C/D `.a/.b`, t0, iki parçalı rezerv grafiği, TRP kontrol listesi, 24 saat iki sapma penceresi ve ünite sertifikası gözlendi. İmza, kişi, numara ve ham veri kopyalanmaz. |
| Depolama teknik kriter/prosedür PDF'leri | EDÜ/EDT ayrımı | 1 | Koruma sınırı | Klasik 6→4 dönüşümü EDÜ/EDT PFK profiline otomatik uygulanmayacak; SoC/enerji/DC sinyalleri korunacak. |
| Yerel RGDH/SFK raporları ve kriter dokümanları | Diğer hizmet formatları | 2-3 | Regresyon koruması | İncelendi; PFK kabul motoruna kriter aktarılmayacak. |
| Iskra/Hioki/logger/sinyal jeneratörü referansları | Ekipman metadata alanları | 3 | Ekipman ve kanal tabloları | Cihaz türü, üretici, model, seri, kalibrasyon, kanal, bağlantı ve ölçek alanları rapor metadata'sında tutulur; satın alma şartı ayrı PFK red kriteri yapılmaz. |

## Mevcut PFK şablon envanteri

Başlangıçta klasik PFK HES, DGKÇS ve TES için her tesis türünde altı fiziksel adım vardı:

1. `RES_MAX_NEG200`
2. `RES_MAX_POS200`
3. `RES_MIN_NEG200`
4. `RES_MIN_POS200`
5. `HASSASIYET`
6. `VALIDATION`

Bu durum `CSV_Sablonlari/PFK` altında klasik tesisler için 18 şablona, örneklerde ise aynı altı dosyalı setlere ve iki üniteli kampanyada ünite başına altı dosyaya karşılık geliyordu. EDÜ/EDT'nin dört dosyalı BESS profili (`BESS_*`) ayrı tutuluyordu.

Yeni klasik kanonik set yalnız `MAKSIMUM_REZERV`, `MINIMUM_REZERV`, `HASSASIYET` ve `DOGRULAMA_24H` olacaktır. Eski dört `RES_*` adımı yalnız input alias olarak okunacaktır; yeni şablon/ZIP/kampanya sayacında görünmeyecektir.

## Mevcut evaluator ve kriter davranışı

- Başlangıç evaluator'ı rezerv yönünü dosya adı/`STEP_ID` içindeki `NEG200` ve `POS200` ekinden çıkarıyor; tek fiziksel kayıt içinden iki olayı ayırmıyordu.
- `Δtd`, `t50` ve `t100` hesapları başlangıçta vardı; TRP değerleri ise zaman penceresinde maksimum tepkiyi kullandığından resmi her-bant-içi-oran gereksinimini karşılamıyordu.
- Hassasiyet tek CSV'de kısmen segmentleniyordu. Klasik 24 saat doğrulama için otomatik kabul evaluator'ı yoktu; sonuç mühendis incelemesine düşüyordu.
- Kriterlerin bir bölümü config metninde, bir bölümü evaluator'da magic number olarak tekrarlanıyordu. vNext'te merkezi `PFK_CRITERIA` ile tek kaynağa alınacaktır.

## Grafik, ReportModel ve yerel kayıt mimarisi

- Grafik motoru zaman temelli çizim, zoom/pan, legend görünürlüğü ve min/max downsampling sağlıyor; ancak rezerv dosyası başına sadece genel seri seti üretip -200/+200 event görünümünü ayrı modellemiyordu.
- `CSV → evaluateRecord → ReportModel → preview/PDF/DOCX` zinciri halihazırda ortak semantic model kullanıyor. PFK bölümleri legacy adımlara göre C/D/E/F seçiyor; 4 fiziksel dosyada C/D `.a/.b` alt bölümleri için genişletilecektir.
- PDF, DOCX ve HTML preview aynı `ReportModel` section seçimini kullanıyor; vNext değişiklikleri bu tek model katmanında yapılacaktır.
- v0.6.5 Tauri `fs:allow-write-file` ve kullanıcı ana dizini scope'u ile native save desteği eklenmiştir. Browser fallback yerine gerçek native yazma yapılır; portable smoke testinde eski `127.0.0.1:1420` bağımlılığı yoktur.

## Referanslar ile farklar

- Resmî kaynak tek maksimum/minimum kayıt içinde nominal → −200 → nominal → +200 → nominal sırasını ister; repo bunu dört ayrı fiziksel kayda bölüyordu.
- Resmî rapor C/D içinde her yön için ayrı grafik, TRP bant kontrolü ve tekil karar gösterir; başlangıç raporu her legacy CSV'yi sadece satır/özet olarak temsil ediyordu.
- Yerel örneklerde 24 saat için beklenen güç/tolerans ve pozitif-negatif kritik pencereler görünür; başlangıçta klasik 24 saat için otomatik uygunluk oranı yoktu.
- Tutanakta çoklu ekipman, sinyal ve saha anlatımı var; modelde bazı alanlar mevcut olsa da katılımcı/ekipman/ekler daha çok tek metin düzeyindeydi.

## Yapılacaklar ve sınırlar

1. Kullanıcı görünümünü **YDA (Yan Hizmetler Doğrulama Aracı)** adına geçirmek, ancak Tauri identifier, eski storage anahtarı ve eski CSV metadata aliaslarını güvenli biçimde korumak/migrate etmek.
2. Verilen `docs/icon.png` varlığından Tauri, Windows, installer ve web icon setini üretmek; 16/32/48/256 px görünümünü kontrol etmek.
3. Klasik PFK için 4 fiziksel CSV, iki event segmentasyonu, legacy aliasları ve tek/çok üniteli örnek setleri eklemek.
4. Merkezi kriter, event/24-saat evaluator, event grafik setleri, resmi C/D `.a/.b`, tamlık ve provenance bilgisini ortak ReportModel'e taşımak.
5. RGDH/HFK/SFHM/SFK ve EDÜ/EDT PFK config/veri akışını değiştirmemek; sadece ortak UI/brand katmanını güvenli biçimde güncellemek.

## Riskler ve uyumluluk planı

- İmzalı/özel kaynak belgeler ve gerçek ham veriler Git'e eklenmeyecek; yalnız format/kurallar audit için kullanıldı.
- Eski `RES_*` dosyaları route edilir. Tek-event legacy kayıt, yeni modelde açıkça `legacy` provenance ile kalır; iki olay türetilmiş gibi gösterilmez.
- YDA adlandırması kullanıcı görünümündedir. `tr.gov.teias.yhda`, eski localStorage anahtarı ve `YHDA_VERSION` metadata alanı korunur; yeni adın görünmesi için bunların üzerine kullanıcı metni bindirilmez.
- Resmî kaynağın açıkça tarif etmediği tolerans ayrıntıları uydurulmayacak. Kaynakta görülen yönsel TRP formülleri merkezi modelde açık seçik tanımlanacak ve fixture testleriyle doğrulanacaktır.
