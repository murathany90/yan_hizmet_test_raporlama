# YDA v0.7.1 Köprü HES PFK Parite Denetimi

Denetim tarihi: 2026-08-18
Başlangıç HEAD: `0cf3c036abb5ee888b9d8292d42fae163cdfa00c`

## Yerelde incelenen, commit dışı referanslar

- `docs/test_dosyaları/pfk_test/örnek_hes/KOPRU_HES_YDA_DUZELTILMIS_PFK_CSV/**`
- Köprü HES PFK rapor/sertifika ve tutanak PDF'leri

Bu kaynaklar özel saha verisi veya imzalı belge niteliğindedir. Yalnız hesap/biçim doğrulaması için kullanılır; repoya eklenmez.

## Başlangıç bulguları

- v0.7.0, klasik PFK akışını dört fiziksel CSV ve olay bazlı `NEG200`/`POS200` ayrımına geçirmişti. Bu yönlendirme korunacaktır.
- Köprü verisi başlangıç evaluator'ında sekiz rezerv olayını `KALDI` üretiyordu. Sebep, TRP-A'nın simetrik `baseline ± tolerans` doğrusu üzerinden hesaplanmasıydı; resmî zarf Pset tabanlı ve yön bağımlıdır.
- Kayıtların 90–900 s bölgesinden hesaplanan ΔP değerleri referans sertifikadaki sekiz değeri doğrudan verir. Bu nedenle ΔP sabit değer olarak saklanmayacak, her olayın gerçek kaydından üretilecektir.
- Resmî etkinleşme anı, simüle frekansın ilk anlamlı yön değişiminden itibaren ölçülen P'nin resmî `Pset ± RPmax` hedefine ilk ulaştığı andır. Bu tanım, referansın 19.9/19.5/26.7/18.0 ve 18.8/18.7/23.4/21.4 s sonuçlarını üretir.
- Başlangıç hassasiyet algılayıcısı gerçek dört platoyu `49.996` gibi ham ortalama değerlerle raporluyordu. Kanonik hedef etiketleri ve ayar kanadı kanıtı kullanılmalıdır.
- Başlangıç 24 saat kritik penceresi satır indeksiyle `±600` örnek seçiyordu; zaman damgası üzerinden ekstrem merkez `±300 s` olmalıdır.
- Başlangıç PFK raporunda kampanya özeti ve SHA-256 manifest ana gövdede varsayılan görünüyordu. Resmî A–G gövdesi için bunlar varsayılan dışı teknik ek yapılacaktır.

## Koruma sınırları

- RGDH, HFK, SFHM, SFK ve EDÜ/EDT PFK çizim/evaluator davranışı PFK resmî profilinden etkilenmeyecektir.
- İmza, kaşe veya taranmış görseller çoğaltılmayacak; yalnız yapılandırılmış boş imza alanları oluşturulacaktır.
