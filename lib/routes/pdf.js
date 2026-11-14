// PDF downloads: student profile, teacher profile, monthly and yearly finance reports.
import { route, fail, need, int, ADMINS, FINANCE, isMonth, curMonth, monthShift, today } from "../http.js";
import { getSettings } from "../db.js";
import { studentAccess } from "./core.js";
import { studentStats, teacherRanking, studentRanking } from "./stats.js";
import { monthReports } from "./finance.js";
import { teacherReviews } from "./school.js";
import { makeDoc, sendPdf, C, fmtMonth, fmtNum, fmtDate, fmtAvg } from "../pdf.js";

const ATT = { present: "Keldi", absent: "Kelmadi", late: "Kechikdi" };
const LEVEL_PLACE = (a) => [a.level, a.place ? `${a.place}-o‘rin` : null].filter(Boolean).join(", ");

route("GET", "/pdf/student/:id", async (ctx) => {
  const { sql, user, res } = ctx;
  const s = await studentAccess(ctx, ctx.params.id);
  const settings = await getSettings(sql);
  const month = isMonth(ctx.query.month) ? ctx.query.month : curMonth();
  const [cls] = s.class_id ? await sql`select c.name, u.name as leader from classes c left join users u on u.id = c.leader_id where c.id = ${s.class_id}` : [{}];
  const [parent] = s.parent_id ? await sql`select name, phone from users where id = ${s.parent_id}` : [{}];
  const st = await studentStats(sql, s.id, month);
  const ach = await sql`select * from achievements where student_id = ${s.id} order by date desc nulls last`;
  const pays = user.role === "teacher" ? [] : await sql`select month, amount, method, paid_at from payments where student_id = ${s.id} order by paid_at desc limit 24`;
  const docs = ADMINS.includes(user.role) ? await sql`select kind, name, created_at from documents where owner_type = 'student' and owner_id = ${s.id} order by created_at desc` : [];
  let rank = null;
  if (s.class_id) { const list = await studentRanking(sql, { period: "month", classId: s.class_id }); const i = list.findIndex((r) => r.id === s.id); rank = list[i]?.avg != null ? `${i + 1} / ${list.length}` : null; }

  const P = makeDoc({ title: `${s.last_name} ${s.first_name}`, subtitle: `O‘quvchi ma’lumotnomasi · ${fmtMonth(month)}`, school: settings.school });
  P.h2("Shaxsiy ma’lumotlar");
  P.kv([["Sinf", cls?.name], ["Sinf rahbari", cls?.leader], ["Tug‘ilgan sana", s.birth_date ? fmtDate(s.birth_date) : null], ["Jinsi", s.gender === "f" ? "Qiz" : "O‘g‘il"],
    ["Ota-ona", parent?.name], ["Telefon", parent?.phone], ["Manzil", s.profile?.address], ["Avvalgi maktab", s.profile?.prevSchool], ["Qabul qilingan", s.joined_on ? fmtDate(s.joined_on) : null],
    ...(user.role === "teacher" ? [] : [["Oylik to‘lov", s.monthly_fee ? fmtNum(s.monthly_fee) + " so‘m" : null]]), ["Qiziqishlari", s.profile?.interests], ["Izoh", s.profile?.notes]]);
  P.h2(`O‘zlashtirish — ${fmtMonth(month)}`);
  const att = st.attendance || {}, totalAtt = (att.present || 0) + (att.absent || 0) + (att.late || 0), hw = st.homework || {};
  P.tiles([{ label: "O‘rtacha baho", value: fmtAvg(st.avg) }, { label: "Sinfdagi o‘rni (oy)", value: rank || "—", tone: "gold" },
    { label: "Davomat", value: totalAtt ? Math.round(((att.present + att.late) / totalAtt) * 100) + "%" : "—" }, { label: "Uy vazifasi bajarildi", value: hw.done + hw.missed ? Math.round((hw.done / (hw.done + hw.missed)) * 100) + "%" : "—" }]);
  if (st.subjects.length) {
    P.hbars(st.subjects.filter((x) => x.avg != null).map((x) => ({ label: x.subject, value: x.avg })));
    P.table([{ label: "Fan", width: 0.34 }, { label: "Baholar", width: 0.14, align: "center" }, { label: "O‘rtacha", width: 0.16, align: "center" }, { label: "O‘tgan oy", width: 0.16, align: "center" }, { label: "O‘zgarish", width: 0.2, align: "center" }],
      st.subjects.map((x) => { const d = x.avg != null && x.prevAvg != null ? x.avg - x.prevAvg : null; return [x.subject, x.n, fmtAvg(x.avg), fmtAvg(x.prevAvg), d == null ? "—" : (d > 0 ? "+" : d < 0 ? "" : "± ") + fmtAvg(d)]; }),
      { rowStyle: (i) => { const x = st.subjects[i]; const d = x.avg != null && x.prevAvg != null ? x.avg - x.prevAvg : 0; return { colors: { 4: d > 0 ? C.good : d < 0 ? C.bad : C.muted } }; } });
    if (st.best.length) P.p(`Eng yaxshi o‘zlashtirilayotgan fanlar: ${st.best.join(", ")}.${st.worst.length ? ` E’tibor kerak: ${st.worst.filter((w) => !st.best.includes(w)).join(", ") || "—"}.` : ""}`, { size: 9.5 });
  } else P.p("Bu oyda baholar yo‘q.", { color: C.muted });
  if (st.weak.length) {
    P.h2("Past baho olingan mavzular");
    P.table([{ label: "Sana", width: 0.16 }, { label: "Fan", width: 0.24 }, { label: "Mavzu", width: 0.48 }, { label: "Baho", width: 0.12, align: "center" }],
      st.weak.map((w) => [fmtDate(w.date), w.subject, w.topic || "—", w.value]), { rowStyle: (i) => ({ colors: { 3: st.weak[i].value <= 2 ? C.bad : C.gold } }) });
  }
  if (st.trend.some((t) => t.avg != null)) { P.h2("6 oylik o‘rtacha baho"); P.hbars(st.trend.map((t) => ({ label: fmtMonth(t.month), value: t.avg }))); }
  P.h2("Yutuqlar va olimpiadalar");
  if (ach.length) P.table([{ label: "Sana", width: 0.16 }, { label: "Yutuq", width: 0.46 }, { label: "Bosqich / o‘rin", width: 0.38 }], ach.map((a) => [fmtDate(a.date), a.title, LEVEL_PLACE(a) || "—"]));
  else P.p("Hozircha qayd etilgan yutuqlar yo‘q.", { color: C.muted });
  if (pays.length) {
    P.h2("To‘lovlar tarixi");
    P.table([{ label: "Oy", width: 0.3 }, { label: "Summa, so‘m", width: 0.25, align: "right" }, { label: "Usul", width: 0.2 }, { label: "Sana", width: 0.25 }],
      pays.map((p) => [fmtMonth(p.month), fmtNum(p.amount), p.method || "", fmtDate(p.paid_at)]), { total: ["Jami", fmtNum(pays.reduce((a, p) => a + p.amount, 0)), "", ""] });
  }
  if (docs.length) { P.h2("Yuklangan hujjatlar"); P.table([{ label: "Hujjat", width: 0.35 }, { label: "Fayl", width: 0.45 }, { label: "Sana", width: 0.2 }], docs.map((d) => [DOC_KIND[d.kind] || d.kind, d.name, fmtDate(d.created_at)])); }
  sendPdf(res, await P.done(), `${s.last_name}_${s.first_name}_${month}.pdf`);
});
const DOC_KIND = { passport: "Ota-ona pasporti", metrika: "Tug‘ilganlik guvohnomasi", atestat: "Attestat / tabel", contract: "Shartnoma", diploma: "Diplom", medical: "Tibbiy ma’lumotnoma", other: "Boshqa", employment: "Mehnat shartnomasi", certificate: "Sertifikat" };

route("GET", "/pdf/teacher/:id", async ({ sql, user, params, res }) => {
  const [t] = await sql`select * from users where id = ${int(params.id)} and role = 'teacher'`;
  if (!t) fail(404, "O‘qituvchi topilmadi");
  need(ADMINS.includes(user.role) || user.id === t.id, "Ruxsat yo‘q", 403);
  const settings = await getSettings(sql), p = t.profile || {};
  const schedule = await sql`select distinct c.name as cls, sb.name as subject from schedule sc join classes c on c.id = sc.class_id join subjects sb on sb.id = sc.subject_id where sc.teacher_id = ${t.id} order by 1`;
  const [hours] = await sql`select count(*)::int as n from schedule where teacher_id = ${t.id}`;
  const byMonth = await sql`select substr(date,1,7) as month, count(*)::int as total, count(*) filter (where status='ended')::int as ended, count(distinct date)::int as days from lessons where teacher_id = ${t.id} group by 1 order by 1 desc limit 12`;
  const reviews = await teacherReviews(sql, t.id);
  const opens = await sql`select title, event, created_at from posts where kind = 'openlesson' and author_id = ${t.id} order by created_at desc limit 30`;
  const sal = ["owner", "accountant"].includes(user.role) || user.id === t.id ? await sql`select month, amount, paid_at from salaries where teacher_id = ${t.id} order by month desc limit 24` : [];
  const mr = await teacherRanking(sql, { month: curMonth() }), yr = await teacherRanking(sql, { year: today().slice(0, 4) });
  const me = mr.rows.find((r) => r.id === t.id), my = yr.rows.find((r) => r.id === t.id);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : null;

  const P = makeDoc({ title: t.name, subtitle: `O‘qituvchi ma’lumotnomasi · ${fmtDate(today())}`, school: settings.school });
  P.h2("Ma’lumotlar");
  P.kv([["Lavozim", p.position], ["Fanlar", schedule.length ? [...new Set(schedule.map((x) => x.subject))].join(", ") : p.subjects], ["Sinflar", [...new Set(schedule.map((x) => x.cls))].join(", ")],
    ["Haftalik dars soati", hours.n], ["Telefon", t.phone], ["Ish staji", p.experience ? p.experience + " yil" : null], ["Toifa", p.category], ["Ma’lumoti", p.education],
    ...(ADMINS.includes(user.role) ? [["Tug‘ilgan sana", p.birthDate], ["Manzil", p.address], ["Ishga qabul qilingan", p.hiredOn ? fmtDate(p.hiredOn) : null]] : []), ["Yutuqlari", p.achievements]]);
  P.h2("Reyting");
  P.tiles([{ label: "Ota-onalar bahosi", value: avg ? fmtAvg(avg) + " / 5" : "—" }, { label: "Baholar soni", value: reviews.length }, { label: `O‘rin (${fmtMonth(curMonth())})`, value: me ? `${me.rank} / ${mr.rows.length}` : "—", tone: "gold" }, { label: "O‘rin (yil)", value: my ? `${my.rank} / ${yr.rows.length}` : "—", tone: "gold" }]);
  P.p(`Reyting ota-onalar bahosi (${mr.weights.starsWeight}%) va ochiq darslar soni (${mr.weights.openLessonWeight}%) asosida hisoblanadi.`, { size: 8.5, color: C.muted });
  if (byMonth.length) {
    P.h2("O‘tilgan darslar");
    P.bars(byMonth.slice().reverse().map((m) => ({ label: fmtMonth(m.month).slice(0, 3) + " " + m.month.slice(2, 4), values: [m.ended] })), [{ name: "Yakunlangan darslar", color: C.green }], { height: 110, format: (v) => Math.round(v) });
    P.table([{ label: "Oy", width: 0.4 }, { label: "Darslar", width: 0.2, align: "center" }, { label: "Yakunlangan", width: 0.2, align: "center" }, { label: "Ish kunlari", width: 0.2, align: "center" }], byMonth.map((m) => [fmtMonth(m.month), m.total, m.ended, m.days]));
  }
  if (opens.length) { P.h2("Ochiq darslar"); P.table([{ label: "Sana", width: 0.2 }, { label: "Mavzu", width: 0.55 }, { label: "Joy", width: 0.25 }], opens.map((o) => [fmtDate(o.event?.date || o.created_at), o.title, o.event?.place || ""])); }
  if (reviews.length) {
    P.h2("Ota-onalar fikrlari");
    P.table([{ label: "Sana", width: 0.15 }, { label: "Ota-ona", width: 0.27 }, { label: "Baho", width: 0.1, align: "center" }, { label: "Fikr", width: 0.48 }],
      reviews.slice(0, 60).map((r) => [fmtDate(r.created_at), `${r.parent_name}${r.student_name ? `\n(${r.student_name}, ${r.class_name || ""})` : ""}`, `${r.stars} / 5`, r.comment || "—"]), { rowStyle: () => ({ colors: { 2: C.gold } }) });
  }
  if (sal.length) { P.h2("Olingan oyliklar"); P.table([{ label: "Oy", width: 0.4 }, { label: "Summa, so‘m", width: 0.3, align: "right" }, { label: "To‘langan", width: 0.3 }], sal.map((x) => [fmtMonth(x.month), fmtNum(x.amount), fmtDate(x.paid_at)]), { total: ["Jami", fmtNum(sal.reduce((a, x) => a + x.amount, 0)), ""] }); }
  sendPdf(res, await P.done(), `${t.name.replace(/\s+/g, "_")}.pdf`);
});

route("GET", "/pdf/report", async ({ sql, query, res }) => {
  const settings = await getSettings(sql);
  const year = /^\d{4}$/.test(query.year || "") ? query.year : null;
  const month = !year ? (isMonth(query.month) ? query.month : monthShift(curMonth(), -1)) : null;
  const COLORS = [C.green, C.gold, C.info, "#8E5BD0", "#C9643B", "#5E8C7A", "#9C4A2A"];
  if (month) {
    const prev = monthShift(month, -1);
    const { categories, months } = await monthReports(sql, monthShift(month, -5), month);
    const m = months[months.length - 1], p = months[months.length - 2];
    const P = makeDoc({ title: `Oylik hisobot`, subtitle: fmtMonth(month), school: settings.school });
    const pct = (a, b) => (a ? Math.round(((b - a) / Math.abs(a)) * 1000) / 10 : null);
    const chg = (a, b) => { const d = b - a, q = pct(a, b); return d === 0 ? "=" : `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d))}${q != null ? ` (${q > 0 ? "+" : ""}${String(q).replace(".", ",")}%)` : ""}`; };
    P.tiles([{ label: "Kirim", value: fmtNum(m.income) }, { label: "Chiqim", value: fmtNum(m.out), tone: "gold" }, { label: "Sof foyda", value: fmtNum(m.profit), tone: m.profit < 0 ? "bad" : undefined }, { label: "O‘quvchilar", value: m.students }]);
    P.p(`${fmtMonth(month)}da ${fmtMonth(prev)}ga nisbatan kirim ${m.income === p.income ? "o‘zgarmadi" : `${m.income > p.income ? "oshdi" : "kamaydi"} (${chg(p.income, m.income)})`}, chiqim ${m.out === p.out ? "o‘zgarmadi" : `${m.out > p.out ? "oshdi" : "kamaydi"} (${chg(p.out, m.out)})`}, sof foyda ${chg(p.profit, m.profit)} so‘m.`, { size: 9.5 });
    P.h2(`${fmtMonth(month)} va ${fmtMonth(prev)}`);
    const rows = [["O‘quvchilar", p.students, m.students, false, 1], ["Kirim", p.income, m.income, true, 1], ["O‘qituvchilar oyligi", p.salaries, m.salaries, true, -1], ...categories.map((c) => [c, p.byCat[c] || 0, m.byCat[c] || 0, true, -1]), ["Jami chiqim", p.out, m.out, true, -1], ["Sof foyda", p.profit, m.profit, true, 1]];
    P.table([{ label: "Ko‘rsatkich", width: 0.34 }, { label: fmtMonth(prev), width: 0.2, align: "right" }, { label: fmtMonth(month), width: 0.2, align: "right" }, { label: "O‘zgarish", width: 0.26, align: "right" }],
      rows.map(([l, a, b, money]) => [l, money ? fmtNum(a) : a, money ? fmtNum(b) : b, money ? chg(a, b) : (b - a > 0 ? "+" : "") + (b - a)]),
      { rowStyle: (i) => { const [, a, b, , dir] = rows[i]; const d = (b - a) * dir; return { bold: ["Kirim", "Jami chiqim", "Sof foyda"].includes(rows[i][0]), colors: { 3: d > 0 ? C.good : d < 0 ? C.bad : C.muted } }; } });
    P.h2("So‘nggi 6 oy, mln so‘m");
    P.bars(months.map((x) => ({ label: fmtMonth(x.month).slice(0, 3), values: [x.income, x.out, Math.max(0, x.profit)] })), [{ name: "Kirim", color: C.green }, { name: "Chiqim", color: C.gold }, { name: "Foyda", color: C.info }]);
    P.h2("Chiqimlar tarkibi");
    const parts = [["O‘qituvchilar oyligi", m.salaries], ...categories.map((c) => [c, m.byCat[c] || 0])].filter((x) => x[1] > 0);
    P.table([{ label: "Toifa", width: 0.5 }, { label: "Summa, so‘m", width: 0.3, align: "right" }, { label: "Ulushi", width: 0.2, align: "right" }], parts.map(([l, v]) => [l, fmtNum(v), m.out ? Math.round((v / m.out) * 100) + "%" : "—"]), { total: ["Jami", fmtNum(m.out), "100%"] });
    const exp = await sql`select category, amount, note, recipient, source from expenses where month = ${month} order by amount desc limit 40`;
    if (exp.length) { P.h2("Xarajatlar ro‘yxati"); P.table([{ label: "Toifa", width: 0.24 }, { label: "Tavsif", width: 0.46 }, { label: "Summa", width: 0.18, align: "right" }, { label: "Manba", width: 0.12 }], exp.map((e) => [e.category, e.note + (e.recipient ? ` (${e.recipient})` : ""), fmtNum(e.amount), e.source === "bank" ? "Bank" : "Naqd"])); }
    return sendPdf(res, await P.done(), `hisobot_${month}.pdf`);
  }
  const { categories, months } = await monthReports(sql, `${year}-01`, `${year}-12` > curMonth() ? curMonth() : `${year}-12`);
  const sum = (k) => months.reduce((a, x) => a + x[k], 0);
  const P = makeDoc({ title: "Yillik hisobot", subtitle: `${year} yil`, school: settings.school });
  P.tiles([{ label: "Jami kirim", value: fmtNum(sum("income")) }, { label: "Jami chiqim", value: fmtNum(sum("out")), tone: "gold" }, { label: "Sof foyda", value: fmtNum(sum("profit")), tone: sum("profit") < 0 ? "bad" : undefined }, { label: "O‘quvchilar (oxiri)", value: months[months.length - 1]?.students ?? 0 }]);
  P.h2("Oylar bo‘yicha, mln so‘m");
  P.bars(months.map((x) => ({ label: fmtMonth(x.month).slice(0, 3), values: [x.income, x.out, Math.max(0, x.profit)] })), [{ name: "Kirim", color: C.green }, { name: "Chiqim", color: C.gold }, { name: "Foyda", color: C.info }]);
  P.table([{ label: "Oy", width: 0.2 }, { label: "O‘quvchi", width: 0.1, align: "center" }, { label: "Kirim", width: 0.18, align: "right" }, { label: "Oyliklar", width: 0.17, align: "right" }, { label: "Xarajatlar", width: 0.17, align: "right" }, { label: "Foyda", width: 0.18, align: "right" }],
    months.map((x) => [fmtMonth(x.month), x.students, fmtNum(x.income), fmtNum(x.salaries), fmtNum(x.expenses), fmtNum(x.profit)]),
    { rowStyle: (i) => ({ colors: { 5: months[i].profit < 0 ? C.bad : C.ink } }), total: ["Jami", "", fmtNum(sum("income")), fmtNum(sum("salaries")), fmtNum(sum("expenses")), fmtNum(sum("profit"))] });
  P.h2("Chiqimlar tarkibi (yil)");
  const parts = [["O‘qituvchilar oyligi", sum("salaries")], ...categories.map((c) => [c, months.reduce((a, x) => a + (x.byCat[c] || 0), 0)])].filter((x) => x[1] > 0);
  const tot = parts.reduce((a, x) => a + x[1], 0);
  P.bars(parts.map(([l, v]) => ({ label: l.length > 14 ? l.slice(0, 13) + "…" : l, values: [v] })), [{ name: "Summa, mln so‘m", color: C.gold }], { height: 110 });
  P.table([{ label: "Toifa", width: 0.5 }, { label: "Summa, so‘m", width: 0.3, align: "right" }, { label: "Ulushi", width: 0.2, align: "right" }], parts.map(([l, v]) => [l, fmtNum(v), tot ? Math.round((v / tot) * 100) + "%" : "—"]), { total: ["Jami", fmtNum(tot), "100%"] });
  const tr = await teacherRanking(sql, { year });
  if (tr.rows.length) { P.h2("O‘qituvchilar reytingi (yil)"); P.table([{ label: "O‘rin", width: 0.1, align: "center" }, { label: "O‘qituvchi", width: 0.4 }, { label: "Baho", width: 0.15, align: "center" }, { label: "Ochiq darslar", width: 0.15, align: "center" }, { label: "Ball", width: 0.2, align: "center" }], tr.rows.map((r) => [r.rank, r.name, r.stars != null ? fmtAvg(r.stars) : "—", r.open_lessons, fmtAvg(r.score)])); }
  sendPdf(res, await P.done(), `yillik_hisobot_${year}.pdf`);
}, { roles: FINANCE });
