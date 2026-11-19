# Steam Plaza — iOS va Android ilovalari

Ilovalar web versiya bilan **bitta kod, bitta server, bitta baza** ishlatadi. O‘qituvchi telefonda baho qo‘ysa, ota-ona web'da yoki boshqa telefonda darhol ko‘radi.

## Kerakli narsalar
| | Android | iOS |
|---|---|---|
| Dastur | Android Studio (bepul) | Xcode 26 (Mac App Store, macOS 15.6+) |
| Hisob | Google Play Console — bir martalik 25$ | Apple Developer Program — yiliga 99$ |
| Boshqa | Node.js 20+ | Node.js 20+, Mac |

## 1. Tayyorlash (bir marta)
```bash
cd ~/Downloads/steamplaza-platform/mobile
npm install
```
`app.config.json` ichida server manzilini tekshiring (Vercel'dagi saytingiz):
```json
{ "apiUrl": "https://steam-plaza-app.vercel.app" }
```

## 2. Android
```bash
npm run android
```
Android Studio ochiladi (birinchi marta Gradle yuklab olishi 5–10 daqiqa).
- **Telefonda sinash:** telefonda *Developer options → USB debugging* ni yoqing, USB bilan ulang, yashil ▶ (Run) tugmasini bosing.
- **APK (do‘stlarga yuborish):** *Build → Build App Bundle(s)/APK(s) → Build APK(s)* → `android/app/build/outputs/apk/debug/app-debug.apk`.
- **Google Play uchun:** *Build → Generate Signed App Bundle* → yangi kalit (keystore) yarating va **uni xavfsiz saqlang** (yo‘qolsa ilovani yangilab bo‘lmaydi) → `.aab` faylni Play Console'ga yuklang.

## 3. iOS
```bash
npm run ios
```
Xcode ochiladi.
1. Chapda **App** → *Signing & Capabilities* → **Team** — Apple Developer hisobingizni tanlang.
2. Bundle Identifier: `uz.steamplaza.app` (band bo‘lsa, o‘zgartiring va `capacitor.config.json` dagi `appId` ni ham o‘zgartiring).
3. iPhone'ni ulang va ▶ (Run) bosing. Birinchi marta telefonda *Settings → General → VPN & Device Management* da ishonch bildiring.
4. **App Store / TestFlight:** *Product → Archive → Distribute App → App Store Connect* → App Store Connect'da TestFlight orqali sinab, keyin ko‘rib chiqishga yuboring.

## Web o‘zgarganda ilovani yangilash
Ma’lumotlar (baholar, to‘lovlar, yangiliklar) har doim jonli — ilovani yangilash shart emas.
Dizayn yoki funksiya o‘zgarganda:
```bash
cd mobile
npm run sync        # web fayllarni ilovaga ko‘chiradi
```
so‘ng Android Studio/Xcode'da yangi versiya raqami bilan qayta yig‘ib, do‘konga yuklaysiz
(Android: `android/app/build.gradle` → `versionCode` +1; iOS: Xcode → General → Build +1).

## Ilovada nima bor
- Web'dagi hamma bo‘limlar (barcha rollar uchun)
- PDF va hujjatlarni telefonga saqlash yoki Telegram'ga yuborish (ulashish oynasi)
- Android "orqaga" tugmasi: oynani yopadi → oldingi sahifa → ilovadan chiqish
- Status bar, splash ekran, ikonka, tugmalarda yengil tebranish
- Kamera/galereyadan rasm va hujjat yuklash

## Muammolar
- **Ilova ochiladi, lekin kirish ishlamaydi** — `app.config.json` dagi manzil noto‘g‘ri yoki server ishlamayapti. Brauzerda `<manzil>/api/health` ni oching.
- **Intel Mac'da Xcode 26 o‘rnatilmaydi** — iOS ilovani bulutda yig‘ish mumkin (Codemagic yoki Ionic Appflow, `mobile/` papkasini ulaysiz).
- Ikonka/splash'ni almashtirish: `resources/icon.png` (1024×1024) va `resources/splash.png` (2732×2732) ni almashtirib, `npm run assets` ni bosing.
