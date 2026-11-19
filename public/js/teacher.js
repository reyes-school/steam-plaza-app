// Teacher panel: today with live timer, lesson workspace, classes, open lessons, parents' reviews.
import {
  S, VIEWS, ACTIONS, SUBMITS, MODALS, NAV, render, go, api, post, patch, put, run, busy, data, pending, invalidate, toast, openModal, closeModal, modalHead,
  esc, ic, badge, seg, cardHead, empty, bar, field, fv, fill, starsHtml, rankMark, avgColor, ava, fileBox, fileLinks, linkTo,
  fmtDay, fmtDate, fmtWhen, fmtMonth, fmtAvg, hm, sName, today, curMonth, wdOf, WD, user, settings, periodTimes, tzNow, celebrateOnce, CUP, confetti, greeting, tile,
} from "./core.js";
import { reviewItem, postCard } from "./common.js";

NAV.teacher = [["today", "Bugun", "home"], ["schedule", "Jadval", "calendar"], ["classes", "Sinflarim", "users"], ["ratings", "Reyting", "trophy"], ["openlessons", "Ochiq darslar", "megaphone"], ["absences", "Kelmaslik xabarlari", "bell"], ["reviews", "Fikrlar va baholar", "star"], ["news", "Yangiliklar", "news"]];

const slotOf = (p) => periodTimes(settings().bell).find((x) => x.period === p);
function timing(date, period) {
  const t = slotOf(period); if (!t) return null;
  const now = tzNow();
  if (date !== now.date) return { t, state: date < now.date ? "past" : "future" };
  if (now.min < t.start) return { t, state: "before", mins: t.start - now.min };
  if (now.min >= t.end) return { t, state: "after" };
  return { t, state: "now", left: t.end - now.min, pct: ((now.min - t.start) / (t.end - t.start)) * 100 };
}

/* ================= today ================= */
VIEWS["teacher:today"] = {
  title: "Bugun", noHead: true,
  render() {
    const tr = data("/ratings/teachers?month=" + curMonth());
    const me = tr?.rows?.find((x) => x.id === user().id);
    if (me && me.rank === 1 && (me.votes || me.open_lessons)) celebrateOnce(`sp.cele.t${user().id}.${curMonth()}`, { type: "teacher-celebrate", extra: JSON.stringify(me) });
    const banner = me && me.rank <= 3 ? `<section class="card" style="background:${me.rank === 1 ? "var(--gold-soft)" : "var(--accent-soft)"};border-color:${me.rank === 1 ? "var(--gold)" : "var(--line)"}"><div class="row">${rankMark(me.rank)}<div class="col grow"><b>${me.rank === 1 ? "Siz oyning eng yaxshi o‘qituvchisisiz!" : `Siz o‘qituvchilar reytingida ${me.rank}-o‘rindasiz`}</b><span class="small muted">${fmtMonth(curMonth())} · ${fmtAvg(me.score)} ball · ${me.stars != null ? fmtAvg(me.stars) + " ★, " : ""}${me.open_lessons} ochiq dars</span></div>${me.rank === 1 ? `<button type="button" class="btn sm" data-a="t-cele">${ic("trophy", 16)}</button>` : ""}</div></section>` : "";
    const d = today(), list = data(`/lessons?from=${d}&to=${d}`) || [];
    const t = data("/teachers/" + user().id);
    const avg = t?.reviews?.length ? t.reviews.reduce((a, x) => a + x.stars, 0) / t.reviews.length : null;
    const tiles = `<div class="tiles four">
      ${tile({ icon: "calendar", label: "Bugungi darslar", value: String(list.length), tone: "green", route: "schedule" })}
      ${tile({ icon: "check", label: "Yakunlangan", value: String(list.filter((l) => l.status === "ended").length), tone: "mint" })}
      ${tile({ icon: "trophy", label: "Oy reytingi", value: me ? `${me.rank}/${tr.rows.length}` : "—", tone: "lav", route: "ratings" })}
      ${tile({ icon: "star", label: "Ota-onalar bahosi", value: avg ? fmtAvg(avg) : "—", tone: "yellow", route: "reviews" })}</div>`;
    const abs = (data("/absences?from=" + d + "&to=" + d) || []);
    const absCard = abs.length ? `<button type="button" class="doc-row" style="border:0;background:var(--info-soft);color:var(--info);text-align:left" data-a="go" data-r="absences">${ic("bell", 18)}<span class="grow small"><b>Bugun kelmaydi (ota-ona xabar bergan):</b> ${abs.map((a) => esc(`${a.last_name} ${a.first_name} (${a.class_name || ""})`)).join(", ")}</span>${ic("chevron", 16)}</button>` : "";
    return greeting(user().name) + tiles + absCard + banner + todayBody();
  },
};
ACTIONS["t-cele"] = () => { const tr = data("/ratings/teachers?month=" + curMonth()); const me = tr?.rows?.find((x) => x.id === user().id); if (me) { openModal({ type: "teacher-celebrate", extra: JSON.stringify(me) }); confetti(); } };
MODALS["teacher-celebrate"] = (m) => {
  const me = JSON.parse(m.extra || "{}");
  return `<div class="col celebrate" style="gap:10px;padding:14px;border-radius:18px">${ava(user(), 84, "t")}${CUP}
    <span class="chip-title">${ic("trophy2", 14)} ${fmtMonth(curMonth())}</span><h2 class="big">Oyning eng yaxshi o‘qituvchisi!</h2>
    <span style="font-size:16px">Hurmatli <b>${esc(user().name)}</b>, ota-onalar bahosi va ochiq darslaringiz bo‘yicha maktabda <b>1-o‘rindasiz</b>. Mehnatingiz uchun rahmat!</span>
    <span class="small muted">${fmtAvg(me.score)} ball · ${me.stars != null ? fmtAvg(me.stars) + " ★ (" + me.votes + " baho)" : ""} · ${me.open_lessons} ochiq dars</span>
    <button type="button" class="btn" data-a="close-modal">Rahmat!</button></div>`;
};
function todayBody() {
  {
    const d = today(), path = `/lessons?from=${d}&to=${d}`;
    const list = data(path);
    if (list === undefined) return pending(path);
    const wd = wdOf(d);
    if (!list.length) return `<section class="card">${empty(wd === 0 ? "Bugun yakshanba — dam olish kuni" : "Bugun sizda dars yo‘q")}</section>${linkTo("Haftalik jadval →", "schedule")}`;
    const cur = list.find((l) => timing(l.date, l.period)?.state === "now");
    const next = list.find((l) => timing(l.date, l.period)?.state === "before");
    const hero = cur || next;
    const tm = hero ? timing(hero.date, hero.period) : null;
    const heroHtml = hero ? `<section class="nowcard">
        <div class="row between"><span class="small" style="opacity:.85">${cur ? "Hozirgi dars" : `Keyingi dars · ${tm.mins} daqiqadan keyin`}</span><span class="small" style="opacity:.85">${hm(tm.t.start)}–${hm(tm.t.end)}</span></div>
        <h2 style="font-size:24px">${esc(hero.class_name)} · ${esc(hero.subject)}</h2>
        ${cur ? `${bar(tm.pct, "var(--gold)")}<span class="small">${tm.left} daqiqa qoldi${hero.status === "planned" ? " · dars hali boshlanmagan" : hero.status === "started" ? " · dars ketmoqda" : ""}</span>` : ""}
        ${hero.lesson_id && hero.status !== "planned" ? `<button type="button" class="btn" style="background:#fff;color:var(--accent-ink);align-self:flex-start" data-a="go" data-r="lesson-${hero.lesson_id}">${ic("play", 16)} Darsga o‘tish</button>` : `<button type="button" class="btn" style="background:#fff;color:var(--accent-ink);align-self:flex-start" data-a="lesson-start" data-c="${hero.class_id}" data-p="${hero.period}">${ic("play", 16)} Darsni boshlash</button>`}
      </section>` : "";
    return `${heroHtml}<section class="card">${cardHead("Bugungi darslar", linkTo("Haftalik jadval →", "schedule"))}<div class="list">${list.map((l) => {
      const t = timing(l.date, l.period), st = l.status;
      const label = st === "ended" ? badge("Yakunlandi", "green") : st === "started" ? badge("Ketmoqda", "gold") : t?.state === "after" ? badge("O‘tkazilmadi", "red") : t?.state === "now" ? badge("Hozir", "gold") : "";
      const btn = l.lesson_id && st !== "planned" ? `<button type="button" class="btn sec sm" data-a="go" data-r="lesson-${l.lesson_id}">${st === "ended" ? "Ko‘rish" : "Davom ettirish"}</button>` : t && t.state !== "future" && (t.state === "now" || t.state === "after" || (t.state === "before" && t.mins <= 15)) ? `<button type="button" class="btn sm" data-a="lesson-start" data-c="${l.class_id}" data-p="${l.period}">Boshlash</button>` : "";
      return `<div class="row"><div class="time"><b>${l.period}</b><br>${t ? hm(t.t.start) : ""}</div><div class="col grow"><b>${esc(l.class_name)} · ${esc(l.subject)}</b><span class="small muted">${esc(l.topic || "Mavzu kiritilmagan")}</span>${label ? `<span>${label}</span>` : ""}</div>${btn}</div>`;
    }).join("")}</div></section>`;
  }
}
ACTIONS["lesson-start"] = (el) => { S.f.ltopic = ""; openModal({ type: "lesson-start", id: Number(el.dataset.c), extra: el.dataset.p }); };
MODALS["lesson-start"] = (m) => {
  const c = S.me.classes.find((x) => x.id === m.id);
  return `${modalHead("Darsni boshlash", `${esc(c?.name || "")} · ${m.extra}-soat`)}
    <form class="stack" style="gap:12px" data-submit="lesson-start" data-c="${m.id}" data-p="${m.extra}">
      ${field("ltopic", "Bugungi dars mavzusi", { required: true, ph: "Masalan, Kasrlarni qo‘shish" })}
      <span class="xs muted">Mavzu ota-onalarga ko‘rinadi va baholar statistikasi mavzular bo‘yicha shu asosda hisoblanadi.</span>
      <button type="submit" class="btn" ${busy("ls") ? "disabled" : ""}>${ic("play", 16)} Boshlash</button></form>`;
};
SUBMITS["lesson-start"] = async (form) => {
  const r = await run("ls", () => post("/lessons/start", { date: today(), class_id: Number(form.dataset.c), period: Number(form.dataset.p), topic: fv("ltopic") }), { invalidate: ["/lessons"] });
  closeModal(); go("lesson-" + r.id);
};

/* ================= lesson workspace ================= */
const ATT = [["present", "Keldi", "p"], ["late", "Kechikdi", "l"], ["absent", "Yo‘q", "a"]];
VIEWS["teacher:lesson"] = {
  title: "Dars", back: true, nav: "today",
  render(id) {
    const L = data("/lessons/" + id);
    if (L === undefined) return pending("/lessons/" + id);
    const tm = timing(L.date, L.period);
    const tab = S.ui.lTab || (L.status === "ended" ? "hw" : "marks");
    const editable = L.canEdit;
    const lockMsg = { locked: "Bu dars yopilgan. O‘zgartirish uchun administratordan ruxsat so‘rang.", requested: "Ruxsat so‘raldi — administrator javobini kuting.", denied: "So‘rov rad etildi.", readonly: "Bu dars boshqa o‘qituvchiga tegishli — faqat ko‘rish mumkin." }[L.edit];
    const marked = L.students.filter((s) => s.attendance).length, graded = L.students.filter((s) => s.grade).length, checked = Object.keys(L.checks).length;
    const head = `<section class="card" style="gap:10px">
      <div class="row wrap between"><div class="col" style="gap:2px"><h2 style="font-size:21px">${esc(L.class_name)} · ${esc(L.subject)}</h2><span class="small muted">${WD[wdOf(L.date)]}, ${fmtDay(L.date)} · ${L.period}-soat${tm ? ` · ${hm(tm.t.start)}–${hm(tm.t.end)}` : ""}</span></div>
        ${L.status === "ended" ? badge("Dars yakunlangan", "green") : tm?.state === "now" ? `<span class="lesson-timer">${ic("clock", 16)} ${tm.left} daq qoldi</span>` : badge("Dars ketmoqda", "gold")}</div>
      ${tm?.state === "now" && L.status !== "ended" ? bar(tm.pct, "var(--gold)") : ""}
      <div class="row wrap" style="gap:8px;align-items:flex-end"><div class="grow">${editable ? field("ltopicE", "Mavzu", { def: L.topic || "" }) : `<span class="small muted">Mavzu</span><br><b>${esc(L.topic || "—")}</b>`}</div>${editable && fv("ltopicE", L.topic || "") !== (L.topic || "") ? `<button type="button" class="btn sec sm" data-a="topic-save" data-v="${L.id}">Saqlash</button>` : ""}</div>
      ${lockMsg ? `<div class="doc-row" style="background:var(--warn-soft);color:var(--warn)">${ic("lock", 18)}<span class="small grow">${lockMsg}</span>${L.edit === "locked" || L.edit === "denied" ? `<button type="button" class="btn sec sm" data-a="modal" data-m="unlock-req" data-v="${L.id}">Ruxsat so‘rash</button>` : ""}</div>` : ""}
    </section>`;
    const tabs = `<div class="seg" role="group"><button type="button" data-a="set" data-k="lTab" data-v="marks" aria-pressed="${tab === "marks"}">Davomat va baho <span class="muted">${marked}/${L.students.length}</span></button><button type="button" data-a="set" data-k="lTab" data-v="check" aria-pressed="${tab === "check"}">Uy vazifasini tekshirish <span class="muted">${checked}</span></button><button type="button" data-a="set" data-k="lTab" data-v="hw" aria-pressed="${tab === "hw"}">${L.status === "ended" ? "Uyga vazifa" : "Yakunlash"}</button></div>`;
    let body = "";
    if (tab === "marks") {
      body = `<div class="row wrap between"><span class="small muted">${graded} ta baho qo‘yildi</span>${editable ? `<button type="button" class="btn sec sm" data-a="all-present" data-v="${L.id}">${ic("check", 15)} Hammasi keldi</button>` : ""}</div>
        <div class="list">${L.students.map((s) => `<div class="mark-row"><button type="button" class="row grow" style="border:0;background:transparent;text-align:left;padding:0;min-width:160px" data-a="go" data-r="student-${s.id}">${ava(s, 38)}<span class="col" style="gap:0"><b class="small">${esc(sName(s))}</b>${s.excused ? `<span class="xs" style="color:var(--info)" title="${esc(s.excused.reason)}">${ic("bell", 11)} Ota-ona xabar bergan: ${esc(s.excused.reason).slice(0, 40)}</span>` : ""}</span></button>
          <div class="tog" role="group" aria-label="Davomat">${ATT.map(([v, l, c]) => `<button type="button" class="${c}" data-a="mark" data-l="${L.id}" data-s="${s.id}" data-k="attendance" data-v="${v}" aria-pressed="${s.attendance === v}" ${editable ? "" : "disabled"}>${l}</button>`).join("")}</div>
          <div class="tog" role="group" aria-label="Baho">${[2, 3, 4, 5].map((g) => `<button type="button" class="g" data-a="mark" data-l="${L.id}" data-s="${s.id}" data-k="grade" data-v="${g}" aria-pressed="${s.grade === g}" ${editable && s.attendance !== "absent" ? "" : "disabled"}>${g}</button>`).join("")}</div></div>`).join("") || empty("Sinfda o‘quvchilar yo‘q")}</div>`;
    } else if (tab === "check") {
      body = L.prev ? `<div class="doc-row" style="background:var(--info-soft);align-items:flex-start">${ic("book", 18)}<div class="col grow"><span class="xs muted">${fmtDay(L.prev.date)} darsida berilgan vazifa · ${esc(L.prev.topic || "")}</span><b>${esc(L.prev.homework)}</b>${fileLinks(L.prev.hw_files)}</div></div>
        <div class="list">${L.students.map((s) => { const v = L.checks[s.id]; return `<div class="mark-row"><div class="row grow" style="min-width:160px">${ava(s, 36)}<b class="small">${esc(sName(s))}</b></div><div class="tog" role="group" aria-label="Uy vazifasi"><button type="button" class="p" data-a="mark" data-l="${L.id}" data-s="${s.id}" data-k="hw_done" data-v="1" aria-pressed="${v === true}" ${editable ? "" : "disabled"}>Bajardi</button><button type="button" class="a" data-a="mark" data-l="${L.id}" data-s="${s.id}" data-k="hw_done" data-v="0" aria-pressed="${v === false}" ${editable ? "" : "disabled"}>Bajarmadi</button></div></div>`; }).join("")}</div>` : empty("Oldingi darsda bu fandan uyga vazifa berilmagan");
    } else {
      if (S.ui.hwFilled !== L.id) { S.f.lhw = L.homework || ""; S.files.hw = [...(L.hw_files || [])]; S.ui.hwFilled = L.id; }
      const ok = fv("lhw").trim().length >= 3;
      body = editable ? `<form class="stack" style="gap:12px" data-submit="lesson-end" data-v="${L.id}">
          ${field("lhw", "Uyga vazifa", { area: true, rows: 4, required: true, live: true, ph: "Masalan, darslikdagi 12–15-mashqlar, 47-bet" })}
          ${fileBox("hw", { label: "Rasm, PDF yoki Word biriktirish" })}
          ${L.status !== "ended" ? `<span class="xs muted">${ok ? "Tayyor. “Darsni yakunlash” tugmasini bosing." : "Darsni yakunlash uchun uyga vazifani yozish shart."}</span>` : ""}
          <button type="submit" class="btn" ${!ok || busy("le") ? "disabled" : ""}>${ic("check", 18)} ${L.status === "ended" ? "Uyga vazifani saqlash" : "Darsni yakunlash"}</button></form>`
        : `${L.homework ? `<b>${esc(L.homework)}</b>${fileLinks(L.hw_files)}` : empty("Uyga vazifa kiritilmagan")}`;
    }
    return `${head}${tabs}<section class="card">${body}</section>`;
  },
};
ACTIONS.mark = async (el) => {
  const lid = el.dataset.l, sid = Number(el.dataset.s), k = el.dataset.k;
  const L = data("/lessons/" + lid); if (!L) return;
  const s = L.students.find((x) => x.id === sid);
  let value;
  if (k === "attendance") { value = s.attendance === el.dataset.v ? null : el.dataset.v; s.attendance = value; if (value === "absent") s.grade = null; }
  else if (k === "grade") { value = s.grade === Number(el.dataset.v) ? null : Number(el.dataset.v); s.grade = value; if (value && !s.attendance) s.attendance = "present"; }
  else { const want = el.dataset.v === "1"; value = L.checks[sid] === want ? null : want; if (value === null) delete L.checks[sid]; else L.checks[sid] = value; }
  render();
  try {
    const body = { student_id: sid, [k]: value };
    if (k === "grade" && value && s.attendance === "present") body.attendance = "present";
    if (k === "attendance" && value === "absent") body.grade = null;
    await put(`/lessons/${lid}/marks`, body);
  } catch (e) { toast(e.message); invalidate("/lessons/" + lid); }
};
ACTIONS["all-present"] = async (el) => {
  const L = data("/lessons/" + el.dataset.v); if (!L) return;
  await run("ap", async () => { for (const s of L.students.filter((x) => !x.attendance)) { s.attendance = "present"; await put(`/lessons/${L.id}/marks`, { student_id: s.id, attendance: "present" }); } }, { ok: "Hammasi “keldi” deb belgilandi" });
};
ACTIONS["topic-save"] = async (el) => { await run("ts", () => patch("/lessons/" + el.dataset.v, { topic: fv("ltopicE") }), { ok: "Mavzu saqlandi", invalidate: ["/lessons"] }); };
SUBMITS["lesson-end"] = async (form) => {
  const L = data("/lessons/" + form.dataset.v);
  const ended = L?.status === "ended";
  await run("le", () => (ended ? patch("/lessons/" + form.dataset.v, { homework: fv("lhw"), hw_files: S.files.hw || [] }) : post(`/lessons/${form.dataset.v}/end`, { homework: fv("lhw"), hw_files: S.files.hw || [] })), { ok: ended ? "Uyga vazifa saqlandi" : "Dars yakunlandi. Uyga vazifa ota-onalarga ko‘rinadi.", invalidate: ["/lessons"] });
  S.ui.hwFilled = null;
  if (!ended) go("today");
};
MODALS["unlock-req"] = (m) => `${modalHead("Tahrirlash uchun ruxsat so‘rash")}<form class="stack" style="gap:12px" data-submit="unlock-req" data-v="${m.id}">${field("ureason", "Sababi", { area: true, required: true, ph: "Masalan, bir o‘quvchining bahosini kiritish esdan chiqibdi" })}<button type="submit" class="btn" ${busy("ur") ? "disabled" : ""}>Yuborish</button></form>`;
SUBMITS["unlock-req"] = async (form) => { await run("ur", () => post(`/lessons/${form.dataset.v}/unlock`, { reason: fv("ureason") }), { ok: "So‘rov administratorga yuborildi", invalidate: ["/lessons/" + form.dataset.v] }); S.f.ureason = ""; closeModal(); };

/* ================= classes ================= */
VIEWS["teacher:classes"] = {
  title: "Sinflarim",
  render() {
    const mine = S.me.classes.filter((c) => S.me.myClasses.includes(c.id));
    if (!mine.length) return `<section class="card">${empty("Sizga hali sinf biriktirilmagan")}</section>`;
    return `<div class="grid" style="--min:240px">${mine.map((c) => `<button type="button" class="card" style="text-align:left;cursor:pointer" data-a="go" data-r="class-${c.id}"><div class="row between"><h2 style="font-size:24px">${esc(c.name)}</h2>${c.leader_id === user().id ? badge("Sinf rahbari", "gold") : ""}</div><span class="muted">${c.size} o‘quvchi${c.room ? " · " + esc(c.room) + "-xona" : ""}</span></button>`).join("")}</div>`;
  },
};
VIEWS["teacher:class"] = {
  title: () => { const c = S.me.classes.find((x) => x.id === Number(location.hash.split("-").pop())); return c ? `${c.name} sinf` : "Sinf"; }, back: true, nav: "classes",
  render(id) {
    const per = S.ui.cPer || "month";
    const path = `/ratings/students?period=${per}&class_id=${id}`;
    const res = data(path);
    const head = seg("cPer", per, [["week", "Hafta"], ["month", "Oy"], ["year", "O‘quv yili"]]);
    if (res === undefined) return head + pending(path);
    return `${head}<section class="card"><span class="xs muted">O‘quvchi ustiga bosing — reytingi, shaxsiy ma’lumotlari, statistikasi va yutuqlari ochiladi. Ma’lumotlarni tahrirlashingiz mumkin.</span>
      <div class="col" style="gap:4px">${res.rows.map((x) => `<button type="button" class="rank-row ${x.rank === 1 ? "top1" : ""}" style="width:100%;text-align:left;background-color:transparent" data-a="go" data-r="student-${x.id}">${rankMark(x.rank)}${ava(x, 40)}<div class="col grow"><b class="small">${esc(sName(x))}</b><span class="xs muted">${x.n} ta baho${x.achievements ? ` · ${x.achievements} ta yutuq` : ""}</span></div><b style="color:${avgColor(x.avg)}">${fmtAvg(x.avg)}</b>${ic("chevron", 16)}</button>`).join("") || empty("O‘quvchilar yo‘q")}</div></section>`;
  },
};

/* ================= open lessons ================= */
VIEWS["teacher:openlessons"] = {
  title: "Ochiq darslarim",
  actions: () => `<button type="button" class="btn" data-a="modal" data-m="post-new" data-x="openlesson">${ic("megaphone", 18)} Ochiq dars e’loni</button>`,
  render() {
    const path = `/posts?kind=openlesson&author_id=${user().id}&limit=50`;
    const list = data(path);
    if (list === undefined) return pending(path);
    const m = curMonth();
    const thisMonth = list.filter((p) => (p.event?.date || "").startsWith(m)).length;
    return `<div class="row wrap" style="gap:12px"><div class="stat" style="background:var(--gold-soft)"><span class="small muted">Shu oyda</span><span class="v">${thisMonth}</span><span class="xs">ochiq dars</span></div><div class="stat" style="background:var(--accent-soft)"><span class="small muted">Jami</span><span class="v">${list.length}</span><span class="xs">ochiq dars</span></div></div>
      <section class="card" style="background:var(--surface-2)"><span class="small">Ochiq darslar soni o‘qituvchilar reytingiga qo‘shiladi. E’lon qilganingizda tanlangan sinflar ota-onalariga bildirishnoma boradi.</span></section>
      ${list.length ? `<div class="grid" style="--min:300px">${list.map(postCard).join("")}</div>` : `<section class="card">${empty("Hali ochiq dars e’lon qilmagansiz")}</section>`}`;
  },
};

/* ================= reviews ================= */
VIEWS["teacher:reviews"] = {
  title: "Ota-onalar fikrlari va baholari",
  render() {
    const t = data("/teachers/" + user().id), r = data("/ratings/teachers?month=" + curMonth());
    if (t === undefined) return pending("/teachers/" + user().id);
    const me = r?.rows.find((x) => x.id === user().id);
    const avg = t.reviews.length ? t.reviews.reduce((a, x) => a + x.stars, 0) / t.reviews.length : null;
    const dist = [5, 4, 3, 2, 1].map((s) => [s, t.reviews.filter((x) => x.stars === s).length]);
    return `<div class="row wrap" style="gap:12px">
        <div class="stat" style="background:var(--gold-soft)"><span class="small muted">O‘rtacha baho</span><span class="v">${fmtAvg(avg)}</span>${starsHtml(avg, 16)}</div>
        <div class="stat" style="background:var(--accent-soft)"><span class="small muted">Reytingdagi o‘rin (${fmtMonth(curMonth())})</span><span class="v">${me ? `${me.rank}<span class="small muted"> / ${r.rows.length}</span>` : "—"}</span><span class="xs">${me ? `${fmtAvg(me.score)} ball · ${me.open_lessons} ochiq dars` : ""}</span></div>
        <div class="stat" style="background:var(--surface-2)"><span class="small muted">Baholar soni</span><span class="v">${t.reviews.length}</span></div></div>
      <section class="card"><div class="col" style="gap:6px">${dist.map(([s, n]) => `<div class="row" style="gap:8px"><span class="small" style="width:44px">${s} ★</span><div class="grow">${bar(t.reviews.length ? (n / t.reviews.length) * 100 : 0, "var(--gold)")}</div><span class="small muted" style="width:24px;text-align:right">${n}</span></div>`).join("")}</div></section>
      <section class="card">${cardHead("Fikrlar")}${t.reviews.length ? `<div class="list">${t.reviews.map(reviewItem).join("")}</div>` : empty("Hali fikr qoldirilmagan")}</section>`;
  },
};
