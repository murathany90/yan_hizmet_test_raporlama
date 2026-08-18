# YDA v0.7.2 Public PFK Plant Matrix

Bu matris yalnız repodaki sentetik/public örneklerle çalışır. Gerçek saha fixture'ı ayrı `npm run test:private` kapsamındadır.

| Test | HES | DGKÇS | TES | EDÜ/EDT |
|---|---:|---:|---:|---:|
| Route | PASS | PASS | PASS | PASS |
| 4 CSV classic | PASS | PASS | PASS | Ayrı depolama profili |
| Reserve segmentation | PASS | PASS | PASS | Profile-specific |
| Reserve evaluation | PASS | PASS | PASS | Teknik ön değerlendirme |
| Sensitivity | PASS | PASS | PASS | Storage-specific |
| Primary process signal | Ayar kanadı | Yakıt vanası | Reglaj vanası | SoC / DC güç / enerji |
| Report render | PASS | PASS | PASS | Smoke |
| Minutes render | PASS | PASS | PASS | Smoke |
| No empty figures | PASS | PASS | PASS | PASS |
| UTF-8 | PASS | PASS | PASS | PASS |

## Çalıştırma

```powershell
npm.cmd run test:plant-matrix
```

Kapsam: HES, DGKÇS ve TES için canonical dört CSV'nin route, iki olay segmentasyonu, hassasiyet prosesi, 24 saat doğrulaması, scatter SVG ve PDF rapor/tutanak smoke kontrolleri. EDÜ/EDT için `PFK_STORAGE` yönlendirmesi ve otomatik kabul formülü üretmeme kuralı doğrulanır.
