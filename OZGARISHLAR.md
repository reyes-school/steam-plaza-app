# Steam Plaza 3-versiya — o‘zgarishlar ro‘yxati

## 1. Kiberxavfsizlik
| Muammo (tahlildan) | Nima qilindi |
|---|---|
| Server `GET /%` kabi bitta so‘rov bilan qulardi | Barcha so‘rovlar `try/catch` ichida, noto‘g‘ri URL → 400. Slowloris uchun timeout'lar, server faqat `127.0.0.1` da (nginx orqali) |
| Demo hisoblar `demo1234` bilan | `NODE_ENV=production` da demo yuklash o‘chiq va demo hisoblar bilan kirib bo‘lmaydi |
| Login bruteforce himoyasi zaif | Telefon bo‘yicha bazada (6 urinish → 15 daqiqa blok, Vercel'da ham ishlaydi) + IP bo‘yicha cheklov |
| DDoS / flood | IP bo‘yicha umumiy (600/daq) va yozish (180/daq) limit, fayl yuklash limiti, JSON hajm chegarasi, nginx `limit_req`/`limit_conn` tayyor konfiguratsiyasi (`deploy/`) |
| Tokenni bekor qilib bo‘lmasdi | Parol almashtirish, admin yangi parol berishi, bloklash, filial o‘zgarishi → eski loginlar bekor. “Barcha qurilmalardan chiqish” tugmasi |
| Zaif parollar (6 belgi) | Kamida 8 belgi, harf + raqam, oddiy parollar rad etiladi. Yaratiladigan parollar 10 belgili |
| Ota-ona istalgan bola kartasini ko‘rardi | Faqat o‘z farzandi filialidagi bolalar; o‘qituvchi baholarida ota-ona ismlari yashirildi |
| O‘qituvchi istalgan darsni egallardi | O‘rinbosarni faqat ma’muriyat tayinlaydi (Sinflar va jadval → O‘rinbosar tayinlash) |
| Xavfsizlik sarlavhalari yo‘q | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (server.js va vercel.json) |
| Fayl turi tekshiruvi zaif | Fayl mazmuni turiga mos bo‘lishi shart (PDF/JPEG/PNG/GIF/WEBP/Office); Office fayllar faqat yuklab olinadi; sandbox CSP |
| Audit log yo‘q | **Harakatlar jurnali**: kirishlar, noto‘g‘ri urinishlar, to‘lov/oylik/xarajat, o‘chirishlar, parol va foydalanuvchi o‘zgarishlari, o‘tgan darslarda baho o‘zgarishi (kim, qachon, IP) |
| Cron kaliti oddiy solishtirish | timing-safe solishtirish, kamida 16 belgi |
| Zaxira faqat bazani olardi | `deploy/backup.sh`: baza + yuklangan fayllar |
| Android `allowBackup=true` | `false` |
| `/api/health` baza xatosini ochib berardi | Faqat umumiy xabar |
| SESSION_SECRET 16 belgi | Kamida 32 belgi |

## 2. Filiallar (2 ta) × Maktab va Bog‘cha
- Yangi jadval `branches`; sinf/guruh, o‘quvchi, to‘lov, oylik, xarajat, yangilik — filial va bo‘lim (maktab/bog‘cha) bilan.
- Birinchi ishga tushishda 2 filial yaratiladi; eski ma’lumotlar 1-filial maktabiga o‘tadi (eski bazada sinab ko‘rildi).
- **Buxgalter faqat o‘z filialini ko‘radi** — server darajasida (boshqa filial so‘ralsa 403). Buxgalter qo‘shishda filial majburiy.
- Menejerga filial biriktirilsa — faqat o‘sha filial; biriktirilmasa — barchasi.
- Barcha ro‘yxat va hisobotlarda filial / bo‘lim filtri (bosh admin uchun).

## 3. Har bir rol uchun alohida panel
- **Bosh admin**: kirganda birinchi **Umumiy hisobot** — butun tashkilot (kirim, chiqim, foyda, o‘quvchilar, qarz) → maktab va bog‘cha jami → har bir filial va uning ichida maktab / bog‘cha. Oy tanlash, filialdan to‘g‘ridan-to‘g‘ri o‘quvchilar / kirim-chiqim / hisobotga o‘tish. PDF oylik hisobotda filial va bo‘limlar jadvali.
- Bosh admin menyusi: Filiallar, Harakatlar jurnali, Kelmaslik xabarlari qo‘shildi.
- **Buxgalter**: o‘z filiali moliya paneli (kirim/chiqim/foyda/qarz, maktab va bog‘cha bo‘yicha, eng katta qarzdorlar).
- **Menejer**: filial bo‘yicha o‘quv paneli, bugun kelmaydiganlar ogohlantirishi.
- **O‘qituvchi**: bugun kelmaydigan o‘quvchilar ro‘yxati, dars sahifasida “ota-ona xabar bergan” belgisi.
- **Ota-ona**: “Kela olmaydi” bo‘limi.

## 4. “Farzandim kela olmaydi”
Ota-ona bosh sahifada bir bosishda yoki alohida bo‘limda: sana(lar), sabab turi (kasal, oilaviy, safar, boshqa), izoh. Bildirishnoma darhol: sinf rahbari/tarbiyachi, o‘sha kunlari dars beradigan o‘qituvchilar, filial menejeri va bosh admin. Ma’muriyat “Ko‘rdim” deb belgilaydi; ota-ona boshlanmagan xabarni bekor qila oladi.

## 5. Tekshiruv
- Avtomatik API testlari kengaytirildi (`npm test`): filial cheklovlari, buxgalter izolyatsiyasi, kelmaslik xabari va bildirishnomalar, token bekor qilinishi, zaif parol, o‘rinbosar, soxta fayl turi, server qulamasligi, audit log — **hammasi o‘tdi**.
- Eski (2-versiya) bazani yangilash sinab ko‘rildi.
- Brauzerda (kompyuter va telefon o‘lchami) bosh admin, buxgalter, o‘qituvchi va ota-ona panellari tekshirildi — JavaScript xatolari yo‘q.
- Mobil ilova ichidagi web fayllar yangilandi (Android versionCode 2 / 1.1).

## 6. Ishga tushirishda nima qilish kerak
1. `.env` ga: `NODE_ENV=production`, 32+ belgili `SESSION_SECRET`, `CRON_SECRET`.
2. O‘z serverida: `deploy/nginx-steamplaza.conf`, `deploy/steamplaza-proxy.conf`, kunlik `deploy/backup.sh` (README 2-bo‘lim).
3. Filiallar nomini va manzilini kiriting, buxgalterlarga filial biriktiring.
4. Mavjud xodimlarning paroli 6–7 belgili bo‘lsa, ular ishlayveradi, lekin yangi parol berishda 8+ belgi talab qilinadi.

## Keyingi bosqich (hali qilinmagan)
- Mobil ilova: push-bildirishnomalar (FCM/APNs), tokenni Keychain/Keystore'da saqlash, do‘konlarga chiqarish.
- Bog‘cha uchun alohida taomnoma va kun tartibi (hozir taomnoma va qo‘ng‘iroq vaqtlari umumiy).
- 2FA / SMS orqali parolni tiklash, Click/Payme integratsiyasi.
