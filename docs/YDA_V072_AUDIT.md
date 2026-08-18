# YDA v0.7.2 Başlangıç Denetimi

Denetim tarihi: 2026-08-18
Başlangıç HEAD: `3a6306b2316eff03187d107400bc6a6bd9901be2`
Başlangıç sürümü: `0.7.1`

## Çalışma ağacı

- Dal `main` ve izlenen dosyalarda başlangıç değişikliği yoktu.
- Yerelde izlenmeyen önceki agent promptları kullanıcı girdisidir; bu sürümün commit kapsamına alınmayacaktır.
- `src/**` taramasında tesis adı, ünite adı veya gerçek saha sonucu/sayısı içeren yasaklı Köprü eşleşmesi bulunmadı.

## Doğrulanan bulgular

| Konu | Başlangıç durumu | v0.7.2 işlemi |
|---|---|---|
| PFK proses sinyali | Hassasiyet, rezerv ve 24 saat grafiklerinde `guide_vane_pct` HES varsayımı vardı. | Tek plant-adapter kaynağına taşınacak. |
| DGKÇS/TES | Şablon ve örnekler vardı; evaluator/rapor yolunda yakıt ve reglaj vanası kullanılmıyordu. | Aynı klasik kriter motorunda adapter sinyalleriyle doğrulanacak. |
| EDÜ/EDT | Birleşik hassasiyet adımı klasik evaluator'a yönleniyordu. | Ayrı `PFK_STORAGE` teknik ön değerlendirme yoluna ayrılacak. |
| 24 saat scatter | Modelde frekans x-ekseni tanımlı olsa da boş figure'a karşı güvence/test yoktu. | Açık x/y/zarf serileri ve boş-figure regression eklenecek. |
| Resmî checklist | PDF/DOCX/önizlemede altı kısa satır vardı. | Dokuz kriterli, kanıt referanslı event modeli eklenecek. |
| G) sonuç | İkinci tablo teknik durum/belge tamlığı özetiydi; resmî ünite kriter matrisi değildi. | İki resmî tablo ve ayrı küçük durum kutusu eklenecek. |
| Tarihler | Tutanak 24 saat kaydının ilk/son satırını doğrudan kullanıyordu. | Açık test/belge/doğrulama tarih alanları ve öncelik modeli eklenecek. |
| Kanal metadata | Birleşim sırası açık değildi; adapter kanalları modelde özel olarak temsil edilmiyordu. | Kayıt > kampanya > kullanıcı > adapter varsayılanı sırası tanımlanacak. |
| UTF-8 | `src/app/config.js` içinde 109 bozuk replacement karakteri saptandı. | Kaynak metin normalize edilip Türkçe regression kapsamı genişletilecek. |
| Regression gate | `test:all` public plant-matrix çalıştırmıyor, private fixture yoksa ayrı bir `SKIPPED_PRIVATE_FIXTURE` sonucu vermiyordu. | Public matrix ve izole private komutları eklenecek. |

## Koruma sınırları

- HES için v0.7.1'in yönsel Pset/TRP ve 24 saat hesapları korunacaktır.
- RGDH, HFK, SFHM ve SFK evaluator/routing kapsamı genişletilmeyecektir.
- Gerçek saha verisi, imzalı belge ve `docs/test_dosyaları/**` sürüm kontrolüne eklenmeyecektir.
