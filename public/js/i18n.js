// Two-language support (Uzbek is the source language, Russian is translated).
// Shared by the browser and the server (PDF reports): no DOM access at import time.
import { RU } from "./ru.js";

const store = () => { try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; } };
export const LANGS = [["uz", "O‘zbekcha"], ["ru", "Русский"]];
export const LANG = (() => { const v = store()?.getItem("sp.lang"); return v === "ru" ? "ru" : "uz"; })();
export function setLang(l) { try { store()?.setItem("sp.lang", l === "ru" ? "ru" : "uz"); } catch { /* private mode */ } }

const MU = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const RU_MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const RU_MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const RU_MONTHS_S = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const RU_WD = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
export const RU_WDS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function plural(n, one, few, many) {
  const a = Math.abs(Math.trunc(Number(n) || 0)), m10 = a % 10, m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MONTH_RE = new RegExp(`(\\d{1,2})-(${MU.join("|")})(\\s+\\d{4})?`, "gi");
const MONTH_NOM_RE = new RegExp(`\\b(${MU.join("|")})(\\s+\\d{4})`, "gi");
/** Uzbek dates inside a text ("16-noyabr 2026", "Noyabr 2026") → Russian. */
const MS_UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
const MS_RE = new RegExp(`^(${MS_UZ.join("|")}) (\\d{2})$`);
function dates(t) {
  if (!/[a-z]/i.test(t)) return t;
  const ms = MS_RE.exec(t); if (ms) return `${RU_MONTHS_S[MS_UZ.indexOf(ms[1])][0].toUpperCase()}${RU_MONTHS_S[MS_UZ.indexOf(ms[1])].slice(1)} ${ms[2]}`;
  return t.replace(MONTH_RE, (_, d, m, y) => `${d} ${RU_MONTHS_GEN[MU.indexOf(m.toLowerCase())]}${y || ""}`)
    .replace(MONTH_NOM_RE, (_, m, y) => `${RU_MONTHS[MU.indexOf(m.toLowerCase())]}${y}`)
    .replace(/(\d)-o‘rin\b/g, "$1-е место")
    .replace(/(\d)-soat\b/g, "$1-й урок")
    .replace(/(\d)-dars\b/g, "$1-й урок")
    .replace(/(\d) so‘m\b/g, "$1 сум")
    .replace(/(\d) mln\b/g, "$1 млн");
}

/** Builds a translate(text) function from a {uz: ru} dictionary. */
export function makeTranslator(dict) {
  const exact = new Map(), pats = [];
  for (const [uz0, ru] of Object.entries(dict)) {
    const uz = uz0.replace(/\s+/g, " ").trim();
    if (!/\{\d+\}/.test(uz)) { exact.set(uz, ru); continue; }
    const parts = uz.split(/(\{\d+\})/).filter((x) => x !== "");
    let re = "^", stat = "", key = "";
    const holes = [], isHole = (x) => /^\{\d+\}$/.test(x || "");
    parts.forEach((p, i) => {
      const h = /^\{(\d+)\}$/.exec(p);
      if (h) {
        holes.push(Number(h[1]));
        const first = i === 0, last = i === parts.length - 1;
        if (first && /^\s/.test(parts[1] || "")) re += "(?:([\\s\\S]*?)\\s+)?";
        else if (last && /\s$/.test(parts[i - 1] || "")) re += "(?:\\s+([\\s\\S]*?))?";
        else re += "([\\s\\S]*?)";
        return;
      }
      let q = p;
      if (i === 1 && isHole(parts[0])) q = q.replace(/^\s+/, "");
      if (i === parts.length - 2 && isHole(parts[parts.length - 1])) q = q.replace(/\s+$/, "");
      re += reEsc(q).replace(/ +/g, "\\s+");
      stat += p; if (p.trim().length > key.length) key = p.trim();
    });
    if (!/[A-Za-z‘’]{2}/.test(stat)) continue; // nothing to anchor on
    pats.push({ re: new RegExp(re + "$"), ru, holes, key, len: stat.trim().length, dot: stat.includes("·"), com: stat.includes(",") });
  }
  pats.sort((a, b) => b.len - a.len);
  const memo = new Map();
  const fill = (ru, vals) => ru
    .replace(/\{(\d+)\|([^|}]*)\|([^|}]*)\|([^|}]*)\}/g, (_, i, one, few, many) => plural(String(vals[i] ?? "").replace(/[^\d-]/g, "") || 0, one, few, many))
    .replace(/\{(\d+)\}/g, (_, i) => vals[i] ?? "");
  function core(t, depth) {
    if (exact.has(t)) return exact.get(t);
    const dot = t.includes(" · "), com = t.includes(", ");
    for (const p of pats) {
      if (p.key && !t.includes(p.key)) continue;
      // a value may not swallow list separators unless the pattern itself has them
      if ((dot && !p.dot) || (com && !p.com && !dot)) continue;
      const m = p.re.exec(t);
      if (!m) continue;
      const vals = {};
      p.holes.forEach((h, i) => { const g = m[i + 1]; vals[h] = depth < 3 && g && g !== t ? tr(g, depth + 1) : g; });
      return fill(p.ru, vals).replace(/\s{2,}/g, " ").trim();
    }
    if (depth < 3 && t.includes(" · ")) { const parts = t.split(" · "); const out = parts.map((x) => tr(x, depth + 1)); if (out.some((x, i) => x !== parts[i])) return out.join(" · "); }
    if (depth < 3 && /, /.test(t) && t.length < 120) { const parts = t.split(", "); const out = parts.map((x) => tr(x, depth + 1)); if (out.some((x, i) => x !== parts[i])) return out.join(", "); }
    if (depth < 3) {
      const c = t.indexOf(": ");
      if (c > 0) { const a = t.slice(0, c), b = t.slice(c + 2), ta = tr(a, depth + 1), tb = tr(b, depth + 1); if (ta !== a || tb !== b) return `${ta}: ${tb}`; }
      const n = /^(\d+)\. (.+)$/.exec(t);
      if (n) { const r = tr(n[2], depth + 1); if (r !== n[2]) return `${n[1]}. ${r}`; }
    }
    return null;
  }
  function tr(text, depth = 0) {
    if (text == null) return text;
    const s = String(text);
    if (!/[A-Za-z]/.test(s)) return s;
    if (depth === 0 && memo.has(s)) return memo.get(s);
    const lead = s.match(/^\s*/)[0], trail = s.slice(lead.length).match(/\s*$/)[0];
    const t = s.trim().replace(/\s+/g, " ");
    let r = core(t, depth);
    r = lead + dates(r == null ? t : r) + trail;
    if (r.trim() === t) r = s;
    if (depth === 0) { if (memo.size > 5000) memo.clear(); memo.set(s, r); }
    return r;
  }
  return tr;
}

export const toRu = makeTranslator(RU);
/** Translate a UI string into the current language. */
export const t = (s) => (LANG === "ru" ? toRu(s) : s);

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
/** Translate every text node and label attribute under root (no-op in Uzbek). */
export function translateDom(root) {
  if (LANG !== "ru" || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && (SKIP.has(n.parentNode.nodeName) || n.parentNode.closest?.("[data-notr]")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const v = n.nodeValue; if (v && /[A-Za-z]/.test(v)) { const r = toRu(v); if (r !== v) n.nodeValue = r; } }
  for (const a of ATTRS) for (const el of root.querySelectorAll(`[${a}]`)) { if (el.closest("[data-notr]")) continue; const v = el.getAttribute(a); const r = toRu(v); if (r !== v) el.setAttribute(a, r); }
}
