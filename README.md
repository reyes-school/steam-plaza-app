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
git push -u origin main --force
```
`--force` eski kodni yangisi bilan almashtiradi. Login so‘ralsa: Username `reyes-school`, Password — token.

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
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now steamplaza

# 6) Nginx + HTTPS (domen DNS'i serverga yo‘naltirilgan bo‘lsin)
sudo tee /etc/nginx/sites-available/steamplaza >/dev/null <<'EOF'
server {
  server_name app.steamplaza.uz;
  client_max_body_size 30m;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
}
EOF
sudo ln -s /etc/nginx/sites-available/steamplaza /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d app.steamplaza.uz

# 7) Har kuni zaxira nusxa va oylik tozalash (crontab -e)
# 0 3 * * * pg_dump steamplaza | gzip > /var/backups/steamplaza-$(date +\%F).sql.gz && find /var/backups -name 'steamplaza-*' -mtime +30 -delete
# 0 4 1 * * curl -s -H "Authorization: Bearer CRON_SECRET" http://127.0.0.1:3000/api/cron/cleanup
```
Yangilash: `cd /opt/steamplaza && git pull && npm ci --omit=dev && sudo systemctl restart steamplaza`.

## Ma’lumotlar qayerda va tezlik
- Hamma ma’lumot PostgreSQL'da, kerakli ustunlarda indekslar bor. 400 o‘quvchi × 2 yil ≈ 1 mln baho/davomat yozuvi — bu PostgreSQL uchun kichik hajm, sahifalar 10–50 ms da ochiladi.
- Fayllar Vercel'da bazada, o‘z serveringizda diskda (`FILE_STORAGE=disk`) saqlanadi.
- **2 yillik saqlash:** oyiga bir marta tozalash ishlaydi (`RETENTION_MONTHS=24`) — 24 oydan eski darslar, baholar, davomat va bildirishnomalar o‘chiriladi. O‘quvchilar, o‘qituvchilar, hujjatlar va moliya o‘chirilmaydi.

## Mobil ilova
Barcha funksiyalar `/api` orqali ishlaydi. iOS va Android ilovasi (React Native/Expo) shu API'ga ulanadi — server qismini qayta yozish shart emas.

## Lokal ishga tushirish
```bash
npm install
cp .env.example .env   # DATABASE_URL, SESSION_SECRET, OWNER_PHONE, OWNER_PASSWORD
npm start              # http://localhost:3000
npm test               # API testlari (bo‘sh baza bilan)
```
