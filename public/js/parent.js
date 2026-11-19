// Parent panel: home, homework by day, learning statistics, teachers.
import {
  S, VIEWS, ACTIONS, MODALS, NAV, render, go, data, pending, openModal, closeModal, modalHead,
  esc, ic, badge, seg, cardHead, empty, bar, starsHtml, rankMark, avgColor, ava, linkTo,
  fmtDay, fmtWhen, fmtMonth, fmtAvg, fmtPhone, hm, sName, today, addDays, wdOf, WD, settings, periodTimes, tzNow, confetti, celebrateOnce, CUP, greeting, tile, banner, user, curMonth, mondayOf, LANG, WDS,
} from "./core.js";
import { currentKid, kidSwitcher, statsPanel, homeworkPanel, postCard } from "./common.js";

NAV.parent = [["home", "Bosh sahifa", "home"], ["homework", "Uy vazifasi", "book"], ["stats", "Statistika", "chart"], ["ratings", "Reyting", "trophy"], ["schedule", "Jadval", "calendar"], ["teachers", "O‘qituvchilar", "user"], ["absences", "Kela olmaydi", "bell"], ["news", "Yangiliklar", "news"], ["child", "Farzandim", "user"]];

const MEAL_L = { breakfast: "Nonushta", lunch: "Tushlik", snack: "Tamaddi" };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

function nowLesson(kid) {
  const d = today(), path = `/lessons?class_id=${kid.class_id}&from=${d}&to=${d}`;
  const list = data(path);
  if (list === undefined) return "";
  const times = periodTimes(settings().bell), now = tzNow().min;
  const cur = times.find((t) => now >= t.start && now < t.end), next = times.find((t) => t.start > now);
  const l = cur && list.find((x) => x.period === cur.period);
  const n = next && list.find((x) => x.period === next.period);
  if (!list.length) return `<section class="card">${cardHead("Bugun")}${empty(wdOf(d) === 0 ? "Yakshanba — dam olish kuni" : "Bugun darslar yo‘q")}</section>`;
  const head = l ? `<section class="nowcard"><div class="row between"><span class="small" style="opacity:.85">Hozir ${cur.period}-dars</span><span class="small" style="opacity:.85">${hm(cur.start)}–${hm(cur.end)}</span></div><h2 style="font-size:24px">${esc(l.subject)}</h2><span class="small">${esc(l.teacher_name)}${l.topic ? " · " + esc(l.topic) : ""}</span>${bar(((now - cur.start) / (cur.end - cur.start)) * 100, "var(--gold)")}<span class="xs" style="opacity:.85">${cur.end - now} daqiqa qoldi${n ? ` · keyingisi: ${esc(n.subject)}` : ""}</span></section>`
    : n ? `<section class="nowcard"><span class="small" style="opacity:.85">Keyingi dars · ${hm(next.start)}</span><h2 style="font-size:22px">${esc(n.subject)}</h2><span class="small">${esc(n.teacher_name)} · ${next.start - now} daqiqadan keyin</span></section>` : "";
  return `${head}<section class="card">${cardHead("Bugungi darslar", linkTo("Jadval →", "schedule"))}<div class="col" style="gap:4px">${list.map((x) => { const t = times.find((y) => y.period === x.period); const isNow = l && x.period === l.period; return `<div class="lesson ${isNow ? "now" : ""}"><span class="time">${t ? hm(t.start) : ""}</span><div class="col grow"><b class="small">${esc(x.subject)}</b><span class="xs muted">${esc(x.teacher_name)}${x.topic ? " · " + esc(x.topic) : ""}</span></div>${x.status === "ended" ? badge("O‘tildi", "green") : isNow ? badge("Hozir", "gold") : ""}</div>`; }).join("")}</div></section>`;
}

function rankCard(kid) {
  const R = data("/my/ranks");
  if (R === undefined) return "";
  const r = R[kid.id]; if (!r) return "";
  const L = { day: "Bugun", week: "Hafta", month: "Oy" };
  // celebration: first place shown once per period
  for (const p of ["month", "week", "day"]) {
    if (r[p].rank === 1) { celebrateOnce(`sp.cele.${kid.id}.${p}.${p === "day" ? today() : p === "week" ? addDays(today(), -((wdOf(today()) + 6) % 7)) : today().slice(0, 7)}`, { type: "celebrate", id: kid.id, extra: p }); break; }
  }
  return `<section class="card">${cardHead(`${esc(kid.first_name)} sinfida nechanchi o‘rinda`, linkTo("Reyting →", "ratings"))}<div class="row wrap" style="gap:10px">${["day", "week", "month"].map((p) => { const x = r[p]; const top = x.rank && x.rank <= 3; return `<div class="ranktile ${x.rank === 1 ? "top" : ""}"><span class="xs muted">${L[p]}</span><div class="row" style="gap:8px">${x.rank ? `<span class="big">${x.rank}</span><span class="small muted">/ ${x.total}</span>` : `<span class="big muted">—</span>`}${x.rank === 1 ? ic("trophy", 22) : ""}</div><span class="xs">${x.avg != null ? `o‘rtacha ${fmtAvg(x.avg)}` : "baho yo‘q"}${top ? " · TOP-3" : ""}</span></div>`; }).join("")}</div></section>`;
}
const CELE = { day: ["Kun yulduzi!", "bugun sinfda 1-o‘rinda"], week: ["Hafta qahramoni!", "bu hafta sinfda 1-o‘rinda"], month: ["Maktab faxri!", "bu oy sinfda 1-o‘rinda — bo‘lajak prezident"] };
MODALS.celebrate = (m) => {
  const kid = S.me.children.find((k) => k.id === m.id) || {};
  const [t, sub] = CELE[m.extra] || CELE.day;
  return `<div class="col celebrate" style="gap:10px;padding:14px;border-radius:18px">${ava(kid, 84)}${CUP}
    <span class="chip-title">${ic("trophy2", 14)} 1-o‘rin</span><h2 class="big">${t}</h2><span style="font-size:16px"><b>${esc(kid.first_name || "")}</b> ${sub}! Tabriklaymiz, siz bilan faxrlanamiz.</span>
    <button type="button" class="btn" data-a="close-modal">Rahmat!</button></div>`;
};
function todayTimeline(kid) {
  const d = today(), path = `/lessons?class_id=${kid.class_id}&from=${d}&to=${d}`;
  const list = data(path);
  if (list === undefined) return "";
  const times = periodTimes(settings().bell), now = tzNow().min;
  if (!list.length) return `<section class="card">${cardHead("Bugun")}${empty(wdOf(d) === 0 ? "Yakshanba — dam olish kuni" : "Bugun darslar yo‘q")}</section>`;
  return `<section class="card">${cardHead("Bugun", linkTo("Barchasi →", "schedule"))}<div class="timeline">${list.map((x) => {
    const t = times.find((y) => y.period === x.period), isNow = t && now >= t.start && now < t.end, done = x.status === "ended" || (t && now >= t.end);
    return `<div class="tl-row ${x.status === "ended" ? "done" : ""} ${isNow ? "now" : ""}"><span class="tl-dot"></span><span class="tl-time">${t ? hm(t.start) : ""}</span><div class="col grow"><b>${esc(x.subject)}</b><span class="xs muted">${esc(x.teacher_name)}${x.topic ? " · " + esc(x.topic) : ""}${isNow ? ` · ${t.end - now} daq qoldi` : ""}</span></div>${x.status === "ended" ? `<span class="check-ic ok">${ic("check", 15)}</span>` : isNow ? `<span class="check-ic wait" style="border-color:var(--gold);color:var(--gold)">${ic("play", 12)}</span>` : `<span class="check-ic wait">${ic(done ? "close" : "play", 12)}</span>`}</div>`;
  }).join("")}</div></section>`;
}

const MEAL_IC = { breakfast: "sun", lunch: "food", snack: "star" };
const MEAL_T = { breakfast: "mint", lunch: "yellow", snack: "lav" };
function mealTimes() {
  const b = settings().bell, t = periodTimes(b);
  if (!t.length) return {};
  const la = t.find((x) => x.period === Number(b.lunchAfter)) || t[Math.min(3, t.length - 1)];
  const sn = t[Math.min(t.length - 1, Number(b.lunchAfter) + 1)] || t[t.length - 1];
  return { breakfast: `${hm(t[0].start - 25)}`, lunch: `${hm(la.end)} – ${hm(la.end + (Number(b.lunch) || 40))}`, snack: hm(sn.end) };
}
function menuCard() {
  const t0 = today(), mon = wdOf(t0) === 0 ? addDays(t0, 1) : mondayOf(t0), days = [0, 1, 2, 3, 4, 5].map((i) => addDays(mon, i));
  const sel = days.includes(S.ui.menuDay) ? S.ui.menuDay : wdOf(t0) === 0 ? mon : t0;
  const tm = addDays(t0, 1);
  const menu = data(`/menu?from=${mon}&to=${days[5]}`);
  const order = { breakfast: 0, lunch: 1, snack: 2 }, times = mealTimes();
  const list = (menu || []).filter((m) => m.date === sel).sort((a, b) => order[a.meal] - order[b.meal]);
  const chips = `<div class="day-chips">${days.map((d) => `<button type="button" class="day-chip ${d === sel ? "on" : ""} ${d === t0 ? "today" : ""} ${(menu || []).some((m) => m.date === d) ? "has" : ""}" data-a="menu-day" data-v="${d}"><span class="xs">${LANG === "ru" ? WDS[wdOf(d)] : WD[wdOf(d)].slice(0, 3)}</span><b>${Number(d.slice(8))}</b></button>`).join("")}</div>`;
  const body = menu === undefined ? "" : list.length ? `<div class="meals">${list.map((m) => `<div class="meal-row t-${MEAL_T[m.meal]}"><span class="meal-ic">${ic(MEAL_IC[m.meal], 20)}</span><div class="col grow"><div class="row between"><span class="xs b meal-l">${MEAL_L[m.meal]}</span>${times[m.meal] ? `<span class="xs muted num">${times[m.meal]}</span>` : ""}</div><b>${esc(m.dish)}</b>${m.items ? `<span class="small muted">${esc(m.items)}</span>` : ""}</div></div>`).join("")}</div>` : empty("Bu kun uchun taomnoma kiritilmagan");
  return `<section class="card menu-card">${cardHead(sel === t0 ? "Bugungi taomnoma" : sel === tm ? "Ertangi taomnoma" : `Taomnoma · ${fmtDay(sel)}`)}${chips}${body}</section>`;
}
ACTIONS["menu-day"] = (el) => { S.ui.menuDay = el.dataset.v; render(); };
VIEWS["parent:home"] = {
  title: "Bosh sahifa", noHead: true,
  render() {
    const kid = currentKid();
    if (!kid) return `${greeting(user().name)}<section class="card">${empty("Hisobingizga hali farzand biriktirilmagan. Maktab administratoriga murojaat qiling.")}</section>`;
    const cls = S.me.classes.find((c) => c.id === kid.class_id);
    const hwPath = `/students/${kid.id}/homework?from=${addDays(today(), -6)}&to=${today()}`, hw = data(hwPath);
    const lastHw = hw?.find((l) => l.homework);
    const s = data("/students/" + kid.id);
    const st = data(`/students/${kid.id}/stats?month=${curMonth()}`);
    const R = data("/my/ranks")?.[kid.id];
    const week = data(`/ratings/students?period=week&class_id=${kid.class_id}`);
    const posts = data("/posts?limit=3");
    const att = st?.attendance || {}, totA = (att.present || 0) + (att.absent || 0) + (att.late || 0), hwT = (st?.homework?.done || 0) + (st?.homework?.missed || 0);
    const trend = st?.trend?.map((t) => t.avg) || [];
    const tiles = st ? `<div class="tiles">
        ${tile({ icon: "calcheck", label: "Davomat", value: totA ? Math.round(((att.present + att.late) / totA) * 100) + "%" : "—", tone: "green", spark: trend.length ? trend.map((x) => (x ? 80 + x * 3 : null)) : null })}
        ${tile({ icon: "star", label: "O‘rtacha baho", value: fmtAvg(st.avg), tone: "yellow", delta: st.avg != null && st.prevAvg != null ? Math.round((st.avg - st.prevAvg) * 10) / 10 : null, deltaText: st.avg != null && st.prevAvg != null ? fmtAvg(Math.abs(st.avg - st.prevAvg)) : "", spark: trend })}
        ${tile({ icon: "clipboard", label: "Uy vazifalari", value: hwT ? Math.round((st.homework.done / hwT) * 100) + "%" : "—", tone: "mint", route: "homework", cls: "hide-m" })}
        ${tile({ icon: "trophy", label: "Sinf reytingi", value: st.classRank ? `${st.classRank}/${st.classSize}` : "—", tone: "lav", route: "ratings" })}
      </div>` : "";
    const leader = cls?.leader_name ? `<section class="card" style="gap:8px"><span class="xs muted b">Sinf rahbari</span><div class="row">${ava({ id: cls.leader_id }, 46, "t")}<div class="col grow"><b>${esc(cls.leader_name)}</b><span class="small muted">${fmtPhone(cls.leader_phone)}</span></div><a class="call-btn" href="tel:${esc(cls.leader_phone || "")}" aria-label="Qo‘ng‘iroq qilish">${ic("phone", 18)}</a></div></section>` : "";
    const rankCta = R?.week?.rank ? `<button type="button" class="rank-cta" style="border:0;text-align:left" data-a="go" data-r="ratings"><span class="small" style="opacity:.9">Sinf reytingida (hafta)</span><b style="font-size:24px">${R.week.rank}-o‘rin</b><span class="xs" style="opacity:.85">Batafsil →</span><svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICON_STAR}"/></svg></button>` : "";
    const absToday = (data("/absences") || []).find((a) => a.student_id === kid.id && a.date_from <= today() && a.date_to >= today());
    return `${greeting(user().name)}
      ${kidSwitcher()}
      ${absToday ? `<div class="doc-row" style="background:var(--info-soft);color:var(--info)">${ic("check", 18)}<span class="small grow">Bugun ${esc(kid.first_name)} kelmasligi haqida xabar berilgan. O‘qituvchilar xabardor.</span></div>`
        : `<button type="button" class="doc-row" style="border:0;background:var(--surface-2);text-align:left" data-a="modal" data-m="absence-new" data-v="${kid.id}">${ic("bell", 18)}<span class="grow small"><b>${esc(kid.first_name)} bugun kela olmaydimi?</b> O‘qituvchi va ma’muriyatga bir bosishda xabar bering</span>${ic("chevron", 16)}</button>`}
      <button type="button" class="pcard" data-a="go" data-r="student-${kid.id}"><span class="ava-wrap">${ava(kid, 58)}</span><div class="col grow"><b style="font-size:18px">${esc(sName(kid))}</b><span class="small muted">${esc(cls?.name || "")} sinf</span></div>${ic("chevron", 18)}</button>
      ${tiles}
      ${menuCard()}
      <div class="grid" style="--min:330px">
        <div class="stack" style="gap:14px">
          ${todayTimeline(kid)}
          ${lastHw ? `<button type="button" class="cta-card" data-a="go" data-r="homework"><span class="cta-ic">${ic("book", 22)}</span><div class="col grow"><span class="xs muted b">Uy vazifasi</span><b>${esc(lastHw.subject)}</b><span class="small">${esc(lastHw.homework)}</span><span class="xs muted">${fmtDay(lastHw.date)}, ${WD[wdOf(lastHw.date)].toLowerCase()}</span></div>${ic("chevron", 18)}</button>` : ""}
          ${leader}
        </div>
        <div class="stack" style="gap:14px">
          ${rankCard(kid)}
          ${rankCta}
          ${banner({ title: "Bilim bilan parvoz qiling!", route: "news" })}
        </div>
      </div>
      ${s?.feedback?.length ? `<section class="card">${cardHead("O‘qituvchilar fikri")}<div class="list">${s.feedback.slice(0, 3).map((f) => `<div class="col"><div class="row between"><b class="small">${esc(f.teacher_name)}</b><span class="xs muted">${fmtWhen(f.created_at)}</span></div><span>${esc(f.text)}</span></div>`).join("")}</div></section>` : ""}
      ${week?.rows?.filter((x) => x.rank && x.rank <= 3).length ? `<section class="card">${cardHead("Hafta o‘quvchilari", linkTo("Reyting →", "ratings"))}<div class="podium">${week.rows.filter((x) => x.rank && x.rank <= 3).slice(0, 3).map((x) => `<button type="button" class="pod p${x.rank}" data-a="stu-open" data-v="${x.id}">${rankMark(x.rank)}${ava(x, 56)}<b>${esc(x.first_name)}</b><span class="pod-avg">${fmtAvg(x.avg)}</span></button>`).join("")}</div></section>` : ""}
      ${posts?.length ? `<section class="card">${cardHead("So‘nggi xabarlar", linkTo("Barchasi →", "news"))}<div class="grid" style="--min:260px">${posts.map(postCard).join("")}</div></section>` : ""}`;
  },
};
const ICON_STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";
VIEWS["parent:homework"] = { title: "Uy vazifalari", render() { const k = currentKid(); return kidSwitcher() + (k ? homeworkPanel(k.id) : empty("Farzand biriktirilmagan")); } };
VIEWS["parent:stats"] = { title: "O‘zlashtirish statistikasi", render() { const k = currentKid(); return kidSwitcher() + (k ? `<section class="card">${statsPanel(k.id)}</section>` : empty("Farzand biriktirilmagan")); } };
VIEWS["parent:child"] = { title: "Farzandim", render() { const k = currentKid(); if (k) { location.replace("#student-" + k.id); return ""; } return empty("Farzand biriktirilmagan"); } };
VIEWS["parent:teachers"] = {
  title: "O‘qituvchilar",
  render() {
    const list = data("/teachers");
    if (list === undefined) return pending("/teachers");
    const myCls = S.me.classes.filter((c) => S.me.children.some((k) => k.class_id === c.id)).map((c) => c.name);
    const mine = list.filter((t) => t.classes.some((c) => myCls.includes(c))), other = list.filter((t) => !mine.includes(t));
    const row = (t) => `<button type="button" class="row" style="border:0;background:transparent;width:100%;text-align:left" data-a="go" data-r="teacher-${t.id}">${ava(t, 46, "t")}<div class="col grow"><b>${esc(t.name)}</b><span class="small muted">${esc(t.subjects.join(", ") || t.profile?.subjects || "")}</span>${t.stars != null ? `<span class="xs">${starsHtml(t.stars, 11)} ${fmtAvg(t.stars)} (${t.votes})</span>` : ""}</div>${ic("chevron", 16)}</button>`;
    return `${mine.length ? `<section class="card">${cardHead("Farzandingizga dars beradiganlar")}<span class="xs muted">Profilini ochib, oyiga bir marta baholashingiz va fikr qoldirishingiz mumkin.</span><div class="list">${mine.map(row).join("")}</div></section>` : ""}
      ${other.length ? `<section class="card">${cardHead("Boshqa o‘qituvchilar")}<div class="list">${other.map(row).join("")}</div></section>` : ""}`;
  },
};
