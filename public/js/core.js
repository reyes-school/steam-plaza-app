// Core of the web app: state, API client, data cache, router, rendering, shared UI pieces.
import { LANG, t, t as tl, translateDom, RU_MONTHS_GEN, RU_MONTHS, RU_MONTHS_S, RU_WD, RU_WDS } from "./i18n.js";
export { LANG, t };
if (typeof document !== "undefined") document.documentElement.lang = LANG;
export const TZ = "Asia/Tashkent";
export const pad = (n) => String(n).padStart(2, "0");
export function tzNow() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const o = {}; for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
  return { date: `${o.year}-${o.month}-${o.day}`, min: Number(o.hour) * 60 + Number(o.minute), sec: Number(o.second) };
}
export const today = () => tzNow().date;
export const curMonth = () => today().slice(0, 7);
export const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const wdOf = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const mondayOf = (iso) => { const w = wdOf(iso); return addDays(iso, w === 0 ? -6 : 1 - w); };
export const monthShift = (ym, n) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
export const monthEnd = (ym) => addDays(monthShift(ym, 1) + "-01", -1);
const RU = LANG === "ru";
export const MONTHS = RU ? RU_MONTHS_GEN : ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const MONTHS_NOM = RU ? RU_MONTHS : MONTHS.map((n) => n[0].toUpperCase() + n.slice(1));
export const MONTHS_S = RU ? RU_MONTHS_S : ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
export const WD = RU ? RU_WD : ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const WDS = RU ? RU_WDS : ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
export const fmtDay = (iso) => { if (!iso) return ""; const s = String(iso); const [, m, d] = s.slice(0, 10).split("-").map(Number); return m ? (RU ? `${d} ${MONTHS[m - 1]}` : `${d}-${MONTHS[m - 1]}`) : ""; };
export const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return m ? (RU ? `${d} ${MONTHS[m - 1]} ${y}` : `${d}-${MONTHS[m - 1]} ${y}`) : ""; };
export const fmtTime = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? "" : new Intl.DateTimeFormat("uz-UZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t)); };
export const fmtWhen = (iso) => { const t = Date.parse(iso); if (Number.isNaN(t)) return ""; const d = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(t)); return (d === today() ? tl("Bugun") : d === addDays(today(), -1) ? tl("Kecha") : fmtDay(d)) + ", " + fmtTime(iso); };
export const fmtMonth = (ym) => { if (!ym) return ""; const [y, m] = ym.split("-").map(Number); return MONTHS_NOM[m - 1] + " " + y; };
export const fmtNum = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "));
export const fmtSum = (n) => fmtNum(n) + (RU ? " сум" : " so‘m");
export const fmtMln = (n) => (Number(n) / 1e6).toFixed(1).replace(".", ",") + (RU ? " млн" : " mln");
export const fmtAvg = (n) => (n == null ? "—" : Number(n).toFixed(1).replace(".", ","));
export const fmtLocal = (v) => { let d = String(v || "").replace(/\D/g, ""); if (d.length > 9 && d.startsWith("998")) d = d.slice(3); d = d.slice(0, 9); return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" "); };
export const FLAG = `<span class="flag" aria-hidden="true"><i></i><i></i><i></i></span>`;
export const fmtPhone = (p) => String(p || "").replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4");
export const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
export const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const initials = (n) => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
export const sName = (s) => (s ? `${s.last_name || ""} ${s.first_name || ""}`.trim() : "");
export const ROLE_L = { owner: "Bosh admin", manager: "Menejer", accountant: "Buxgalter", teacher: "O‘qituvchi", parent: "Ota-ona" };
export const ADMINS = ["owner", "manager", "accountant"];
export const STAFF = ["owner", "manager"];
export const FINANCE = ["owner", "accountant"];
export const SECTION_L = { school: "Maktab", kindergarten: "Bog‘cha" };
export const branches = () => S.me?.branches || [];
export const branchName = (id) => branches().find((b) => b.id === Number(id))?.name || "";
/** null = the user sees every branch (bosh admin / umumiy menejer); a number = limited to that branch. */
export const myScope = () => (S.me ? S.me.scope ?? null : null);
const roleLine = (u) => `${ROLE_L[u.role]}${u.branch_id && ["manager", "accountant", "teacher"].includes(u.role) ? " · " + branchName(u.branch_id) : ""}`;
/** Query string with the branch / section filter chosen in scopeBar(). */
export function fq(prefix = "&") {
  const b = myScope() === null ? S.ui.fb || "" : "", s = S.ui.fs || "";
  const q = [b ? "branch_id=" + b : "", s ? "section=" + s : ""].filter(Boolean).join("&");
  return q ? prefix + q : "";
}
/** Branch + section switcher for lists and reports. Branch staff see only the section switch. */
export function scopeBar({ section = true } = {}) {
  const all = myScope() === null;
  const bs = [["", "Barcha filiallar"], ...branches().map((b) => [String(b.id), b.name])];
  return `<div class="row wrap" style="gap:8px;align-items:center">${all && branches().length > 1 ? pills("fb", S.ui.fb || "", bs) : `<span class="badge">${ic("school", 14)} ${esc(branchName(myScope()) || branches()[0]?.name || "")}</span>`}
    ${section ? pills("fs", S.ui.fs || "", [["", "Maktab va bog‘cha"], ["school", "Maktab"], ["kindergarten", "Bog‘cha"]]) : ""}</div>`;
}
/** Random password that passes the server rules (letters + digits, 10 characters). */
export function genPassword() {
  const L = "abcdefghjkmnpqrstuvwxyz", D = "23456789", all = L + D, r = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let p = L[r(L.length)] + D[r(D.length)];
  while (p.length < 10) p += all[r(all.length)];
  return p.split("").sort(() => r(3) - 1).join("");
}

/** Bell schedule → [{period, start, end}] in minutes since midnight. */
export function periodTimes(bell) {
  const toM = (t) => { const [h, m] = String(t || "08:30").split(":").map(Number); return h * 60 + m; };
  const out = []; let t = toM(bell?.start);
  for (let p = 1; p <= (bell?.periods || 7); p++) { out.push({ period: p, start: t, end: t + bell.lesson }); t += bell.lesson + (p === bell.lunchAfter ? bell.lunch : bell.break); }
  return out;
}

/* ---------- icons ---------- */
export const ICON = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  food: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2M16 7c0-1 1-1 1-2"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4M16 13h2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  megaphone: '<path d="M3 10v4h4l7 5V5L7 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
  trophy2: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M12 13v4M8 21h8M10 17h4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  compare: '<path d="M4 20V10M9 20V4M15 20v-7M20 20V8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  chart: '<path d="M4 4v16h16M8 15l3-4 3 2 5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  calcheck: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 11 6 3h4l2 5 2-5h4l-2.5 8"/>',
};
export const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ""}</svg>`;

/* ---------- state ---------- */
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
export const S = { token: store.get("sp.token") || "", me: null, f: {}, files: {}, ui: {}, modal: null, toast: "", more: false };
export const fv = (k, d = "") => (S.f[k] !== undefined ? S.f[k] : d);
export function fill(map) { for (const [k, v] of Object.entries(map)) S.f[k] = v == null ? "" : String(v); }
export const user = () => S.me?.user;
export const role = () => S.me?.user?.role;
export const group = () => (ADMINS.includes(role()) ? "admin" : role());
export const settings = () => S.me?.settings || {};

/* ---------- API ---------- */
// Web: same origin. Mobile apps (Capacitor) load config.js that points to the live server.
export const API_BASE = String((window.SP_CONFIG && window.SP_CONFIG.api) || "").replace(/\/+$/, "");
export const native = { save: null, haptic: null, isApp: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) };
export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export async function api(path, opts = {}) {
  const r = await fetch(API_BASE + "/api" + path, { ...opts, headers: { "Content-Type": "application/json", ...(S.token ? { Authorization: "Bearer " + S.token } : {}), ...(opts.headers || {}) }, body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body });
  if (r.status === 401 && S.token && !path.startsWith("/auth")) { logout(); throw new ApiError(401, "Tizimga qayta kiring"); }
  const ct = r.headers.get("content-type") || "";
  const body = ct.includes("json") ? await r.json().catch(() => ({})) : await r.blob();
  if (!r.ok) throw new ApiError(r.status, body?.error || "Xatolik yuz berdi. Qayta urinib ko‘ring.");
  return body;
}
export const post = (p, body) => api(p, { method: "POST", body });
export const put = (p, body) => api(p, { method: "PUT", body });
export const patch = (p, body) => api(p, { method: "PATCH", body });
export const del = (p) => api(p, { method: "DELETE" });

/** Runs a mutation with a busy flag and toast on error; invalidates cached data by prefix. */
export async function run(key, fn, { ok, invalidate: inv = [] } = {}) {
  if (S.ui.busy === key) return;
  S.ui.busy = key; render();
  try {
    const out = await fn();
    if (inv.length) invalidate(...inv);
    if (ok) toast(ok);
    return out;
  } catch (e) { toast(e.message || "Xatolik"); throw e; }
  finally { S.ui.busy = null; render(); }
}
export const busy = (key) => S.ui.busy === key;

/* ---------- data cache: views call data(path); it returns the value or undefined while loading ---------- */
const cache = new Map();
export function data(path) {
  const c = cache.get(path);
  if (c && "value" in c) { if (c.stale && !c.loading) load(path); return c.value; }
  if (!c || (!c.loading && !c.error)) load(path);
  return undefined;
}
export const dataError = (path) => cache.get(path)?.error;
async function load(path) {
  const c = cache.get(path) || {};
  c.loading = true; c.error = null; cache.set(path, c);
  try { c.value = await api(path); c.stale = false; }
  catch (e) { c.error = e.message; }
  finally { c.loading = false; scheduleRender(); }
}
export function invalidate(...prefixes) {
  for (const k of cache.keys()) if (prefixes.some((p) => k.startsWith(p))) { const c = cache.get(k); c.stale = true; c.error = null; }
  scheduleRender();
}
export function retry(path) { cache.delete(path); scheduleRender(); }
let raf = 0;
function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
/** Shows a loader/error block for a pending path, otherwise null. Use: `const x = data(p); if (x === undefined) return pending(p);` */
export function pending(path) {
  const e = dataError(path);
  if (e) return `<section class="card"><b>Ma’lumotni yuklab bo‘lmadi</b><span class="muted">${esc(e)}</span><button type="button" class="btn sec sm" style="align-self:flex-start" data-a="retry" data-k="${esc(path)}">Qayta urinish</button></section>`;
  return `<section class="card"><div class="row" style="padding:12px;justify-content:center"><span class="spin"></span><span class="muted">Yuklanmoqda…</span></div></section>`;
}

/* ---------- registries ---------- */
export const VIEWS = {};   // key `${group}:${name}` or `*:${name}` → { title, render(id) }
export const ACTIONS = {}; // data-a="name"
export const SUBMITS = {}; // data-submit="name"
export const MODALS = {};  // S.modal.type
export const NAV = {};     // group/role → [[route, label, icon]]

/* ---------- routing ---------- */
export function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = /^(.*?)-(\d+)$/.exec(h);
  return m ? { name: m[1], id: Number(m[2]) } : { name: h || "", id: null };
}
export function go(r) { if (location.hash.slice(1) === r) render(); else location.hash = r; }
function findView(name) { return VIEWS[`${role()}:${name}`] || VIEWS[`${group()}:${name}`] || VIEWS[`*:${name}`]; }
export function navFor() { return NAV[role()] || NAV[group()] || []; }

/* ---------- shared UI pieces ---------- */
export const badge = (t, tone = "") => `<span class="badge ${tone}">${esc(t)}</span>`;
export const seg = (key, val, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-a="set" data-k="${key}" data-v="${esc(v)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join("")}</div>`;
export const pills = (key, val, opts) => `<div class="pills" role="group">${opts.map(([v, l]) => `<button type="button" class="pill" data-a="set" data-k="${key}" data-v="${esc(v)}" aria-pressed="${String(v) === String(val)}">${esc(l)}</button>`).join("")}</div>`;
export const cardHead = (title, action = "") => `<div class="card-head"><h2>${esc(title)}</h2>${action}</div>`;
export const empty = (t) => `<div class="empty">${esc(t)}</div>`;
export const bar = (pct, color = "var(--accent)") => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></i></div>`;
export const linkTo = (label, route, cls = "link") => `<button type="button" class="${cls}" data-a="go" data-r="${esc(route)}">${label}</button>`;
export function field(id, label, o = {}) {
  const attrs = `id="${id}" data-f="${id}" ${o.live ? 'data-live="1"' : ""} ${o.required ? "required" : ""} ${o.max ? `maxlength="${o.max}"` : ""}`;
  if (o.phone) return `<div class="field" ${o.style ? `style="${o.style}"` : ""}><label for="${id}">${esc(label)}${o.required ? ' <span style="color:var(--bad)">*</span>' : ""}</label><div class="phone-wrap"><span class="cc">${FLAG}+998</span><input class="input" ${attrs} data-phone="1" type="tel" inputmode="tel" placeholder="90 123 45 67" value="${esc(fmtLocal(fv(id, o.def)))}" autocomplete="${o.ac || "off"}"></div>${o.hint ? `<span class="xs muted">${esc(o.hint)}</span>` : ""}</div>`;
  const input = o.area
    ? `<textarea class="input" ${attrs} rows="${o.rows || 3}" placeholder="${esc(o.ph || "")}">${esc(fv(id, o.def))}</textarea>`
    : o.options
      ? `<select class="input" ${attrs}>${o.blank !== false ? `<option value="">${esc(o.blank || "— tanlang —")}</option>` : ""}${o.options.map(([v, l]) => `<option value="${esc(v)}" ${String(fv(id, o.def)) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<input class="input" ${attrs} type="${o.type || "text"}" inputmode="${o.mode || "text"}" placeholder="${esc(o.ph || "")}" value="${esc(fv(id, o.def))}" autocomplete="${o.ac || "off"}" ${o.min != null ? `min="${o.min}"` : ""}>`;
  return `<div class="field" ${o.style ? `style="${o.style}"` : ""}><label for="${id}">${esc(label)}${o.required ? ' <span style="color:var(--bad)">*</span>' : ""}</label>${input}${o.hint ? `<span class="xs muted">${esc(o.hint)}</span>` : ""}</div>`;
}
export const starsHtml = (avg, size = 14) => { const n = Math.round(avg || 0); return `<span class="stars" aria-label="${fmtAvg(avg)} yulduz">${[1, 2, 3, 4, 5].map((i) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= n ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="${ICON.star.match(/d="([^"]+)"/)[1]}"/></svg>`).join("")}</span>`; };
export function rankMark(rank) {
  if (!rank) return `<span class="rk">—</span>`;
  if (rank === 1) return `<span class="rk r1" title="1-o‘rin">${ic("trophy2", 17)}</span>`;
  return `<span class="rk ${rank <= 3 ? "r" + rank : ""}">${rank}</span>`;
}
export const avgColor = (a) => (a == null ? "var(--muted)" : a >= 4.5 ? "var(--accent)" : a >= 4 ? "var(--info)" : a >= 3 ? "var(--warn)" : "var(--bad)");
export const gradeBadge = (v) => `<span class="grade g${v}">${v}</span>`;

/* ---------- avatars & photos ---------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const SKIN = ["#F2C9A5", "#E8B38A", "#D69A6E", "#C58658", "#F5D3B3"], HAIR = ["#2B1B12", "#3B2416", "#4A2E1A", "#1C1C1C", "#6B4423"];
const AVBG = ["#E5EFE9", "#FBF2DF", "#E8F0FC", "#F1EBFA", "#FCEBEB", "#E3F4F5"], SHIRT = ["#083F2C", "#D5A042", "#1F4FA8", "#5B2E9E", "#2C7A53", "#9C4A2A"];
export function avatarSvg(seed, female, size) {
  const r = rng(seed * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)];
  const skin = pick(SKIN), hair = pick(HAIR), bg = pick(AVBG), shirt = pick(SHIRT);
  const back = female ? `<path d="M14 31c0-14 8-21 18-21s18 7 18 21v15c0 4-3 6-6 6H20c-3 0-6-2-6-6z" fill="${hair}"/>` : "";
  const top = female ? `<path d="M19 28c2-9 7-14 13-14s11 5 13 14c-5-4-9-6-13-6s-8 2-13 6z" fill="${hair}"/>` : `<path d="M18 29c0-11 6-17 14-17s14 6 14 17c-2-5-6-8-14-8s-12 3-14 8z" fill="${hair}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="border-radius:50%;display:block;flex-shrink:0"><rect width="64" height="64" fill="${bg}"/>${back}<path d="M11 64c2-11 10-16 21-16s19 5 21 16z" fill="${shirt}"/><rect x="28" y="40" width="8" height="9" rx="3" fill="${skin}"/><circle cx="32" cy="31" r="13" fill="${skin}"/>${top}<circle cx="27" cy="31.5" r="1.6" fill="#2a1a10"/><circle cx="37" cy="31.5" r="1.6" fill="#2a1a10"/><path d="M28 36.5c2.2 2 5.8 2 8 0" stroke="#7a3e2a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
}
export const fileUrl = (f) => (f && f.id ? `${API_BASE}/api/files/${f.id}` : "");
/** Photo if uploaded, otherwise an illustrated avatar. p: {id, photo, gender | profile.gender}, kind 's' or 't' */
export function ava(p, size = 40, kind = "s") {
  if (!p) return avatarSvg(1, false, size);
  if (p.photo && p.photo.id) return `<img src="${fileUrl(p.photo)}" alt="" width="${size}" height="${size}" loading="lazy" style="border-radius:50%;object-fit:cover;flex-shrink:0;display:block;width:${size}px;height:${size}px">`;
  const female = (p.gender || p.profile?.gender || p.student_gender) === "f";
  return avatarSvg((kind === "t" ? 500 : 0) + (p.id || p.student_id || 1), female, size);
}
/** Avatar that uploads a new photo when clicked (target: "student:ID" or "user:ID"). */
export function avaEdit(p, size, target, kind = "s") {
  return `<button type="button" class="ava-btn" data-a="photo" data-k="${target}" aria-label="Rasm yuklash">${ava(p, size, kind)}<span class="cam">${ic("camera", 11)}</span></button>`;
}

/* ---------- files ---------- */
export const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
export const isImg = (f) => f && /^image\//.test(f.type || "");
function readAsDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("read")); r.readAsDataURL(blob); }); }
export function shrinkImage(file, max = 1800, square = 0) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
      if (square) { const m = Math.min(img.width, img.height); cv.width = cv.height = square; ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, square, square); }
      else { const k = Math.min(1, max / Math.max(img.width, img.height)); if (k === 1 && file.size < 600 * 1024 && /jpe?g|png|webp/.test(file.type)) return res(file); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height); }
      cv.toBlob((b) => (b ? res(b) : rej(new Error("type"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("type")); };
    img.src = url;
  });
}
const OK_TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/vnd\.ms-(excel|powerpoint))$/;
const EXT_TYPES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
/** Upload size limit from the server (3 MB on Vercel, 10 MB on own server). */
export const upMb = () => S.me?.uploadMaxMb || 3;
export async function uploadFile(file, { scope = "public", square = 0 } = {}) {
  let type = file.type || EXT_TYPES[(file.name.split(".").pop() || "").toLowerCase()] || "";
  const image = /^image\//.test(type);
  if (!OK_TYPES.test(type) && !image) throw new Error("Faqat rasm, PDF, Word, Excel yoki PowerPoint fayl yuklang");
  const blob = image ? await shrinkImage(file, 1800, square) : file;
  if (image) type = blob.type || "image/jpeg";
  if (blob.size > upMb() * 1024 * 1024) throw new Error(`Fayl juda katta: ${upMb()} MB gacha bo‘lsin`);
  const r = await post("/files", { name: file.name, type, scope, data: await readAsDataUrl(blob) });
  return { ...r, original: Math.max(file.size || 0, r.original || 0) };
}
let picker = null;
/** Opens the system file dialog; resolves with the chosen files. */
export function pickFiles({ multiple = false, accept = "*/*" } = {}) {
  return new Promise((res) => {
    if (!picker) { picker = document.createElement("input"); picker.type = "file"; picker.style.display = "none"; document.body.appendChild(picker); }
    picker.multiple = multiple; picker.accept = accept; picker.value = "";
    picker.onchange = () => res([...(picker.files || [])]);
    picker.click();
  });
}
/** Picks files and uploads them into S.files[key] (keys starting with "priv:" are stored as private). */
export async function pickAndUpload(key, { multiple = false, accept } = {}) {
  const files = await pickFiles({ multiple, accept });
  if (!files.length) return S.files[key] || [];
  await run("up:" + key, async () => {
    let before = 0, after = 0;
    for (const f of files) { const meta = await uploadFile(f, { scope: key.startsWith("priv:") ? "private" : "public" }); before += meta.original || meta.size; after += meta.size; delete meta.original; S.files[key] = multiple ? [...(S.files[key] || []), meta] : [meta]; }
    if (before > after * 1.15 && before - after > 50 * 1024) toast(`Fayl siqildi: ${fmtSize(before)} → ${fmtSize(after)}`);
  }).catch(() => {});
  return S.files[key] || [];
}
/** File picker widget bound to S.files[key]. */
export function fileBox(key, { label = "Fayl biriktirish", multiple = true, hint = `Rasm, PDF yoki Word, ${upMb()} MB gacha · avtomatik siqiladi`, accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" } = {}) {
  const list = S.files[key] || [];
  const up = busy("up:" + key);
  return `<div class="col" style="gap:8px">
    ${list.length ? `<div class="row wrap" style="gap:6px">${list.map((f, i) => `<span class="chip-file">${ic(isImg(f) ? "camera" : "file", 15)}<b title="${esc(f.name)}">${esc(f.name)}</b><span class="xs muted">${fmtSize(f.size)}</span><button type="button" class="linkbtn" data-a="file-rm" data-k="${key}" data-v="${i}" aria-label="Olib tashlash">✕</button></span>`).join("")}</div>` : ""}
    ${multiple || !list.length ? `<div class="row wrap" style="gap:8px"><button type="button" class="btn sec sm" data-a="file-pick" data-k="${key}" data-m="${multiple ? 1 : 0}" data-accept="${esc(accept)}" ${up ? "disabled" : ""}>${up ? '<span class="spin" style="width:14px;height:14px"></span> Yuklanmoqda…' : `${ic("upload", 16)} ${esc(label)}`}</button><span class="xs muted">${esc(hint)}</span></div>` : ""}
  </div>`;
}
/** Links to attached files (public ones open directly). */
export function fileLinks(list, { priv = false } = {}) {
  if (!list || !list.length) return "";
  return `<div class="row wrap" style="gap:6px">${list.map((f) => isImg(f) && !priv
    ? `<a class="chip-file" href="${fileUrl(f)}" target="_blank" rel="noopener"><img src="${fileUrl(f)}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:6px"><b>${esc(f.name)}</b></a>`
    : priv ? `<button type="button" class="chip-file" data-a="file-open" data-v="${esc(f.id)}" data-n="${esc(f.name)}">${ic("file", 15)}<b>${esc(f.name)}</b><span class="xs muted">${fmtSize(f.size)}</span></button>`
      : `<a class="chip-file" href="${fileUrl(f)}" target="_blank" rel="noopener">${ic("file", 15)}<b>${esc(f.name)}</b><span class="xs muted">${fmtSize(f.size)}</span></a>`).join("")}</div>`;
}
/** Downloads an API file (PDF reports) with the login token. */
export async function download(path, name) {
  S.ui.busy = "dl:" + path; render();
  try {
    const blob = await api(RU && path.startsWith("/pdf/") ? path + (path.includes("?") ? "&" : "?") + "lang=ru" : path);
    if (native.save) { await native.save(blob, name); return; }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) { toast(e.message); }
  finally { S.ui.busy = null; render(); }
}
export const pdfBtn = (path, name, label = "PDF yuklab olish") => `<button type="button" class="btn sec sm" data-a="pdf" data-v="${esc(path)}" data-n="${esc(name)}" ${busy("dl:" + path) ? "disabled" : ""}>${busy("dl:" + path) ? '<span class="spin" style="width:14px;height:14px"></span>' : ic("download", 16)} ${esc(label)}</button>`;

/* ---------- design components ---------- */
export function greeting(name) {
  const h = Math.floor(tzNow().min / 60);
  const hi = h >= 5 && h < 11 ? "Xayrli tong" : h >= 11 && h < 17 ? "Xayrli kun" : h >= 17 && h < 22 ? "Xayrli kech" : "Xayrli tun";
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const d = today();
  return `<div class="greet"><h1>${hi}${first ? ", " + esc(first) : ""}!</h1><div class="when"><span class="sun">${ic("sun", 20)}</span>Bugun ${fmtDay(d)}, ${WD[wdOf(d)].toLowerCase()}</div></div>`;
}
export function sparkline(values, color = "var(--accent)") {
  const v = (values || []).filter((x) => x != null && !Number.isNaN(Number(x))).map(Number);
  if (v.length < 2) return "";
  const W = 96, H = 28, min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => [((i / (v.length - 1)) * (W - 4) + 2).toFixed(1), (H - 3 - ((x - min) / span) * (H - 8)).toFixed(1)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const TONE_COL = { green: "#1A9F5B", yellow: "#E8A21A", mint: "#0F9F80", lav: "#6C5CE7", sky: "#2F80ED", rose: "#E5484D" };
/** Coloured statistic tile. delta: number (positive = good unless bad:true). */
export function tile({ icon, label, value, tone = "green", delta = null, deltaText = "", goodUp = true, spark = null, route = null, cls = "" }) {
  const dir = delta == null || delta === 0 ? "flat" : (delta > 0) === goodUp ? "up" : "down";
  const d = delta == null ? "" : `<span class="t-d ${dir}">${delta > 0 ? "↑" : delta < 0 ? "↓" : "="} ${esc(deltaText)}</span>`;
  const tag = route ? "button" : "div";
  return `<${tag} ${route ? `type="button" data-a="go" data-r="${esc(route)}"` : ""} class="tile ${tone} ${cls}"><div class="t-top"><span class="t-ic">${ic(icon, 21)}</span><span class="t-l">${esc(label)}</span></div><span class="t-v">${value}</span><div class="t-foot">${d || "<span></span>"}${spark ? sparkline(spark, TONE_COL[tone]) : ""}</div></${tag}>`;
}
export function ring(pct, label = "") {
  const L = 226.2, p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<div class="ring" style="--len:${L}" role="img" aria-label="${p}%${label ? " " + esc(label) : ""}"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" cx="42" cy="42" r="36" stroke-dasharray="${L}" stroke-dashoffset="${(L * (1 - p / 100)).toFixed(1)}"/></svg><b>${p}%</b></div>`;
}
export const PLANE = `<svg class="plane" viewBox="0 0 430 190" aria-hidden="true"><defs><linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6E2EB"/></linearGradient></defs>
  <ellipse cx="90" cy="150" rx="70" ry="16" fill="#fff" opacity=".9"/><ellipse cx="130" cy="140" rx="46" ry="18" fill="#fff" opacity=".9"/><ellipse cx="360" cy="40" rx="44" ry="11" fill="#fff" opacity=".85"/>
  <path d="M212 93 L262 38 L286 38 L254 96 Z" fill="#C3D1DC"/>
  <path d="M44 106 C70 88 300 79 366 87 C398 91 412 101 404 110 C396 118 366 121 334 121 L76 121 C54 121 36 114 44 106 Z" fill="url(#pf)"/>
  <path d="M64 106 L34 50 L58 50 L106 102 Z" fill="#1A9F5B"/><path d="M58 50 L70 50 L104 98 L96 100 Z" fill="#F2B12E"/>
  <path d="M66 112 L392 105 L396 110 L70 118 Z" fill="#1A9F5B"/><path d="M70 119 L396 111 L397 113 L72 121 Z" fill="#F2B12E"/>
  <path d="M196 108 L258 166 L286 166 L248 106 Z" fill="#E6EDF3" stroke="#C3D1DC"/><ellipse cx="244" cy="138" rx="20" ry="8" fill="#AFC0CD"/><ellipse cx="228" cy="138" rx="5" ry="7" fill="#7F93A3"/>
  ${Array.from({ length: 15 }, (_, i) => `<rect x="${126 + i * 15}" y="94" width="8" height="8" rx="3" fill="#2E4A5E" opacity=".75"/>`).join("")}
  <path d="M376 91 Q392 94 400 102 L382 102 Z" fill="#2E4A5E"/></svg>`;
export function banner({ title = "Bilim bilan parvoz qiling!", btn = "Batafsil", route = "news" } = {}) {
  const sch = settings().school || {};
  return `<section class="banner"><span class="b-brand">${ic("school", 16)} ${esc(sch.name || "Steam Plaza")}</span><h2>${esc(title)}</h2><button type="button" class="btn sm" data-a="go" data-r="${esc(route)}">${esc(btn)} →</button>${PLANE}</section>`;
}
const SUBJ_TONES = ["green", "yellow", "mint", "lav", "sky", "rose"];
export const subjTone = (name) => { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SUBJ_TONES[h % SUBJ_TONES.length]; };
export const TONE = TONE_COL;

/* ---------- motion: counters, bars, rings, charts animate once when visible ---------- */
const played = new Set();
let motionRoute = null, io = null;
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function countUp(el) {
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
  if (!node) return;
  const m = /^(\D*?)(-?\d[\d\s]*)(,\d+)?(.*)$/s.exec(node.nodeValue);
  if (!m) return;
  const intPart = m[2].replace(/\s/g, ""), dec = m[3] ? m[3].length - 1 : 0, grouped = /\s/.test(m[2].trim());
  const target = Number(intPart + (m[3] ? "." + m[3].slice(1) : ""));
  if (!Number.isFinite(target) || target === 0) return;
  const fmt = (v) => { let t = v.toFixed(dec).replace(".", ","); if (grouped) { const [i, f] = t.split(","); t = i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (f ? "," + f : ""); } return m[1] + t + m[4]; };
  const t0 = performance.now(), dur = 800;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.nodeValue = fmt(target * e); if (k < 1 && node.isConnected) requestAnimationFrame(step); else node.nodeValue = fmt(target); };
  node.nodeValue = fmt(0); requestAnimationFrame(step);
}
function play(el) {
  if (el.matches(".stat .v, .tile .t-v, .ranktile .big, .pod-avg")) countUp(el);
  else el.classList.add("play");
}
function afterRender(routeKey) {
  if (routeKey !== motionRoute) { played.clear(); motionRoute = routeKey; }
  const main = document.getElementById("main"); if (!main) return;
  if (!io && "IntersectionObserver" in window) io = new IntersectionObserver((entries) => { for (const en of entries) if (en.isIntersecting) { io.unobserve(en.target); play(en.target); } }, { threshold: 0.2 });
  const seen = {};
  main.querySelectorAll(".stat .v, .tile .t-v, .ranktile .big, .pod-avg, .bar > i, .ring, .chartbox, svg.spark, .check-ic.ok, .st-pill.ok").forEach((el) => {
    const type = el.matches(".bar > i") ? "bar" : el.classList[0] || el.tagName;
    const n = (seen[type] = (seen[type] || 0) + 1);
    const key = `${type}|${n}|${(el.textContent || "").slice(0, 24)}|${el.getAttribute("style") || ""}`;
    if (played.has(key)) return;
    played.add(key);
    if (reduceMotion()) return;
    if (io) io.observe(el); else play(el);
  });
}
// ripple feedback for touch on Android
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || !/Android/i.test(navigator.userAgent) || reduceMotion()) return;
  const el = e.target.closest(".btn, .tab, .nav-item, .sheet-item, .pill, .week-chip, .seg button, .tile, .pcard, .cta-card");
  if (!el) return;
  const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height);
  const sp = document.createElement("span"); sp.className = "ripple";
  sp.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.style.overflow = "hidden"; el.appendChild(sp); setTimeout(() => sp.remove(), 600);
}, { passive: true });

/* ---------- celebrations ---------- */
export function confetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.id = "confetti"; document.body.appendChild(c);
  const ctx = c.getContext("2d"), W = (c.width = innerWidth), H = (c.height = innerHeight);
  const cols = ["#D5A042", "#F4C95D", "#083F2C", "#2C7A53", "#E8F0FC", "#C98B1E", "#FFFFFF"];
  const ps = Array.from({ length: 170 }, () => ({ x: W / 2 + (Math.random() - 0.5) * 140, y: H * 0.35, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) { ctx.clearRect(0, 0, W, H); for (const p of ps) { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); } if (t - t0 < 4200) requestAnimationFrame(frame); else c.remove(); })(t0);
}
export const CUP = `<svg class="cup" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v12a14 14 0 0 1-28 0z" fill="#E7B64E"/><path d="M46 12h8v4a8 8 0 0 1-8 8M18 12h-8v4a8 8 0 0 0 8 8" fill="none" stroke="#C98B1E" stroke-width="3"/><rect x="28" y="34" width="8" height="10" fill="#C98B1E"/><rect x="20" y="44" width="24" height="8" rx="2" fill="#083F2C"/><path d="M32 13l2 4 4.4.6-3.2 3 .8 4.4L32 23l-4 2 .8-4.4-3.2-3 4.4-.6z" fill="#FFF6DD"/></svg>`;
/** Opens a celebration once per key (stored in this browser). */
export function celebrateOnce(key, modal) {
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
  if (S.modal) return;
  setTimeout(() => { S.modal = modal; render(); confetti(); }, 350);
}
/* ---------- toast & modal ---------- */
let toastTimer;
export function toast(msg) { S.toast = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ""; render(); }, 3200); render(); }
export function openModal(m) { S.modal = m; render(); }
export function closeModal() { S.modal = null; render(); }
export const modalHead = (title, sub = "") => `<div class="row between" style="align-items:flex-start"><div class="col" style="gap:2px;min-width:0"><h2 style="font-size:19px">${esc(title)}</h2>${sub ? `<span class="small muted">${sub}</span>` : ""}</div><button type="button" class="iconbtn" data-a="close-modal" aria-label="Yopish">${ic("close", 16)}</button></div>`;

/* ---------- session ---------- */
export async function loadMe() { S.me = await api("/me"); }
export function setToken(t) { S.token = t; if (t) store.set("sp.token", t); else store.del("sp.token"); }
/** Hooks run before logout (e.g. remove this browser's push subscription while the token still works). */
export const beforeLogout = [];
export async function logoutAll() { for (const f of beforeLogout) { try { await f(); } catch { /* ignore */ } } }
export function logout() { logoutAll(); setToken(""); S.me = null; cache.clear(); S.f = {}; S.files = {}; S.modal = null; S.ui = {}; if (location.hash) location.hash = ""; render(); }

/* ---------- shell & render ---------- */
const $app = () => document.getElementById("app");
function shell(view, content) {
  const u = user(), nav = navFor(), { name } = parseHash();
  const active = view.nav || name;
  const unread = S.me?.unread || 0;
  const tabsN = 4, tabs = nav.length > 5 ? [...nav.slice(0, tabsN), ["#more", "Yana", "more"]] : nav, extra = nav.length > 5 ? nav.slice(tabsN) : [];
  const sch = settings().school || {};
  const item = ([r, l, i]) => `<button type="button" class="nav-item" data-a="go" data-r="${r}" ${r === active ? 'aria-current="page"' : ""}>${ic(i, 20)}${esc(l)}${r === "unlocks" && S.me?.badges?.unlocks ? `<span class="count">${S.me.badges.unlocks}</span>` : ""}</button>`;
  return `<div class="shell">
    <aside class="side" aria-label="Asosiy menyu">
      <div class="brand"><img src="/logo-mark.png" alt="" width="62" height="32" style="object-fit:contain"><div class="col" style="gap:0"><span class="brand-name">${esc(sch.name || "Steam Plaza")}</span><span class="xs muted">${esc(sch.subtitle || "")}</span></div></div>
      <nav class="nav">${nav.map(item).join("")}
        <button type="button" class="nav-item" data-a="bell">${ic("bell", 20)}Bildirishnomalar${unread ? `<span class="count">${unread}</span>` : ""}</button></nav>
      <div class="me"><button type="button" class="ava-btn" data-a="go" data-r="profile" aria-label="Profil">${ava(u, 36, u.role === "teacher" ? "t" : "s")}</button><div class="col grow" style="gap:0"><b class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name)}</b><span class="xs muted">${esc(roleLine(u))}</span></div><button type="button" class="iconbtn" style="width:38px;height:38px;border:0;background:transparent" data-a="logout" aria-label="Chiqish">${ic("logout", 19)}</button></div>
    </aside>
    <div class="main">
      <header class="top"><div class="top-row">
        ${view.back ? `<button type="button" class="iconbtn" data-a="back" aria-label="Orqaga">${ic("back", 18)}</button>` : ""}
        <div class="top-brand"><img src="/logo-mark.png" alt="" width="46" height="26" style="object-fit:contain;flex-shrink:0"><div style="min-width:0"><b>${esc(sch.name || "Steam Plaza")}</b><span class="xs muted">${esc(roleLine(u))}</span></div></div>
        <button type="button" class="iconbtn" data-a="bell" aria-label="Bildirishnomalar${unread ? `: ${unread} ta yangi` : ""}">${ic("bell", 18)}${unread ? '<span class="dot"></span>' : ""}</button>
        <button type="button" class="ava-btn" data-a="go" data-r="profile" aria-label="Profil">${ava(u, 36, u.role === "teacher" ? "t" : "s")}</button></div>
      </header>
      <div class="deskbar">${ADMINS.includes(u.role) ? `<form class="search" data-submit="gsearch">${ic("search", 17)}<input id="gq" data-f="gq" placeholder="O‘quvchi yoki ota-ona qidirish…" value="${esc(fv("gq"))}" aria-label="Qidirish"></form>` : ""}<span class="sp"></span>
        <button type="button" class="iconbtn" data-a="bell" aria-label="Bildirishnomalar">${ic("bell", 18)}${unread ? '<span class="dot"></span>' : ""}</button>
        <button type="button" class="ava-btn" data-a="go" data-r="profile" aria-label="Profil">${ava(u, 38, u.role === "teacher" ? "t" : "s")}</button></div>
      <main class="content ${S._pageIn ? "page-in" : ""}" id="main">
        ${view.noHead ? "" : `<div class="page-head"><div class="row" style="gap:8px">${view.back ? `<button type="button" class="iconbtn" data-a="back" aria-label="Orqaga">${ic("back", 18)}</button>` : ""}<h1>${esc(typeof view.title === "function" ? view.title() : view.title)}</h1></div>${view.actions ? view.actions() : ""}</div>`}
        ${content}
      </main>
    </div>
    <nav class="tabs" aria-label="Bo‘limlar">${tabs.map(([r, l, i]) => { const on = r === "#more" ? S.more || extra.some((e) => e[0] === active) : r === active; return `<button type="button" class="tab" data-a="${r === "#more" ? "more" : "go"}" data-r="${r}" ${on ? 'aria-current="page"' : ""}>${ic(i, 22)}${esc(l)}</button>`; }).join("")}</nav>
    ${S.more ? `<div class="overlay" data-a="close-more"><div class="modal" style="gap:4px" data-stop="1">${extra.map(([r, l, i]) => `<button type="button" class="sheet-item" data-a="go" data-r="${r}" ${r === active ? 'aria-current="page"' : ""}>${ic(i, 20)}${esc(l)}</button>`).join("")}<button type="button" class="sheet-item" data-a="logout">${ic("logout", 20)}Chiqish</button></div></div>` : ""}
  </div>`;
}

export function render() {
  const root = $app(); if (!root) return;
  const a = document.activeElement, focusId = a && a.id ? a.id : null;
  const sel = a && typeof a.selectionStart === "number" ? [a.selectionStart, a.selectionEnd] : null;
  const scrollModal = document.querySelector(".modal")?.scrollTop || 0;
  let html;
  if (!S.token || !S.me) html = VIEWS["*:login"].render();
  else {
    const { name, id } = parseHash();
    let view = findView(name);
    if (!view || (view.roles && !view.roles.includes(role()))) { const home = navFor()[0]?.[0] || "home"; if (name !== home) { location.replace("#" + home); return; } view = findView(home); }
    let content = "", modal = "";
    try { content = view.render(id); } catch (e) { console.error(e); content = `<section class="card"><b>Bu sahifani ko‘rsatib bo‘lmadi</b><span class="muted">Sahifani yangilab ko‘ring. Muammo takrorlansa, administratorga xabar bering.</span></section>`; }
    if (S.modal) { try { const m = MODALS[S.modal.type]; modal = m ? `<div class="overlay" data-a="close-modal"><div class="modal ${S.modal.wide ? "wide" : ""}" role="dialog" aria-modal="true" data-stop="1">${m(S.modal)}</div></div>` : ""; } catch (e) { console.error(e); S.modal = null; } }
    const routeKey = location.hash || "#";
    const isPending = /class="spin"/.test(content) && content.length < 600;
    S._pageIn = routeKey !== S._lastRoute || (S._lastPending && !isPending);
    S._lastRoute = routeKey; S._lastPending = isPending;
    html = shell(view, content) + modal;
    S._routeKey = routeKey;
    document.title = `${typeof view.title === "function" ? view.title() : view.title} · ${settings().school?.name || "Steam Plaza"}`;
  }
  if (S.toast) html += `<div class="toast" role="status">${esc(S.toast)}</div>`;
  root.innerHTML = html;
  if (RU) { try { translateDom(root); document.title = tl(document.title); } catch (e) { console.error(e); } }
  if (scrollModal) { const m = document.querySelector(".modal"); if (m) m.scrollTop = scrollModal; }
  if (S.me && S.token) { try { afterRender(S._routeKey); } catch (e) { console.error(e); } S._pageIn = false; }
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch {} } } }
}
