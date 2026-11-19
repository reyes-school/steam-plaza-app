# Steam Plaza 4-versiya — o‘zgarishlar ro‘yxati

## 1. Har bir rol uchun demo hisob
Parol hammasida **demo1234**. Kirish sahifasida “Demo hisoblar” bo‘limi chiqadi, bosilsa darhol o‘sha rol bilan kiradi.

| Rol | Telefon | Nima ko‘rinadi |
|---|---|---|
| Bosh admin | +998 90 700 00 00 | Hamma filiallar, umumiy hisobot |
| Menejer | +998 90 700 00 01 | Barcha filiallar |
| Menejer | +998 90 700 00 04 | Faqat 2-filial |
| Buxgalter | +998 90 700 00 02 | Faqat 1-filial moliyasi |
| Buxgalter | +998 90 700 00 03 | Faqat 2-filial moliyasi |
| O‘qituvchi | +998 90 700 10 01 | 1-filial, 5-A sinf rahbari |
| O‘qituvchi | +998 90 700 10 02 | 2-filial, 5-B sinf rahbari |
| Ota-ona | +998 91 500 00 00 | 1-filial maktab (a’lochi o‘quvchi) |
| Ota-ona | +998 91 500 00 48 | 1-filial bog‘cha |

- Yuklash: `npm run demo` (yoki bosh admin → Sozlamalar → Demo ma’lumotlar). Demo ichida bitta “kela olmaydi” xabari ham bor.
- Xavfsizlik: `NODE_ENV=production` bo‘lsa demo ro‘yxat chiqmaydi va demo hisoblar bilan kirib bo‘lmaydi. Sinov serverida `ALLOW_DEMO=1` qo‘yib yoqiladi.

## 2. Ma’lumotlarni shifrlash (AES-256-GCM)
- **Barcha yuklangan fayllar** shifrlangan holda saqlanadi — bazani yoki diskni o‘g‘irlagan odam pasport, metrika, tibbiy ma’lumotnomani ocha olmaydi.
- **Shaxsiy maydonlar**: pasport, manzil, sog‘liq, izoh, qo‘shimcha telefon, tug‘ilgan joy/sana, guvohnoma, ish joyi.
- Push kalitlari ham shifrlangan.
- Eski ma’lumotlar: `npm run encrypt`; kalit almashtirish: `npm run encrypt -- --rekey`.
- Telefon va ism login hamda qidiruv uchun ochiq qoladi.

## 3. Fayllarni siqish
- Rasmlar serverda qayta siqiladi: eng katta tomoni 2000 px, burilish to‘g‘rilanadi, GPS/metama’lumot o‘chiriladi.
- Skaner PDF ichidagi rasmlar qayta siqiladi.
- Sinov natijasi: 3,4 MB foto → 258 KB, 3,4 MB PNG → 528 KB, 6,7 MB skaner PDF → 348 KB.
- Fayl chegarasi o‘z serverda 3 MB dan **10 MB** ga oshirildi (siqilgandan keyin baribir kichik saqlanadi). Vercel’da 3 MB.
- Yuklangandan keyin “Fayl siqildi: 3,2 MB → 252 KB” xabari chiqadi.

## 4. O‘quvchi / o‘qituvchi PDF’ida hujjatlarning o‘zi
- “Yuklangan hujjatlar” jadvali “Ilova 1, 2, …” raqami va holati bilan.
- Keyin hujjatlarning o‘zi keladi:
  - rasm va skanerlar alohida sahifada, sarlavhasi bilan;
  - PDF hujjatlar to‘liq sahifalari bilan, har sahifa pastida “Ilova 3. Ota-ona pasporti · 1/2” belgisi bor.
- Word/Excel fayllar faqat ro‘yxatda ko‘rsatiladi, chunki ularni PDF ichiga chizib bo‘lmaydi.
- Parolli PDF bo‘lsa “Ochib bo‘lmadi (parol bilan himoyalangan)” deb yoziladi.
- O‘qituvchi PDF’iga ham hujjatlar qo‘shildi. Ularni ma’muriyat ko‘radi, o‘qituvchi esa faqat o‘zinikini ko‘radi.

## 5. Web saytda bildirishnomalar
- **Web Push**: profil yoki 🔔 oynasida “Yoqish” bosiladi. Shundan keyin sayt yopiq bo‘lsa ham kompyuter yoki telefonga xabar keladi: baho, kelmaslik xabari, yangilik va boshqalar.
- Bildirishnoma bosilsa, kerakli sahifa ochiladi.
- “Sinab ko‘rish” tugmasi bor. Chiqishda shu brauzerga xabar yuborish to‘xtaydi.
- Sayt ochiq bo‘lsa 🔔 soni darhol yangilanadi (tekshirish 30 o‘rniga 20 soniyada).
- Xavfsizlik: server faqat haqiqiy push xizmatlariga (Google, Mozilla, Apple, Microsoft) xabar yuboradi.

## 6. Tekshiruv
- `npm test` — barcha avvalgi testlar va 4-versiya uchun yangi testlar o‘tdi. Yangi testlar quyidagilarni tekshiradi:
  - bazada `enc:v1` / `SPE1` shifrlangan saqlanadi, API esa ochiq qiymat qaytaradi;
  - PNG siqiladi;
  - skaner PDF’da sahifa bo‘lib chiqadi;
  - noto‘g‘ri push manzili rad etiladi.
- Push to‘liq zanjirda sinaldi: yuborish → shifrlangan xabar → qabul qiluvchi ochdi.
- Brauzerda (kompyuter va telefon o‘lchami) kirish sahifasi, demo ro‘yxat, bildirishnoma oynasi tekshirildi — JavaScript xatolari yo‘q.
- Kalit almashtirish (rekey) sinaldi. Noto‘g‘ri kalit bilan ma’lumot buzilmaydi, o‘tkazib yuboriladi.

## 7. Ishga tushirishda nima qilish kerak
1. `npm install` (yangi kutubxonalar: sharp, pdf-lib, web-push).
2. `.env` ga `DATA_KEY=` (`openssl rand -hex 32`). **Kalitni alohida, xavfsiz joyda saqlang**: zaxira nusxani usiz ochib bo‘lmaydi.
3. `npm run encrypt` — mavjud fayl va profillarni shifrlaydi (oldin `deploy/backup.sh` bilan zaxira oling).
4. Sayt HTTPS’da bo‘lishi kerak (push uchun).
5. Haqiqiy serverda `NODE_ENV=production` — demo o‘chadi. Demo uchun alohida sinov serveri tavsiya etiladi.

## Keyingi bosqich
- Mobil ilova: native push (FCM/APNs), tokenni Keychain/Keystore’da saqlash, do‘konlarga chiqarish.
