// Owner tools: load/clear demo data, data retention cleanup (Vercel Cron or system cron on your server).
import { route, fail, need, today, addDays, weekday, curMonth, monthShift } from "../http.js";
import { hashPassword } from "../auth.js";

route("POST", "/admin/demo", async ({ sql, body }) => {
  if (body.action === "clear") return clearDemo(sql);
  const [{ n }] = await sql`select count(*)::int as n from users where demo`;
  need(n === 0, "Demo ma’lumotlar allaqachon yuklangan");
  return loadDemo(sql);
}, { roles: ["owner"] });

async function clearDemo(sql) {
  await sql.begin(async (tx) => {
    const sids = (await tx`select id from students where demo`).map((r) => r.id);
    const tids = (await tx`select id from users where demo and role = 'teacher'`).map((r) => r.id);
    if (sids.length) await tx`delete from documents where owner_type = 'student' and owner_id = any(${sids}::int[])`;
    if (tids.length) await tx`delete from documents where owner_type = 'teacher' and owner_id = any(${tids}::int[])`;
    await tx`delete from lessons where class_id in (select id from classes where demo)`;
    await tx`delete from students where demo`;
    await tx`delete from classes where demo`;
    await tx`delete from users where demo`;
    await tx`delete from subjects where demo and id not in (select subject_id from schedule union select subject_id from lessons)`;
    await tx`delete from expenses where demo`;
    await tx`delete from menu where demo`;
  });
  return { ok: true, cleared: true };
}

// Data retention: lesson-level records older than RETENTION_MONTHS (default 24) are removed. Students, teachers and finance stay.
route("GET", "/cron/cleanup", async ({ sql, req }) => {
  const secret = process.env.CRON_SECRET;
  need(secret && req.headers.authorization === `Bearer ${secret}`, "Ruxsat yo‘q", 401);
  const months = Math.max(6, Number(process.env.RETENTION_MONTHS) || 24);
  const cutoff = monthShift(curMonth(), -months) + "-01";
  const l = await sql`delete from lessons where date < ${cutoff}`;
  const n = await sql`delete from notifications where created_at < now() - interval '180 days'`;
  await sql`delete from files f where created_at < now() - interval '2 days' and not exists (select 1 from users where photo->>'id' = f.id::text)
    and not exists (select 1 from students where photo->>'id' = f.id::text) and not exists (select 1 from documents where file->>'id' = f.id::text)
    and not exists (select 1 from posts where files::text like '%' || f.id::text || '%') and not exists (select 1 from lessons where hw_files::text like '%' || f.id::text || '%')
    and not exists (select 1 from achievements where file->>'id' = f.id::text) and not exists (select 1 from payments where receipt->>'id' = f.id::text)
    and not exists (select 1 from salaries where receipt->>'id' = f.id::text) and not exists (select 1 from expenses where receipt->>'id' = f.id::text)`;
  return { ok: true, cutoff, lessons: l.count, notifications: n.count };
}, { auth: false });

/* ---------- demo data ---------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

async function loadDemo(sql) {
  const R = rng(20261114), pick = (a) => a[Math.floor(R() * a.length)];
  const pass = await hashPassword("demo1234");
  const T = today();
  const FM = ["Aziz", "Jasur", "Bekzod", "Otabek", "Doniyor", "Islom", "Sardor", "Umid", "Behruz", "Elbek", "Javohir", "Temur", "Abdulloh", "Diyor", "Kamron", "Asadbek"];
  const FF = ["Feruza", "Nilufar", "Laylo", "Bonu", "Madina", "Sevara", "Zarina", "Malika", "Asal", "Gulnoza", "Kamola", "Shahzoda", "Mohinur", "Sabina", "Robiya", "Oysha"];
  const LAST = ["Nurmatov", "Ahmedov", "Hamidov", "Abdullayev", "Ismoilov", "Sattorov", "Alimov", "Rahmonov", "Mirzayev", "Yusupov", "Olimov", "Ergashev", "Qodirov", "Rasulov", "Sodiqov", "Umarov"];
  const fem = (l) => (/(ov|ev)$/.test(l) ? l + "a" : l);
  const SUBJ = { "Matematika": ["Natural sonlar", "Kasrlar", "O‘nli kasrlar", "Foizlar", "Tenglamalar", "Proporsiya", "Geometrik shakllar"],
    "Ona tili": ["Ot so‘z turkumi", "Sifat", "Fe’l", "Imlo qoidalari", "Gap bo‘laklari", "Diktant"],
    "Ingliz tili": ["Present Simple", "Past Simple", "My family", "Daily routine", "Vocabulary: school", "Reading practice"],
    "Tarix": ["Qadimgi Baqtriya", "So‘g‘diyona", "Buyuk ipak yo‘li", "Amir Temur davlati", "Xorazm davlati"],
    "Biologiya": ["O‘simlik hujayrasi", "Fotosintez", "Ildiz tuzilishi", "Gul va meva", "Hayvonlar olami"],
    "Fizika": ["Mexanik harakat", "Tezlik", "Kuch", "Bosim", "Energiya"],
    "Informatika": ["Algoritmlar", "Scratch: sikllar", "Python: o‘zgaruvchilar", "Shartli operatorlar", "Massivlar"],
    "Aviatsiya asoslari": ["Samolyot qismlari", "Ko‘tarish kuchi", "Aerodinamika", "Navigatsiya asoslari", "Dron yig‘ish"] };
  const TEACH = [["Nodira Saidova", "f", "Matematika", "Oliy toifa", 14], ["Sherzod Mahmudov", "m", "Ona tili", "Birinchi toifa", 9], ["Sarah Brown", "f", "Ingliz tili", "CELTA", 7],
    ["Bahrom Qosimov", "m", "Tarix", "Birinchi toifa", 11], ["Mohira Yoqubova", "f", "Biologiya", "Oliy toifa", 12], ["Rustam Umarov", "m", "Fizika", "Ikkinchi toifa", 6],
    ["Jamshid Sobirov", "m", "Informatika", "Birinchi toifa", 8], ["Akmal Xolmatov", "m", "Aviatsiya asoslari", "Uchuvchi-instruktor", 15]];
  return sql.begin(async (tx) => {
    const subj = {};
    for (const name of Object.keys(SUBJ)) {
      const [s] = await tx`insert into subjects (name, demo) values (${name}, true) on conflict (name) do update set name = excluded.name returning id`; subj[name] = s.id;
    }
    const teachers = [];
    for (const [i, [name, g, subject, category, exp]] of TEACH.entries()) {
      const [u] = await tx`insert into users (role, name, phone, pass_hash, demo, profile) values ('teacher', ${name}, ${"+99890700" + String(1001 + i).slice(-4)}, ${pass}, true,
        ${tx.json({ gender: g, subjects: subject, category, experience: String(exp), education: "Oliy ma’lumotli, pedagogika universiteti", salary: 4000000 + Math.round(R() * 15) * 100000, position: subject + " o‘qituvchisi", achievements: "Tuman “Yilning eng yaxshi fan o‘qituvchisi” tanlovi ishtirokchisi" })}) returning id, name`;
      teachers.push({ ...u, subject });
    }
    const CL = ["5-A", "5-B", "6-A", "7-A"], classes = [];
    for (const [i, name] of CL.entries()) {
      const [c] = await tx`insert into classes (name, grade, room, leader_id, demo) values (${name}, ${parseInt(name, 10)}, ${"10" + (i + 1)}, ${teachers[i].id}, true) returning id, name`;
      classes.push(c);
    }
    // weekly schedule: 6 periods × 6 days; teacher busy-check by slot
    const busy = new Set(), sched = [];
    for (const c of classes) for (let wd = 1; wd <= 6; wd++) for (let p = 1; p <= (wd === 6 ? 4 : 6); p++) {
      const order = [...teachers].sort(() => R() - 0.5);
      const t = order.find((x) => !busy.has(`${x.id}|${wd}|${p}`));
      if (!t) continue; busy.add(`${t.id}|${wd}|${p}`);
      sched.push({ class_id: c.id, weekday: wd, period: p, subject_id: subj[t.subject], teacher_id: t.id });
    }
    await tx`insert into schedule ${tx(sched, "class_id", "weekday", "period", "subject_id", "teacher_id")}`;
    // students + parents
    const students = [];
    let k = 0;
    for (const c of classes) for (let j = 0; j < 12; j++) {
      const g = R() < 0.5 ? "f" : "m", last = pick(LAST), first = g === "f" ? pick(FF) : pick(FM);
      const pphone = "+99891" + String(5000000 + k).padStart(7, "0");
      const [p] = await tx`insert into users (role, name, phone, pass_hash, demo) values ('parent', ${(R() < 0.5 ? pick(FF) + " " + fem(last) : pick(FM) + " " + last)}, ${pphone}, ${pass}, true) returning id`;
      const joined = monthShift(curMonth(), R() < 0.25 ? -3 : -2) + "-01";
      const [s] = await tx`insert into students (first_name, last_name, gender, birth_date, class_id, parent_id, monthly_fee, joined_on, demo, profile)
        values (${first}, ${g === "f" ? fem(last) : last}, ${g}, ${2015 - (parseInt(c.name, 10) - 5) + "-0" + (1 + Math.floor(R() * 9)) + "-1" + Math.floor(R() * 9)}, ${c.id}, ${p.id}, 2000000, ${joined}, true,
        ${tx.json({ address: "Toshkent sh., " + pick(["Chilonzor", "Yunusobod", "Mirzo Ulug‘bek", "Yakkasaroy"]) + " tumani", prevSchool: R() < 0.4 ? pick(["110-maktab", "21-maktab", "Prezident maktabi"]) : "" })}) returning id, class_id`;
      students.push({ ...s, skill: k === 0 ? 9 : 3.2 + R() * 1.5, star: k === 0 }); k++;
    }
    // past lessons for the last 3 weeks with attendance, grades, homework and homework checks
    const lrows = [], att = [], grd = [], hwc = [];
    const HW = ["Darslikdagi 5–8-mashqlar", "Mavzu bo‘yicha konspekt yozish", "12-betdagi savollarga javob", "Test topshiriqlari (10 ta)", "Matnni o‘qib, qayta hikoya qilish"];
    for (let d = addDays(T, -21); d <= T; d = addDays(d, 1)) {
      const wd = weekday(d); if (wd === 0) continue;
      // today: only the first two lessons of the first class are already held, the rest is left for trying the lesson flow
      for (const s of sched.filter((x) => x.weekday === wd && (d < T || (x.class_id === classes[0].id && x.period <= 2)))) {
        const subName = Object.keys(subj).find((n) => subj[n] === s.subject_id);
        lrows.push({ date: d, class_id: s.class_id, period: s.period, subject_id: s.subject_id, teacher_id: s.teacher_id, topic: pick(SUBJ[subName]), status: "ended", homework: pick(HW) });
      }
    }
    const ids = new Map();
    for (let i = 0; i < lrows.length; i += 1000) {
      const got = await tx`insert into lessons ${tx(lrows.slice(i, i + 1000), "date", "class_id", "period", "subject_id", "teacher_id", "topic", "status", "homework")} returning id, date, class_id, period`;
      for (const g of got) ids.set(`${g.date}|${g.class_id}|${g.period}`, g.id);
    }
    await tx`update lessons set started_at = (date || 'T09:00:00+05:00')::timestamptz, ended_at = (date || 'T09:45:00+05:00')::timestamptz where class_id = any(${classes.map((c) => c.id)}::int[])`;
    const lastHw = new Map();
    for (const lr of lrows) {
      const lid = ids.get(`${lr.date}|${lr.class_id}|${lr.period}`), key = `${lr.class_id}|${lr.subject_id}`, prev = lastHw.get(key);
      for (const st of students.filter((x) => x.class_id === lr.class_id)) {
        const absent = !st.star && R() < 0.05;
        att.push({ lesson_id: lid, student_id: st.id, status: absent ? "absent" : R() < 0.04 ? "late" : "present" });
        if (!absent && (st.star ? lr.date === T || R() < 0.7 : R() < 0.45)) grd.push({ lesson_id: lid, student_id: st.id, value: Math.max(2, Math.min(5, Math.round(st.skill + (R() - 0.5) * 1.8))) });
        if (prev && !absent) hwc.push({ lesson_id: prev, student_id: st.id, done: st.star || R() < (st.skill - 2) / 3, checked_in: lid });
      }
      lastHw.set(key, lid);
    }
    for (let i = 0; i < att.length; i += 2000) await tx`insert into attendance ${tx(att.slice(i, i + 2000))}`;
    for (let i = 0; i < grd.length; i += 2000) await tx`insert into grades ${tx(grd.slice(i, i + 2000), "lesson_id", "student_id", "value")}`;
    for (let i = 0; i < hwc.length; i += 2000) await tx`insert into hw_checks ${tx(hwc.slice(i, i + 2000), "lesson_id", "student_id", "done", "checked_in")}`;
    // ratings, feedback, achievements, posts
    const CMT = ["Farzandim fanni yaxshi ko‘rib qoldi, rahmat!", "Darslari qiziqarli, mavzuni tushunarli tushuntiradi.", "Juda e’tiborli ustoz.", "Natijalar sezilarli yaxshilandi.", "Uyga vazifa biroz ko‘p, lekin foydali.", "Olimpiadaga tayyorlashda katta yordam berdi."];
    for (const st of students) {
      if (R() < 0.6) {
        const cand = teachers.filter((x) => sched.some((s) => s.class_id === st.class_id && s.teacher_id === x.id)); const t = cand[Math.floor(R() * cand.length)];
        const [pr] = await tx`select parent_id from students where id = ${st.id}`;
        await tx`insert into teacher_ratings (parent_id, teacher_id, month, student_id, stars, comment) values (${pr.parent_id}, ${t.id}, ${curMonth()}, ${st.id}, ${R() < 0.7 ? 5 : 4}, ${pick(CMT)}) on conflict do nothing`;
      }
      if (R() < 0.15) await tx`insert into achievements (student_id, title, kind, level, place, subject, date) values (${st.id}, ${pick(["Matematika olimpiadasi", "Ingliz tili olimpiadasi", "Robototexnika tanlovi", "Informatika olimpiadasi"])}, 'olympiad', ${pick(["Tuman", "Shahar", "Respublika"])}, ${1 + Math.floor(R() * 3)}, null, ${addDays(T, -Math.floor(R() * 200))})`;
    }
    for (const t of [teachers[0], teachers[0], ...teachers.slice(0, 5)]) await tx`insert into posts (kind, title, body, author_id, class_ids, event) values ('openlesson', ${t.subject + ": ochiq dars"}, ${"Barcha ota-onalarni ochiq darsimizga taklif qilamiz. Dars davomida o‘quvchilar o‘z bilimlarini namoyish etadi."}, ${t.id}, ${[classes[0].id]}, ${tx.json({ date: addDays(T, -Math.floor(R() * 20)), time: "10:00", subject: t.subject, place: "101-xona" })})`;
    const star = teachers[0];
    const parentsOfStar = await tx`select distinct s.parent_id, s.id from students s where s.class_id in (select class_id from schedule where teacher_id = ${star.id}) and s.demo limit 14`;
    for (const r of parentsOfStar) await tx`insert into teacher_ratings (parent_id, teacher_id, month, student_id, stars, comment) values (${r.parent_id}, ${star.id}, ${curMonth()}, ${r.id}, 5, ${pick(CMT)}) on conflict (parent_id, teacher_id, month) do update set stars = 5`;
    await tx`insert into users (role, name, phone, pass_hash, demo, profile) values ('manager', 'Demo Menejer', '+998907000001', ${pass}, true, ${tx.json({ position: "O‘quv ishlari bo‘yicha menejer" })}), ('accountant', 'Demo Buxgalter', '+998907000002', ${pass}, true, ${tx.json({ position: "Bosh buxgalter" })})`;
    await tx`insert into posts (kind, title, body, author_id) values ('news', 'Aviatsiya haftaligi boshlanadi', ${"Kelasi hafta maktabimizda aviatsiya haftaligi o‘tkaziladi. O‘quvchilar aerodromga ekskursiyaga boradi, dron yig‘ish bo‘yicha mahorat darslari bo‘ladi.\n\nOta-onalar ham tadbirlarda qatnashishi mumkin."}, ${teachers[7].id})`;
    // finance: last 3 months payments, salaries, expenses
    for (let i = 2; i >= 0; i--) {
      const m = monthShift(curMonth(), -i);
      const pays = students.filter(() => i > 0 || R() < 0.6).map((st) => ({ student_id: st.id, month: m, amount: 2000000, method: pick(["Naqd", "Click", "Payme"]), paid_at: m + "-0" + (3 + Math.floor(R() * 6)) + "T10:00:00+05:00" }));
      if (pays.length) await tx`insert into payments ${tx(pays)}`;
      if (i > 0) for (const t of teachers) await tx`insert into salaries (teacher_id, month, amount, paid_at) values (${t.id}, ${m}, ${4000000 + Math.round(R() * 15) * 100000}, ${monthShift(m, 1) + "-05T12:00:00+05:00"})`;
      const ex = [["Ijara va kommunal", 9000000, "Bino ijarasi va kommunal to‘lovlar"], ["Oziq-ovqat", 8500000, "Oshxona uchun mahsulotlar"], ["O‘quv jihozlari", 2000000 + Math.round(R() * 3e6), "Darsliklar va kanselyariya"], ["Soliq va bank xizmatlari", 600000, "Bank xizmati"]];
      for (const [category, amount, note] of ex) await tx`insert into expenses (month, category, amount, note, demo, source) values (${m}, ${category}, ${amount}, ${note}, true, 'cash')`;
    }
    for (let d = addDays(T, -1); d <= addDays(T, 6); d = addDays(d, 1)) {
      if (weekday(d) === 0) continue;
      await tx`insert into menu (date, meal, dish, items, demo) values (${d}, 'breakfast', ${pick(["Sutli guruch bo‘tqa", "Omlet va non", "Suli bo‘tqasi"])}, 'Choy, non, sariyog‘', true), (${d}, 'lunch', ${pick(["Osh", "Mastava", "Lag‘mon", "Sho‘rva"])}, 'Salat, kompot', true), (${d}, 'snack', ${pick(["Mevali yogurt", "Pishiriq va sharbat", "Olma va pechenye"])}, null, true) on conflict do nothing`;
    }
    return { ok: true, teachers: teachers.length, students: students.length, lessons: lrows.length, password: "demo1234",
      sample: { teacher: "+998907001001", parent: "+998915000000", manager: "+998907000001", accountant: "+998907000002" } };
  });
}
