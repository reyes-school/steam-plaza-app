// Branches (filiallar): bosh admin's overall → branch → school/kindergarten dashboard, accountant's own-branch panel,
// branch management, audit log, absence notices (parents → teachers and administration), substitute teachers.
import {
  S, VIEWS, ACTIONS, SUBMITS, MODALS, NAV, render, go, post, patch, put, del, run, busy, data, pending, invalidate, toast, openModal, closeModal, modalHead,
  esc, ic, badge, cardHead, empty, field, fv, fill, ava, linkTo, tile, greeting, fmtDay, fmtDate, fmtWhen, fmtMonth, fmtNum, fmtSum, fmtMln, fmtPhone, sName,
  today, curMonth, addDays, monthShift, ROLE_L, STAFF, FINANCE, SECTION_L, branches, branchName, myScope, fq, scopeBar, user, role, loadMe, settings, periodTimes, hm,
} from "./core.js";

/* ================= overview (bosh admin and general manager) ================= */
const monthsBack = (n) => Array.from({ length: n }, (_, i) => monthShift(curMonth(), -i));
const money = (v) => fmtMln(v);
function sectionRow(label, x, tone) {
  return `<div class="ov-row"><span class="badge ${tone}">${esc(label)}</span>
    <div class="ov-cells">
      <div><span class="xs muted">Kirim</span><b class="pos">${money(x.income)}</b></div>
      <div><span class="xs muted">Chiqim</span><b class="neg">${money(x.out)}</b></div>
      <div><span class="xs muted">Foyda</span><b class="${x.profit < 0 ? "neg" : ""}">${money(x.profit)}</b></div>
      <div><span class="xs muted">${label === "Bog‘cha" ? "Bolalar" : "O‘quvchilar"}</span><b>${x.students}</b></div>
      <div><span class="xs muted">Qarz</span><b class="${x.debt ? "neg" : ""}">${money(x.debt)}</b></div>
      <div><span class="xs muted">Bugun kelmaydi</span><b>${x.absences}</b></div>
    </div></div>`;
}
function overviewBody(O, { finance = true } = {}) {
  const T = O.total;
  const totals = `<div class="tiles">
      ${finance ? tile({ icon: "wallet", label: `Kirim · ${fmtMonth(O.month)}`, value: money(T.income), tone: "green", route: "ledger" }) : ""}
      ${finance ? tile({ icon: "receipt", label: "Chiqim", value: money(T.out), tone: "yellow", route: "ledger" }) : ""}
      ${finance ? tile({ icon: "chart", label: "Sof foyda", value: money(T.profit), tone: T.profit < 0 ? "rose" : "sky", route: "reports" }) : ""}
      ${tile({ icon: "users", label: "O‘quvchi va bolalar", value: String(T.students), tone: "mint", route: "students" })}
      ${tile({ icon: "card", label: `Qarzdorlik (${T.debtors} ta)`, value: money(T.debt), tone: "rose", route: "debts" })}
    </div>`;
  const bySec = `<section class="card">${cardHead("Maktab va bog‘cha — umumiy")}${Object.entries(O.bySection).map(([k, x]) => sectionRow(SECTION_L[k], x, k === "school" ? "green" : "orange")).join("")}
      ${O.central && O.central.out ? `<span class="xs muted">Markaziy (filialga biriktirilmagan) xarajatlar: <b>${fmtSum(O.central.out)}</b></span>` : ""}</section>`;
  const perBranch = O.branches.map((b) => `<section class="card branch-card">
      <div class="card-head"><h2>${ic("school", 18)} ${esc(b.name)}</h2><div class="row wrap" style="gap:6px">
        <button type="button" class="btn sec sm" data-a="br-open" data-v="${b.id}" data-r="students">O‘quvchilar</button>
        ${finance ? `<button type="button" class="btn sec sm" data-a="br-open" data-v="${b.id}" data-r="ledger">Kirim-chiqim</button><button type="button" class="btn sec sm" data-a="br-open" data-v="${b.id}" data-r="reports">Hisobot</button>` : ""}</div></div>
      ${b.address ? `<span class="xs muted">${esc(b.address)}</span>` : ""}
      ${finance ? `<div class="row wrap" style="gap:10px"><div class="stat" style="background:var(--accent-soft)"><span class="small muted">Kirim</span><span class="v">${money(b.total.income)}</span></div><div class="stat" style="background:var(--gold-soft)"><span class="small muted">Chiqim</span><span class="v">${money(b.total.out)}</span></div><div class="stat" style="background:var(--surface-2)"><span class="small muted">Sof foyda</span><span class="v ${b.total.profit < 0 ? "neg" : ""}">${money(b.total.profit)}</span></div></div>` : ""}
      ${Object.entries(b.sections).map(([k, x]) => sectionRow(SECTION_L[k], x, k === "school" ? "green" : "orange")).join("")}
      ${b.common.out ? `<span class="xs muted">Filialning umumiy (maktab/bog‘chaga bo‘linmagan) xarajati: <b>${fmtSum(b.common.out)}</b></span>` : ""}
    </section>`).join("");
  return totals + bySec + `<div class="grid" style="--min:330px">${perBranch}</div>`;
}
ACTIONS["br-open"] = (el) => { S.ui.fb = el.dataset.v; S.ui.fs = ""; invalidate("/"); go(el.dataset.r); };

VIEWS["owner:home"] = {
  title: "Bosh sahifa", noHead: true,
  render() {
    const m = S.ui.ovMonth || curMonth();
    const O = data("/reports/overview?month=" + m), d = data("/dashboard");
    const head = `${greeting(user().name)}<div class="row wrap between" style="gap:8px"><h2 style="font-size:20px">Umumiy hisobot</h2>
      <select class="input" style="width:auto" data-f="ovMonth" aria-label="Oy">${monthsBack(12).map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${fmtMonth(x)}</option>`).join("")}</select></div>`;
    if (O === undefined) return head + pending("/reports/overview?month=" + m);
    const c = d?.counts;
    if (c) S.me.badges = { unlocks: c.unlocks };
    const alerts = c ? `${c.unlocks ? `<button type="button" class="doc-row" style="border:0;background:var(--warn-soft);color:var(--warn);text-align:left" data-a="go" data-r="unlocks">${ic("key", 18)}<b class="grow">${c.unlocks} ta o‘qituvchi tahrirlash uchun ruxsat so‘ramoqda</b>${ic("chevron", 16)}</button>` : ""}
      ${c.absences ? `<button type="button" class="doc-row" style="border:0;background:var(--info-soft);color:var(--info);text-align:left" data-a="go" data-r="absences">${ic("bell", 18)}<b class="grow">Bugun ${c.absences} ta o‘quvchi kelmasligi haqida ota-onalar xabar bergan</b>${ic("chevron", 16)}</button>` : ""}` : "";
    return head + alerts + overviewBody(O, { finance: role() === "owner" || FINANCE.includes(role()) }) + (role() === "owner" && !O.total.students ? `<section class="card" style="background:var(--gold-soft);border-color:var(--gold)"><h2>Boshlash</h2><span class="small">Avval <b>Filiallar</b>ni tekshiring, keyin <b>Sinflar va jadval</b>da har bir filial uchun maktab sinflari va bog‘cha guruhlarini qo‘shing, so‘ng o‘qituvchilar va o‘quvchilarni.</span></section>` : "");
  },
};
ACTIONS["change:ovMonth"] = (el) => { S.ui.ovMonth = el.value; };

/* ================= accountant panel: only their own branch ================= */
VIEWS["accountant:home"] = {
  title: "Bosh sahifa", noHead: true,
  render() {
    if (!myScope()) return `${greeting(user().name)}<section class="card">${empty("Sizga filial biriktirilmagan. Bosh admin bilan bog‘laning.")}</section>`;
    const m = S.ui.ovMonth || curMonth();
    const O = data("/reports/overview?month=" + m), debts = data("/finance/debts");
    const head = `${greeting(user().name)}<div class="row wrap between" style="gap:8px"><h2 style="font-size:20px">${esc(branchName(myScope()))} · moliya</h2>
      <select class="input" style="width:auto" data-f="ovMonth" aria-label="Oy">${monthsBack(12).map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${fmtMonth(x)}</option>`).join("")}</select></div>`;
    if (O === undefined) return head + pending("/reports/overview?month=" + m);
    const b = O.branches[0];
    const top = (debts || []).slice(0, 6);
    return `${head}
      <div class="tiles">${tile({ icon: "wallet", label: `Kirim · ${fmtMonth(m)}`, value: money(b.total.income), tone: "green", route: "ledger" })}${tile({ icon: "receipt", label: "Chiqim", value: money(b.total.out), tone: "yellow", route: "ledger" })}${tile({ icon: "chart", label: "Sof foyda", value: money(b.total.profit), tone: b.total.profit < 0 ? "rose" : "sky", route: "reports" })}${tile({ icon: "card", label: "Qarzdorlik", value: money(b.total.debt), tone: "rose", route: "debts" })}</div>
      <section class="card">${cardHead("Maktab va bog‘cha")}${Object.entries(b.sections).map(([k, x]) => sectionRow(SECTION_L[k], x, k === "school" ? "green" : "orange")).join("")}${b.common.out ? `<span class="xs muted">Umumiy xarajatlar: <b>${fmtSum(b.common.out)}</b></span>` : ""}</section>
      <div class="row wrap" style="gap:8px"><button type="button" class="btn" data-a="go" data-r="ledger">${ic("plus", 16)} To‘lov yoki xarajat kiritish</button><button type="button" class="btn sec" data-a="go" data-r="reports">${ic("chart", 16)} Hisobotlar</button></div>
      <section class="card">${cardHead("Eng katta qarzdorlar", linkTo("Barchasi →", "debts"))}<div class="list">${top.map((x) => `<button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left" data-a="go" data-r="student-${x.id}"><div class="col grow"><b class="small">${esc(x.last_name + " " + x.first_name)}</b><span class="xs muted">${esc(x.class_name || "")} · ${SECTION_L[x.section] || ""} · ${esc(x.parent_name || "")} ${fmtPhone(x.parent_phone)}</span></div><b class="neg num">${fmtNum(x.debt)}</b></button>`).join("") || empty(debts === undefined ? "Yuklanmoqda…" : "Qarzdorlar yo‘q")}</div></section>`;
  },
};

/* ================= branches management (bosh admin) ================= */
VIEWS["owner:branches"] = {
  title: "Filiallar",
  actions: () => `<button type="button" class="btn" data-a="modal" data-m="branch-edit">${ic("plus", 18)} Filial qo‘shish</button>`,
  render() {
    const list = data("/branches");
    if (list === undefined) return pending("/branches");
    return `<div class="grid" style="--min:300px">${list.map((b) => `<section class="card"><div class="card-head"><h2>${ic("school", 18)} ${esc(b.name)}</h2><button type="button" class="btn sec sm" data-a="modal" data-m="branch-edit" data-v="${b.id}">${ic("edit", 15)}</button></div>
      <span class="small muted">${esc(b.address || "Manzil kiritilmagan")}${b.phone ? " · " + esc(b.phone) : ""}</span>
      <div class="row wrap" style="gap:10px"><div class="stat" style="background:var(--accent-soft)"><span class="small muted">Maktab o‘quvchilari</span><span class="v">${b.school_students}</span></div><div class="stat" style="background:var(--gold-soft)"><span class="small muted">Bog‘cha bolalari</span><span class="v">${b.kg_students}</span></div></div>
      <span class="xs muted">${b.classes} ta sinf va guruh</span></section>`).join("")}</div>
      <section class="card" style="background:var(--surface-2)"><span class="small">Har bir filialda <b>maktab</b> va <b>bog‘cha</b> bo‘limi bor. Sinf yoki guruh qo‘shganda filial va bo‘limni tanlaysiz — o‘quvchilar, to‘lovlar va hisobotlar shu bo‘yicha ajraladi. Buxgalter va filial menejeriga “Foydalanuvchilar” bo‘limida filial biriktiring: ular faqat o‘z filialini ko‘radi.</span></section>`;
  },
};
MODALS["branch-edit"] = (m) => {
  const b = (data("/branches") || []).find((x) => x.id === m.id);
  if (S.ui.brFilled !== (m.id || "new")) { fill({ brname: b?.name, braddr: b?.address, brphone: b?.phone }); S.ui.brFilled = m.id || "new"; }
  return `${modalHead(b ? b.name : "Yangi filial")}<form class="stack" style="gap:12px" data-submit="branch-edit" data-v="${m.id || ""}">
    ${field("brname", "Nomi", { required: true, ph: "Masalan, Chilonzor filiali" })}${field("braddr", "Manzil")}${field("brphone", "Telefon")}
    <button type="submit" class="btn" ${busy("br") ? "disabled" : ""}>Saqlash</button></form>`;
};
SUBMITS["branch-edit"] = async (form) => {
  const body = { name: fv("brname"), address: fv("braddr"), phone: fv("brphone") };
  await run("br", () => (form.dataset.v ? patch("/branches/" + form.dataset.v, body) : post("/branches", body)), { ok: "Saqlandi", invalidate: ["/branches", "/reports"] });
  S.ui.brFilled = null; await loadMe(); closeModal();
};

/* ================= audit log (bosh admin) ================= */
const AUDIT_L = {
  "login.ok": "Tizimga kirdi", "login.fail": "Noto‘g‘ri parol bilan kirishga urinish", "logout.all": "Barcha qurilmalardan chiqdi", "password.change": "Parolini o‘zgartirdi",
  "user.create": "Foydalanuvchi qo‘shdi", "user.update": "Foydalanuvchini tahrirladi", "student.create": "O‘quvchi qo‘shdi", "student.update": "O‘quvchini tahrirladi",
  "payment.create": "To‘lov kiritdi", "salary.create": "Oylik kiritdi", "expense.create": "Xarajat kiritdi", "finance.delete": "Moliyaviy yozuvni o‘chirdi", "finance.receipt": "Chek biriktirdi",
  "grade.change": "Bahoni o‘zgartirdi", "lesson.substitute": "O‘rinbosar tayinladi", "absence.create": "Kelmaslik xabarini yubordi", "settings.update": "Sozlamani o‘zgartirdi",
  "class.create": "Sinf qo‘shdi", "class.update": "Sinfni tahrirladi", "class.delete": "Sinfni o‘chirdi", "branch.create": "Filial qo‘shdi", "branch.update": "Filialni tahrirladi",
  "contract.create": "Shartnoma tuzdi", "contract.status": "Shartnoma holatini o‘zgartirdi", "document.add": "Hujjat yukladi", "document.delete": "Hujjatni o‘chirdi", "demo.load": "Demo yukladi", "demo.clear": "Demo o‘chirdi",
};
VIEWS["owner:audit"] = {
  title: "Harakatlar jurnali",
  render() {
    const f = S.ui.auF || "";
    const path = "/audit" + (f ? "?action=" + f : "");
    const list = data(path);
    const head = `<div class="row wrap" style="gap:8px">${["", "login", "payment", "finance", "user", "grade"].map((x) => `<button type="button" class="pill" data-a="set" data-k="auF" data-v="${x}" aria-pressed="${x === f}">${esc({ "": "Hammasi", login: "Kirishlar", payment: "To‘lovlar", finance: "O‘chirishlar", user: "Foydalanuvchilar", grade: "Baholar" }[x])}</button>`).join("")}</div>`;
    if (list === undefined) return head + pending(path);
    return `${head}<section class="card"><span class="xs muted">Kim, qachon, nima qilgani. Oxirgi 200 ta yozuv. Ma’lumotlar 3 yil saqlanadi.</span><div class="list">${list.map((a) => `<div class="row"><span class="avatar" style="background:${/fail|delete/.test(a.action) ? "var(--bad-soft);color:var(--bad)" : "var(--surface-2)"}">${ic(/login/.test(a.action) ? "key" : /payment|salary|expense|finance/.test(a.action) ? "wallet" : "user", 16)}</span><div class="col grow" style="min-width:0"><b class="small">${esc(a.user_name || (a.action === "login.fail" ? a.detail?.phone || "Noma’lum" : "—"))} <span class="xs muted">${esc(ROLE_L[a.role] || "")}</span></b><span class="xs muted">${esc(AUDIT_L[a.action] || a.action)}${a.branch_name ? " · " + esc(a.branch_name) : ""}${a.detail?.amount ? " · " + fmtNum(a.detail.amount) + " so‘m" : ""}${a.detail?.name ? " · " + esc(a.detail.name) : ""}</span></div><span class="xs muted" style="text-align:right">${fmtWhen(a.at)}<br>${esc(a.ip || "")}</span></div>`).join("") || empty("Yozuvlar yo‘q")}</div></section>`;
  },
};

/* ================= absence notices ================= */
export const ABS_KIND = { sick: "Kasal", family: "Oilaviy sabab", trip: "Safar", other: "Boshqa sabab" };
const absWhen = (a) => (a.date_from === a.date_to ? fmtDay(a.date_from) : `${fmtDay(a.date_from)} — ${fmtDay(a.date_to)}`);
const absCard = (a, { staff = false } = {}) => `<div class="row" style="align-items:flex-start">${ava(a, 40)}<div class="col grow" style="min-width:0;gap:2px">
    <b class="small">${esc(sName(a))} <span class="xs muted">${esc(a.class_name || "")}${staff && a.section ? " · " + SECTION_L[a.section] : ""}${staff && myScope() === null && a.branch_id ? " · " + esc(branchName(a.branch_id)) : ""}</span></b>
    <span class="small">${badge(ABS_KIND[a.kind] || "Sabab", a.kind === "sick" ? "red" : "orange")} ${absWhen(a)}</span>
    <span class="small muted">${esc(a.reason)}</span>
    ${staff ? `<span class="xs muted">${esc(a.parent_name || "")} ${a.parent_phone ? "· " + fmtPhone(a.parent_phone) : ""} · ${fmtWhen(a.created_at)}${a.seen_by_name ? " · ko‘rdi: " + esc(a.seen_by_name) : ""}</span>` : `<span class="xs muted">Yuborildi: ${fmtWhen(a.created_at)}${a.seen_by_name ? " · ko‘rildi" : ""}</span>`}</div>
  ${staff && !a.seen_by && role() !== "accountant" ? `<button type="button" class="btn sec sm" data-a="abs-seen" data-v="${a.id}">${ic("check", 15)} Ko‘rdim</button>` : ""}
  ${!staff && a.date_from >= today() ? `<button type="button" class="linkbtn xs" data-a="abs-del" data-v="${a.id}">Bekor qilish</button>` : ""}</div>`;

function absenceList(staff) {
  const path = "/absences" + (staff && role() !== "teacher" ? fq("?") : "");
  const list = data(path);
  if (list === undefined) return pending(path);
  const t = today();
  const now = list.filter((a) => a.date_from <= t && a.date_to >= t), next = list.filter((a) => a.date_from > t), past = list.filter((a) => a.date_to < t);
  const block = (title, l) => (l.length ? `<section class="card">${cardHead(`${title} (${l.length})`)}<div class="list">${l.map((a) => absCard(a, { staff })).join("")}</div></section>` : "");
  return (block("Bugun", now) + block("Keyingi kunlar", next) + block("O‘tgan 30 kun", past)) || `<section class="card">${empty("Xabarlar yo‘q")}</section>`;
}
VIEWS["parent:absences"] = {
  title: "Kelmaslik xabarlari",
  actions: () => `<button type="button" class="btn" data-a="modal" data-m="absence-new">${ic("plus", 18)} Xabar berish</button>`,
  render() {
    return `<section class="card" style="background:var(--info-soft)"><span class="small">Farzandingiz kasal bo‘lsa yoki boshqa sabab bilan maktab/bog‘chaga kela olmasa, shu yerdan xabar bering. Xabar sinf rahbari, o‘sha kuni dars beradigan o‘qituvchilar va ma’muriyatga darhol boradi.</span></section>${absenceList(false)}`;
  },
};
const staffAbs = {
  title: "Kelmaslik xabarlari",
  render() { return (role() === "teacher" ? "" : scopeBar()) + absenceList(true); },
};
VIEWS["teacher:absences"] = staffAbs;
VIEWS["admin:absences"] = staffAbs;

MODALS["absence-new"] = (m) => {
  const kids = S.me.children || [];
  if (!S.ui.abFilled) { fill({ abkid: m.id || kids[0]?.id, abfrom: today(), abto: today(), abkind: "sick", abreason: "" }); S.ui.abFilled = true; }
  return `${modalHead("Farzandim kela olmaydi", "O‘qituvchilar va ma’muriyatga bildirishnoma boradi")}
    <form class="stack" style="gap:12px" data-submit="absence-new">
      ${kids.length > 1 ? field("abkid", "Farzand", { options: kids.map((k) => [k.id, `${k.first_name} ${k.last_name}`]), blank: false }) : ""}
      <div class="row wrap" style="align-items:flex-start">${field("abfrom", "Qaysi kundan", { type: "date", min: addDays(today(), -3) })}${field("abto", "Qaysi kungacha", { type: "date" })}</div>
      ${field("abkind", "Sabab turi", { options: Object.entries(ABS_KIND), blank: false })}
      ${field("abreason", "Izoh", { area: true, required: true, ph: "Masalan, isitmasi bor, shifokorga boramiz" })}
      <button type="submit" class="btn" ${busy("ab") ? "disabled" : ""}>${ic("bell", 16)} Xabar yuborish</button></form>`;
};
SUBMITS["absence-new"] = async () => {
  const kids = S.me.children || [];
  const from = fv("abfrom", today()), to = fv("abto") || from;
  await run("ab", () => post("/absences", { student_id: Number(fv("abkid", kids[0]?.id)), date_from: from, date_to: to < from ? from : to, kind: fv("abkind", "sick"), reason: fv("abreason") }), { ok: "Xabar yuborildi. O‘qituvchilar va ma’muriyat xabardor qilindi.", invalidate: ["/absences"] });
  S.ui.abFilled = false; closeModal();
};
ACTIONS["abs-seen"] = async (el) => { await run("abs", () => post(`/absences/${el.dataset.v}/seen`, {}), { invalidate: ["/absences", "/dashboard"] }); };
ACTIONS["abs-del"] = async (el) => { await run("abs", () => del(`/absences/${el.dataset.v}`), { ok: "Xabar bekor qilindi", invalidate: ["/absences"] }); };

/* ================= substitute teacher (administration) ================= */
MODALS.substitute = () => {
  const classes = S.me.classes || [];
  const teachers = (data("/teachers") || []).filter((t) => t.active);
  const times = periodTimes(settings().bell);
  if (!S.ui.subFilled) { fill({ sbdate: today(), sbcls: classes[0]?.id, sbper: "1", sbt: "" }); S.ui.subFilled = true; }
  return `${modalHead("O‘rinbosar o‘qituvchi tayinlash", "Bir dars uchun: o‘qituvchi kasal yoki yo‘q bo‘lsa")}
    <form class="stack" style="gap:12px" data-submit="substitute">
      <div class="row wrap" style="align-items:flex-start">${field("sbdate", "Sana", { type: "date", min: today() })}${field("sbcls", "Sinf", { options: classes.filter((c) => c.section !== "kindergarten").map((c) => [c.id, c.name + (myScope() === null ? " · " + branchName(c.branch_id) : "")]), blank: false })}${field("sbper", "Soat", { options: times.map((t) => [t.period, `${t.period}-soat, ${hm(t.start)}`]), blank: false })}</div>
      ${field("sbt", "O‘rinbosar o‘qituvchi", { options: teachers.map((t) => [t.id, t.name]) })}
      <span class="xs muted">Tayinlangan o‘qituvchiga bildirishnoma boradi va u shu darsni boshlay oladi. Boshqa o‘qituvchilar birovning darsini o‘zlari boshlay olmaydi.</span>
      <button type="submit" class="btn" ${busy("sb") ? "disabled" : ""}>Tayinlash</button></form>`;
};
SUBMITS.substitute = async () => {
  await run("sb", () => put("/lessons/substitute", { date: fv("sbdate", today()), class_id: Number(fv("sbcls")), period: Number(fv("sbper", 1)), teacher_id: Number(fv("sbt")) }), { ok: "O‘rinbosar tayinlandi", invalidate: ["/live", "/lessons"] });
  S.ui.subFilled = false; closeModal();
};
