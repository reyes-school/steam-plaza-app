# Steam Plaza — maktab platformasi (2-versiya)

Ota-onalar, o‘qituvchilar va maktab ma’muriyati uchun to‘liq web platforma. Baza: PostgreSQL. Bitta kod avval **Vercel**da, keyin **o‘z serveringizda** (Ahost VDS) o‘zgartirishsiz ishlaydi.

## Rollar
| Rol | Nima qila oladi |
|---|---|
| **Bosh admin** | Hammasi: xodimlar va adminlar qo‘shish, moliya, sozlamalar, demo ma’lumotlar |
| **Menejer** | O‘quvchi, o‘qituvchi, ota-ona qo‘shish; sinflar, dars jadvali, qo‘ng‘iroq vaqtlari, yangiliklar, taomnoma, shartnomalar, tahrirlash ruxsatlari |
| **Buxgalter** | To‘lovlar, oyliklar, xarajatlar (chek bilan), bank to‘lovi, qarzdorlar, hisobotlar va PDF |
| **O‘qituvchi** | Bugungi darslar (taymer), mavzu → davomat/baho/uy vazifasi tekshiruvi → uyga vazifa (majburiy) bilan yakunlash, jadval (oldinga va tarix), sinflari, o‘quvchilarni tahrirlash, ochiq dars e’loni (fayl bilan), ota-onalar fikrlari |
| **Ota-ona** | Farzandining reytingi, hozirgi dars, uyga vazifalar (bajarilgan/bajarilmagan), fan va mavzular bo‘yicha oylik statistika, jadval, o‘qituvchilarni baholash, yangiliklar |

Har bir foydalanuvchi **telefon raqam + parol** bilan kiradi. Parollarni admin beradi va tiklaydi.

---

## 1. Vercel'ga joylash (GitHub orqali)

### 1.1. Kodni GitHub'ga yuklash
```bash
cd ~/Downloads/steamplaza-platform
git init
git add .
git commit -m "Steam Plaza 2.0"
git branch -M main
git remote add origin https://github.com/reyes-school/steam-plaza-app.git
git push -u origin main
```
Agar repoda eski kod bo‘lsa, avval `git pull` qiling yoki yangi branch'ga push qilib, Pull Request oching (`--force` ishlatmang — tarix yo‘qoladi). Login so‘ralsa: GitHub foydalanuvchi nomi va Personal Access Token.

### 1.2. Vercel'da loyiha
1. vercel.com → **Add New → Project** → `steam-plaza-app` → **Import**.
2. **Framework Preset:** `Other`, boshqa joyini o‘zgartirmang.
3. **Environment Variables** ga qo‘shing:

| Nomi | Qiymati |
|---|---|
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` natijasi |
| `OWNER_PHONE` | bosh admin telefoni, masalan `+998901234567` |
| `OWNER_PASSWORD` | bosh admin paroli (kamida 6 belgi) |
| `OWNER_NAME` | masalan `Direktor` |
| `CRON_SECRET` | istalgan uzun tasodifiy matn |
| `ANTHROPIC_API_KEY` | ixtiyoriy — bank to‘lov topshiriqnomasini avtomatik o‘qish |

4. **Deploy**.
5. Loyiha → **Storage → Create Database → Neon** → **Connect** (`DATABASE_URL` o‘zi qo‘shiladi) → **Deployments → ⋯ → Redeploy**.

### 1.3. Tekshirish va birinchi kirish
- `https://<loyiha>.vercel.app/api/health` → `"ok":true, "owner":true`
- Bosh sahifada `OWNER_PHONE` va `OWNER_PASSWORD` bilan kiring.
- Sinab ko‘rish uchun: **Sozlamalar → Demo ma’lumotlarni yuklash** (4 sinf, 8 o‘qituvchi, 48 o‘quvchi, 3 haftalik darslar). Demo hisoblar paroli `demo1234`: o‘qituvchi `+998 90 700 10 01`, ota-ona `+998 91 500 00 00`. Haqiqiy ishga tushirishdan oldin **Demo ma’lumotlarni o‘chirish** tugmasini bosing.

### 1.4. Haqiqiy ma’lumotlarni kiritish tartibi
1. **Sinflar va jadval → Fanlar** — fanlarni qo‘shing.
2. **Qo‘ng‘iroq vaqtlari** — dars boshlanishi, dars/tanaffus/tushlik davomiyligi.
3. **O‘qituvchilar → O‘qituvchi qo‘shish** (telefon va parol bilan). Hujjatlarini profilidagi “Hujjatlar”ga yuklang.
4. **Sinflar** — sinf va sinf rahbari.
5. **Haftalik jadval** — har bir sinf uchun katakni bosib fan va o‘qituvchini tanlang.
6. **O‘quvchilar → O‘quvchi qo‘shish** — ota-ona hisobi shu yerda yaratiladi. Metrika, pasport, attestatni o‘quvchi sahifasidagi “Hujjatlar”ga yuklang.
7. Ota-onalar va o‘qituvchilarga telefon raqami va parolini bering.

### Vercel cheklovlari
- Bitta fayl **3 MB gacha** (Vercel so‘rov chegarasi 4,5 MB). Rasmlar yuklashda avtomatik siqiladi.
- Fayllar Neon bazasida saqlanadi. Neon bepul rejasi **0,5 GB** — sinov uchun yetadi. Haqiqiy foydalanishda Neon'ning pullik rejasiga o‘ting yoki o‘z serveringizga ko‘chiring.
- Real vaqt yangilanishlari 20–30 soniyada bir marta tekshiriladi (Vercel'da doimiy ulanish yo‘q).

---

## 2. O‘z serveringizga ko‘chirish (Ahost VDS, Ubuntu 24.04)

Tavsiya: 2 vCPU, 4 GB RAM, 80–100 GB SSD, TAS-IX tarmog‘ida. 300–400 foydalanuvchi uchun bemalol yetadi.

```bash
# 1) Node.js 20 va PostgreSQL
sudo apt update && sudo apt install -y curl git nginx postgresql
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# 2) Baza
sudo -u postgres psql -c "create user steamplaza with password 'KUCHLI_PAROL';"
sudo -u postgres psql -c "create database steamplaza owner steamplaza;"

# 3) Kod
sudo mkdir -p /opt/steamplaza && sudo chown $USER /opt/steamplaza
git clone https://github.com/reyes-school/steam-plaza-app.git /opt/steamplaza && cd /opt/steamplaza
npm ci --omit=dev
cp .env.example .env && nano .env
```
`.env` ichida: `DATABASE_URL=postgres://steamplaza:KUCHLI_PAROL@localhost/steamplaza`, `SESSION_SECRET`, `OWNER_PHONE`, `OWNER_PASSWORD`, **`FILE_STORAGE=disk`**, `FILE_DIR=/var/lib/steamplaza/uploads`, `MAX_FILE_MB=20`, `CRON_SECRET`.

```bash
# 4) Vercel'dagi ma’lumotlarni ko‘chirish (Neon → server)
pg_dump "NEON_DATABASE_URL" --no-owner --no-acl > neon.sql
psql "postgres://steamplaza:KUCHLI_PAROL@localhost/steamplaza" < neon.sql
# Neon'dagi fayllar bazada qoladi va ishlayveradi; yangilari diskka yoziladi.

# 5) Doimiy ishlashi uchun systemd xizmati
sudo mkdir -p /var/lib/steamplaza/uploads && sudo chown $USER /var/lib/steamplaza/uploads
sudo tee /etc/systemd/system/steamplaza.service >/dev/null <<EOF
[Unit]
Description=Steam Plaza
After=network.target postgresql.service
[Service]
WorkingDirectory=/opt/steamplaza
ExecStart=/usr/bin/node server.js
Restart=always
User=$USER
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now steamplaza

# 6) Nginx + HTTPS + flood (DDoS) himoyasi (domen DNS'i serverga yo‘naltirilgan bo‘lsin)
sudo cp deploy/steamplaza-proxy.conf /etc/nginx/snippets/steamplaza-proxy.conf
sudo cp deploy/nginx-steamplaza.conf /etc/nginx/sites-available/steamplaza   # ichida domenni almashtiring
sudo ln -s /etc/nginx/sites-available/steamplaza /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d app.steamplaza.uz

# 7) Har kuni zaxira nusxa va oylik tozalash (crontab -e)
# 0 3 * * * /opt/steamplaza/deploy/backup.sh     # baza + yuklangan fayllar, 30 kun saqlanadi; nusxani boshqa serverga ham ko‘chiring
# 0 4 1 * * curl -s -H "Authorization: Bearer CRON_SECRET" http://127.0.0.1:3000/api/cron/cleanup
```
Yangilash: `cd /opt/steamplaza && git pull && npm ci --omit=dev && sudo systemctl restart steamplaza`.

## Ma’lumotlar qayerda va tezlik
- Hamma ma’lumot PostgreSQL'da, kerakli ustunlarda indekslar bor. 400 o‘quvchi × 2 yil ≈ 1 mln baho/davomat yozuvi — bu PostgreSQL uchun kichik hajm, sahifalar 10–50 ms da ochiladi.
- Fayllar Vercel'da bazada, o‘z serveringizda diskda (`FILE_STORAGE=disk`) saqlanadi.
- **2 yillik saqlash:** oyiga bir marta tozalash ishlaydi (`RETENTION_MONTHS=24`) — 24 oydan eski darslar, baholar, davomat va bildirishnomalar o‘chiriladi. O‘quvchilar, o‘qituvchilar, hujjatlar va moliya o‘chirilmaydi.

## Mobil ilovalar (iOS va Android)
`mobile/` papkasida — Capacitor asosida, web bilan bir xil kod va server. Qo‘llanma: `mobile/MOBILE.md`.
O‘z serveringizga ko‘chganda `mobile/app.config.json` dagi `apiUrl` ni yangi domenga almashtiring.

## Lokal ishga tushirish
```bash
npm install
cp .env.example .env   # DATABASE_URL, SESSION_SECRET, OWNER_PHONE, OWNER_PASSWORD
npm start              # http://localhost:3000
npm test               # API testlari (bo‘sh baza bilan)
```

## Tillar (O‘zbekcha / Русский)

Kirish sahifasining yuqori burchagida va **Profil** sahifasida UZ | RU almashtirgichi bor. Tanlov qurilmada saqlanadi.
Tarjimalar `public/js/ru.js` lug‘atida (kalit — o‘zbekcha matn, qiymat — ruscha; `{0}` — qiymat o‘rni, `{0|ученик|ученика|учеников}` — ko‘plik shakli).
Yangi matn qo‘shsangiz, ruscha tarjimasini shu faylga qo‘shing. PDF hisobotlar ham tanlangan tilda yuklanadi.


---

## 3-versiya: filiallar, maktab/bog‘cha va xavfsizlik

### Filiallar
- Baza birinchi ishga tushganda **2 ta filial** yaratiladi (`1-filial`, `2-filial`). Nomini, manzilini **Filiallar** bo‘limida o‘zgartirasiz, kerak bo‘lsa yangisini qo‘shasiz.
- Har bir filialda ikki bo‘lim bor: **Maktab** va **Bog‘cha**. Sinf (yoki bog‘cha guruhi) qo‘shganda filial va bo‘limni tanlaysiz — o‘quvchi, to‘lov, qarz va hisobotlar shu bo‘yicha avtomatik ajraladi.
- Eski ma’lumotlar (filialsiz) 1-filialning maktab bo‘limiga o‘tkaziladi.
- Xarajat va oylikda bo‘limni tanlash mumkin; tanlanmasa — filialning umumiy xarajati. Bosh admin filialsiz (markaziy) xarajat ham kirita oladi.

### Rollar va panellar
| Rol | Panel |
|---|---|
| Bosh admin | **Umumiy hisobot** (butun tashkilot → har bir filial → maktab va bog‘cha), filiallar, foydalanuvchilar, harakatlar jurnali, hamma bo‘limlar. Ro‘yxat va hisobotlarda filial/bo‘lim filtri. |
| Menejer | O‘quv ishlari. Filial biriktirilsa — faqat o‘sha filial (o‘quvchilar, sinflar, jadval, ota-onalar, kelmaslik xabarlari). Biriktirilmasa — barcha filiallar. |
| Buxgalter | **Faqat o‘z filiali**: kirim-chiqim, qarzdorlar, hisobotlar, shartnomalar. Boshqa filial ma’lumotini server bermaydi (403). Buxgalter qo‘shishda filial majburiy. |
| O‘qituvchi | O‘z darslari; bugungi kelmaydigan o‘quvchilar ro‘yxati, dars sahifasida “ota-ona xabar bergan” belgisi. |
| Ota-ona | Farzandi; **“Farzandim kela olmaydi”** xabari. |

### Kelmaslik xabari
Ota-ona bosh sahifada yoki **Kela olmaydi** bo‘limida sana(lar), sabab turi va izoh bilan xabar yuboradi. Bildirishnoma darhol boradi: sinf rahbari (tarbiyachi), o‘sha kunlari shu sinfda dars beradigan o‘qituvchilar, filial menejeri va bosh admin. Ma’muriyat “Ko‘rdim” deb belgilaydi.

### O‘rinbosar o‘qituvchi
O‘qituvchi endi boshqa o‘qituvchining darsini o‘zi boshlay olmaydi. **Sinflar va jadval → O‘rinbosar tayinlash** orqali ma’muriyat tayinlaydi.

### Xavfsizlik o‘zgarishlari
- Server bitta noto‘g‘ri so‘rov bilan qulamaydi; sekin so‘rovlar (slowloris) uchun timeout'lar; server faqat `127.0.0.1` da tinglaydi (nginx orqali).
- Rate limit: IP bo‘yicha umumiy va yozish so‘rovlari, login (IP bo‘yicha va telefon bo‘yicha — bazada, 6 urinishdan keyin 15 daqiqa blok), fayl yuklash. nginx'da qo‘shimcha `limit_req`/`limit_conn` (`deploy/nginx-steamplaza.conf`).
- Parol: kamida 8 belgi, harf va raqam. Parol almashtirilganda, admin yangi parol berganda, hisob bloklanganda yoki filial o‘zgarganda **eski loginlar bekor bo‘ladi**. Profilda “Barcha qurilmalardan chiqish”.
- Production (`NODE_ENV=production`) da demo yuklash o‘chirilgan va demo hisoblar bilan kirib bo‘lmaydi.
- Ruxsatlar: ota-ona boshqa filial bolalarining kartasini ko‘rmaydi; o‘qituvchi baholarida ota-ona ismlari faqat admin va o‘qituvchining o‘ziga ko‘rinadi; filial cheklovi barcha endpoint'larda serverda tekshiriladi.
- Fayllar: mazmuni turiga mos kelishi tekshiriladi (PDF, JPEG, PNG, Office), Office fayllar yuklab olinadi (brauzerda ochilmaydi), fayl javoblarida sandbox CSP.
- Xavfsizlik sarlavhalari: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (`server.js` va `vercel.json`).
- **Harakatlar jurnali** (audit log): kirishlar va noto‘g‘ri urinishlar, to‘lov/oylik/xarajat, o‘chirishlar, foydalanuvchi va parol o‘zgarishlari, o‘tgan darslardagi baho o‘zgarishlari — kim, qachon, qaysi IP.
- Zaxira: `deploy/backup.sh` baza bilan birga yuklangan fayllarni ham saqlaydi.
- Shaxsiy ma’lumotlar: O‘zbekiston qonunchiligi bo‘yicha fuqarolarning shaxsiy ma’lumotlari O‘zbekistondagi serverda saqlanishi kerak — haqiqiy ishga tushirishni Vercel emas, O‘zbekistondagi VDS (2-bo‘lim) da qiling.

## 4-versiya: demo hisoblar, shifrlash, fayl siqish, PDF ilovalar, brauzer bildirishnomalari

### Demo hisoblar (sinov uchun)
`npm run demo` (yoki Sozlamalar → Demo ma’lumotlar) har bir rol uchun hisob yaratadi, parol hammasida `demo1234`.
Kirish sahifasida “Demo hisoblar” ro‘yxati chiqadi — bosilsa o‘sha rol bilan kiradi.

| Rol | Telefon | Nima ko‘rinadi |
|---|---|---|
| Bosh admin | +998 90 700 00 00 | Hamma filiallar, umumiy hisobot |
| Menejer | +998 90 700 00 01 | Barcha filiallar |
| Menejer | +998 90 700 00 04 | Faqat 2-filial |
| Buxgalter | +998 90 700 00 02 | Faqat 1-filial |
| Buxgalter | +998 90 700 00 03 | Faqat 2-filial |
| O‘qituvchi | +998 90 700 10 01 | 1-filial, 5-A sinf rahbari |
| O‘qituvchi | +998 90 700 10 02 | 2-filial, 5-B sinf rahbari |
| Ota-ona | +998 91 500 00 00 | 1-filial maktab |
| Ota-ona | +998 91 500 00 48 | 1-filial bog‘cha |

`NODE_ENV=production` bo‘lsa demo o‘chiq: ro‘yxat chiqmaydi, demo hisoblar bilan kirib bo‘lmaydi. Alohida sinov serverida `ALLOW_DEMO=1` bilan yoqiladi.
`npm run demo -- clear` — demo ma’lumotlarni o‘chiradi.

### Shifrlash (AES-256-GCM)
- Barcha yuklangan fayllar (hujjatlar, rasmlar, cheklar) bazada yoki diskda shifrlangan holda saqlanadi.
- Shaxsiy maydonlar shifrlanadi: pasport, manzil, sog‘liq, izoh, qo‘shimcha telefon, tug‘ilgan joy/sana (profilda), guvohnoma, ish joyi.
- Kalit: `.env` dagi `DATA_KEY` (`openssl rand -hex 32`). **Kalitni parollar menejerida yoki seyfda alohida saqlang** — kalitsiz zaxira nusxadan fayllarni ochib bo‘lmaydi.
- Eski (4-versiyadan oldingi) ma’lumotlarni shifrlash: `npm run encrypt` (oylik cron ham asta-sekin shifrlaydi).
- Kalitni almashtirish: yangisini `DATA_KEY` ga, eskisini `DATA_KEY_OLD` ga yozing → `npm run encrypt -- --rekey` → `DATA_KEY_OLD` ni olib tashlang.
- Login uchun telefon raqam va ism shifrlanmaydi (qidiruv va kirish uchun kerak). Diskni to‘liq shifrlash (LUKS) va Neon’ning o‘z shifrlashi bilan birga ishlatish tavsiya etiladi.

### Fayllarni siqish
- Rasmlar: telefonda kichraytiriladi, serverda yana qayta siqiladi (eng katta tomon 2000 px, EXIF burilishi to‘g‘rilanadi, GPS va boshqa metama’lumotlar o‘chiriladi).
- PDF: skaner qilingan sahifa rasmlari qayta siqiladi va fayl ixcham saqlanadi. Sinovda 6,7 MB skaner PDF → 0,35 MB, 3,4 MB foto → 0,26 MB.
- Fayl chegarasi: o‘z serverda 10 MB, Vercel’da 3 MB (`MAX_FILE_MB`).

### Profil PDF ichida hujjatlar
O‘quvchi yoki o‘qituvchi PDF’ida “Yuklangan hujjatlar” jadvali “Ilova 1, 2, …” raqamlari bilan, keyin hujjatlarning o‘zi: rasm/skanerlar alohida sahifada, PDF hujjatlar sahifama-sahifa (har sahifada “Ilova N” belgisi). Word/Excel fayllar faqat ro‘yxatda ko‘rsatiladi. Hujjatlarni faqat ma’muriyat (va o‘qituvchi — o‘z PDF’ida) ko‘radi.

### Brauzer bildirishnomalari (Web Push)
- Profil yoki 🔔 oynasida “Yoqish” — sayt yopiq bo‘lsa ham kompyuter/telefonga bildirishnoma keladi (Chrome, Edge, Firefox; iPhone’da Safari → “Bosh ekranga qo‘shish” orqali).
- Kalitlar avtomatik yaratiladi (bazada shifrlangan). Xohlasangiz `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` ni o‘zingiz bering.
- HTTPS shart (localhost bundan mustasno). Chiqishda shu brauzerga bildirishnoma yuborish to‘xtaydi.
