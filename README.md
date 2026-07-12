# VocabMaster

İngilizce ve Almanca kelime listelerini ayrı tutan, farklı quiz modları ve ilerleme takibi sunan kişisel kelime çalışma uygulaması.

## Özellikler

- İngilizce (`lists`) ve Almanca (`lists_de`) için ayrı Firestore koleksiyonları
- Excel, CSV veya manuel girişle kelime listesi oluşturma
- Çoktan seçmeli, flashcard, eşleştirme, yazarak cevap ve eş anlamlı quizleri
- Almanca için A1-A2 düzeyinde Gemini örnek cümleleri
- SM-2 tabanlı tekrar seçimi, zor kelime havuzu ve ayrıntılı istatistikler
- Masaüstü ve mobil uyumlu çalışma paneli

## Yerel Çalıştırma

Node.js 20 veya üzeri gerekir.

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak `http://127.0.0.1:3000/` adresinde açılır.

## Ortam Değişkenleri

İstemci tarafında Firebase yapılandırması için şu değişkenler kullanılır:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Vercel API fonksiyonları için:

```text
GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
```

Mevcut otomatik oturum akışı `VITE_FIREBASE_USER` ve `VITE_FIREBASE_PASS` değişkenlerini de destekler. `VITE_` önekli değerler tarayıcı paketine dahil edildiğinden, herkese açık dağıtımlarda bu yaklaşım yerine etkileşimli Firebase Authentication kullanılması gerekir.

## Doğrulama

```bash
npm run build
npm audit --omit=dev
```
