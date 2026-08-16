# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/) yaklaşımını izler.

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
