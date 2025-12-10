# VocabMaster

## Ozellikler
- Excel/CSV veya manuel giris ile liste olusturma; tekrar eden kelimeler engellenir.
- Quiz modlari: Coktan secmeli, Flashcard, Eslesme; soru yonu: Karisik, Ing -> Tr, Tr -> Ing.
- Gemini destekli ornek cumle/ceviri: coktan secmeli icin toggle ile acilir; her kelime icin uretilen cumle ve ceviri Firestore'da saklanir, yeniden kullanilir, istenirse tekrar urettirilir.
- Bilmiyorum/Listeye ekle butonu; yanlis/bilinmeyen cevaplar tek bir “Bilemedigim Kelimeler” havuzunda tutulur ve listeler ekraninda ayrica gosterilir.
- Zor kelimeler toggle: tum listelerde incorrectCount > 0 olan kelimelerden quiz baslatma (sayac dahil).
- Seslendirme: soru kelimesi icin sesli okutma; listelerde tek tek kelime seslendirme.
- SM-2 tabanli secim ve “Testi Bitir” ile erken cikis; dogru/yanlis sayaci, ilerleme cizgisi, quiz sayaci.
- Animasyonlu navbar logosu; tiklayinca ana sayfaya donus.
- Firestore senkronizasyonu ile listeler ve kelime istatistikleri bulutta saklanir; zor/yanlis havuzu tum listeleri kapsar.

## Versiyon notlari (kisa)
- v1.3: Ornek cumle/ceviri Firestore cache, yeniden kullanma ve yeniden uretme; zor kelimeler tum listelerden tek havuz; ikonlar/emoji geri getirildi; sesli okuma butonu eklendi.
- v1.2: Quiz ayarlari ve toggle tasarimi yenilendi, “Bilemedigim Kelimeler” tek havuza tasindi.
- v1.1: Gemini entegrasyonu, zor kelimeler toggle, Testi Bitir, SM-2 secim iyilestirmeleri.
- v1.0: Liste yukleme/olusturma, temel quiz modlari, Firestore senk ve navbar animasyonu.

Not: Bu repo tek kullanici senaryosu icin tasarlandi; ortam degiskenleri ve Firebase kurulumu gereklidir.
