# VocabMaster

Tek kullanıcı için tasarlanmış, Firestore senkronizasyonlu kelime/quiz uygulaması. Excel/CSV'den liste yükleme, manuel ekleme, çoktan seçmeli/flashcard/eşleştirme modları, SM-2 tabanlı tekrar seçimi ve cihazlar arasında aynı veriyi paylaşma desteği içerir.

## Özellikler
- Excel/CSV yükleme ve manuel kelime ekleme; aynı İngilizce kelimenin tekrar eklenmesini engeller.
- Quiz modları: Çoktan seçmeli, Flashcard, Eşleştirme.
- Soru yönü seçimi: Karışık, İngilizce→Türkçe, Türkçe→İngilizce.
- “Bilmiyorum / listeye ekle” butonu ve yanlış cevaplar otomatik “Bilemediğim Kelimeler” listesine kaydedilir.
- Yanlış/kaçırılan kelimeler Word Lists ekranında ayrı bir kartta, satırlar arası boşlukla gösterilir.
- Şık seçildikten sonra her şıkkın anlamı turuncu etiketle şık içinde görünür; soru geçişleri ~1 saniye bekler.
- Quiz sırasında “Testi Bitir” ile erken bitirme; sonuçlar/istatistikler korunur.
- SM-2 destekli kart durumu ve performans logları; zorlu kelime filtresi.
- Firestore senkronizasyonu (tek hesapla tüm cihazlarda aynı veri).
- Navbar ortasında animasyonlu logo; tıklayınca ana sayfaya döner.

## Kurulum
```bash
npm install
npm run dev
```
Lokal adres: `http://localhost:5173`

## Ortam Değişkenleri
`.env.local` (repoya koyma) ve Vercel Environment Variables'a aynı değerleri ekle:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...    # opsiyonel
VITE_FIREBASE_USER=...              # tek kullanıcı email
VITE_FIREBASE_PASS=...              # tek kullanıcı şifre
```

## Firestore Kuralı (tek kullanıcı)
Firebase Console → Authentication'dan oluşturduğun kullanıcı UID'sini bul, aşağıdaki kurala yaz:
```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == "YOUR_UID";
    }
  }
}
```

## Dağıtım (Vercel)
1) Production ortamına tüm `VITE_*` değişkenlerini gir.
2) Deploy et. SPA yönlendirmesi gerekiyorsa `vercel.json` içinde `rewrites` tanımlı olmalı.

## Kısa Notlar
- Şık geçişleri ve flashcard geçişleri yaklaşık 1 saniye bekler; anlam etiketleri şık içinde görünür.
- “Bilemediğim Kelimeler” kartındaki satırlar geniş aralıklı ve 12 kelimeye kadar listelenir, fazlası özetlenir.
- Navbar logosu animasyonlu; tıklayınca ana sayfaya döner.
