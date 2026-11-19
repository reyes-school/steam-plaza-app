// Views shared by all roles: login, profile, news & post pages, notifications, student and teacher pages, ratings, schedule.
import {
  S, VIEWS, ACTIONS, SUBMITS, MODALS, render, go, api, post, patch, del, put, run, busy, data, pending, invalidate, toast, openModal, closeModal, modalHead,
  esc, ic, badge, seg, pills, cardHead, empty, bar, field, fv, fill, starsHtml, rankMark, avgColor, ava, avaEdit, fileBox, fileLinks, fileUrl, isImg, pdfBtn,
  fmtDay, fmtDate, fmtTime, fmtWhen, fmtMonth, fmtNum, fmtSum, fmtAvg, fmtPhone, fmtSize, hm, sName, initials, today, curMonth, addDays, mondayOf, monthShift, monthEnd, wdOf,
  WD, WDS, MONTHS, MONTHS_S, ROLE_L, ADMINS, STAFF, FINANCE, user, role, group, settings, periodTimes, setToken, loadMe, logout, linkTo, tzNow, fmtLocal, FLAG, ring, subjTone, TONE, PLANE, greeting, tile, banner, sparkline,
} from "./core.js";
import { LANG, LANGS, setLang } from "./i18n.js";

/* ================= login ================= */
/** UZ | RU switch; the page reloads in the chosen language. */
export const langSwitch = (cls = "") => `<div class="lang-seg ${cls}" role="group" aria-label="Til · Язык" data-notr>${LANGS.map(([k, l]) => `<button type="button" data-a="lang" data-v="${k}" aria-pressed="${LANG === k}"><b>${k.toUpperCase()}</b><span>${l}</span></button>`).join("")}</div>`;
ACTIONS.lang = (el) => { if (el.dataset.v === LANG) return; setLang(el.dataset.v); document.documentElement.classList.add("lang-switching"); location.reload(); };
VIEWS["*:login"] = {
  title: "Kirish",
  render() {
    const sch = settings().school || {};
    return `<div class="login ios">
      <div class="login-top">${langSwitch("on-dark")}<div class="app-icon"><img src="/logo-mark.png" alt=""></div><h1>${esc(sch.name || "Steam Plaza")}</h1><p>Innovatsion ta’lim — yorqin kelajak uchun</p>${PLANE}</div>
      <form class="login-sheet" data-submit="login">
        <h2>Kirish</h2>
        <div class="group">
          <div class="g-row"><label for="lphone">Telefon</label><span class="cc">${FLAG}+998</span><input id="lphone" data-f="lphone" data-phone="1" type="tel" inputmode="tel" autocomplete="username" placeholder="90 123 45 67" value="${esc(fmtLocal(fv("lphone")))}"></div>
          <div class="g-row"><label for="lpass">Parol</label><input id="lpass" data-f="lpass" type="${S.ui.showPass ? "text" : "password"}" autocomplete="current-password" placeholder="Parolingiz" value="${esc(fv("lpass"))}"><button type="button" class="eye" data-a="set" data-k="showPass" data-v="${S.ui.showPass ? "" : "1"}" aria-label="${S.ui.showPass ? "Parolni yashirish" : "Parolni ko‘rsatish"}">${ic("eye", 20)}</button></div>
        </div>
        ${S.ui.loginErr ? `<span class="err-text" role="alert">${esc(S.ui.loginErr)}</span>` : ""}
        <button type="submit" class="btn" ${busy("login") ? "disabled" : ""}>${busy("login") ? "Kirilmoqda…" : "Kirish"}</button>
        <span class="xs muted" style="text-align:center">Parolni maktab administratori beradi. Unutgan bo‘lsangiz, administratorga murojaat qiling.</span>
      </form>
    </div>`;
  },
};
SUBMITS.login = async () => {
  S.ui.loginErr = "";
  try {
    const r = await run("login", () => post("/auth/login", { phone: fv("lphone"), password: fv("lpass") }));
    setToken(r.token); S.f = {}; await loadMe(); location.hash = ""; render();
  } catch (e) { S.ui.loginErr = e.message; render(); }
};

/* ================= profile ================= */
VIEWS["*:profile"] = {
  title: "Profil",
  render() {
    const u = user();
    const teacher = u.role === "teacher";
    return `<div class="grid" style="--min:360px">
      <section class="card">
        <div class="row">${u.role === "owner" ? avaEdit(u, 72, "user:" + u.id, "t") : ava(u, 72, teacher ? "t" : "s")}<div class="col"><h2 style="font-size:20px">${esc(u.name)}</h2><span class="muted">${ROLE_L[u.role]} · ${fmtPhone(u.phone)}</span></div></div>
        ${teacher ? `<div class="doc-row">${ic("lock", 18)}<span class="small">Profilingizdagi ma’lumotlarni faqat administrator tahrirlay oladi. O‘zgartirish kerak bo‘lsa, administratorga murojaat qiling.</span></div>${linkTo("To‘liq profilim va reytingim →", "teacher-" + u.id)}` : ""}
      </section>
      <section class="card"><h2>Til · Язык</h2>${langSwitch()}</section>
      <section class="card"><h2>Parolni almashtirish</h2>
        <form class="stack" style="gap:12px" data-submit="password">
          ${field("pold", "Joriy parol", { type: "password", ac: "current-password" })}
          ${field("pnew", "Yangi parol", { type: "password", ac: "new-password", hint: "Kamida 8 belgi, harf va raqam" })}
          <button type="submit" class="btn" ${busy("pass") ? "disabled" : ""}>Saqlash</button>
        </form>
      </section>
      <section class="card"><h2>Xavfsizlik</h2><span class="small muted">Telefoningiz yo‘qolsa yoki parolingizni boshqa odam bilgan bo‘lsa, barcha qurilmalardan chiqing. Parolni almashtirsangiz ham boshqa qurilmalar avtomatik chiqariladi.</span>
        <button type="button" class="btn sec" style="align-self:flex-start" data-a="logout-all">${ic("logout", 16)} Barcha qurilmalardan chiqish</button></section>
    </div>`;
  },
};
SUBMITS.password = async () => {
  const r = await run("pass", () => post("/me/password", { old: fv("pold"), new: fv("pnew") }), { ok: "Parol almashtirildi. Boshqa qurilmalar tizimdan chiqarildi." });
  if (r?.token) setToken(r.token);
  S.f.pold = S.f.pnew = ""; render();
};

/* ================= notifications ================= */
const NOTIF_IC = { feedback: "chat", rating: "star", unlock: "key", news: "news", openlesson: "megaphone", achievement: "trophy", absence: "bell" };
ACTIONS["logout-all"] = async () => { try { await post("/auth/logout-all", {}); } catch {} logout(); };
MODALS.notifications = () => {
  const n = data("/notifications");
  return `${modalHead("Bildirishnomalar")}${n === undefined ? `<div class="row" style="justify-content:center;padding:16px"><span class="spin"></span></div>` : n.items.length ? `<div class="list">${n.items.map((x) => `<button type="button" class="row" style="border:0;background:${x.read ? "transparent" : "var(--accent-soft)"};border-radius:12px;padding:10px;text-align:left;align-items:flex-start;width:100%" data-a="notif-go" data-r="${esc(x.link || "")}"><span class="avatar" style="width:36px;height:36px">${ic(NOTIF_IC[x.kind] || "bell", 17)}</span><span class="col grow"><b class="small">${esc(x.title)}</b>${x.body ? `<span class="small muted">${esc(x.body)}</span>` : ""}<span class="xs muted">${fmtWhen(x.created_at)}</span></span></button>`).join("")}</div>` : empty("Hozircha bildirishnoma yo‘q")}`;
};

/* ================= news & post pages ================= */
const POST_L = { news: "Yangilik", openlesson: "Ochiq dars" };
export function postCard(p) {
  const img = (p.files || []).find(isImg);
  return `<button type="button" class="card post-card" data-a="go" data-r="post-${p.id}">
    ${img ? `<img class="post-cover" src="${fileUrl(img)}" alt="" loading="lazy">` : ""}
    <div class="row wrap" style="gap:6px">${badge(POST_L[p.kind], p.kind === "openlesson" ? "gold" : "green")}${p.event?.date ? badge(fmtDay(p.event.date) + (p.event.time ? " · " + p.event.time : ""), "blue") : ""}<span class="xs muted" style="margin-left:auto">${fmtWhen(p.created_at)}</span></div>
    <h2 style="font-size:17px">${esc(p.title)}</h2>
    ${p.excerpt ? `<span class="muted small post-excerpt">${esc(p.excerpt)}</span>` : ""}
    <div class="row small muted" style="gap:8px">${ava({ id: p.author_id, photo: p.author_photo }, 24, "t")}${esc(p.author_name || "")}${(p.files || []).length ? `<span style="margin-left:auto">${ic("file", 14)} ${(p.files || []).length}</span>` : ""}</div>
  </button>`;
}
VIEWS["*:news"] = {
  title: "Yangiliklar",
  actions: () => (STAFF.includes(role()) ? `<button type="button" class="btn" data-a="modal" data-m="post-new" data-x="news">${ic("plus", 18)} Yangilik</button>` : role() === "teacher" ? `<button type="button" class="btn" data-a="modal" data-m="post-new" data-x="openlesson">${ic("megaphone", 18)} Ochiq dars e’loni</button>` : ""),
  render() {
    const k = S.ui.newsKind || "";
    const path = "/posts?limit=40" + (k ? "&kind=" + k : "");
    const list = data(path);
    return `${seg("newsKind", k, [["", "Hammasi"], ["news", "Yangiliklar"], ["openlesson", "Ochiq darslar"]])}
      ${list === undefined ? pending(path) : list.length ? `<div class="grid" style="--min:300px">${list.map(postCard).join("")}</div>` : `<section class="card">${empty("Hozircha xabar yo‘q")}</section>`}`;
  },
};
function paragraphs(text) {
  return String(text || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</p>`).join("");
}
VIEWS["*:post"] = {
  title: "Xabar", back: true, nav: "news",
  render(id) {
    const p = data("/posts/" + id);
    if (p === undefined) return pending("/posts/" + id);
    const imgs = (p.files || []).filter(isImg), docs = (p.files || []).filter((f) => !isImg(f));
    const canDel = p.author_id === user().id || STAFF.includes(role());
    return `<article class="card post-page">
      <div class="row wrap" style="gap:6px">${badge(POST_L[p.kind], p.kind === "openlesson" ? "gold" : "green")}${(p.class_names || []).map((c) => badge(c)).join("")}</div>
      <h1 style="font-size:28px">${esc(p.title)}</h1>
      <div class="row small muted">${ava({ id: p.author_id, photo: p.author_photo }, 34, "t")}<div class="col" style="gap:0"><b style="color:var(--ink)">${esc(p.author_name || "")}</b><span>${fmtWhen(p.created_at)}</span></div>${canDel ? `<button type="button" class="btn ghost sm" style="margin-left:auto;color:var(--bad)" data-a="post-del" data-v="${p.id}">${ic("trash", 16)} O‘chirish</button>` : ""}</div>
      ${p.event ? `<div class="event-box">${ic("calendar", 22)}<div class="col" style="gap:2px"><b>${fmtDate(p.event.date)}${p.event.time ? ", soat " + esc(p.event.time) : ""}</b><span class="small">${[p.event.subject, p.event.class, p.event.place].filter(Boolean).map(esc).join(" · ")}</span></div></div>` : ""}
      ${imgs.length ? `<div class="post-gallery">${imgs.map((f) => `<a href="${fileUrl(f)}" target="_blank" rel="noopener"><img src="${fileUrl(f)}" alt="${esc(f.name)}" loading="lazy"></a>`).join("")}</div>` : ""}
      <div class="post-body">${paragraphs(p.body)}</div>
      ${docs.length ? `<div class="col" style="gap:8px"><b class="small">Biriktirilgan fayllar</b>${fileLinks(docs)}</div>` : ""}
    </article>`;
  },
};
ACTIONS["post-del"] = async (el) => {
  if (S.ui.confirmDel !== el.dataset.v) { S.ui.confirmDel = el.dataset.v; toast("O‘chirish uchun yana bir marta bosing"); return; }
  await run("pdel", () => del("/posts/" + el.dataset.v), { ok: "Xabar o‘chirildi", invalidate: ["/posts"] });
  go("news");
};
MODALS["post-new"] = (m) => {
  const kind = m.extra === "openlesson" ? "openlesson" : "news";
  const classes = S.me.classes;
  const mine = role() === "teacher" ? classes.filter((c) => S.me.myClasses.includes(c.id)) : classes;
  const picked = new Set(String(fv("pcls", "")).split(",").filter(Boolean));
  return `${modalHead(kind === "openlesson" ? "Ochiq dars e’loni" : "Yangi xabar", "Matn yozing, kerak bo‘lsa rasm yoki fayl biriktiring")}
    <form class="stack" style="gap:12px" data-submit="post-new" data-kind="${kind}">
      ${field("ptitle", "Sarlavha", { required: true, ph: kind === "openlesson" ? "Masalan, Matematika: kasrlar bo‘yicha ochiq dars" : "Masalan, Aviatsiya haftaligi boshlanadi" })}
      ${kind === "openlesson" ? `<div class="row wrap" style="align-items:flex-start">${field("pdate", "Sana", { type: "date", required: true, def: today() })}${field("ptime", "Vaqti", { type: "time", def: "10:00" })}${field("pplace", "Joy", { ph: "101-xona" })}</div>
        <div class="row wrap" style="align-items:flex-start">${field("psubj", "Fan", { options: S.me.subjects.map((s) => [s.name, s.name]) })}</div>` : ""}
      ${field("pbody", "Matn", { area: true, rows: 6, ph: "Xabar matni…" })}
      <div class="col" style="gap:6px"><span class="small b muted">Kimlar ko‘radi</span><div class="row wrap" style="gap:6px">
        <button type="button" class="pill" data-a="pcls" data-v="" aria-pressed="${!picked.size}">Hamma</button>
        ${mine.map((c) => `<button type="button" class="pill" data-a="pcls" data-v="${c.id}" aria-pressed="${picked.has(String(c.id))}">${esc(c.name)}</button>`).join("")}</div></div>
      ${fileBox("post", { label: "Rasm yoki fayl qo‘shish" })}
      <button type="submit" class="btn" ${busy("post") ? "disabled" : ""}>${ic("megaphone", 18)} E’lon qilish</button>
    </form>`;
};
ACTIONS.pcls = (el) => {
  const set = new Set(String(fv("pcls", "")).split(",").filter(Boolean));
  if (!el.dataset.v) set.clear(); else if (set.has(el.dataset.v)) set.delete(el.dataset.v); else set.add(el.dataset.v);
  S.f.pcls = [...set].join(","); render();
};
SUBMITS["post-new"] = async (form) => {
  const kind = form.dataset.kind;
  const classIds = String(fv("pcls", "")).split(",").filter(Boolean).map(Number);
  const body = { kind, title: fv("ptitle"), body: fv("pbody"), files: S.files.post || [], class_ids: classIds.length ? classIds : null };
  if (kind === "openlesson") body.event = { date: fv("pdate", today()), time: fv("ptime", "10:00"), place: fv("pplace"), subject: fv("psubj"), class: S.me.classes.filter((c) => classIds.includes(c.id)).map((c) => c.name).join(", ") };
  const p = await run("post", () => post("/posts", body), { ok: "E’lon qilindi. Ota-onalarga bildirishnoma yuborildi.", invalidate: ["/posts", "/teachers", "/ratings"] });
  for (const k of ["ptitle", "pbody", "pcls", "pplace"]) S.f[k] = ""; S.files.post = [];
  closeModal(); go("post-" + p.id);
};

/* ================= student page ================= */
export const ACH_KIND = { olympiad: "Olimpiada", contest: "Tanlov", sport: "Sport", other: "Boshqa" };
export const DOC_KIND = { passport: "Ota-ona pasporti", metrika: "Tug‘ilganlik guvohnomasi (metrika)", atestat: "Attestat / tabel", medical: "Tibbiy ma’lumotnoma", contract: "Shartnoma", photo: "Rasm 3×4", diploma: "Diplom", employment: "Mehnat shartnomasi", certificate: "Sertifikat", other: "Boshqa hujjat" };
const ATT_L = { present: ["Keldi", "green"], absent: ["Kelmadi", "red"], late: ["Kechikdi", "orange"] };

export function achievementItem(a, canDel) {
  return `<div class="row" style="align-items:flex-start"><span class="avatar" style="background:var(--gold-soft);color:var(--gold-ink)">${ic(a.kind === "sport" ? "flag" : "medal", 18)}</span><div class="col grow"><b>${esc(a.title)}</b><span class="small muted">${[ACH_KIND[a.kind], a.level, a.subject, fmtDate(a.date)].filter(Boolean).map(esc).join(" · ")}</span>${a.file ? fileLinks([a.file]) : ""}</div>${a.place ? `<span class="chip-title">${a.place}-o‘rin</span>` : ""}${canDel ? `<button type="button" class="iconbtn" style="width:34px;height:34px" data-a="ach-del" data-v="${a.id}" aria-label="O‘chirish">${ic("trash", 15)}</button>` : ""}</div>`;
}

/** Monthly learning statistics block (used on the student page and the parent's statistics page). */
export function statsPanel(sid) {
  const month = S.ui["sm" + sid] || curMonth();
  const path = `/students/${sid}/stats?month=${month}`;
  const st = data(path);
  const months = Array.from({ length: 12 }, (_, i) => monthShift(curMonth(), -i));
  const head = `<div class="row wrap between"><select class="input" style="width:auto" data-f="sm${sid}" aria-label="Oy">${months.map((m) => `<option value="${m}" ${m === month ? "selected" : ""}>${fmtMonth(m)}</option>`).join("")}</select>${pdfBtn(`/pdf/student/${sid}?month=${month}`, `oquvchi_${sid}_${month}.pdf`, "PDF hisobot")}</div>`;
  if (st === undefined) return head + pending(path);
  const att = st.attendance || {}, totalAtt = (att.present || 0) + (att.absent || 0) + (att.late || 0), hw = st.homework || {}, hwT = (hw.done || 0) + (hw.missed || 0);
  const dl = (a, b) => (a == null || b == null ? `<span class="dl zero">—</span>` : a === b ? `<span class="dl zero">=</span>` : `<span class="dl ${b > a ? "pos" : "neg"}">${b > a ? "▲" : "▼"} ${fmtAvg(Math.abs(b - a))}</span>`);
  return `${head}
    <div class="row wrap" style="gap:10px">
      <div class="stat" style="background:var(--accent-soft)"><span class="small muted">O‘rtacha baho</span><span class="v" style="color:${avgColor(st.avg)}">${fmtAvg(st.avg)}</span><span class="xs">${st.prevAvg != null ? `O‘tgan oy: ${fmtAvg(st.prevAvg)} ${dl(st.prevAvg, st.avg)}` : "&nbsp;"}</span></div>
      <div class="stat" style="background:var(--gold-soft)"><span class="small muted">Sinfdagi o‘rni</span><span class="v">${st.classRank ? `${st.classRank}<span class="small muted"> / ${st.classSize}</span>` : "—"}</span><span class="xs">oy bo‘yicha</span></div>
      <div class="stat" style="background:var(--info-soft)"><span class="small muted">Davomat</span><span class="v">${totalAtt ? Math.round(((att.present + att.late) / totalAtt) * 100) + "%" : "—"}</span><span class="xs">${att.absent || 0} ta qoldirgan, ${att.late || 0} ta kechikkan</span></div>
      <div class="stat" style="background:var(--surface-2)"><span class="small muted">Uy vazifasi</span><span class="v">${hwT ? Math.round((hw.done / hwT) * 100) + "%" : "—"}</span><span class="xs">${hw.done || 0} bajarilgan, ${hw.missed || 0} bajarilmagan</span></div>
    </div>
    ${st.best.length ? `<div class="doc-row" style="background:var(--accent-soft)">${ic("chart", 18)}<span class="small">Eng yaxshi: <b>${st.best.map(esc).join(", ")}</b>${st.worst.filter((w) => !st.best.includes(w)).length ? `. E’tibor kerak: <b>${st.worst.filter((w) => !st.best.includes(w)).map(esc).join(", ")}</b>` : ""}.</span></div>` : ""}
    ${st.subjects.length ? `<div class="col" style="gap:10px">${st.subjects.map((x) => {
      const open = S.ui.subjOpen === sid + x.subject;
      return `<div class="subj-row"><button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left;padding:0" data-a="set" data-k="subjOpen" data-v="${esc(open ? "" : sid + x.subject)}">
        <div class="col grow" style="gap:6px"><div class="row between"><b>${esc(x.subject)}</b><span class="row" style="gap:8px"><span class="xs muted">${x.n} ta baho</span>${dl(x.prevAvg, x.avg)}<b style="color:${avgColor(x.avg)};min-width:30px;text-align:right">${fmtAvg(x.avg)}</b></span></div>${bar(((x.avg || 0) / 5) * 100, avgColor(x.avg))}</div>${ic(open ? "back" : "chevron", 16)}</button>
        ${open ? `<div class="col" style="gap:6px;padding:10px 0 2px">${x.topics.map((t) => `<div class="row between small"><span>${esc(t.topic)}</span><span class="row" style="gap:6px"><span class="xs muted">${t.n} ta</span><b style="color:${avgColor(t.avg)}">${fmtAvg(t.avg)}</b></span></div>`).join("") || `<span class="small muted">Bu oyda baho yo‘q</span>`}
          <div class="row wrap" style="gap:4px">${x.grades.map((g) => `<span class="grade g${g.value}" title="${esc(fmtDay(g.date) + ": " + (g.topic || ""))}">${g.value}</span>`).join("")}</div></div>` : ""}
      </div>`; }).join("")}</div>` : empty("Bu oyda baholar yo‘q")}
    ${st.weak.length ? `<div class="col" style="gap:8px"><b>Past baho olingan mavzular</b><div class="list">${st.weak.map((w) => `<div class="row"><span class="grade g${w.value}">${w.value}</span><div class="col grow"><b class="small">${esc(w.topic || "Mavzusiz")}</b><span class="xs muted">${esc(w.subject)} · ${fmtDay(w.date)}</span></div></div>`).join("")}</div></div>` : ""}
    ${trendChart(st.trend)}`;
}
function trendChart(trend) {
  if (!trend || !trend.some((t) => t.avg != null)) return "";
  const W = 640, H = 170, L = 34, R = 10, T = 12, B = 26, gw = (W - L - R) / trend.length;
  const y = (v) => T + ((5 - v) / 3) * (H - T - B);
  let g = "";
  for (const v of [2, 3, 4, 5]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" style="fill:var(--muted)">${v}</text>`;
  const pts = trend.map((t, i) => [L + gw * i + gw / 2, t.avg != null ? y(Math.max(2, t.avg)) : null, t]);
  const line = pts.filter((p) => p[1] != null);
  g += `<polyline points="${line.map((p) => p[0] + "," + p[1]).join(" ")}" fill="none" style="stroke:var(--accent)" stroke-width="2.5"/>`;
  for (const p of pts) { if (p[1] != null) g += `<circle cx="${p[0]}" cy="${p[1]}" r="4" style="fill:var(--surface);stroke:var(--accent)" stroke-width="2"><title>${fmtMonth(p[2].month)}: ${fmtAvg(p[2].avg)}</title></circle><text x="${p[0]}" y="${p[1] - 9}" text-anchor="middle" font-size="11" font-weight="700" style="fill:var(--ink)">${fmtAvg(p[2].avg)}</text>`; g += `<text x="${p[0]}" y="${H - 8}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${MONTHS_S[Number(p[2].month.slice(5)) - 1]}</text>`; }
  return `<div class="col" style="gap:6px"><b>So‘nggi 6 oy: o‘rtacha baho</b><div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Oylar bo‘yicha o‘rtacha baho">${g}</svg></div></div>`;
}

/** Homework by day with done / not done marks. */
export function homeworkPanel(sid) {
  const mon = mondayOf(today());
  const weeks = [0, 1, 2, 3].map((i) => { const f = addDays(mon, -7 * i); return [f, addDays(f, 5)]; });
  const wi = Number(S.ui["hwW" + sid] || 0), [from, to] = weeks[wi];
  const path = `/students/${sid}/homework?from=${from}&to=${to}`;
  const list = data(path);
  const label = ([f, t]) => `${Number(f.slice(8))}–${Number(t.slice(8))} ${MONTHS[Number(t.slice(5, 7)) - 1].slice(0, 3)}`;
  const chips = `<div class="week-chips">${weeks.map((w, i) => `<button type="button" class="week-chip" data-a="set" data-k="hwW${sid}" data-v="${i}" aria-pressed="${i === wi}">${i === 0 ? "Shu hafta · " : ""}${label(w)}</button>`).join("")}</div>`;
  if (list === undefined) return chips + pending(path);
  const items = list.filter((l) => l.homework);
  const done = items.filter((l) => l.done === true).length, missed = items.filter((l) => l.done === false).length, waiting = items.length - done - missed;
  const flt = S.ui["hwF" + sid] || "all";
  const shown = items.filter((l) => flt === "all" || (flt === "done" ? l.done === true : flt === "missed" ? l.done === false : l.done == null));
  const summary = `<div class="ring-card">${ring(items.length ? (done / items.length) * 100 : 0, "bajarilgan")}<div class="col grow" style="gap:6px"><span class="muted small">Bajarilgan</span><b style="font-size:24px">${done} / ${items.length}</b>${bar(items.length ? (done / items.length) * 100 : 0)}<span class="xs muted">${missed} ta bajarilmagan · ${waiting} ta hali tekshirilmagan</span></div></div>`;
  const filters = seg("hwF" + sid, flt, [["all", "Hammasi"], ["done", "Bajarilgan"], ["wait", "Kutilmoqda"], ["missed", "Bajarilmagan"]]);
  const days = [...new Set(shown.map((l) => l.date))];
  const pill = (l) => (l.done === true ? `<span class="st-pill ok">Bajarildi <i>${ic("check", 12)}</i></span>` : l.done === false ? `<span class="st-pill no">Bajarilmadi <i>${ic("close", 11)}</i></span>` : `<span class="st-pill wait">Kutilmoqda <i>${ic("clock", 11)}</i></span>`);
  const body = days.length ? days.map((d) => `<div class="day-h ${d < today() ? "" : "past"}">${d === today() ? "Bugun" : WD[wdOf(d)]}, ${fmtDay(d)}</div>
    <div class="col" style="gap:4px">${shown.filter((l) => l.date === d).map((l) => { const tn = subjTone(l.subject); return `<div class="hw-item ${l.done === true ? "done" : ""}"><span class="s-dot" style="background:${TONE[tn]}1F;color:${TONE[tn]}">${ic("book", 17)}</span><div class="col grow"><b style="color:var(--accent-ink)">${esc(l.subject)}</b><span>${esc(l.homework)}</span>${fileLinks(l.hw_files)}<span class="xs muted">${esc(l.topic || "")}${l.topic ? " · " : ""}${esc(l.teacher_name)}${l.grade ? ` · baho: ${l.grade}` : ""}${l.attendance && l.attendance !== "present" ? " · " + ATT_L[l.attendance][0] : ""}</span></div>${pill(l)}</div>`; }).join("")}</div>`).join("") : empty(items.length ? "Bu filtr bo‘yicha vazifa yo‘q" : "Bu haftada uyga vazifa berilmagan");
  return `${chips}<section class="card">${summary}</section>${filters}<section class="card" style="gap:6px">${body}</section>`;
}

VIEWS["*:student"] = {
  title: () => { const s = S.ui.lastStudent; return s ? sName(s) : "O‘quvchi"; }, back: true, nav: "students",
  render(id) {
    const s = data("/students/" + id);
    if (s === undefined) return pending("/students/" + id);
    S.ui.lastStudent = s;
    const r = role(), staff = STAFF.includes(r), canEdit = staff || r === "teacher";
    const tabs = [["info", "Ma’lumot"], ["stats", "O‘zlashtirish"], ["hw", "Uy vazifalari"], ["ach", "Yutuqlar"], ["fb", "Fikrlar"], ...(ADMINS.includes(r) ? [["docs", "Hujjatlar"]] : []), ...(s.payments ? [["pay", "To‘lovlar"]] : [])];
    const tab = tabs.some((t) => t[0] === S.ui.stab) ? S.ui.stab : "info";
    let body = "";
    if (tab === "info") {
      const p = s.profile || {};
      body = `<div class="kv">${[["Sinf", s.class?.name], ["Sinf rahbari", s.class?.leader_name ? `${s.class.leader_name}${s.class.leader_phone ? " · " + fmtPhone(s.class.leader_phone) : ""}` : ""], ["Tug‘ilgan sana", fmtDate(s.birth_date)], ["Jinsi", s.gender === "f" ? "Qiz" : "O‘g‘il"],
        ["Ota-ona", s.parent?.name], ["Ota-ona telefoni", s.parent ? fmtPhone(s.parent.phone) : ""], ["Manzil", p.address], ["Avvalgi maktab", p.prevSchool], ["Qabul qilingan", fmtDate(s.joined_on)],
        ...(s.monthly_fee != null && r !== "teacher" ? [["Oylik to‘lov", fmtSum(s.monthly_fee)]] : []), ["Qiziqishlari", p.interests], ["Sog‘lig‘i", p.health], ["Izoh", p.notes]].filter((x) => x[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
        ${canEdit ? `<button type="button" class="btn sec sm" style="align-self:flex-start" data-a="modal" data-m="student-edit" data-v="${s.id}">${ic("edit", 16)} Tahrirlash</button>` : ""}`;
    } else if (tab === "stats") body = statsPanel(s.id);
    else if (tab === "hw") body = homeworkPanel(s.id);
    else if (tab === "ach") body = `${s.achievements.length ? `<div class="list">${s.achievements.map((a) => achievementItem(a, staff)).join("")}</div>` : empty("Hozircha yutuqlar qayd etilmagan")}
      ${canEdit ? `<button type="button" class="btn sec sm" style="align-self:flex-start" data-a="modal" data-m="ach-new" data-v="${s.id}">${ic("plus", 16)} Yutuq qo‘shish</button>` : ""}`;
    else if (tab === "fb") body = `${r === "teacher" || staff ? `<form class="stack" style="gap:8px" data-submit="feedback" data-v="${s.id}">${field("fbtext", "Ota-onaga fikr yozing", { area: true, ph: "Masalan, bugun darsda faol qatnashdi…" })}<button type="submit" class="btn sm" style="align-self:flex-start" ${busy("fb") ? "disabled" : ""}>${ic("chat", 16)} Yuborish</button></form>` : ""}
      ${s.feedback.length ? `<div class="list">${s.feedback.map((f) => `<div class="col"><div class="row between"><b class="small">${esc(f.teacher_name)}</b><span class="xs muted">${fmtWhen(f.created_at)}</span></div><span>${esc(f.text)}</span></div>`).join("")}</div>` : empty("Hozircha fikrlar yo‘q")}`;
    else if (tab === "docs") body = docsPanel("student", s.id, s.documents);
    else if (tab === "pay") body = s.payments.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Oy</th><th>Summa</th><th>Usul</th><th>Sana</th><th>Chek</th></tr></thead><tbody>${s.payments.map((p) => `<tr><td>${fmtMonth(p.month)}</td><td>${fmtNum(p.amount)}</td><td>${esc(p.method || "")}</td><td>${fmtDay(p.paid_at)}</td><td>${p.receipt ? fileLinks([p.receipt], { priv: true }) : "—"}</td></tr>`).join("")}</tbody></table></div>` : empty("To‘lovlar yo‘q");
    return `<section class="card profile-head">
        <div class="row wrap" style="gap:16px">${canEdit ? avaEdit(s, 84, "student:" + s.id) : ava(s, 84)}
          <div class="col grow" style="gap:4px"><h2 style="font-size:22px">${esc(sName(s))}</h2><div class="row wrap" style="gap:6px">${s.class ? badge(s.class.name, "green") : ""}${s.status === "left" ? badge("Ketgan", "red") : ""}${s.achievements.length ? badge(`${s.achievements.length} ta yutuq`, "gold") : ""}${(() => { if (!s.class_id) return ""; const r = data(`/ratings/students?period=week&class_id=${s.class_id}`)?.rows?.find((x) => x.id === s.id); return r?.rank && r.rank <= 3 ? `<span class="chip-title">${ic("trophy2", 13)} ${r.rank === 1 ? "Hafta qahramoni — sinfda 1-o‘rin" : `Haftada sinfda ${r.rank}-o‘rin`}</span>` : ""; })()}</div>
          ${s.parent && r !== "parent" ? `<span class="small muted">${ic("phone", 14)} ${esc(s.parent.name)} · ${fmtPhone(s.parent.phone)}</span>` : ""}</div>
          ${pdfBtn(`/pdf/student/${s.id}`, `${sName(s).replace(/\s+/g, "_")}.pdf`)}</div>
      </section>
      <div class="pills">${tabs.map(([k, l]) => `<button type="button" class="pill" data-a="set" data-k="stab" data-v="${k}" aria-pressed="${k === tab}">${l}</button>`).join("")}</div>
      ${tab === "hw" ? body : `<section class="card">${body}</section>`}`;
  },
};
ACTIONS["change:" + "sm"] = () => {};
SUBMITS.feedback = async (form) => {
  await run("fb", () => post("/feedback", { student_id: Number(form.dataset.v), text: fv("fbtext") }), { ok: "Fikr ota-onaga yuborildi", invalidate: ["/students/" + form.dataset.v] });
  S.f.fbtext = ""; render();
};
ACTIONS["ach-del"] = async (el) => {
  if (S.ui.confirmDel !== "a" + el.dataset.v) { S.ui.confirmDel = "a" + el.dataset.v; toast("O‘chirish uchun yana bir marta bosing"); return; }
  await run("ach", () => del("/achievements/" + el.dataset.v), { ok: "O‘chirildi", invalidate: ["/students"] });
};
MODALS["ach-new"] = (m) => `${modalHead("Yutuq qo‘shish", "Olimpiada, tanlov yoki boshqa yutuq")}
  <form class="stack" style="gap:12px" data-submit="ach-new" data-v="${m.id}">
    ${field("atitle", "Nomi", { required: true, ph: "Masalan, Matematika olimpiadasi" })}
    <div class="row wrap" style="align-items:flex-start">${field("akind", "Turi", { options: Object.entries(ACH_KIND), def: "olympiad", blank: false })}${field("alevel", "Bosqich", { options: ["Maktab", "Tuman", "Shahar", "Viloyat", "Respublika", "Xalqaro"].map((x) => [x, x]) })}</div>
    <div class="row wrap" style="align-items:flex-start">${field("aplace", "O‘rin", { options: [["1", "1-o‘rin"], ["2", "2-o‘rin"], ["3", "3-o‘rin"], ["", "Ishtirokchi"]], blank: false, def: "1" })}${field("asubj", "Fan", { options: S.me.subjects.map((s) => [s.name, s.name]) })}${field("adate", "Sana", { type: "date", def: today() })}</div>
    ${fileBox("ach", { label: "Sertifikat / diplom", multiple: false })}
    <button type="submit" class="btn" ${busy("ach") ? "disabled" : ""}>Saqlash</button>
  </form>`;
SUBMITS["ach-new"] = async (form) => {
  await run("ach", () => post(`/students/${form.dataset.v}/achievements`, { title: fv("atitle"), kind: fv("akind", "olympiad"), level: fv("alevel"), place: fv("aplace", "1"), subject: fv("asubj"), date: fv("adate", today()), file: (S.files.ach || [])[0] || null }), { ok: "Yutuq qo‘shildi", invalidate: ["/students", "/ratings"] });
  S.f.atitle = ""; S.files.ach = []; closeModal();
};

/** Documents list with upload (students and teachers), admin roles only. */
export function docsPanel(type, id, docs) {
  const kinds = type === "student" ? ["passport", "metrika", "atestat", "medical", "contract", "photo", "other"] : ["passport", "diploma", "employment", "certificate", "medical", "other"];
  return `${docs?.length ? `<div class="list">${docs.map((d) => `<div class="row">${ic("file", 20)}<div class="col grow"><b class="small">${esc(DOC_KIND[d.kind] || d.kind)}</b><span class="xs muted">${esc(d.name)} · ${fmtSize(d.file?.size)} · ${fmtDay(d.created_at)}</span></div><button type="button" class="btn sec sm" data-a="file-open" data-v="${esc(d.file.id)}">Ochish</button>${STAFF.includes(role()) ? `<button type="button" class="iconbtn" style="width:36px;height:36px" data-a="doc-del" data-v="${d.id}" aria-label="O‘chirish">${ic("trash", 15)}</button>` : ""}</div>`).join("")}</div>` : empty("Hujjatlar yuklanmagan")}
    <form class="stack" style="gap:10px;border-top:1px solid var(--line);padding-top:12px" data-submit="doc-new" data-t="${type}" data-v="${id}">
      <b class="small">Yangi hujjat</b>
      <div class="row wrap" style="align-items:flex-end">${field("dkind", "Hujjat turi", { options: kinds.map((k) => [k, DOC_KIND[k]]), blank: false, def: kinds[0] })}</div>
      ${fileBox("priv:doc", { label: "Faylni tanlash", multiple: false, hint: "Skaner, rasm yoki PDF, 3 MB gacha" })}
      <button type="submit" class="btn sm" style="align-self:flex-start" ${busy("doc") || !(S.files["priv:doc"] || []).length ? "disabled" : ""}>Hujjatni saqlash</button>
    </form>`;
}
SUBMITS["doc-new"] = async (form) => {
  const file = (S.files["priv:doc"] || [])[0]; if (!file) return toast("Fayl tanlang");
  await run("doc", () => post("/documents", { owner_type: form.dataset.t, owner_id: Number(form.dataset.v), kind: fv("dkind", "other"), name: file.name, file }), { ok: "Hujjat saqlandi", invalidate: ["/students/" + form.dataset.v, "/teachers/" + form.dataset.v, "/contracts"] });
  S.files["priv:doc"] = []; render();
};
ACTIONS["doc-del"] = async (el) => {
  if (S.ui.confirmDel !== "d" + el.dataset.v) { S.ui.confirmDel = "d" + el.dataset.v; toast("O‘chirish uchun yana bir marta bosing"); return; }
  await run("doc", () => del("/documents/" + el.dataset.v), { ok: "Hujjat o‘chirildi", invalidate: ["/students", "/teachers", "/contracts"] });
};

/* edit student (staff: all fields; teacher: personal fields) */
MODALS["student-edit"] = (m) => {
  const s = data("/students/" + m.id) || {};
  if (!S.ui.seFilled || S.ui.seFilled !== m.id) {
    const p = s.profile || {};
    fill({ sfirst: s.first_name, slast: s.last_name, sbirth: s.birth_date, sgender: s.gender || "m", sclass: s.class_id, sfee: s.monthly_fee, saddr: p.address, sprev: p.prevSchool, snotes: p.notes, shealth: p.health, sint: p.interests, sstatus: s.status });
    S.ui.seFilled = m.id;
  }
  const staff = STAFF.includes(role());
  return `${modalHead("O‘quvchi ma’lumotlari", sName(s))}
    <form class="stack" style="gap:12px" data-submit="student-edit" data-v="${m.id}">
      <div class="row wrap" style="align-items:flex-start">${field("slast", "Familiya", { required: true })}${field("sfirst", "Ism", { required: true })}</div>
      <div class="row wrap" style="align-items:flex-start">${field("sbirth", "Tug‘ilgan sana", { type: "date" })}${field("sgender", "Jinsi", { options: [["m", "O‘g‘il"], ["f", "Qiz"]], blank: false })}</div>
      ${staff ? `<div class="row wrap" style="align-items:flex-start">${field("sclass", "Sinf", { options: S.me.classes.map((c) => [c.id, c.name]) })}${field("sfee", "Oylik to‘lov (so‘m)", { mode: "numeric" })}${field("sstatus", "Holati", { options: [["active", "O‘qiydi"], ["left", "Ketgan"]], blank: false })}</div>` : ""}
      ${field("saddr", "Manzil")}${field("sprev", "Avvalgi maktab (ko‘chib kelgan bo‘lsa)")}
      ${field("sint", "Qiziqishlari / to‘garaklar")}${field("shealth", "Sog‘lig‘i haqida")}${field("snotes", "Izoh", { area: true })}
      <button type="submit" class="btn" ${busy("se") ? "disabled" : ""}>Saqlash</button>
    </form>`;
};
SUBMITS["student-edit"] = async (form) => {
  const id = form.dataset.v, staff = STAFF.includes(role());
  const body = { first_name: fv("sfirst"), last_name: fv("slast"), birth_date: fv("sbirth") || null, gender: fv("sgender", "m"), profile: { address: fv("saddr"), prevSchool: fv("sprev"), notes: fv("snotes"), health: fv("shealth"), interests: fv("sint") } };
  if (staff) Object.assign(body, { class_id: fv("sclass") || null, monthly_fee: fv("sfee", "0"), status: fv("sstatus", "active") });
  await run("se", () => patch("/students/" + id, body), { ok: "Saqlandi", invalidate: ["/students", "/ratings", "/lessons"] });
  S.ui.seFilled = null; closeModal();
};

/** Public student card (parents tapping a name in the rating). */
MODALS["student-card"] = (m) => {
  const c = data(`/students/${m.id}/card`);
  if (c === undefined) return `${modalHead("O‘quvchi")}${pending(`/students/${m.id}/card`)}`;
  return `<div class="row" style="align-items:flex-start;gap:14px">${ava(c, 72)}<div class="col grow"><h2 style="font-size:20px">${esc(sName(c))}</h2><span class="muted">${esc(c.class_name || "")}</span>${c.interests ? `<span class="small">${esc(c.interests)}</span>` : ""}</div><button type="button" class="iconbtn" data-a="close-modal" aria-label="Yopish">${ic("close", 16)}</button></div>
    <div class="col" style="gap:8px"><b>Fanlarni o‘zlashtirish — ${fmtMonth(c.month)}</b>${c.subjects.length ? c.subjects.map((x) => `<div class="col" style="gap:4px"><div class="row between small"><span>${esc(x.subject)}</span><b style="color:${avgColor(x.avg)}">${fmtAvg(x.avg)}</b></div>${bar((x.avg / 5) * 100, avgColor(x.avg))}</div>`).join("") : `<span class="small muted">Bu oyda baholar yo‘q</span>`}</div>
    <div class="col" style="gap:8px"><b>Yutuqlar va olimpiadalar</b>${c.achievements.length ? `<div class="list">${c.achievements.map((a) => achievementItem(a, false)).join("")}</div>` : `<span class="small muted">Hozircha qayd etilmagan</span>`}</div>`;
};

/* ================= teacher page ================= */
export function reviewItem(r) {
  return `<div class="row" style="align-items:flex-start;gap:10px">${ava({ id: r.student_id, photo: r.student_photo, gender: r.student_gender }, 38)}<div class="col grow" style="gap:2px;min-width:0"><div class="row between wrap" style="gap:6px"><b class="small">${esc(r.parent_name)}</b><span class="xs muted">${fmtWhen(r.created_at)}</span></div><span class="xs muted">${r.student_name ? `${esc(r.student_name)} (${esc(r.class_name || "")}) ota-onasi` : "Ota-ona"}</span><span>${starsHtml(r.stars, 13)}</span>${r.comment ? `<span>${esc(r.comment)}</span>` : ""}</div></div>`;
}
VIEWS["*:teacher"] = {
  title: () => S.ui.lastTeacher?.name || "O‘qituvchi", back: true, nav: "teachers",
  render(id) {
    const t = data("/teachers/" + id);
    if (t === undefined) return pending("/teachers/" + id);
    S.ui.lastTeacher = t;
    const r = role(), admin = ADMINS.includes(r), self = user().id === t.id, staff = STAFF.includes(r);
    const p = t.profile || {};
    const avg = t.reviews.length ? t.reviews.reduce((a, x) => a + x.stars, 0) / t.reviews.length : null;
    const subjects = [...new Set(t.schedule.map((x) => x.subject))], classes = [...new Set(t.schedule.map((x) => x.class_name))];
    const tabs = [["info", "Ma’lumot"], ["reviews", `Fikrlar va baholar (${t.reviews.length})`], ["open", `Ochiq darslar (${t.openLessons.length})`], ...(t.recentLessons ? [["lessons", "O‘tgan darslar"]] : []), ...(t.salaries ? [["salary", "Oyliklar"]] : []), ...(admin ? [["docs", "Hujjatlar"]] : [])];
    const tab = tabs.some((x) => x[0] === S.ui.ttab) ? S.ui.ttab : "info";
    let body = "";
    if (tab === "info") body = `<div class="kv">${[["Lavozim", p.position], ["Fanlar", subjects.join(", ") || p.subjects], ["Sinflar", classes.join(", ")], ["Sinf rahbari", t.leads.map((c) => c.name).join(", ")], ["Telefon", fmtPhone(t.phone)], ["Ish staji", p.experience ? p.experience + " yil" : ""], ["Toifa", p.category], ["Ma’lumoti", p.education],
      ...(admin || self ? [["Tug‘ilgan sana", fmtDate(p.birthDate)], ["Manzil", p.address], ["Pasport", p.passport], ["Ishga qabul", fmtDate(p.hiredOn)], ...(FINANCE.includes(r) || self ? [["Oylik maosh", p.salary ? fmtSum(p.salary) : ""]] : [])] : []), ["Yutuqlari", p.achievements], ["O‘zi haqida", p.about]].filter((x) => x[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
      ${t.schedule.length ? `<div class="col" style="gap:6px"><b class="small">Haftalik dars soati: ${t.schedule.length}</b></div>` : ""}
      ${staff ? `<button type="button" class="btn sec sm" style="align-self:flex-start" data-a="modal" data-m="teacher-edit" data-v="${t.id}">${ic("edit", 16)} Tahrirlash</button>` : self ? `<span class="small muted">${ic("lock", 14)} Ma’lumotlarni faqat administrator tahrirlay oladi</span>` : ""}`;
    else if (tab === "reviews") body = t.reviews.length ? `<div class="list">${t.reviews.map(reviewItem).join("")}</div>` : empty("Hali baho qoldirilmagan");
    else if (tab === "open") body = t.openLessons.length ? `<div class="list">${t.openLessons.map((o) => `<button type="button" class="row" style="border:0;background:transparent;text-align:left;width:100%" data-a="go" data-r="post-${o.id}"><span class="avatar" style="background:var(--gold-soft);color:var(--gold-ink)">${ic("megaphone", 17)}</span><div class="col grow"><b class="small">${esc(o.title)}</b><span class="xs muted">${fmtDate(o.event?.date || o.created_at)}${o.event?.place ? " · " + esc(o.event.place) : ""}</span></div>${ic("chevron", 16)}</button>`).join("")}</div>` : empty("Ochiq darslar hali o‘tkazilmagan");
    else if (tab === "lessons") body = `${t.lessonsByMonth.length ? `<div class="row wrap" style="gap:8px">${t.lessonsByMonth.slice(0, 6).map((m) => `<div class="stat" style="background:var(--surface-2);flex:1 1 120px;padding:12px"><span class="xs muted">${fmtMonth(m.month)}</span><span class="v" style="font-size:22px">${m.ended}</span><span class="xs">yakunlangan dars</span></div>`).join("")}</div>` : ""}
      ${t.recentLessons.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Sana</th><th>Sinf</th><th>Fan</th><th style="text-align:left">Mavzu</th><th style="text-align:left">Uyga vazifa</th></tr></thead><tbody>${t.recentLessons.map((l) => `<tr><td>${fmtDay(l.date)}, ${l.period}-soat</td><td>${esc(l.class_name)}</td><td>${esc(l.subject)}</td><td style="text-align:left;white-space:normal">${esc(l.topic || "")}</td><td style="text-align:left;white-space:normal">${esc(l.homework || "—")}</td></tr>`).join("")}</tbody></table></div>` : empty("Darslar tarixi yo‘q")}`;
    else if (tab === "salary") body = t.salaries.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Oy</th><th>Summa</th><th>To‘langan</th><th>Chek</th></tr></thead><tbody>${t.salaries.map((x) => `<tr><td>${fmtMonth(x.month)}</td><td>${fmtNum(x.amount)}</td><td>${fmtDay(x.paid_at)}</td><td>${x.receipt ? fileLinks([x.receipt], { priv: true }) : "—"}</td></tr>`).join("")}<tr class="total"><td>Jami</td><td>${fmtNum(t.salaries.reduce((a, x) => a + x.amount, 0))}</td><td></td><td></td></tr></tbody></table></div>` : empty("Oylik to‘lovlari yo‘q");
    else if (tab === "docs") body = docsPanel("teacher", t.id, t.documents);
    const canRate = r === "parent" && S.me.children.some((k) => t.schedule.some((x) => x.class_id === k.class_id) || t.leads.some((c) => c.id === k.class_id));
    return `<section class="card profile-head"><div class="row wrap" style="gap:16px">${staff ? avaEdit(t, 84, "user:" + t.id, "t") : ava(t, 84, "t")}
        <div class="col grow" style="gap:4px"><h2 style="font-size:22px">${esc(t.name)}</h2><span class="muted">${esc(p.position || subjects.join(", ") || "O‘qituvchi")}</span>
          <div class="row wrap" style="gap:8px">${avg ? `<span class="row" style="gap:4px">${starsHtml(avg, 15)}<b>${fmtAvg(avg)}</b><span class="xs muted">(${t.reviews.length})</span></span>` : `<span class="small muted">Hali baholanmagan</span>`}${t.leads.length ? badge(t.leads.map((c) => c.name).join(", ") + " sinf rahbari", "gold") : ""}${(() => { const r = data("/ratings/teachers?month=" + curMonth())?.rows?.find((x) => x.id === t.id); return r && r.rank <= 3 && (r.votes || r.open_lessons) ? `<span class="chip-title">${ic("trophy2", 13)} ${r.rank === 1 ? "Oyning eng yaxshi o‘qituvchisi" : `Reytingda ${r.rank}-o‘rin`}</span>` : ""; })()}</div></div>
        <div class="row wrap" style="gap:8px">${canRate ? `<button type="button" class="btn" data-a="modal" data-m="rate" data-v="${t.id}">${ic("star", 17)} Baholash</button>` : ""}${admin || self ? pdfBtn(`/pdf/teacher/${t.id}`, `${t.name.replace(/\s+/g, "_")}.pdf`) : ""}</div></div></section>
      <div class="pills">${tabs.map(([k, l]) => `<button type="button" class="pill" data-a="set" data-k="ttab" data-v="${k}" aria-pressed="${k === tab}">${esc(l)}</button>`).join("")}</div>
      <section class="card">${body}</section>`;
  },
};
MODALS.rate = (m) => {
  const t = data("/teachers/" + m.id) || {};
  const stars = Number(fv("rstars", "0"));
  return `${modalHead("O‘qituvchini baholash", esc(t.name || ""))}
    <form class="stack" style="gap:12px" data-submit="rate" data-v="${m.id}">
      <div class="starpick" role="radiogroup" aria-label="Baho">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-a="rstar" data-v="${i}" aria-pressed="${i <= stars}" aria-label="${i} yulduz">${ic("star", 34)}</button>`).join("")}</div>
      ${field("rcomment", "Fikringiz (ixtiyoriy)", { area: true, ph: "Darslar, munosabat, natijalar haqida…" })}
      <span class="xs muted">Har oyda bir marta baholaysiz; qayta yuborsangiz shu oydagi bahoingiz yangilanadi. Fikringizni o‘qituvchi va maktab ma’muriyati ko‘radi.</span>
      <button type="submit" class="btn" ${!stars || busy("rate") ? "disabled" : ""}>Yuborish</button>
    </form>`;
};
ACTIONS.rstar = (el) => { S.f.rstars = el.dataset.v; render(); };
SUBMITS.rate = async (form) => {
  await run("rate", () => post("/teacher-ratings", { teacher_id: Number(form.dataset.v), stars: Number(fv("rstars")), comment: fv("rcomment") }), { ok: "Rahmat! Bahoingiz yuborildi.", invalidate: ["/teachers", "/ratings"] });
  S.f.rstars = ""; S.f.rcomment = ""; closeModal();
};

/* ================= ratings ================= */
VIEWS["*:ratings"] = {
  title: "Reyting",
  render() {
    const kind = S.ui.rkind || "students";
    return `${seg("rkind", kind, [["students", "O‘quvchilar"], ["teachers", "O‘qituvchilar"]])}${kind === "students" ? studentRatings() : teacherRatings()}`;
  },
};
function studentRatings() {
  const r = role();
  const period = S.ui.rper || "week";
  const kids = r === "parent" ? S.me.children : [];
  const myCls = r === "parent" ? kids.map((k) => k.class_id) : r === "teacher" ? S.me.myClasses : [];
  const scope = S.ui.rscope !== undefined ? S.ui.rscope : String(myCls[0] || "");
  const classes = S.me.classes;
  const path = `/ratings/students?period=${period}${scope ? "&class_id=" + scope : ""}`;
  const res = data(path);
  const opts = [["", "Butun maktab"], ...classes.map((c) => [String(c.id), c.name])];
  const head = `<div class="row wrap between">${seg("rper", period, [["day", "Bugun"], ["week", "Hafta"], ["month", "Oy"], ["year", "O‘quv yili"]])}<select class="input" style="width:auto" data-f="rscope" aria-label="Sinf">${opts.map(([v, l]) => `<option value="${v}" ${v === scope ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  if (res === undefined) return head + pending(path);
  const mine = new Set(kids.map((k) => k.id));
  const rows = res.rows;
  const podium = rows.filter((x) => x.rank && x.rank <= 3).slice(0, 3);
  return `${head}
    ${podium.length ? `<div class="podium">${podium.map((x) => `<button type="button" class="pod p${x.rank}" data-a="stu-open" data-v="${x.id}">${rankMark(x.rank)}${ava(x, 64)}<b>${esc(x.first_name)}</b><span class="xs muted">${esc(x.class_name || "")}</span><span class="pod-avg">${fmtAvg(x.avg)}</span></button>`).join("")}</div>` : ""}
    <section class="card"><span class="xs muted">${fmtDay(res.from)}${res.from !== res.to ? " — " + fmtDay(res.to) : ""} · o‘rtacha baho bo‘yicha</span>
      <div class="col" style="gap:4px">${rows.map((x) => `<button type="button" class="rank-row ${mine.has(x.id) ? "mine" : ""} ${x.rank === 1 ? "top1" : ""}" style="width:100%;text-align:left;background-color:${mine.has(x.id) ? "" : "transparent"}" data-a="stu-open" data-v="${x.id}">${rankMark(x.rank)}${ava(x, 40)}<div class="col grow"><b class="small">${esc(sName(x))}${x.achievements ? ` <span title="Yutuqlar" style="color:var(--gold)">${ic("medal", 14)}</span>` : ""}</b><span class="xs muted">${esc(x.class_name || "")} · ${x.n} ta baho</span></div><b style="color:${avgColor(x.avg)}">${fmtAvg(x.avg)}</b></button>`).join("") || empty("Bu davrda baholar yo‘q")}</div></section>`;
}
ACTIONS["stu-open"] = (el) => {
  const id = Number(el.dataset.v), r = role();
  const kids = r === "parent" ? S.me.children.map((k) => k.id) : [];
  if (ADMINS.includes(r) || kids.includes(id)) return go("student-" + id);
  if (r === "teacher") { const row = Object.values(S.ui).length; void row; }
  openModal({ type: r === "teacher" ? "student-peek" : "student-card", id });
};
MODALS["student-peek"] = (m) => {
  // teachers: full page for their classes, public card otherwise
  const c = data(`/students/${m.id}/card`);
  if (c && S.me.myClasses.includes(c.class_id)) { setTimeout(() => { closeModal(); go("student-" + m.id); }, 0); return ""; }
  return MODALS["student-card"](m);
};
function teacherRatings() {
  const mode = S.ui.trmode || "month";
  const month = S.ui.trmonth || curMonth(), year = S.ui.tryear || today().slice(0, 4);
  const path = mode === "year" ? `/ratings/teachers?year=${year}` : `/ratings/teachers?month=${month}`;
  const res = data(path);
  const months = Array.from({ length: 12 }, (_, i) => monthShift(curMonth(), -i));
  const head = `<div class="row wrap between">${seg("trmode", mode, [["month", "Oylik"], ["year", "Yillik"]])}${mode === "year" ? `<select class="input" style="width:auto" data-f="tryear">${[0, 1, 2].map((i) => String(Number(today().slice(0, 4)) - i)).map((y) => `<option ${y === year ? "selected" : ""}>${y}</option>`).join("")}</select>` : `<select class="input" style="width:auto" data-f="trmonth">${months.map((m) => `<option value="${m}" ${m === month ? "selected" : ""}>${fmtMonth(m)}</option>`).join("")}</select>`}</div>`;
  if (res === undefined) return head + pending(path);
  return `${head}<section class="card"><span class="xs muted">Ball = ota-onalar bahosi (${res.weights.starsWeight}%) + ochiq darslar (${res.weights.openLessonWeight}%, ${mode === "year" ? "yiliga" : "oyiga"} ${res.target} ta = to‘liq ball). Baho kam bo‘lsa, o‘rtacha 4,0 tomon tekislanadi.</span>
    <div class="col" style="gap:4px">${res.rows.map((x) => `<button type="button" class="rank-row ${x.rank === 1 ? "top1" : ""}" style="width:100%;text-align:left;background-color:transparent" data-a="go" data-r="teacher-${x.id}">${rankMark(x.rank)}${ava(x, 42, "t")}<div class="col grow"><b class="small">${esc(x.name)}</b><span class="xs muted">${esc((x.subjects || []).join(", "))}</span><span class="xs">${x.stars != null ? `${starsHtml(x.stars, 11)} ${fmtAvg(x.stars)} (${x.votes})` : `<span class="muted">baho yo‘q</span>`} · ${x.open_lessons} ochiq dars</span></div><div class="col" style="align-items:flex-end;gap:0"><b style="font-size:18px">${fmtAvg(x.score)}</b><span class="xs muted">ball</span></div></button>`).join("") || empty("O‘qituvchilar yo‘q")}</div></section>`;
}

/* ================= schedule (week / month, ahead and history) ================= */
const ST_L = { ended: ["O‘tildi", "green"], started: ["Ketmoqda", "gold"], planned: ["Rejada", ""], missed: ["Kiritilmagan", "red"] };
export function scheduleView({ teacherId = null, classId = null, title = "" } = {}) {
  const mode = S.ui.schMode || "week";
  const ref = S.ui.schRef || today();
  const from = mode === "week" ? mondayOf(ref) : ref.slice(0, 7) + "-01";
  const to = mode === "week" ? addDays(from, 5) : monthEnd(ref.slice(0, 7));
  if (!teacherId && !classId) return empty("Sinf yoki o‘qituvchini tanlang");
  const path = `/lessons?from=${from}&to=${to}${teacherId ? "&teacher_id=" + teacherId : ""}${classId ? "&class_id=" + classId : ""}`;
  const list = data(path);
  const times = periodTimes(settings().bell);
  const step = mode === "week" ? 7 : 31;
  const nav = `<div class="row wrap between"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-a="set" data-k="schRef" data-v="${mode === "week" ? addDays(from, -7) : monthShift(from.slice(0, 7), -1) + "-01"}" aria-label="Oldingi">${ic("back", 18)}</button><b style="min-width:150px;text-align:center">${mode === "week" ? `${fmtDay(from)} — ${fmtDay(to)}` : fmtMonth(from.slice(0, 7))}</b><button type="button" class="iconbtn" data-a="set" data-k="schRef" data-v="${mode === "week" ? addDays(from, 7) : monthShift(from.slice(0, 7), 1) + "-01"}" aria-label="Keyingi">${ic("chevron", 18)}</button><button type="button" class="btn ghost sm" data-a="set" data-k="schRef" data-v="${today()}">Bugun</button></div>${seg("schMode", mode, [["week", "Hafta"], ["month", "Oy"]])}</div>`;
  void step;
  if (list === undefined) return nav + pending(path);
  const t = today();
  const status = (l) => (l.status === "planned" && l.date < t ? "missed" : l.status);
  const cell = (l) => {
    const st = status(l), tm = times.find((x) => x.period === l.period);
    return `<div class="sch-item st-${st}"><div class="row between" style="gap:6px"><b class="small">${l.period}. ${esc(l.subject)}</b><span class="xs muted">${tm ? hm(tm.start) : ""}</span></div><span class="xs muted">${esc(teacherId ? l.class_name : l.teacher_name)}</span>${l.topic ? `<span class="xs">${esc(l.topic)}</span>` : ""}${l.homework ? `<span class="xs" style="color:var(--accent-ink)">${ic("book", 12)} ${esc(l.homework)}</span>` : ""}${st !== "planned" ? badge(ST_L[st][0], ST_L[st][1]) : ""}${role() === "teacher" && l.lesson_id ? `<button type="button" class="linkbtn xs" style="align-self:flex-start" data-a="go" data-r="lesson-${l.lesson_id}">Ochish</button>` : ""}</div>`;
  };
  const days = []; for (let d = from; d <= to; d = addDays(d, 1)) if (wdOf(d) !== 0) days.push(d);
  if (mode === "week") return `${nav}<div class="week-grid">${days.map((d) => { const ls = list.filter((l) => l.date === d); return `<div class="week-col ${d === t ? "today" : ""}"><div class="week-day"><b>${WD[wdOf(d)]}</b><span class="xs muted">${fmtDay(d)}</span></div>${ls.map(cell).join("") || `<span class="xs muted" style="padding:8px">Dars yo‘q</span>`}</div>`; }).join("")}</div>`;
  const withL = days.filter((d) => list.some((l) => l.date === d));
  return `${nav}${withL.length ? withL.map((d) => `<section class="card" style="gap:8px"><div class="row between"><b>${WD[wdOf(d)]}, ${fmtDay(d)}</b>${d === t ? badge("Bugun", "green") : ""}</div><div class="month-list">${list.filter((l) => l.date === d).map(cell).join("")}</div></section>`).join("") : `<section class="card">${empty("Bu oyda darslar yo‘q")}</section>`}`;
}
VIEWS["*:schedule"] = {
  title: "Dars jadvali",
  render() {
    const r = role();
    if (r === "teacher") return scheduleView({ teacherId: user().id });
    if (r === "parent") { const k = currentKid(); return kidSwitcher() + (k ? scheduleView({ classId: k.class_id }) : empty("Farzand biriktirilmagan")); }
    const by = S.ui.schBy || "class";
    const classes = S.me.classes;
    const teachers = data("/teachers") || [];
    const cls = S.ui.schCls || String(classes[0]?.id || ""), tid = S.ui.schT || String(teachers[0]?.id || "");
    return `<div class="row wrap" style="gap:10px">${seg("schBy", by, [["class", "Sinf bo‘yicha"], ["teacher", "O‘qituvchi bo‘yicha"]])}
      ${by === "class" ? `<select class="input" style="width:auto" data-f="schCls">${classes.map((c) => `<option value="${c.id}" ${String(c.id) === cls ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>` : `<select class="input" style="width:auto" data-f="schT">${teachers.map((t) => `<option value="${t.id}" ${String(t.id) === tid ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>`}</div>
      ${by === "class" ? scheduleView({ classId: Number(cls) || null }) : scheduleView({ teacherId: Number(tid) || null })}`;
  },
};
for (const k of ["schCls", "schT", "rscope", "trmonth", "tryear"]) ACTIONS["change:" + k] = (el) => { S.ui[k] = el.value; };

/* ================= parent helpers shared by several pages ================= */
export function currentKid() {
  const kids = S.me?.children || [];
  return kids.find((k) => String(k.id) === String(S.ui.kid)) || kids[0] || null;
}
export function kidSwitcher() {
  const kids = S.me?.children || [];
  if (kids.length < 2) return "";
  const cur = currentKid();
  return `<div class="kids">${kids.map((k) => `<button type="button" class="kid" data-a="set" data-k="kid" data-v="${k.id}" aria-pressed="${k.id === cur?.id}">${ava(k, 30)}${esc(k.first_name)}</button>`).join("")}</div>`;
}

/* month selects inside stats panels */
document.addEventListener("change", (e) => {
  const f = e.target?.dataset?.f || "";
  if (/^sm\d+$/.test(f)) { S.ui[f] = e.target.value; render(); }
});

export { put, api, tzNow, initials, WDS, settings };
