// Parent panel: home, homework by day, learning statistics, teachers.
import {
  S, VIEWS, ACTIONS, MODALS, NAV, render, go, data, pending, openModal, closeModal, modalHead,
  esc, ic, badge, seg, cardHead, empty, bar, starsHtml, rankMark, avgColor, ava, linkTo,
  fmtDay, fmtWhen, fmtMonth, fmtAvg, fmtPhone, hm, sName, today, addDays, wdOf, WD, settings, periodTimes, tzNow, confetti, celebrateOnce, CUP,
} from "./core.js";
import { currentKid, kidSwitcher, statsPanel, homeworkPanel, postCard } from "./common.js";

NAV.parent = [["home", "Bosh sahifa", "home"], ["homework", "Uy vazifasi", "book"], ["stats", "Statistika", "chart"], ["ratings", "Reyting", "trophy"], ["schedule", "Jadval", "calendar"], ["teachers", "O‘qituvchilar", "user"], ["news", "Yangiliklar", "news"], ["child", "Farzandim", "user"]];

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
VIEWS["parent:home"] = {
  title: () => `${WD[wdOf(today())]}, ${fmtDay(today())}`,
  render() {
    const kid = currentKid();
    if (!kid) return `<section class="card">${empty("Hisobingizga hali farzand biriktirilmagan. Maktab administratoriga murojaat qiling.")}</section>`;
    const cls = S.me.classes.find((c) => c.id === kid.class_id);
    const menu = data(`/menu?from=${today()}&to=${today()}`);
    const hwPath = `/students/${kid.id}/homework?from=${addDays(today(), -4)}&to=${today()}`, hw = data(hwPath);
    const lastDay = hw?.find((l) => l.homework)?.date;
    const s = data("/students/" + kid.id);
    const week = data(`/ratings/students?period=week&class_id=${kid.class_id}`);
    const posts = data("/posts?limit=3");
    return `${kidSwitcher()}
      <section class="card profile-head"><button type="button" class="row" style="border:0;background:transparent;text-align:left;padding:0" data-a="go" data-r="student-${kid.id}">${ava(kid, 56)}<div class="col grow"><h2 style="font-size:20px">${esc(sName(kid))}</h2><span class="muted small">${esc(cls?.name || "")} sinf</span></div>${ic("chevron", 18)}</button></section>
      ${rankCard(kid)}
      ${nowLesson(kid)}
      <div class="grid" style="--min:300px">
        ${cls?.leader_name ? `<section class="card">${cardHead("Sinf rahbari")}<div class="row">${ava({ id: cls.leader_id }, 44, "t")}<div class="col grow"><b>${esc(cls.leader_name)}</b><a class="small" href="tel:${esc(cls.leader_phone || "")}" style="color:var(--accent-ink)">${ic("phone", 14)} ${fmtPhone(cls.leader_phone)}</a></div><button type="button" class="btn sec sm" data-a="go" data-r="teacher-${cls.leader_id}">Profil</button></div></section>` : ""}
        <section class="card">${cardHead("Bugungi taomnoma")}${menu === undefined ? "" : menu.length ? `<div class="row wrap" style="gap:8px">${menu.map((m) => `<div class="meal" style="background:var(--surface-2)"><span class="xs muted">${MEAL_L[m.meal]}</span><b class="small">${esc(m.dish)}</b>${m.items ? `<span class="xs muted">${esc(m.items)}</span>` : ""}</div>`).join("")}</div>` : empty("Taomnoma kiritilmagan")}</section>
      </div>
      <section class="card">${cardHead(lastDay ? `Uyga vazifa · ${fmtDay(lastDay)}` : "Uyga vazifa", linkTo("Barchasi →", "homework"))}${hw === undefined ? "" : lastDay ? `<div class="list">${hw.filter((l) => l.date === lastDay && l.homework).map((l) => `<div class="col"><b class="small">${esc(l.subject)}</b><span>${esc(l.homework)}</span></div>`).join("")}</div>` : empty("So‘nggi kunlarda uyga vazifa berilmagan")}</section>
      ${s?.feedback?.length ? `<section class="card">${cardHead("O‘qituvchilar fikri")}<div class="list">${s.feedback.slice(0, 3).map((f) => `<div class="col"><div class="row between"><b class="small">${esc(f.teacher_name)}</b><span class="xs muted">${fmtWhen(f.created_at)}</span></div><span>${esc(f.text)}</span></div>`).join("")}</div></section>` : ""}
      ${week?.rows?.filter((x) => x.rank && x.rank <= 3).length ? `<section class="card">${cardHead("Hafta o‘quvchilari", linkTo("Reyting →", "ratings"))}<div class="row wrap" style="gap:10px">${week.rows.filter((x) => x.rank && x.rank <= 3).slice(0, 3).map((x) => `<div class="ranktile ${x.rank === 1 ? "top" : ""}" style="align-items:center;text-align:center">${rankMark(x.rank)}${ava(x, 52)}<b class="small">${esc(x.first_name)}</b><span class="xs muted">${fmtAvg(x.avg)}</span></div>`).join("")}</div></section>` : ""}
      ${posts?.length ? `<section class="card">${cardHead("Yangiliklar", linkTo("Barchasi →", "news"))}<div class="grid" style="--min:260px">${posts.map(postCard).join("")}</div></section>` : ""}`;
  },
};
VIEWS["parent:homework"] = { title: "Uy vazifalari", render() { const k = currentKid(); return kidSwitcher() + (k ? `<section class="card">${homeworkPanel(k.id)}</section>` : empty("Farzand biriktirilmagan")); } };
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
