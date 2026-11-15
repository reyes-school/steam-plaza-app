// Admin roles (bosh admin, menejer, buxgalter): dashboard, people, classes & schedule, finance, reports, settings.
import {
  S, VIEWS, ACTIONS, SUBMITS, MODALS, NAV, render, go, api, post, patch, del, put, run, busy, data, pending, invalidate, toast, openModal, closeModal, modalHead,
  esc, ic, badge, seg, pills, cardHead, empty, bar, field, fv, fill, starsHtml, rankMark, avgColor, ava, avaEdit, fileBox, fileLinks, pdfBtn, uploadFile,
  fmtDay, fmtDate, fmtWhen, fmtMonth, fmtNum, fmtSum, fmtMln, fmtAvg, fmtPhone, hm, sName, today, curMonth, addDays, monthShift, wdOf, WD, WDS, MONTHS_S,
  ROLE_L, ADMINS, STAFF, FINANCE, user, role, settings, periodTimes, tzNow, loadMe, linkTo, pickAndUpload, celebrateOnce, confetti, CUP, mondayOf,
} from "./core.js";
import { postCard } from "./common.js";

NAV.owner = [["home", "Bosh sahifa", "grid"], ["students", "O‘quvchilar", "users"], ["teachers", "O‘qituvchilar", "user"], ["classes", "Sinflar va jadval", "calendar"], ["ratings", "Reyting", "trophy"], ["news", "Yangiliklar", "news"],
  ["ledger", "Kirim-chiqim", "wallet"], ["debts", "Qarzdorlar", "card"], ["reports", "Hisobotlar", "chart"], ["contracts", "Shartnomalar", "file"], ["menu", "Taomnoma", "food"], ["unlocks", "Ruxsatlar", "key"], ["people", "Foydalanuvchilar", "users"], ["settings", "Sozlamalar", "settings"]];
NAV.manager = [["home", "Bosh sahifa", "grid"], ["students", "O‘quvchilar", "users"], ["teachers", "O‘qituvchilar", "user"], ["classes", "Sinflar va jadval", "calendar"], ["ratings", "Reyting", "trophy"], ["news", "Yangiliklar", "news"],
  ["contracts", "Shartnomalar", "file"], ["debts", "Qarzdorlar", "card"], ["menu", "Taomnoma", "food"], ["unlocks", "Ruxsatlar", "key"], ["people", "Ota-onalar", "users"], ["settings", "Sozlamalar", "settings"]];
NAV.accountant = [["home", "Bosh sahifa", "grid"], ["ledger", "Kirim-chiqim", "wallet"], ["debts", "Qarzdorlar", "card"], ["reports", "Hisobotlar", "chart"], ["contracts", "Shartnomalar", "file"], ["students", "O‘quvchilar", "users"], ["teachers", "O‘qituvchilar", "user"], ["news", "Yangiliklar", "news"]];

const confirmTwice = (key) => { if (S.ui.confirm === key) { S.ui.confirm = null; return true; } S.ui.confirm = key; toast("Tasdiqlash uchun yana bir marta bosing"); return false; };

/* ================= dashboard ================= */
function liveBlock() {
  const L = data("/live");
  if (L === undefined) return pending("/live");
  const now = tzNow().min, t = L.times;
  const cur = t.find((x) => now >= x.start && now < x.end);
  const next = t.find((x) => x.start > now);
  const slot = cur || next;
  const ls = slot ? L.lessons.filter((l) => l.period === slot.period) : [];
  const pct = cur ? ((now - cur.start) / (cur.end - cur.start)) * 100 : 0;
  return `<section class="card"><div class="card-head"><h2>${cur ? `Hozir: ${cur.period}-soat` : next ? `Keyingi: ${next.period}-soat` : "Bugungi darslar tugadi"}</h2>${slot ? `<span class="small muted">${hm(slot.start)}–${hm(slot.end)}${cur ? ` · ${cur.end - now} daqiqa qoldi` : next ? ` · ${next.start - now} daqiqadan keyin` : ""}</span>` : ""}</div>
    ${cur ? bar(pct, "var(--gold)") : ""}
    ${ls.length ? `<div class="live-grid">${ls.map((l) => `<div class="live-item st-${l.status === "planned" && cur ? "missed" : l.status}"><b>${esc(l.class_name)}</b><span class="small">${esc(l.subject)}</span><span class="xs muted">${esc(l.teacher_name)}</span>${l.topic ? `<span class="xs">${esc(l.topic)}</span>` : ""}<span class="xs b">${l.status === "started" ? "● Dars ketmoqda" : l.status === "ended" ? "✓ Yakunlangan" : cur ? "Boshlanmagan" : "Rejada"}</span></div>`).join("")}</div>` : slot ? empty("Bu soatda dars yo‘q") : ""}
  </section>`;
}
VIEWS["admin:home"] = {
  title: "Bosh sahifa",
  render() {
    const d = data("/dashboard");
    if (d === undefined) return pending("/dashboard");
    const c = d.counts, f = d.finance;
    S.me.badges = { unlocks: c.unlocks };
    const ts = d.topStudents[0], tt = d.topTeachers[0]?.votes || d.topTeachers[0]?.open_lessons ? d.topTeachers[0] : null;
    if (ts || tt) celebrateOnce(`sp.cele.a${user().id}.${mondayOf(today())}`, { type: "admin-celebrate" });
    const heroes = ts || tt ? `<section class="card heroes">${cardHead("Maktab qahramonlari", `<button type="button" class="btn sm" data-a="a-cele">${ic("trophy", 16)} Tabriklash</button>`)}<div class="row wrap" style="gap:12px">
      ${ts ? `<button type="button" class="hero-tile" data-a="go" data-r="student-${ts.id}">${ava(ts, 56)}<div class="col"><span class="xs muted">Hafta o‘quvchisi</span><b>${esc(sName(ts))}</b><span class="small">${esc(ts.class_name || "")} · o‘rtacha ${fmtAvg(ts.avg)}</span></div></button>` : ""}
      ${tt ? `<button type="button" class="hero-tile" data-a="go" data-r="teacher-${tt.id}">${ava(tt, 56, "t")}<div class="col"><span class="xs muted">Oyning eng yaxshi o‘qituvchisi</span><b>${esc(tt.name)}</b><span class="small">${fmtAvg(tt.score)} ball · ${tt.open_lessons} ochiq dars</span></div></button>` : ""}</div></section>` : "";
    const tile = (label, v, bg, route) => `<button type="button" class="stat" style="background:${bg};border:0;text-align:left" data-a="go" data-r="${route}"><span class="small muted">${label}</span><span class="v">${v}</span></button>`;
    return `<div class="row wrap" style="gap:12px">${tile("O‘quvchilar", c.students, "var(--accent-soft)", "students")}${tile("O‘qituvchilar", c.teachers, "var(--gold-soft)", "teachers")}${tile("Sinflar", c.classes, "var(--info-soft)", "classes")}${tile("Ota-onalar", c.parents, "var(--surface-2)", STAFF.includes(role()) ? "people" : "students")}</div>
      ${c.unlocks && STAFF.includes(role()) ? `<button type="button" class="doc-row" style="border:0;background:var(--warn-soft);color:var(--warn);text-align:left" data-a="go" data-r="unlocks">${ic("key", 18)}<b class="grow">${c.unlocks} ta o‘qituvchi tahrirlash uchun ruxsat so‘ramoqda</b>${ic("chevron", 16)}</button>` : ""}
      ${f ? `<section class="card">${cardHead(`Moliya — ${fmtMonth(f.month)}`, linkTo("Hisobotlar →", "reports"))}<div class="row wrap" style="gap:10px">
        <div class="stat" style="background:var(--accent-soft)"><span class="small muted">Kirim</span><span class="v">${fmtMln(f.income)}</span></div>
        <div class="stat" style="background:var(--gold-soft)"><span class="small muted">Chiqim</span><span class="v">${fmtMln(f.salaries + f.expenses)}</span><span class="xs">oylik ${fmtMln(f.salaries)} · xarajat ${fmtMln(f.expenses)}</span></div>
        <div class="stat" style="background:${f.profit < 0 ? "var(--bad-soft)" : "var(--info-soft)"}"><span class="small muted">Sof foyda</span><span class="v" style="color:${f.profit < 0 ? "var(--bad)" : "inherit"}">${fmtMln(f.profit)}</span></div></div></section>` : ""}
      ${heroes}
      ${liveBlock()}
      <div class="grid" style="--min:320px">
        <section class="card">${cardHead("Hafta o‘quvchilari", linkTo("Reyting →", "ratings"))}<div class="col" style="gap:4px">${d.topStudents.map((x, i) => `<button type="button" class="rank-row" style="width:100%;text-align:left;background:transparent" data-a="go" data-r="student-${x.id}">${rankMark(i + 1)}${ava(x, 36)}<div class="col grow"><b class="small">${esc(sName(x))}</b><span class="xs muted">${esc(x.class_name || "")}</span></div><b style="color:${avgColor(x.avg)}">${fmtAvg(x.avg)}</b></button>`).join("") || empty("Bu hafta baholar yo‘q")}</div></section>
        <section class="card">${cardHead("O‘qituvchilar reytingi (oy)", linkTo("Barchasi →", "ratings"))}<div class="col" style="gap:4px">${d.topTeachers.map((x) => `<button type="button" class="rank-row" style="width:100%;text-align:left;background:transparent" data-a="go" data-r="teacher-${x.id}">${rankMark(x.rank)}${ava(x, 36, "t")}<div class="col grow"><b class="small">${esc(x.name)}</b><span class="xs muted">${x.stars != null ? fmtAvg(x.stars) + " ★ · " : ""}${x.open_lessons} ochiq dars</span></div><b>${fmtAvg(x.score)}</b></button>`).join("") || empty("O‘qituvchilar yo‘q")}</div></section>
      </div>
      ${role() === "owner" && !c.students ? `<section class="card" style="background:var(--gold-soft);border-color:var(--gold)"><h2>Boshlash</h2><span class="small">Tizim bo‘sh. Avval <b>Sinflar va jadval</b> bo‘limida fanlar va sinflarni, keyin o‘qituvchilarni, so‘ng o‘quvchilarni qo‘shing. Sinab ko‘rish uchun <b>Sozlamalar → Demo ma’lumotlar</b>ni yuklashingiz mumkin.</span></section>` : ""}`;
  },
};

ACTIONS["a-cele"] = () => { openModal({ type: "admin-celebrate" }); confetti(); };
MODALS["admin-celebrate"] = () => {
  const d = data("/dashboard"); if (!d) return "";
  const ts = d.topStudents[0], tt = d.topTeachers[0];
  return `<div class="col celebrate" style="gap:12px;padding:14px;border-radius:18px">${CUP}<h2 class="big">Maktab qahramonlari!</h2>
    <div class="row wrap" style="gap:12px;justify-content:center">
      ${ts ? `<div class="col" style="align-items:center;gap:4px;min-width:150px">${ava(ts, 72)}<span class="chip-title">Hafta o‘quvchisi</span><b>${esc(sName(ts))}</b><span class="small muted">${esc(ts.class_name || "")} · ${fmtAvg(ts.avg)}</span></div>` : ""}
      ${tt ? `<div class="col" style="align-items:center;gap:4px;min-width:150px">${ava(tt, 72, "t")}<span class="chip-title">Oy o‘qituvchisi</span><b>${esc(tt.name)}</b><span class="small muted">${fmtAvg(tt.score)} ball</span></div>` : ""}</div>
    <span>Ularni tabriklash uchun yangilik e’lon qilishingiz mumkin — ota-onalar va o‘qituvchilarga bildirishnoma boradi.</span>
    <div class="row wrap" style="gap:8px;justify-content:center">${STAFF.includes(role()) ? `<button type="button" class="btn" data-a="cele-post">${ic("megaphone", 16)} Tabrik e’lon qilish</button>` : ""}<button type="button" class="btn sec" data-a="close-modal">Yopish</button></div></div>`;
};
ACTIONS["cele-post"] = () => {
  const d = data("/dashboard"); const ts = d?.topStudents[0], tt = d?.topTeachers[0];
  S.f.ptitle = "Tabriklaymiz! Maktab qahramonlari";
  S.f.pbody = [ts ? `Hafta o‘quvchisi — ${sName(ts)} (${ts.class_name || ""}), o‘rtacha bahosi ${fmtAvg(ts.avg)}.` : "", tt ? `Oyning eng yaxshi o‘qituvchisi — ${tt.name}.` : "", "Bilim va mehnatingiz bilan faxrlanamiz!"].filter(Boolean).join("\n\n");
  openModal({ type: "post-new", extra: "news" });
};

/* ================= students ================= */
VIEWS["admin:students"] = {
  title: "O‘quvchilar",
  actions: () => (STAFF.includes(role()) ? `<button type="button" class="btn" data-a="modal" data-m="student-new">${ic("plus", 18)} O‘quvchi qo‘shish</button>` : ""),
  render() {
    const cls = S.ui.stCls || "", q = fv("stq").trim(), status = S.ui.stStatus || "active";
    const path = `/students?status=${status}${cls ? "&class_id=" + cls : ""}`;
    const list = data(path);
    const head = `<div class="row wrap" style="gap:10px"><div class="field" style="flex:1 1 240px"><input class="input" id="stq" data-f="stq" data-live="1" placeholder="Ism, familiya yoki ota-ona telefoni" value="${esc(q)}" aria-label="Qidirish"></div>
      <select class="input" style="width:auto" data-f="stCls" aria-label="Sinf"><option value="">Barcha sinflar</option>${S.me.classes.map((c) => `<option value="${c.id}" ${String(c.id) === cls ? "selected" : ""}>${esc(c.name)} (${c.size})</option>`).join("")}</select>
      ${seg("stStatus", status, [["active", "O‘qiydi"], ["left", "Ketgan"]])}</div>`;
    if (list === undefined) return head + pending(path);
    const ql = q.toLowerCase();
    const rows = list.filter((s) => !ql || sName(s).toLowerCase().includes(ql) || (s.parent_phone || "").includes(ql.replace(/\s/g, "")));
    return `${head}<section class="card"><span class="small muted">${rows.length} ta o‘quvchi</span>
      <div class="list">${rows.map((s) => `<button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left" data-a="go" data-r="student-${s.id}">${ava(s, 42)}<div class="col grow"><b>${esc(sName(s))}</b><span class="small muted">${esc(s.class_name || "Sinfsiz")}${s.parent_name ? ` · ${esc(s.parent_name)}, ${fmtPhone(s.parent_phone)}` : ""}</span></div>${s.monthly_fee != null && FINANCE.includes(role()) ? `<span class="small muted num">${fmtNum(s.monthly_fee)}</span>` : ""}${ic("chevron", 16)}</button>`).join("") || empty("O‘quvchi topilmadi")}</div></section>`;
  },
};
ACTIONS["change:stCls"] = (el) => { S.ui.stCls = el.value; };
MODALS["student-new"] = () => {
  const existing = S.ui.parentMode === "existing";
  return `${modalHead("Yangi o‘quvchi", "Ota-ona hisobi ham shu yerda yaratiladi")}
  <form class="stack" style="gap:12px" data-submit="student-new">
    <div class="row wrap" style="align-items:flex-start">${field("nlast", "Familiya", { required: true })}${field("nfirst", "Ism", { required: true })}</div>
    <div class="row wrap" style="align-items:flex-start">${field("nbirth", "Tug‘ilgan sana", { type: "date" })}${field("ngender", "Jinsi", { options: [["m", "O‘g‘il"], ["f", "Qiz"]], blank: false })}</div>
    <div class="row wrap" style="align-items:flex-start">${field("nclass", "Sinf", { options: S.me.classes.map((c) => [c.id, c.name]), required: true })}${field("nfee", "Oylik to‘lov (so‘m)", { mode: "numeric", def: "2000000" })}${field("njoined", "Qabul sanasi", { type: "date", def: today() })}</div>
    ${field("naddr", "Manzil")}${field("nprev", "Avvalgi maktab (ko‘chib kelgan bo‘lsa)")}
    <div class="col" style="gap:8px;border-top:1px solid var(--line);padding-top:12px"><div class="row between"><b>Ota-ona</b>${seg("parentMode", existing ? "existing" : "new", [["new", "Yangi"], ["existing", "Mavjud"]])}</div>
      ${existing ? field("npid", "Ota-ona (ro‘yxatdan)", { options: (data("/users?role=parent") || []).map((p) => [p.id, `${p.name} · ${fmtPhone(p.phone)}`]) }) : `<div class="row wrap" style="align-items:flex-start">${field("npname", "F.I.Sh.", { required: true })}${field("npphone", "Telefon", { phone: true, required: true })}</div>
      ${field("nppass", "Ota-ona uchun parol", { hint: "Kamida 6 belgi. Ota-onaga shu raqam va parolni bering.", def: S.ui.genPass || (S.ui.genPass = Math.random().toString(36).slice(2, 8)) })}`}</div>
    <span class="xs muted">Hujjatlar (metrika, pasport, attestat) va rasmni o‘quvchi sahifasida yuklaysiz.</span>
    <button type="submit" class="btn" ${busy("sn") ? "disabled" : ""}>O‘quvchini qo‘shish</button>
  </form>`;
};
SUBMITS["student-new"] = async () => {
  const body = { first_name: fv("nfirst"), last_name: fv("nlast"), birth_date: fv("nbirth") || null, gender: fv("ngender", "m"), class_id: fv("nclass"), monthly_fee: fv("nfee", "0"), joined_on: fv("njoined", today()), profile: { address: fv("naddr"), prevSchool: fv("nprev") } };
  if (S.ui.parentMode === "existing") body.parent_id = fv("npid") || null; else body.parent = { name: fv("npname"), phone: fv("npphone"), password: fv("nppass", S.ui.genPass) };
  const s = await run("sn", () => post("/students", body), { ok: "O‘quvchi qo‘shildi", invalidate: ["/students", "/users", "/dashboard", "/ratings"] });
  for (const k of ["nfirst", "nlast", "nbirth", "naddr", "nprev", "npname", "npphone", "nppass"]) S.f[k] = "";
  S.ui.genPass = null; await loadMe(); closeModal(); go("student-" + s.id);
};

/* ================= teachers ================= */
VIEWS["admin:teachers"] = {
  title: "O‘qituvchilar",
  actions: () => (STAFF.includes(role()) ? `<button type="button" class="btn" data-a="modal" data-m="teacher-new">${ic("plus", 18)} O‘qituvchi qo‘shish</button>` : ""),
  render() {
    const list = data("/teachers");
    if (list === undefined) return pending("/teachers");
    return `<section class="card"><div class="list">${list.map((t) => `<button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left;${t.active ? "" : "opacity:.55"}" data-a="go" data-r="teacher-${t.id}">${ava(t, 44, "t")}<div class="col grow"><b>${esc(t.name)}${t.active ? "" : " (faol emas)"}</b><span class="small muted">${esc(t.subjects.join(", ") || t.profile?.subjects || "")}${t.classes.length ? " · " + esc(t.classes.join(", ")) : ""}</span></div>${t.stars != null ? `<span class="row small" style="gap:4px">${starsHtml(t.stars, 12)}<b>${fmtAvg(t.stars)}</b><span class="muted">(${t.votes})</span></span>` : `<span class="xs muted">baho yo‘q</span>`}${ic("chevron", 16)}</button>`).join("") || empty("O‘qituvchilar hali qo‘shilmagan")}</div></section>`;
  },
};
const teacherFields = (pre) => `
  <div class="row wrap" style="align-items:flex-start">${field(pre + "name", "F.I.Sh.", { required: true })}${field(pre + "phone", "Telefon (login)", { phone: true, required: true })}</div>
  <div class="row wrap" style="align-items:flex-start">${field(pre + "pos", "Lavozim", { ph: "Matematika o‘qituvchisi" })}${field(pre + "subj", "Fanlari", { ph: "Matematika, Geometriya" })}${field(pre + "gender", "Jinsi", { options: [["m", "Erkak"], ["f", "Ayol"]], blank: false })}</div>
  <div class="row wrap" style="align-items:flex-start">${field(pre + "exp", "Ish staji (yil)", { mode: "numeric" })}${field(pre + "cat", "Toifa", { ph: "Oliy toifa" })}${field(pre + "salary", "Oylik maosh (so‘m)", { mode: "numeric" })}</div>
  ${field(pre + "edu", "Ma’lumoti", { ph: "TDPU, matematika fakulteti (2010)" })}
  <div class="row wrap" style="align-items:flex-start">${field(pre + "birth", "Tug‘ilgan sana", { type: "date" })}${field(pre + "hired", "Ishga qabul qilingan", { type: "date" })}${field(pre + "pass", "Pasport", { ph: "AA1234567" })}</div>
  ${field(pre + "addr", "Manzil")}${field(pre + "ach", "Yutuqlari va sertifikatlari", { area: true })}${field(pre + "about", "O‘zi haqida (ota-onalarga ko‘rinadi)", { area: true })}`;
const teacherProfile = (pre) => ({ position: fv(pre + "pos"), subjects: fv(pre + "subj"), gender: fv(pre + "gender", "m"), experience: fv(pre + "exp"), category: fv(pre + "cat"), salary: fv(pre + "salary"), education: fv(pre + "edu"), birthDate: fv(pre + "birth"), hiredOn: fv(pre + "hired"), passport: fv(pre + "pass"), address: fv(pre + "addr"), achievements: fv(pre + "ach"), about: fv(pre + "about") });
MODALS["teacher-new"] = () => `${modalHead("Yangi o‘qituvchi", "Telefon raqami va parol bilan tizimga kiradi")}
  <form class="stack" style="gap:12px" data-submit="teacher-new">${teacherFields("tn")}
    ${field("tnpw", "Parol", { def: S.ui.genPass || (S.ui.genPass = Math.random().toString(36).slice(2, 8)), hint: "Kamida 6 belgi. O‘qituvchiga shu raqam va parolni bering." })}
    <button type="submit" class="btn" ${busy("tn") ? "disabled" : ""}>Qo‘shish</button></form>`;
SUBMITS["teacher-new"] = async () => {
  const u = await run("tn", () => post("/users", { role: "teacher", name: fv("tnname"), phone: fv("tnphone"), password: fv("tnpw", S.ui.genPass), profile: teacherProfile("tn") }), { ok: "O‘qituvchi qo‘shildi", invalidate: ["/teachers", "/dashboard", "/ratings"] });
  for (const k of Object.keys(S.f)) if (k.startsWith("tn")) S.f[k] = ""; S.ui.genPass = null;
  closeModal(); go("teacher-" + u.id);
};
MODALS["teacher-edit"] = (m) => {
  const t = data("/teachers/" + m.id) || {};
  if (S.ui.teFilled !== m.id) {
    const p = t.profile || {};
    fill({ tename: t.name, tephone: t.phone, tepos: p.position, tesubj: p.subjects, tegender: p.gender || "m", teexp: p.experience, tecat: p.category, tesalary: p.salary, teedu: p.education, tebirth: p.birthDate, tehired: p.hiredOn, tepass: p.passport, teaddr: p.address, teach: p.achievements, teabout: p.about, tepw: "" });
    S.ui.teFilled = m.id;
  }
  return `${modalHead("O‘qituvchi ma’lumotlari", esc(t.name || ""))}
  <form class="stack" style="gap:12px" data-submit="teacher-edit" data-v="${m.id}">${teacherFields("te")}
    ${field("tepw", "Yangi parol (o‘zgartirish kerak bo‘lsa)", { hint: "Bo‘sh qoldirsangiz, parol o‘zgarmaydi" })}
    <div class="row wrap" style="gap:8px"><button type="submit" class="btn" ${busy("te") ? "disabled" : ""}>Saqlash</button>
    <button type="button" class="btn sec" data-a="user-active" data-v="${m.id}" data-on="${t.active ? 0 : 1}">${t.active ? "Faolsizlantirish (ishdan ketgan)" : "Qayta faollashtirish"}</button></div></form>`;
};
SUBMITS["teacher-edit"] = async (form) => {
  const body = { name: fv("tename"), phone: fv("tephone"), profile: teacherProfile("te") };
  if (fv("tepw")) body.password = fv("tepw");
  await run("te", () => patch("/users/" + form.dataset.v, body), { ok: "Saqlandi", invalidate: ["/teachers", "/ratings"] });
  S.ui.teFilled = null; closeModal();
};
ACTIONS["user-active"] = async (el) => {
  if (!confirmTwice("ua" + el.dataset.v)) return;
  await run("ua", () => patch("/users/" + el.dataset.v, { active: el.dataset.on === "1" }), { ok: "Saqlandi", invalidate: ["/teachers", "/users", "/dashboard"] });
  closeModal();
};

/* ================= classes, subjects, weekly schedule, bell ================= */
VIEWS["admin:classes"] = {
  title: "Sinflar va dars jadvali", roles: ["owner", "manager"],
  render() {
    const tab = S.ui.clTab || "schedule";
    return `${seg("clTab", tab, [["schedule", "Haftalik jadval"], ["classes", "Sinflar"], ["subjects", "Fanlar"], ["bell", "Qo‘ng‘iroq vaqtlari"]])}
      ${tab === "classes" ? classesTab() : tab === "subjects" ? subjectsTab() : tab === "bell" ? bellTab() : scheduleEditor()}`;
  },
};
function classesTab() {
  const teachers = data("/teachers") || [];
  return `<section class="card">${cardHead("Sinflar", `<button type="button" class="btn sm" data-a="modal" data-m="class-edit">${ic("plus", 16)} Sinf qo‘shish</button>`)}
    <div class="list">${S.me.classes.map((c) => `<div class="row"><span class="avatar">${esc(c.name)}</span><div class="col grow"><b>${esc(c.name)} sinf</b><span class="small muted">${c.size} o‘quvchi${c.leader_name ? " · Sinf rahbari: " + esc(c.leader_name) : ""}${c.room ? " · " + esc(c.room) + "-xona" : ""}</span></div><button type="button" class="btn sec sm" data-a="modal" data-m="class-edit" data-v="${c.id}">${ic("edit", 15)}</button></div>`).join("") || empty("Sinflar yo‘q")}</div></section>`;
}
MODALS["class-edit"] = (m) => {
  const c = S.me.classes.find((x) => x.id === m.id);
  if (S.ui.ceFilled !== (m.id || "new")) { fill({ cname: c?.name, croom: c?.room, cleader: c?.leader_id }); S.ui.ceFilled = m.id || "new"; }
  const teachers = (data("/teachers") || []).filter((t) => t.active);
  return `${modalHead(c ? `${c.name} sinf` : "Yangi sinf")}
    <form class="stack" style="gap:12px" data-submit="class-edit" data-v="${m.id || ""}">
      <div class="row wrap" style="align-items:flex-start">${field("cname", "Sinf nomi", { ph: "5-A", required: true })}${field("croom", "Xona", { ph: "101" })}</div>
      ${field("cleader", "Sinf rahbari", { options: teachers.map((t) => [t.id, t.name]) })}
      <div class="row wrap" style="gap:8px"><button type="submit" class="btn" ${busy("ce") ? "disabled" : ""}>Saqlash</button>${c ? `<button type="button" class="btn sec" style="color:var(--bad)" data-a="class-del" data-v="${c.id}">O‘chirish</button>` : ""}</div>
    </form>`;
};
SUBMITS["class-edit"] = async (form) => {
  const body = { name: fv("cname"), room: fv("croom"), leader_id: fv("cleader") || null };
  await run("ce", () => (form.dataset.v ? patch("/classes/" + form.dataset.v, body) : post("/classes", body)), { ok: "Saqlandi", invalidate: ["/schedule", "/dashboard"] });
  S.ui.ceFilled = null; await loadMe(); closeModal();
};
ACTIONS["class-del"] = async (el) => { if (!confirmTwice("cd" + el.dataset.v)) return; await run("ce", () => del("/classes/" + el.dataset.v), { ok: "Sinf o‘chirildi" }); await loadMe(); closeModal(); };
function subjectsTab() {
  return `<section class="card">${cardHead("Fanlar")}
    <form class="row wrap" style="align-items:flex-end;gap:8px" data-submit="subject-new"><div class="grow">${field("subname", "Yangi fan", { ph: "Masalan, Aviatsiya asoslari" })}</div><button type="submit" class="btn" ${busy("sub") ? "disabled" : ""}>Qo‘shish</button></form>
    <div class="row wrap" style="gap:8px">${S.me.subjects.map((s) => `<span class="chip-file"><b>${esc(s.name)}</b><button type="button" class="linkbtn" data-a="subject-del" data-v="${s.id}" aria-label="O‘chirish">✕</button></span>`).join("") || empty("Fanlar yo‘q")}</div></section>`;
}
SUBMITS["subject-new"] = async () => { await run("sub", () => post("/subjects", { name: fv("subname") }), { ok: "Fan qo‘shildi" }); S.f.subname = ""; await loadMe(); render(); };
ACTIONS["subject-del"] = async (el) => { if (!confirmTwice("sd" + el.dataset.v)) return; await run("sub", () => del("/subjects/" + el.dataset.v), { ok: "Fan o‘chirildi" }); await loadMe(); render(); };
function bellTab() {
  const b = settings().bell || {};
  if (!S.ui.bellFilled) { fill({ bstart: b.start, blesson: b.lesson, bbreak: b.break, blunchAfter: b.lunchAfter, blunch: b.lunch, bperiods: b.periods }); S.ui.bellFilled = true; }
  const preview = periodTimes({ start: fv("bstart", "08:30"), lesson: Number(fv("blesson", 45)) || 45, break: Number(fv("bbreak", 10)) || 0, lunchAfter: Number(fv("blunchAfter", 4)) || 0, lunch: Number(fv("blunch", 40)) || 0, periods: Math.min(12, Number(fv("bperiods", 7)) || 7) });
  const lunchAfter = Number(fv("blunchAfter", 4));
  return `<div class="grid" style="--min:320px"><section class="card"><h2>Dars vaqtlari</h2>
    <form class="stack" style="gap:12px" data-submit="bell">
      <div class="row wrap" style="align-items:flex-start">${field("bstart", "Birinchi dars boshlanishi", { type: "time", live: true })}${field("bperiods", "Kuniga darslar soni", { mode: "numeric", live: true })}</div>
      <div class="row wrap" style="align-items:flex-start">${field("blesson", "Dars davomiyligi (daqiqa)", { mode: "numeric", live: true })}${field("bbreak", "Tanaffus (daqiqa)", { mode: "numeric", live: true })}</div>
      <div class="row wrap" style="align-items:flex-start">${field("blunchAfter", "Tushlik nechanchi darsdan keyin", { mode: "numeric", live: true })}${field("blunch", "Tushlik davomiyligi (daqiqa)", { mode: "numeric", live: true })}</div>
      <button type="submit" class="btn" ${busy("bell") ? "disabled" : ""}>Saqlash</button></form></section>
    <section class="card"><h2>Ko‘rinishi</h2><div class="list">${preview.map((p) => `<div class="row between"><b>${p.period}-dars</b><span class="num">${hm(p.start)} – ${hm(p.end)}</span></div>${p.period === lunchAfter ? `<div class="row between" style="color:var(--gold-ink)"><span>${ic("food", 16)} Tushlik</span><span class="num">${hm(p.end)} – ${hm(p.end + Number(fv("blunch", 40)))}</span></div>` : ""}`).join("")}</div></section></div>`;
}
SUBMITS.bell = async () => {
  await run("bell", () => put("/settings/bell", { value: { start: fv("bstart"), lesson: fv("blesson"), break: fv("bbreak"), lunchAfter: fv("blunchAfter"), lunch: fv("blunch"), periods: fv("bperiods") } }), { ok: "Dars vaqtlari saqlandi", invalidate: ["/live", "/lessons"] });
  await loadMe(); S.ui.bellFilled = false; render();
};
function scheduleEditor() {
  const classes = S.me.classes;
  if (!classes.length) return `<section class="card">${empty("Avval sinf qo‘shing")}</section>`;
  const cls = Number(S.ui.seCls) || classes[0].id;
  const rows = data("/schedule?class_id=" + cls);
  const teachers = (data("/teachers") || []).filter((t) => t.active);
  const times = periodTimes(settings().bell);
  const head = `<div class="row wrap between"><select class="input" style="width:auto" data-f="seCls" aria-label="Sinf">${classes.map((c) => `<option value="${c.id}" ${c.id === cls ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select><span class="small muted">Katakni bosib fan va o‘qituvchini tanlang. O‘qituvchi bir vaqtda ikki sinfda bo‘la olmaydi.</span></div>`;
  if (rows === undefined) return head + pending("/schedule?class_id=" + cls);
  return `${head}<div class="table-wrap"><div class="tt">${["", 1, 2, 3, 4, 5, 6].map((d) => `<div class="small b muted" style="padding:6px">${d ? WD[d] : ""}</div>`).join("")}
    ${times.map((t) => `<div class="small muted" style="padding:6px"><b style="color:var(--ink)">${t.period}</b><br>${hm(t.start)}</div>${[1, 2, 3, 4, 5, 6].map((d) => { const r = rows.find((x) => x.weekday === d && x.period === t.period); return `<button type="button" class="cell" style="border:0;text-align:left;cursor:pointer;${r ? "background:var(--accent-soft)" : ""}" data-a="modal" data-m="sched-cell" data-v="${cls}" data-x="${d}:${t.period}">${r ? `<b>${esc(r.subject)}</b><br><span class="xs muted">${esc(r.teacher_name)}</span>` : `<span class="xs muted">+ qo‘shish</span>`}</button>`; }).join("")}`).join("")}
  </div></div>`;
}
ACTIONS["change:seCls"] = (el) => { S.ui.seCls = el.value; };
MODALS["sched-cell"] = (m) => {
  const [wd, p] = m.extra.split(":").map(Number);
  const rows = data("/schedule?class_id=" + m.id) || [];
  const r = rows.find((x) => x.weekday === wd && x.period === p);
  if (S.ui.scFilled !== m.extra + m.id) { fill({ scsub: r?.subject_id, sct: r?.teacher_id, scroom: r?.room }); S.ui.scFilled = m.extra + m.id; }
  const teachers = (data("/teachers") || []).filter((t) => t.active);
  const c = S.me.classes.find((x) => x.id === m.id);
  return `${modalHead(`${c?.name || ""} · ${WD[wd]}, ${p}-soat`)}
    <form class="stack" style="gap:12px" data-submit="sched-cell" data-v="${m.id}" data-x="${m.extra}">
      ${field("scsub", "Fan", { options: S.me.subjects.map((s) => [s.id, s.name]) })}${field("sct", "O‘qituvchi", { options: teachers.map((t) => [t.id, t.name]) })}${field("scroom", "Xona (ixtiyoriy)")}
      <div class="row wrap" style="gap:8px"><button type="submit" class="btn" ${busy("sc") ? "disabled" : ""}>Saqlash</button>${r ? `<button type="button" class="btn sec" style="color:var(--bad)" data-a="sched-clear" data-v="${m.id}" data-x="${m.extra}">Darsni olib tashlash</button>` : ""}</div></form>`;
};
SUBMITS["sched-cell"] = async (form) => {
  const [wd, p] = form.dataset.x.split(":").map(Number);
  await run("sc", () => put("/schedule", { class_id: Number(form.dataset.v), weekday: wd, period: p, subject_id: fv("scsub") || null, teacher_id: fv("sct") || null, room: fv("scroom") }), { ok: "Jadval yangilandi", invalidate: ["/schedule", "/lessons", "/teachers", "/live"] });
  S.ui.scFilled = null; closeModal();
};
ACTIONS["sched-clear"] = async (el) => {
  const [wd, p] = el.dataset.x.split(":").map(Number);
  await run("sc", () => put("/schedule", { class_id: Number(el.dataset.v), weekday: wd, period: p, subject_id: null }), { ok: "Olib tashlandi", invalidate: ["/schedule", "/lessons", "/teachers", "/live"] });
  closeModal();
};

/* ================= users: parents and staff ================= */
VIEWS["admin:people"] = {
  title: () => (role() === "owner" ? "Foydalanuvchilar" : "Ota-onalar"), roles: ["owner", "manager"],
  actions: () => `<button type="button" class="btn" data-a="modal" data-m="user-new">${ic("plus", 18)} ${role() === "owner" ? "Foydalanuvchi qo‘shish" : "Ota-ona qo‘shish"}</button>`,
  render() {
    const tab = role() === "owner" ? S.ui.uTab || "parent" : "parent";
    const path = tab === "staff" ? "/users" : "/users?role=parent";
    const list = data(path);
    const head = role() === "owner" ? seg("uTab", tab, [["parent", "Ota-onalar"], ["staff", "Xodimlar va adminlar"]]) : "";
    if (list === undefined) return head + pending(path);
    const rows = tab === "staff" ? list.filter((u) => ["owner", "manager", "accountant"].includes(u.role)) : list;
    const q = fv("uq").toLowerCase();
    const shown = rows.filter((u) => !q || u.name.toLowerCase().includes(q) || u.phone.includes(q.replace(/\s/g, "")));
    return `${head}<div class="field"><input class="input" id="uq" data-f="uq" data-live="1" placeholder="Ism yoki telefon" value="${esc(fv("uq"))}" aria-label="Qidirish"></div>
      <section class="card"><div class="list">${shown.map((u) => `<div class="row" style="${u.active ? "" : "opacity:.55"}">${ava(u, 40, "t")}<div class="col grow"><b>${esc(u.name)}</b><span class="small muted">${ROLE_L[u.role]} · ${fmtPhone(u.phone)}${u.role === "parent" ? ` · ${u.children} farzand` : ""}${u.active ? "" : " · faol emas"}</span></div><button type="button" class="btn sec sm" data-a="modal" data-m="user-edit" data-v="${u.id}" data-x="${tab}">${ic("edit", 15)}</button></div>`).join("") || empty("Topilmadi")}</div></section>
      <section class="card" style="background:var(--surface-2)"><span class="small"><b>Rollar:</b> Bosh admin — hammasi; Menejer — o‘quvchi, o‘qituvchi, ota-ona, sinflar, jadval, yangiliklar; Buxgalter — to‘lovlar, oyliklar, xarajatlar va hisobotlar; O‘qituvchi — o‘z darslari; Ota-ona — o‘z farzandi.</span></section>`;
  },
};
MODALS["user-new"] = () => {
  const roles = role() === "owner" ? [["parent", "Ota-ona"], ["manager", "Menejer"], ["accountant", "Buxgalter"], ["owner", "Bosh admin"]] : [["parent", "Ota-ona"]];
  return `${modalHead("Yangi foydalanuvchi", "O‘qituvchilarni “O‘qituvchilar” bo‘limida qo‘shing")}
    <form class="stack" style="gap:12px" data-submit="user-new">
      ${field("unrole", "Rol", { options: roles, blank: false, def: roles[0][0] })}
      <div class="row wrap" style="align-items:flex-start">${field("unname", "F.I.Sh.", { required: true })}${field("unphone", "Telefon (login)", { phone: true, required: true })}</div>
      ${field("unpos", "Lavozim / izoh", { ph: "Masalan, o‘quv ishlari bo‘yicha menejer" })}
      ${field("unpw", "Parol", { def: S.ui.genPass || (S.ui.genPass = Math.random().toString(36).slice(2, 8)), hint: "Kamida 6 belgi" })}
      <button type="submit" class="btn" ${busy("un") ? "disabled" : ""}>Qo‘shish</button></form>`;
};
SUBMITS["user-new"] = async () => {
  await run("un", () => post("/users", { role: fv("unrole", "parent"), name: fv("unname"), phone: fv("unphone"), password: fv("unpw", S.ui.genPass), profile: { position: fv("unpos") } }), { ok: "Foydalanuvchi qo‘shildi", invalidate: ["/users", "/dashboard"] });
  for (const k of ["unname", "unphone", "unpos", "unpw"]) S.f[k] = ""; S.ui.genPass = null; closeModal();
};
MODALS["user-edit"] = (m) => {
  const list = data(m.extra === "staff" ? "/users" : "/users?role=parent") || [];
  const u = list.find((x) => x.id === m.id) || {};
  if (S.ui.ueFilled !== m.id) { fill({ uename: u.name, uephone: u.phone, uepos: u.profile?.position || u.profile?.workplace || "", uepw: "" }); S.ui.ueFilled = m.id; }
  return `${modalHead(u.name || "Foydalanuvchi", ROLE_L[u.role] || "")}
    <form class="stack" style="gap:12px" data-submit="user-edit" data-v="${m.id}">
      <div class="row wrap" style="align-items:flex-start">${field("uename", "F.I.Sh.", { required: true })}${field("uephone", "Telefon (login)", { phone: true })}</div>
      ${field("uepw", "Yangi parol", { hint: "Ota-ona yoki xodim parolni unutsa, yangisini shu yerda bering" })}
      <div class="row wrap" style="gap:8px"><button type="submit" class="btn" ${busy("ue") ? "disabled" : ""}>Saqlash</button>${u.id !== user().id ? `<button type="button" class="btn sec" data-a="user-active" data-v="${u.id}" data-on="${u.active ? 0 : 1}">${u.active ? "Bloklash" : "Faollashtirish"}</button>` : ""}</div></form>`;
};
SUBMITS["user-edit"] = async (form) => {
  const body = { name: fv("uename"), phone: fv("uephone") };
  if (fv("uepw")) body.password = fv("uepw");
  await run("ue", () => patch("/users/" + form.dataset.v, body), { ok: "Saqlandi", invalidate: ["/users", "/students"] });
  S.ui.ueFilled = null; closeModal();
};

/* ================= menu ================= */
const MEAL_L = { breakfast: "Nonushta", lunch: "Tushlik", snack: "Tamaddi" };
VIEWS["admin:menu"] = {
  title: "Taomnoma", roles: ["owner", "manager"],
  render() {
    const ref = S.ui.menuRef || today();
    const mon = addDays(ref, wdOf(ref) === 0 ? -6 : 1 - wdOf(ref)), sat = addDays(mon, 5);
    const path = `/menu?from=${mon}&to=${sat}`;
    const list = data(path);
    const nav = `<div class="row" style="gap:6px"><button type="button" class="iconbtn" data-a="set" data-k="menuRef" data-v="${addDays(mon, -7)}">${ic("back", 18)}</button><b style="min-width:150px;text-align:center">${fmtDay(mon)} — ${fmtDay(sat)}</b><button type="button" class="iconbtn" data-a="set" data-k="menuRef" data-v="${addDays(mon, 7)}">${ic("chevron", 18)}</button></div>`;
    if (list === undefined) return nav + pending(path);
    const days = Array.from({ length: 6 }, (_, i) => addDays(mon, i));
    return `${nav}<div class="grid" style="--min:280px">${days.map((d) => `<section class="card" style="gap:8px"><div class="row between"><b>${WD[wdOf(d)]}, ${fmtDay(d)}</b>${d === today() ? badge("Bugun", "green") : ""}</div>
      ${Object.entries(MEAL_L).map(([k, l]) => { const m = list.find((x) => x.date === d && x.meal === k); return `<button type="button" class="doc-row" style="border:0;text-align:left;width:100%" data-a="modal" data-m="menu-edit" data-v="${d}" data-x="${k}"><span class="col grow" style="gap:0"><span class="xs muted">${l}</span><b class="small">${m ? esc(m.dish) : "—"}</b>${m?.items ? `<span class="xs muted">${esc(m.items)}</span>` : ""}</span>${ic("edit", 15)}</button>`; }).join("")}</section>`).join("")}</div>`;
  },
};
MODALS["menu-edit"] = (m) => {
  const d = m.id, meal = m.extra;
  const ref = S.ui.menuRef || today(), mon = addDays(ref, wdOf(ref) === 0 ? -6 : 1 - wdOf(ref));
  const cur = (data(`/menu?from=${mon}&to=${addDays(mon, 5)}`) || []).find((x) => x.date === d && x.meal === meal);
  if (S.ui.meFilled !== d + meal) { fill({ medish: cur?.dish, meitems: cur?.items }); S.ui.meFilled = d + meal; }
  return `${modalHead(`${MEAL_L[meal]} · ${fmtDay(d)}`)}<form class="stack" style="gap:12px" data-submit="menu-edit" data-v="${d}" data-x="${meal}">${field("medish", "Taom", { ph: "Osh" })}${field("meitems", "Tarkibi / qo‘shimcha", { ph: "Salat, kompot" })}<span class="xs muted">Taomni bo‘sh qoldirsangiz, yozuv o‘chiriladi.</span><button type="submit" class="btn" ${busy("me") ? "disabled" : ""}>Saqlash</button></form>`;
};
SUBMITS["menu-edit"] = async (form) => { await run("me", () => put("/menu", { date: form.dataset.v, meal: form.dataset.x, dish: fv("medish"), items: fv("meitems") }), { ok: "Saqlandi", invalidate: ["/menu"] }); S.ui.meFilled = null; closeModal(); };

/* ================= unlock requests ================= */
VIEWS["admin:unlocks"] = {
  title: "Tahrirlash ruxsatlari", roles: ["owner", "manager"],
  render() {
    const st = S.ui.unSt || "requested";
    const path = "/unlocks?status=" + st, list = data(path);
    const head = `${seg("unSt", st, [["requested", "Kutilmoqda"], ["approved", "Ruxsat berilgan"], ["denied", "Rad etilgan"]])}<span class="small muted">O‘qituvchi darsni faqat o‘sha kuni tahrirlay oladi. Keyin o‘zgartirish uchun shu yerda ruxsat berasiz — ruxsat shu kun oxirigacha amal qiladi.</span>`;
    if (list === undefined) return head + pending(path);
    return `${head}<section class="card"><div class="list">${list.map((u) => `<div class="row wrap"><div class="col grow"><b>${esc(u.teacher_name)}</b><span class="small muted">${esc(u.class_name)} · ${esc(u.subject)} · ${fmtDay(u.date)}, ${u.period}-soat</span><span class="small">“${esc(u.reason || "")}”</span><span class="xs muted">${fmtWhen(u.created_at)}</span></div>${u.status === "requested" ? `<button type="button" class="btn sm" data-a="unlock" data-v="${u.id}" data-ok="1">Ruxsat berish</button><button type="button" class="btn sec sm" data-a="unlock" data-v="${u.id}" data-ok="0">Rad etish</button>` : badge(u.status === "approved" ? "Ruxsat berilgan" : "Rad etilgan", u.status === "approved" ? "green" : "red")}</div>`).join("") || empty("So‘rovlar yo‘q")}</div></section>`;
  },
};
ACTIONS.unlock = async (el) => { await run("unl", () => post(`/unlocks/${el.dataset.v}/decide`, { approve: el.dataset.ok === "1" }), { ok: el.dataset.ok === "1" ? "Ruxsat berildi" : "Rad etildi", invalidate: ["/unlocks", "/dashboard"] }); };

/* ================= contracts ================= */
const CST = { pending: ["Imzolanmagan", "orange"], signed: ["Imzolangan", "green"], ended: ["Tugagan", ""] };
VIEWS["admin:contracts"] = {
  title: "Shartnomalar",
  actions: () => `<button type="button" class="btn" data-a="modal" data-m="contract-new">${ic("plus", 18)} Yangi shartnoma</button>`,
  render() {
    const list = data("/contracts");
    if (list === undefined) return pending("/contracts");
    return `<section class="card"><span class="small muted">Shartnomaga ota-ona pasporti, metrika va attestat o‘quvchi sahifasidagi “Hujjatlar” bo‘limida yuklanadi.</span>
      <div class="list">${list.map((c) => `<div class="row wrap"><div class="col grow"><b>${esc(c.student_name)} <span class="muted small">${esc(c.class_name || "")}</span></b><span class="small muted">${esc(c.number)} · ${esc(c.parent_name || "")} · ${fmtDay(c.created_at)} · ${fmtSum(c.monthly)}</span></div>${badge(`Hujjat ${c.docs}/3`, c.docs >= 3 ? "green" : c.docs ? "gold" : "")}${badge(CST[c.status][0], CST[c.status][1])}
        <select class="input" style="width:auto;min-height:38px" data-f="cst${c.id}" aria-label="Holat">${Object.entries(CST).map(([k, v]) => `<option value="${k}" ${k === c.status ? "selected" : ""}>${v[0]}</option>`).join("")}</select>
        <button type="button" class="btn sec sm" data-a="contract-view" data-v="${c.id}">Matn</button><button type="button" class="btn ghost sm" data-a="go" data-r="student-${c.student_id}">O‘quvchi</button></div>`).join("") || empty("Shartnomalar yo‘q")}</div></section>`;
  },
};
document.addEventListener("change", async (e) => {
  const f = e.target?.dataset?.f || "";
  if (/^cst\d+$/.test(f)) await run("cst", () => patch("/contracts/" + f.slice(3), { status: e.target.value }), { ok: "Holat yangilandi", invalidate: ["/contracts", "/dashboard"] });
});
MODALS["contract-new"] = () => `${modalHead("Yangi shartnoma")}<form class="stack" style="gap:12px" data-submit="contract-new">
  ${field("ctst", "O‘quvchi", { options: (data("/students") || []).map((s) => [s.id, `${sName(s)} · ${s.class_name || ""}`]) })}
  ${field("ctpar", "Ota-ona F.I.Sh. (bo‘sh qoldirsangiz, hisobdagi ism olinadi)")}${field("ctfee", "Oylik to‘lov (bo‘sh — o‘quvchi kartasidagi summa)", { mode: "numeric" })}
  <button type="submit" class="btn" ${busy("ct") ? "disabled" : ""}>Yaratish</button></form>`;
SUBMITS["contract-new"] = async () => { await run("ct", () => post("/contracts", { student_id: fv("ctst"), parent_name: fv("ctpar"), monthly: fv("ctfee") }), { ok: "Shartnoma yaratildi", invalidate: ["/contracts", "/students/"] }); closeModal(); };
ACTIONS["contract-view"] = (el) => openModal({ type: "contract-text", id: Number(el.dataset.v) });
MODALS["contract-text"] = (m) => {
  const c = (data("/contracts") || []).find((x) => x.id === m.id); if (!c) return "";
  const sch = settings().school || {};
  const text = `TA’LIM XIZMATLARI SHARTNOMASI № ${c.number}\n${fmtDate(c.created_at)}\n\n${sch.name || "Steam Plaza"} (keyingi o‘rinlarda “Maktab”) bir tomondan, va ${c.parent_name} (keyingi o‘rinlarda “Ota-ona”) ikkinchi tomondan, quyidagilar haqida ushbu shartnomani tuzdilar:\n\n1. Shartnoma predmeti. Maktab ${c.student_name} (${c.class_name || ""} sinf) ga umumiy o‘rta ta’lim xizmatlarini ko‘rsatadi.\n\n2. To‘lov. Oylik to‘lov miqdori ${fmtSum(c.monthly)}. To‘lov har oyning 15-sanasigacha amalga oshiriladi.\n\n3. Tomonlarning majburiyatlari. Maktab dars jadvali, baholar, davomat va to‘lovlar haqidagi ma’lumotni platforma orqali taqdim etadi. Ota-ona to‘lovlarni o‘z vaqtida amalga oshiradi.\n\n4. Muddat. Shartnoma imzolangan kundan boshlab joriy o‘quv yili oxirigacha amal qiladi.\n\nMaktab: ____________          Ota-ona: ${c.parent_name} ____________`;
  S.ui.contractText = text;
  return `${modalHead(c.number, esc(c.student_name))}<div class="contract-text">${esc(text)}</div><button type="button" class="btn sec" data-a="copy-contract">Matnni nusxalash</button>`;
};
ACTIONS["copy-contract"] = async () => { try { await navigator.clipboard.writeText(S.ui.contractText || ""); toast("Nusxalandi"); } catch { toast("Nusxalab bo‘lmadi"); } };

/* ================= debts ================= */
VIEWS["admin:debts"] = {
  title: "Qarzdorlar",
  render() {
    const list = data("/finance/debts");
    if (list === undefined) return pending("/finance/debts");
    const total = list.reduce((a, x) => a + x.debt, 0);
    return `<div class="row wrap" style="gap:12px"><div class="stat" style="background:var(--bad-soft)"><span class="small muted">Umumiy qarz</span><span class="v" style="color:var(--bad)">${fmtSum(total)}</span></div><div class="stat" style="background:var(--surface-2)"><span class="small muted">Qarzdor o‘quvchilar</span><span class="v">${list.length}</span></div></div>
      <section class="card"><span class="xs muted">Qarz = oylik to‘lov × qabul qilingan oydan joriy oygacha bo‘lgan oylar − to‘langan summa</span><div class="list">${list.map((x) => `<button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left" data-a="go" data-r="student-${x.id}"><div class="col grow"><b>${esc(x.last_name + " " + x.first_name)} <span class="small muted">${esc(x.class_name || "")}</span></b><span class="small muted">${esc(x.parent_name || "")} · ${fmtPhone(x.parent_phone)} · oxirgi to‘lov: ${x.last_month ? fmtMonth(x.last_month) : "yo‘q"}</span></div><div class="col" style="align-items:flex-end;gap:0"><b class="neg">${fmtNum(x.debt)}</b><span class="xs muted">${x.monthsOwed} oy</span></div></button>`).join("") || empty("Qarzdorlar yo‘q")}</div></section>`;
  },
};

/* ================= ledger ================= */
VIEWS["admin:ledger"] = {
  title: "Kirim-chiqim", roles: FINANCE,
  render() {
    const tab = S.ui.lgTab || "pay";
    const month = S.ui.lgMonth || curMonth();
    const L = data("/finance/ledger?month=" + month);
    const months = Array.from({ length: 12 }, (_, i) => monthShift(curMonth(), -i));
    const top = `${seg("lgTab", tab, [["pay", "O‘quvchi to‘lovi"], ["salary", "O‘qituvchi oyligi"], ["expense", "Xarajat"], ["bank", "Bank to‘lovi"]])}`;
    const form = tab === "pay" ? payForm() : tab === "salary" ? salaryForm() : tab === "expense" ? expenseForm() : bankForm();
    let list = "";
    if (L === undefined) list = pending("/finance/ledger?month=" + month);
    else {
      const items = [
        ...L.payments.map((p) => ({ k: "payments", id: p.id, at: p.paid_at, in: true, title: `${p.student_name} · ${fmtMonth(p.month)}`, sub: `O‘quvchi to‘lovi · ${p.method || ""}${p.note ? " · " + p.note : ""}`, amount: p.amount, receipt: p.receipt })),
        ...L.salaries.map((x) => ({ k: "salaries", id: x.id, at: x.paid_at, in: false, title: `${x.teacher_name} · ${fmtMonth(x.month)}`, sub: "O‘qituvchi oyligi", amount: x.amount, receipt: x.receipt })),
        ...L.expenses.map((e) => ({ k: "expenses", id: e.id, at: e.created_at, in: false, bank: e.source === "bank", title: e.note, sub: `${e.category}${e.recipient ? " · " + e.recipient : ""}${e.source === "bank" ? " · bank orqali" + (e.doc_no ? " №" + e.doc_no : "") : ""}`, amount: e.amount, receipt: e.receipt })),
      ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
      const inc = items.filter((i) => i.in).reduce((a, i) => a + i.amount, 0), out = items.filter((i) => !i.in).reduce((a, i) => a + i.amount, 0);
      list = `<section class="card"><div class="card-head"><select class="input" style="width:auto" data-f="lgMonth" aria-label="Oy">${months.map((m) => `<option value="${m}" ${m === month ? "selected" : ""}>${fmtMonth(m)}</option>`).join("")}</select><span class="small"><b class="pos">+${fmtNum(inc)}</b> · <b class="neg">−${fmtNum(out)}</b></span></div>
        <div class="list">${items.map((i) => `<div class="row">${i.bank ? `<span class="avatar" style="background:var(--info-soft);color:var(--info)">${ic("bank", 17)}</span>` : ""}<div class="col grow" style="min-width:160px"><b class="small">${esc(i.title)}</b><span class="xs muted">${esc(i.sub)} · ${fmtDay(i.at)}</span></div>${i.receipt ? `<button type="button" class="btn ghost sm" data-a="file-open" data-v="${i.receipt.id}">${ic("receipt", 15)} Chek</button>` : `<button type="button" class="linkbtn xs" data-a="add-receipt" data-k="${i.k}" data-v="${i.id}">+ chek</button>`}<b class="num ${i.in ? "pos" : "neg"}">${i.in ? "+" : "−"}${fmtNum(i.amount)}</b>${role() === "owner" ? `<button type="button" class="iconbtn" style="width:32px;height:32px;border:0" data-a="fin-del" data-k="${i.k}" data-v="${i.id}" aria-label="O‘chirish">${ic("trash", 14)}</button>` : ""}</div>`).join("") || empty("Bu oyda yozuvlar yo‘q")}</div></section>`;
    }
    return `${top}<section class="card">${form}</section>${list}`;
  },
};
ACTIONS["change:lgMonth"] = (el) => { S.ui.lgMonth = el.value; };
ACTIONS["set:lgTab"] = () => { S.files["priv:rc"] = []; };
const monthOpts = () => Array.from({ length: 4 }, (_, i) => monthShift(curMonth(), 1 - i)).map((m) => [m, fmtMonth(m)]);
function payForm() {
  const students = data("/students") || [];
  return `<form class="stack" style="gap:12px" data-submit="pay">
    ${field("pyst", "O‘quvchi", { options: students.map((s) => [s.id, `${sName(s)} · ${s.class_name || ""} · ${fmtNum(s.monthly_fee)}`]) })}
    <div class="row wrap" style="align-items:flex-start">${field("pymonth", "Qaysi oy uchun", { options: monthOpts(), blank: false, def: curMonth() })}${field("pyamt", "Summa (so‘m)", { mode: "numeric", def: String(students.find((s) => String(s.id) === fv("pyst"))?.monthly_fee || "") })}${field("pymethod", "Usul", { options: ["Naqd", "Click", "Payme", "Uzum", "Bank o‘tkazmasi"].map((x) => [x, x]), blank: false })}</div>
    ${field("pynote", "Izoh (ixtiyoriy)")}${fileBox("priv:rc", { label: "Chek biriktirish", multiple: false, hint: "Rasm yoki PDF, ixtiyoriy" })}
    <button type="submit" class="btn" style="align-self:flex-start" ${busy("pay") ? "disabled" : ""}>To‘lovni kiritish</button></form>`;
}
SUBMITS.pay = async () => {
  const st = (data("/students") || []).find((s) => String(s.id) === fv("pyst"));
  await run("pay", () => post("/payments", { student_id: fv("pyst"), month: fv("pymonth", curMonth()), amount: fv("pyamt") || st?.monthly_fee, method: fv("pymethod", "Naqd"), note: fv("pynote"), receipt: (S.files["priv:rc"] || [])[0] || null }), { ok: "To‘lov kiritildi", invalidate: ["/finance", "/dashboard", "/reports", "/students/"] });
  S.f.pyamt = S.f.pynote = ""; S.files["priv:rc"] = []; render();
};
function salaryForm() {
  const teachers = (data("/teachers") || []).filter((t) => t.active);
  const t = teachers.find((x) => String(x.id) === fv("sltid"));
  return `<form class="stack" style="gap:12px" data-submit="salary">
    <div class="row wrap" style="align-items:flex-start">${field("sltid", "O‘qituvchi", { options: teachers.map((x) => [x.id, x.name]) })}${field("slmonth", "Qaysi oy uchun", { options: monthOpts(), blank: false, def: monthShift(curMonth(), -1) })}${field("slamt", "Summa (so‘m)", { mode: "numeric", def: t?.profile?.salary ? String(t.profile.salary) : "" })}</div>
    ${field("slnote", "Izoh (ixtiyoriy)", { ph: "Masalan, avans yoki mukofot" })}${fileBox("priv:rc", { label: "Chek / vedomost biriktirish", multiple: false, hint: "Ixtiyoriy" })}
    <button type="submit" class="btn" style="align-self:flex-start" ${busy("sal") ? "disabled" : ""}>Oylikni kiritish</button></form>`;
}
SUBMITS.salary = async () => {
  const t = (data("/teachers") || []).find((x) => String(x.id) === fv("sltid"));
  await run("sal", () => post("/salaries", { teacher_id: fv("sltid"), month: fv("slmonth", monthShift(curMonth(), -1)), amount: fv("slamt") || t?.profile?.salary, note: fv("slnote"), receipt: (S.files["priv:rc"] || [])[0] || null }), { ok: "Oylik kiritildi", invalidate: ["/finance", "/dashboard", "/reports", "/teachers/"] });
  S.f.slamt = S.f.slnote = ""; S.files["priv:rc"] = []; render();
};
function expenseForm() {
  const cats = settings().expenseCategories || [];
  return `<form class="stack" style="gap:12px" data-submit="expense">
    <div class="row wrap" style="align-items:flex-start">${field("excat", "Xarajat turi", { options: cats.map((c) => [c, c]), blank: false, def: cats[0] })}${field("exmonth", "Qaysi oy xarajati", { options: monthOpts(), blank: false, def: curMonth() })}${field("examt", "Summa (so‘m)", { mode: "numeric" })}</div>
    ${field("exnote", "Tavsif — nima uchun sarflandi", { area: true, required: true, ph: "Masalan, 5-A sinf uchun proyektor va kabel" })}${field("exrec", "Kimga / qayerga to‘landi (ixtiyoriy)")}
    ${fileBox("priv:rc", { label: "Chek biriktirish", multiple: false, hint: "Rasm yoki PDF, ixtiyoriy" })}
    <button type="submit" class="btn" style="align-self:flex-start" ${busy("exp") ? "disabled" : ""}>Xarajatni kiritish</button></form>`;
}
SUBMITS.expense = async () => {
  await run("exp", () => post("/expenses", { category: fv("excat", (settings().expenseCategories || [])[0]), month: fv("exmonth", curMonth()), amount: fv("examt"), note: fv("exnote"), recipient: fv("exrec"), source: "cash", receipt: (S.files["priv:rc"] || [])[0] || null }), { ok: "Xarajat kiritildi", invalidate: ["/finance", "/dashboard", "/reports"] });
  S.f.examt = S.f.exnote = S.f.exrec = ""; S.files["priv:rc"] = []; render();
};
function bankForm() {
  const bk = S.ui.bank;
  const cats = settings().expenseCategories || [];
  const A = bk?.auto || {}, tag = (k) => (A[k] ? ' <span class="autotag">avtomatik</span>' : "");
  return `<div class="col" style="gap:4px"><b style="font-size:16px">Hisob raqamidan chiqim</b><span class="small muted">Bank to‘lov topshiriqnomasini (PDF yoki rasm) yuklang — tizim summani, to‘lov maqsadini, oluvchini va sanani o‘qib, xarajat turini taklif qiladi. Tekshirib saqlaysiz. Hujjat bo‘lmasa, qo‘lda kiriting.</span></div>
    <div class="row wrap" style="gap:8px"><button type="button" class="btn" data-a="bank-up" ${bk?.status === "reading" ? "disabled" : ""}>${ic("upload", 18)} To‘lov topshiriqnomasini yuklash</button><button type="button" class="btn sec" data-a="bank-manual">Qo‘lda kiritish</button></div>
    ${!bk ? "" : bk.status === "reading" ? `<div class="doc-row"><span class="spin"></span><b>Hujjat o‘qilmoqda…</b></div>` : `<form class="stack" style="gap:12px;border-top:1px solid var(--line);padding-top:12px" data-submit="bank-save">
      ${badge(bk.how === "ai" ? "Hujjat avtomatik o‘qildi — maydonlarni tekshiring" : bk.how === "text" ? "PDF matnidan o‘qildi — maydonlarni tekshiring" : bk.how === "manual" ? "Qo‘lda kiritish" : "Avtomatik o‘qib bo‘lmadi — qo‘lda to‘ldiring", bk.how === "fail" ? "orange" : "green")}
      ${bk.file ? fileLinks([bk.file], { priv: true }) : ""}
      <div class="row wrap" style="align-items:flex-start"><div class="field"><label for="bamt">Summa (so‘m)${tag("amount")}</label><input class="input" id="bamt" data-f="bamt" inputmode="numeric" value="${esc(fv("bamt"))}"></div><div class="field"><label for="bdate">Sana${tag("date")}</label><input class="input" id="bdate" data-f="bdate" type="date" value="${esc(fv("bdate", today()))}"></div><div class="field"><label for="bno">Hujjat raqami${tag("number")}</label><input class="input" id="bno" data-f="bno" value="${esc(fv("bno"))}"></div></div>
      <div class="field"><label for="bpurpose">To‘lov maqsadi — nima uchun${tag("purpose")}</label><textarea class="input" id="bpurpose" data-f="bpurpose" rows="2">${esc(fv("bpurpose"))}</textarea></div>
      <div class="field"><label for="brec">Oluvchi${tag("recipient")}</label><input class="input" id="brec" data-f="brec" value="${esc(fv("brec"))}"></div>
      <div class="row wrap" style="align-items:flex-start">${field("bcat", "Xarajat turi", { options: cats.map((c) => [c, c]), blank: false })}${field("bmonth", "Qaysi oy xarajati", { options: monthOpts(), blank: false, def: curMonth() })}</div>
      <div class="row wrap" style="gap:8px"><button type="submit" class="btn" ${busy("bank") ? "disabled" : ""}>${ic("check", 18)} Chiqimga qo‘shish</button><button type="button" class="btn ghost" data-a="bank-cancel">Bekor qilish</button></div></form>`}`;
}
ACTIONS["bank-manual"] = () => { S.ui.bank = { status: "ready", how: "manual", auto: {} }; fill({ bamt: "", bpurpose: "", brec: "", bno: "", bdate: today() }); render(); };
ACTIONS["bank-cancel"] = () => { S.ui.bank = null; render(); };
ACTIONS["bank-up"] = async () => {
  const [file] = await pickAndUpload("priv:bank", { accept: "image/*,.pdf" });
  S.files["priv:bank"] = [];
  if (!file) return;
  S.ui.bank = { status: "reading", file }; render();
  let f = null, how = "fail";
  try { const res = await post("/finance/extract", { file_id: file.id }); if (res.fields) { f = res.fields; how = "ai"; } } catch {}
  const amount = Math.round(Number(String(f?.amount ?? "").replace(/[^\d.]/g, ""))) || "";
  fill({ bamt: amount, bpurpose: f?.purpose || "", brec: f?.recipient || "", bno: f?.number || "", bdate: /^\d{4}-\d{2}-\d{2}$/.test(f?.date || "") ? f.date : today(), bcat: (settings().expenseCategories || []).includes(f?.category) ? f.category : guessCategory((f?.purpose || "") + " " + (f?.recipient || "")) });
  S.ui.bank = { status: "ready", file, how, auto: { amount: !!amount, purpose: !!f?.purpose, recipient: !!f?.recipient, number: !!f?.number, date: !!f?.date } };
  render();
};
function guessCategory(text) {
  const cats = settings().expenseCategories || [], x = String(text || "").toLowerCase();
  const find = (re) => cats.find((c) => re.test(c.toLowerCase()));
  if (/soliq|налог|inps|инпс|пенсион|komissiya|комисс|bank xizmat|банковск/.test(x)) return find(/soliq|bank/) || cats[cats.length - 1];
  if (/ijara|аренд|kommunal|коммунал|elektr|электр|газ|gaz|вод|issiq|тепл/.test(x)) return find(/ijara|kommunal/) || cats[0];
  if (/oziq|ovqat|продукт|питани|мяс|хлеб|молок/.test(x)) return find(/oziq/) || cats[0];
  if (/kitob|книг|jihoz|оборуд|kompyuter|компьют|канцел|mebel|мебел|учеб/.test(x)) return find(/jihoz/) || cats[0];
  return find(/boshqa|ta.mir/) || cats[cats.length - 1];
}
SUBMITS["bank-save"] = async () => {
  const bk = S.ui.bank || {};
  await run("bank", () => post("/expenses", { amount: fv("bamt"), note: fv("bpurpose"), recipient: fv("brec"), doc_no: fv("bno"), doc_date: fv("bdate"), category: fv("bcat", (settings().expenseCategories || [])[0]), month: fv("bmonth", curMonth()), source: "bank", receipt: bk.file || null }), { ok: "Bank chiqimi xarajatlarga qo‘shildi", invalidate: ["/finance", "/dashboard", "/reports"] });
  S.ui.bank = null; render();
};
ACTIONS["add-receipt"] = async (el) => {
  const [f] = await pickAndUpload("priv:late", { accept: "image/*,.pdf" });
  S.files["priv:late"] = [];
  if (f) await run("rcpt", () => patch(`/finance/${el.dataset.k}/${el.dataset.v}`, { receipt: f }), { ok: "Chek qo‘shildi", invalidate: ["/finance"] });
};
ACTIONS["fin-del"] = async (el) => { if (!confirmTwice("fd" + el.dataset.k + el.dataset.v)) return; await run("fdel", () => del(`/finance/${el.dataset.k}/${el.dataset.v}`), { ok: "O‘chirildi", invalidate: ["/finance", "/dashboard", "/reports"] }); };

/* ================= reports ================= */
const CAT_COL = ["var(--gold)", "var(--info)", "#8E5BD0", "#C9643B", "#5E8C7A", "#9C4A2A", "#2C7A53"];
const niceStep = (max) => { const raw = max / 5, p = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) || p * 10; };
function chartMoney(list) {
  const W = 760, H = 270, L = 58, R = 12, T = 16, B = 34;
  const max = Math.max(1, ...list.map((m) => Math.max(m.income, m.out))), minP = Math.min(0, ...list.map((m) => m.profit));
  const step = niceStep(max - minP), top = Math.ceil(max / step) * step, bot = minP < 0 ? -Math.ceil(-minP / step) * step : 0;
  const y = (v) => T + ((top - v) / (top - bot || 1)) * (H - T - B), gw = (W - L - R) / list.length, bw = Math.min(16, gw * 0.3);
  let g = "";
  for (let v = bot; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${(v / 1e6).toFixed(step < 1e6 ? 1 : 0)}</text>`;
  g += `<text x="${L - 8}" y="10" text-anchor="end" font-size="10" style="fill:var(--muted)">mln</text>`;
  const pts = [];
  list.forEach((m, i) => {
    const cx = L + gw * i + gw / 2;
    g += `<rect x="${cx - bw - 1}" y="${y(Math.max(0, m.income))}" width="${bw}" height="${Math.max(0, y(0) - y(m.income))}" rx="3" style="fill:var(--accent)"><title>${fmtMonth(m.month)} kirim: ${fmtSum(m.income)}</title></rect>`;
    g += `<rect x="${cx + 1}" y="${y(Math.max(0, m.out))}" width="${bw}" height="${Math.max(0, y(0) - y(m.out))}" rx="3" style="fill:var(--gold)"><title>${fmtMonth(m.month)} chiqim: ${fmtSum(m.out)}</title></rect>`;
    g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${MONTHS_S[Number(m.month.slice(5)) - 1]}</text>`;
    pts.push([cx, y(m.profit), m]);
  });
  g += `<polyline points="${pts.map((p) => p[0] + "," + p[1]).join(" ")}" fill="none" style="stroke:var(--info)" stroke-width="2"/>`;
  pts.forEach((p) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:var(--surface);stroke:var(--info)" stroke-width="2"><title>${fmtMonth(p[2].month)} foyda: ${fmtSum(p[2].profit)}</title></circle>`; });
  return `<div class="legend"><span><i style="background:var(--accent)"></i>Kirim</span><span><i style="background:var(--gold)"></i>Chiqim</span><span><i style="background:var(--info);height:3px"></i>Sof foyda</span></div><div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kirim, chiqim va foyda">${g}</svg></div>`;
}
function chartStack(list, cats) {
  const keys = [["O‘qituvchilar oyligi", (m) => m.salaries, "var(--accent)"], ...cats.map((c, i) => [c, (m) => m.byCat[c] || 0, CAT_COL[i % CAT_COL.length]])];
  const W = 760, H = 250, L = 58, R = 12, T = 14, B = 34;
  const max = Math.max(1, ...list.map((m) => m.out)), step = niceStep(max), top = Math.ceil(max / step) * step;
  const y = (v) => T + ((top - v) / top) * (H - T - B), gw = (W - L - R) / list.length, bw = Math.min(34, gw * 0.6);
  let g = "";
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${(v / 1e6).toFixed(step < 1e6 ? 1 : 0)}</text>`;
  list.forEach((m, i) => { const cx = L + gw * i + gw / 2; let acc = 0; keys.forEach(([n, f, col]) => { const v = f(m); if (!v) return; g += `<rect x="${cx - bw / 2}" y="${y(acc + v)}" width="${bw}" height="${Math.max(0, y(acc) - y(acc + v) - 1)}" style="fill:${col}"><title>${fmtMonth(m.month)} · ${n}: ${fmtSum(v)}</title></rect>`; acc += v; }); g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${MONTHS_S[Number(m.month.slice(5)) - 1]}</text>`; });
  return `<div class="legend">${keys.map(([n, , c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join("")}</div><div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chiqimlar tarkibi">${g}</svg></div>`;
}
function dchg(a, b, dir = 1, money = true, compact = false) {
  const d = b - a;
  if (!d) return `<span class="dl zero">=</span>`;
  const pct = a ? Math.round((d / Math.abs(a)) * 1000) / 10 : null;
  const cls = d * dir > 0 ? "pos" : "neg", arrow = d > 0 ? "▲" : "▼";
  if (compact && pct !== null) return `<span class="dl ${cls}" title="${fmtNum(d)}">${arrow} ${d > 0 ? "+" : "−"}${String(Math.abs(pct)).replace(".", ",")}%</span>`;
  return `<span class="dl ${cls}">${arrow} ${money ? fmtNum(Math.abs(d)) : Math.abs(d)}${pct !== null ? ` (${d > 0 ? "+" : "−"}${String(Math.abs(pct)).replace(".", ",")}%)` : ""}</span>`;
}
VIEWS["admin:reports"] = {
  title: "Hisobotlar", roles: FINANCE,
  actions: () => `<div class="row wrap" style="gap:8px">${pdfBtn(`/pdf/report?month=${S.ui.rpA2 || monthShift(curMonth(), -1)}`, `hisobot_${S.ui.rpA2 || monthShift(curMonth(), -1)}.pdf`, "Oylik PDF")}${pdfBtn(`/pdf/report?year=${today().slice(0, 4)}`, `yillik_${today().slice(0, 4)}.pdf`, "Yillik PDF")}</div>`,
  render() {
    const n = Number(S.ui.rpN || 6);
    const R = data("/reports/months");
    if (R === undefined) return pending("/reports/months");
    const all = R.months, done = all.slice(0, -1), sel = all.slice(-n);
    const A = done.some((m) => m.month === S.ui.rpA) ? S.ui.rpA : done[done.length - 2]?.month, Bm = done.some((m) => m.month === S.ui.rpB) ? S.ui.rpB : done[done.length - 1]?.month;
    S.ui.rpA2 = Bm;
    const a = all.find((m) => m.month === A), b = all.find((m) => m.month === Bm);
    const opt = (v) => done.slice().reverse().map((m) => `<option value="${m.month}" ${m.month === v ? "selected" : ""}>${fmtMonth(m.month)}</option>`).join("");
    const rows = a && b ? [["O‘quvchilar", (m) => m.students, 1, false], ["Kirim", (m) => m.income, 1, true, "total"], ["O‘qituvchilar oyligi", (m) => m.salaries, -1, true], ...R.categories.map((c) => [c, (m) => m.byCat[c] || 0, -1, true, "sub"]), ["Jami chiqim", (m) => m.out, -1, true, "total"], ["Sof foyda", (m) => m.profit, 1, true, "total"]] : [];
    const word = (x, y) => (x === y ? "o‘zgarmadi" : `${x ? Math.abs(Math.round(((y - x) / Math.abs(x)) * 100)) + "% " : ""}${y > x ? "oshdi" : "kamaydi"}`);
    return `<section class="card"><div class="card-head" style="flex-wrap:wrap"><h2>Kirim, chiqim va foyda</h2>${seg("rpN", String(n), [["3", "3 oy"], ["6", "6 oy"], ["12", "1 yil"]])}</div>${chartMoney(sel)}</section>
      ${a && b ? `<section class="card"><div class="card-head" style="flex-wrap:wrap;gap:8px"><h2>Ikki oyni solishtirish</h2><div class="row" style="gap:6px"><select class="input" style="width:auto" data-f="rpA">${opt(A)}</select><span class="muted">→</span><select class="input" style="width:auto" data-f="rpB">${opt(Bm)}</select></div></div>
        <div class="doc-row" style="background:var(--accent-soft)">${ic("chart", 18)}<span class="small"><b>${fmtMonth(Bm)}</b> — <b>${fmtMonth(A)}</b>ga nisbatan: kirim ${word(a.income, b.income)}, chiqim ${word(a.out, b.out)}, sof foyda ${b.profit === a.profit ? "o‘zgarmadi" : `${fmtMln(Math.abs(b.profit - a.profit))} so‘mga ${b.profit > a.profit ? "oshdi" : "kamaydi"}`}.</span></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>${fmtMonth(A)}</th><th>${fmtMonth(Bm)}</th><th>O‘zgarish</th></tr></thead><tbody>${rows.map(([l, f, dir, money, cls]) => `<tr class="${cls || ""}"><td>${esc(l)}</td><td>${money ? fmtNum(f(a)) : f(a)}</td><td>${money ? fmtNum(f(b)) : f(b)}</td><td>${dchg(f(a), f(b), dir, money)}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
      <section class="card">${cardHead("Oyma-oy tahlil: o‘tgan oyga nisbatan")}<span class="xs muted">▲ o‘sish, ▼ kamayish. Yashil — yaxshi tomonga, qizil — aksincha.</span>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Oy</th><th>O‘quvchi</th><th>Kirim</th><th></th><th>Chiqim</th><th></th><th>Foyda</th><th></th></tr></thead><tbody>${sel.slice().reverse().map((m) => { const p = all[all.indexOf(m) - 1]; return `<tr><td>${fmtMonth(m.month)}${m === all[all.length - 1] ? ' <span class="xs muted">(joriy)</span>' : ""}</td><td>${m.students}</td><td>${fmtNum(m.income)}</td><td>${p ? dchg(p.income, m.income, 1, true, true) : ""}</td><td>${fmtNum(m.out)}</td><td>${p ? dchg(p.out, m.out, -1, true, true) : ""}</td><td class="${m.profit < 0 ? "neg" : ""}">${fmtNum(m.profit)}</td><td>${p ? dchg(p.profit, m.profit, 1, true, true) : ""}</td></tr>`; }).join("")}</tbody></table></div></section>
      <section class="card">${cardHead("Chiqimlar tarkibi, mln so‘m")}${chartStack(sel, R.categories)}</section>`;
  },
};
for (const k of ["rpA", "rpB"]) ACTIONS["change:" + k] = (el) => { S.ui[k] = el.value; };

/* ================= settings ================= */
VIEWS["admin:settings"] = {
  title: "Sozlamalar", roles: ["owner", "manager"],
  render() {
    const st = settings();
    if (!S.ui.setFilled) { fill({ ssname: st.school?.name, sssub: st.school?.subtitle, ssphone: st.school?.phone, ssaddr: st.school?.address, sscats: (st.expenseCategories || []).join("\n"), ssw: st.teacherRating?.starsWeight, sstarget: st.teacherRating?.openLessonTarget }); S.ui.setFilled = true; }
    return `<div class="grid" style="--min:340px">
      <section class="card"><h2>Maktab ma’lumotlari</h2><span class="xs muted">PDF hisobotlar va sahifa sarlavhasida ko‘rinadi</span>
        <form class="stack" style="gap:12px" data-submit="set-school">${field("ssname", "Nomi")}${field("sssub", "Qisqa tavsif")}${field("ssphone", "Telefon")}${field("ssaddr", "Manzil")}<button type="submit" class="btn" ${busy("ss") ? "disabled" : ""}>Saqlash</button></form></section>
      <section class="card"><h2>Dars vaqtlari</h2><span class="small muted">Dars va tanaffus davomiyligi, tushlik vaqti</span>${linkTo("Sinflar va jadval → Qo‘ng‘iroq vaqtlari", "classes")}</section>
      <section class="card"><h2>O‘qituvchilar reytingi</h2>
        <form class="stack" style="gap:12px" data-submit="set-rating">${field("ssw", "Ota-onalar bahosining ulushi (%)", { mode: "numeric", hint: "Qolgan qismi — ochiq darslar soni" })}${field("sstarget", "Oyiga nechta ochiq dars to‘liq ball beradi", { mode: "numeric" })}<button type="submit" class="btn" ${busy("sr") ? "disabled" : ""}>Saqlash</button></form></section>
      ${role() === "owner" ? `<section class="card"><h2>Xarajat turlari</h2><form class="stack" style="gap:12px" data-submit="set-cats">${field("sscats", "Har bir qatorda bitta tur", { area: true, rows: 6 })}<button type="submit" class="btn" ${busy("sc2") ? "disabled" : ""}>Saqlash</button></form></section>
      <section class="card" style="border-color:var(--gold)"><h2>Demo ma’lumotlar</h2><span class="small muted">Sinab ko‘rish uchun 4 sinf, 8 o‘qituvchi, 48 o‘quvchi, 3 haftalik darslar va to‘lovlar yuklanadi. Barcha demo hisoblar paroli: <b>demo1234</b> (o‘qituvchi: +998 90 700 10 01 — oyning eng yaxshi o‘qituvchisi; ota-ona: +998 91 500 00 00 — farzandi sinfda 1-o‘rinda; menejer: +998 90 700 00 01; buxgalter: +998 90 700 00 02). Haqiqiy ishga tushirishdan oldin o‘chirib tashlang.</span>
        <div class="row wrap" style="gap:8px"><button type="button" class="btn" data-a="demo" data-v="load" ${busy("demo") ? "disabled" : ""}>Demo ma’lumotlarni yuklash</button><button type="button" class="btn sec" style="color:var(--bad)" data-a="demo" data-v="clear" ${busy("demo") ? "disabled" : ""}>Demo ma’lumotlarni o‘chirish</button></div></section>` : ""}
    </div>`;
  },
};
SUBMITS["set-school"] = async () => { await run("ss", () => put("/settings/school", { value: { name: fv("ssname"), subtitle: fv("sssub"), phone: fv("ssphone"), address: fv("ssaddr") } }), { ok: "Saqlandi" }); await loadMe(); render(); };
SUBMITS["set-rating"] = async () => { await run("sr", () => put("/settings/teacherRating", { value: { starsWeight: fv("ssw"), openLessonTarget: fv("sstarget") } }), { ok: "Saqlandi", invalidate: ["/ratings", "/dashboard"] }); await loadMe(); render(); };
SUBMITS["set-cats"] = async () => { await run("sc2", () => put("/settings/expenseCategories", { value: fv("sscats").split("\n").map((x) => x.trim()).filter(Boolean) }), { ok: "Saqlandi", invalidate: ["/reports"] }); await loadMe(); render(); };
ACTIONS.demo = async (el) => {
  if (!confirmTwice("demo" + el.dataset.v)) return;
  await run("demo", () => post("/admin/demo", { action: el.dataset.v }), { ok: el.dataset.v === "load" ? "Demo ma’lumotlar yuklandi" : "Demo ma’lumotlar o‘chirildi", invalidate: ["/"] });
  await loadMe(); render();
};
export { postCard };
