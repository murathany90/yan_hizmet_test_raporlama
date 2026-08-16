# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/) yaklaşımını izler.

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
