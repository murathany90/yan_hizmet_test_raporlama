# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/) yaklaşımını izler.

## [0.7.2] - 2026-08-18

### Düzeltildi

- PFK evaluator, grafik ve kanal tablolarındaki HES'e özgü proses sinyali varsayımı plant-adapter sözleşmesiyle kaldırıldı: DGKÇS `fuel_valve_pct`, TES `regulator_valve_pct` ile buhar basıncı/sıcaklığı, EDÜ/EDT ise ayrı depolama profiliyle çalışır.
- 24 saat Frekans–Güç scatter figure'ı açık frekans x ekseni, aktif güç y ekseni ve ±%1 Pnom zarfı ile üretildi; boş grafik regresyonla engellendi.
- PFK G) bölümündeki teknik/belge özet tablosu, resmî olay performans özeti ve ünite sonuç matrisiyle değiştirildi.
- Tutanak tarihleri test, belge ve doğrulama dönemleri için ayrı metadata alanlarından çözülür; CSV son satırı test bitiş tarihini zorla değiştirmez.
- Yapılandırma kaynaklarındaki bozuk Türkçe karakterler normalize edildi.

### Eklendi

- Her rezerv olayı için dokuz maddelik resmî checklist veri modeli (`criterionId`, metin, ölçüm, sınır, sonuç, kanıt) ve PDF/DOCX/HTML paritesi.
- Public HES/DGKÇS/TES 4-CSV plant-matrix regression'ı, EDÜ/EDT storage routing smoke testi ve özel fixture için açık `SKIPPED_PRIVATE_FIXTURE` sonucu.

## [0.7.1] - 2026-08-18

### Değişti

- Uygulama görünür adı `YDA (Yan Hizmetler Testleri Doğrulama Aracı)` olarak güncellendi.
- PFK rezerv değerlendirmesi Pset tabanlı yönsel TEİAŞ zarfı, ΔP 90–900 s ölçümü ve resmî etkinleştirme süresi ile birleştirildi.

### Eklendi

- Köprü HES PFK FigureModel, hassasiyet platosu, 24 saat zaman-tabanlı kritik pencereler, A–G sonuç tabloları ve opsiyonel teknik kanıt eki.

## [0.7.0] - 2026-08-17

### Değişti

- Uygulamanın görünen adı **YDA (Yan Hizmetler Doğrulama Aracı)** olarak birleştirildi; eski YHDA veri anahtarları yalnız CSV ve yerel ayar uyumluluğu için korunur.
- `docs/icon.png` web favicon, Windows/Tauri uygulama, taskbar ve kurulum ikonu ölçeklerine yeniden üretildi.
- Klasik PFK HES/DGKÇS/TES akışı yeni üretimde dört fiziksel CSV kullanır: `MAKSIMUM_REZERV`, `MINIMUM_REZERV`, `HASSASIYET`, `DOGRULAMA_24H`.

### Eklendi

- Maksimum/minimum rezerv kaydında sıralı −200/+200 mHz plateau segmentasyonu; olay başına gecikme, t50, t100, 900 s sürdürme ve TRP-A/B/C uygunluk analizi.
- Aynı kriter kaynağından üretilen olay grafikleri (ölçülen güç, hedef, tolerans bandı) ve rapor C/D alt bölümleri.
- 24 saatlik PFK doğrulamasında beklenen güç, ±%1 Pnom bandı, uygunluk oranı ve pozitif/negatif kritik pencere grafikleri.
- Klasik tek üniteli ve iki üniteli HES örnekleri 4-CSV yapısıyla yenilendi; U1/U2 Pnom ve RPmax metadata’sı ayrı ayrı korunur.
- PFK tamlık kapısı ile eksik rapor metadata’sı/olayı için açık `TASLAK / EKSİK BİLGİ` statüsü ve genişletilmiş provenance manifesti.

## [0.6.5] - 2026-08-16

### Düzeltildi

- Tauri dosya sistemi yetkilerine kullanıcı seçimiyle belirlenen klasörlere dosya yazma izni eklendi. Portable uygulamada PDF, DOCX, ZIP ve CSV çıktıları seçilen klasöre yazılabilir.
- Yerel kayıt iletişim kutusu PDF ve Word için doğru dosya türünü/uzantıyı gösterir; eksik uzantı otomatik tamamlanır.
- Tauri'nin metin biçiminde ilettiği hatalar artık `undefined` yerine açıklayıcı bir kayıt hatası olarak gösterilir.

## [0.6.4] - 2026-08-16

### Düzeltildi

- Tauri çalışma ortamı resmî API ile algılanır; native PDF, DOCX, ZIP ve kanıt manifesti seçilen çıktı klasörüne yazılır ve başarısız native kayıt tarayıcı indirmesine sessizce düşmez.
- Rapor türü değişimi yeni model ve önizlemeyi anında üretir. “Test Tutanağı” gibi Türkçe ekli tür adları doğru belge akışına yönlenir.
- Rapor giriş/değerlendirme/sonuç, tutanak başlangıç/güvenlik/yöntem/sonuç/teslim/ekler ve sertifika metinleri yalnız kendi belge bölümlerinde görünür; HTML, PDF ve DOCX aynı eşlemeyi kullanır.

### Değişti

- Ayarlar ekranı hizmet + belge seçicisi, tek değişken rehberi ve sade belge-metni kartıyla düzenlendi; çıktı klasörü kurumsal ayarlara eklendi.

## [0.6.3] - 2026-08-16

### Düzeltildi

- Word dışa aktarımı tarayıcı/Tauri WebView yolunda `Packer.toBlob()` ile çalışır; Node/Vitest için `Packer.toBuffer()` korunur.
- PFK çok üniteli rapor bölümleri kayıtları `CAMPAIGN_ID + UNIT_ID + STEP_ID + RUN_ID` kimliğiyle seçer; üniteler birbirine karışmaz.
- Birim sertifikaları üniteye ait ad, Pnom ve RPmax metadata’sını kullanır.
- RGDH C.2 adımları C–F bölümlerine tam STEP_ID eşlemesiyle yönlenir; RGDH C.1 değerlendirme ve sonuç metinleri ayrıdır.

### Değişti

- Ayarlar; hizmet/belge türü bazlı rapor, tutanak ve sertifika metinleri, görünür breadcrumb’lar ve desteklenen placeholder’larla düzenlendi.
- Sertifika geçerlilik metni önizleme, PDF ve DOCX’te ortak kullanılır; Word çıktısında gerçek VML arka plan filigranı bulunur.
- Ekipman varsayılanları yapısal alanlara ayrıldı; kanal tablosu yalnız gerçek CSV kanallarından üretilir ve eksik alanları açıkça gösterir.
- Birleşik PFK HASSASIYET CSV metadata’sı “Hassasiyet Testi — Birleşik Frekans Adımları” adını kullanır.

## [0.6.2] - 2026-08-16

### Eklendi

- `ZAMAN;SIRA_NO` kanonik CSV zaman sözleşmesi, Türkçe tarih/saat ayrıştırması ve gerçek zaman eksenli grafik/tooltip/zaman seçicisi.
- PFK için tek `HASSASIYET` kaydı, 75 şablonluk konfigürasyon envanteri ve iki üniteli HES kampanya örnek veri seti.
- Ham CSV baytlarından SHA-256 kanıt zinciri, kanıt manifesti indirimi ve rapor/tutanak kanıt eki.
- PFK ünite formuna `Pnom`, `RPmax` ve “teste dahil” alanları; yalnız zaman hizası geçerli noktalarla tesis toplamı/normalize tepki karşılaştırması.
- Belge metinleri, kurum bilgileri, filigran/amblemler, imza rolleri ve tesis varsayılanları için kalıcı Ayarlar sekmesi.

### Değişti

- Performans raporu PFK A–G hiyerarşisini, tutanak ekipman/kanal/ek/teslim yapısını, sertifika ise grafik içermeyen iki A4 sayfayı kullanır.
- Teknik ekipman tablosu gerçek cihaz türü, marka, model, seri no, yazılım, doğruluk, kalibrasyon no/tarihi alanlarına ayrıldı.
- Çok üniteli kampanya beklenen gücü kurulu güçten değil, aktif güç referansından veya `Pset ± RPmax` kuralından hesaplar.

### Düzeltildi

- PFK çok üniteli tesis toplamındaki sıra numarası/indeks bazlı eşleşme kaldırıldı; eksik veya tolerans dışı zaman noktaları toplamdan dışlanır.
- Tekrarlanan eski hassasiyet adımlarının yeni HASSASIYET kaydına migrasyonunda zaman damgası sürekliliği doğrulandı.
- Ayarlar sekmesindeki metin alanının tarayıcıda hata üretmesi ve boş PDF tablolarında hücre sayısı uyuşmazlığı düzeltildi.

## [0.6.1] - 2026-08-16

### Eklendi

- PFK'ye özel, varsayılan tek üniteyi koruyan çok üniteli kampanya modeli, benzersiz kayıt rotası ve kampanya/kanıt manifestli ZIP şablonları.
- Tüm seçili test adımlarını ZIP olarak indirme; PFK birim sertifikalarını DOCX ZIP olarak dışa aktarma.
- PFK Ünite / Karşılaştırma / Santral grafikleri, seri görünürlük düğmeleri ve kalıcı grafik görünüm durumu.
- Rapor şablon katmanı, ayrı A4 kapak, ekipman-kalibrasyon ve kanal/ölçek tabloları, PFK kampanya özeti ile RGDH C1/C2 bölüm eşlemesi.
- UTF-8 BOM tarayıcı indirme, PFK kampanya rota/ZIP, seri görünürlüğü, kriter akordeonu, PFK kampanya raporu ve RGDH C1/C2 için odaklı testler.

### Düzeltildi

- Nihai PDF/DOCX çıktılarından orijinal format/kaynak görseli kaldırıldı.
- RGDH gerilim kontrol ve kapasite kayıtları ile SFK sinyal kayıtlarının `Yüklendi` olarak sonuçlandırılması engellendi; ölçülebilir sonuç veya `İnceleme gerekli` statüsü uygulanır.
- Resmî çıktı güvenliği `Taslak / İnceleme gerekli / İmza öncesi` statülerine bağlandı.

## [0.6.0] - 2026-08-16

### Eklendi

- Vite tabanlı modüler web uygulaması ve tek bootstrap noktası
- Tauri v2 iskeleti, dialog/fs eklentileri, capability ve platform ikonları
- Metadata tabanlı çoklu CSV yönlendirme, zorunlu doğrulama ve toplu sonuç özeti
- 87 şablon + 87 örnek veri için otomatik tam matris validator
- Büyük veri için binary görünür aralık ve min/max downsample grafik motoru
- Zoom, pan, zaman aralığı, ResizeObserver ve PNG/SVG dışa aktarımı
- Hizmet/tesis bazlı test prosedürü, teknik kriterler ve ön kontrol/sinyal kartları
- Ortak `ReportModel` üzerinden HTML, A4 PDF ve DOCX rapor adaptörleri
- 6 kolonlu rapor değişken tablosu, eksik test listesi, imza ve kaynak referansı
- Vitest birim/rapor/encoding testleri ve Playwright uçtan uca UI testi
- Repository denetim raporu ve güvenli `.gitignore`

### Düzeltildi

- Çift uygulama başlangıcı ve tekrar tanımlanan global fonksiyonlar
- Yanlış hizmet/tesis/adıma toplu CSV yükleme riski
- Eksik sütun, NaN, monoton olmayan zaman ve örnekleme hatalarının sessiz kabulü
- Aynı rota için CSV’nin onaysız ezilmesi
- CSV metadata/dosya adı/rapor notundan HTML injection riski
- BOM’suz uygulama şablonu indirme
- Pik değerleri kaybeden stride downsample ve pan sırasında RAF birikmesi
- Accordion aç/kapat sonrasında grafik redraw ve durum kaybı
- “PDF” düğmesinin yalnız tarayıcı yazdırmasına bağlı olması
- `TESIS_ADI` gibi metadata alanlarının yanlışlıkla amper birimi alması

### Değişti

- Sürüm kaynağı v0.6.0 olarak birleştirildi.
- Eski 1,69 MB tek HTML mimarisi; modüler ES kaynakları ve paketlenmiş asset yapısıyla değiştirildi.
- HFK/SFHM ve kaynakları eksik resmî formatlar açık biçimde Teknik Ön Değerlendirme / Taslak statüsüne alındı.

### Doğrulama notu

- Üç klasik PFK 24 saat fixture’ı, performans testi amacıyla 1000 ms çözünürlüktedir ve resmî 100 ms saha çözünürlüğünden farklı olduğu için uyarı üretir.
