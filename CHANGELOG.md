# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/) yaklaşımını izler.

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
