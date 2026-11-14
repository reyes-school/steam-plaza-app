// Tiny router shared by the Vercel function (api/index.js) and the standalone server (server.js).
import { db } from "./db.js";
import { readToken } from "./auth.js";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

const MAX_BODY = 4.4 * 1024 * 1024;
export async function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch { fail(400, "JSON noto‘g‘ri"); } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) fail(413, "So‘rov juda katta"); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { fail(400, "JSON noto‘g‘ri"); }
}

const routes = [];
/** route("GET", "/students/:id", handler, { auth: true|false, roles: [...] }) */
export function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  routes.push({ method, re, keys, handler, auth: opts.auth !== false, roles: opts.roles || null });
}

export const ADMINS = ["owner", "manager", "accountant"];
export const STAFF = ["owner", "manager"];
export const FINANCE = ["owner", "accountant"];

async function loadUser(sql, req) {
  const h = req.headers.authorization || "";
  const p = readToken(h.startsWith("Bearer ") ? h.slice(7) : "");
  if (!p) return null;
  const [u] = await sql`select id, role, name, phone, photo, profile, active, posts_seen_at from users where id = ${p.uid}`;
  return u && u.active ? u : null;
}

export async function dispatch(req, res, path) {
  try {
    const method = req.method === "HEAD" ? "GET" : req.method;
    const clean = "/" + String(path || "").replace(/^\/+|\/+$/g, "");
    let found = null, params = {}, allowed = false;
    for (const r of routes) {
      const m = r.re.exec(clean);
      if (!m) continue;
      allowed = true;
      if (r.method !== method) continue;
      found = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      break;
    }
    if (!found) return send(res, allowed ? 405 : 404, { error: allowed ? "Usul ruxsat etilmagan" : "Topilmadi" });
    const sql = await db();
    const url = new URL(req.url, "http://x");
    const ctx = { req, res, sql, params, query: Object.fromEntries(url.searchParams), user: null };
    if (found.auth) {
      ctx.user = await loadUser(sql, req);
      if (!ctx.user) fail(401, "Tizimga qayta kiring");
      if (found.roles && !found.roles.includes(ctx.user.role)) fail(403, "Bu bo‘lim uchun ruxsatingiz yo‘q");
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) ctx.body = await readBody(req);
    const out = await found.handler(ctx);
    if (res.writableEnded) return;
    send(res, 200, out === undefined ? { ok: true } : out);
  } catch (e) {
    const status = e.status || (e.code === "23505" ? 409 : e.code === "23503" ? 409 : 500);
    if (status === 500) console.error(e);
    const msg = e.code === "23505" ? "Bunday yozuv allaqachon mavjud (masalan, telefon raqam band)" : e.code === "23503" ? "Bog‘liq yozuv topilmadi yoki o‘chirib bo‘lmaydi" : status === 500 ? "Serverda xatolik" : e.message;
    if (!res.writableEnded) send(res, status, { error: msg });
  }
}

/* ---------- small shared helpers ---------- */
export const TZ = "Asia/Tashkent";
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function nowMinutes() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const [h, m] = p.split(":").map(Number); return h * 60 + m;
}
export const curMonth = () => today().slice(0, 7);
export const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const weekday = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const monthShift = (ym, n) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
export const monthEnd = (ym) => addDays(monthShift(ym, 1) + "-01", -1);
export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isMonth = (s) => typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
export const str = (v, max = 500) => (v == null ? "" : String(v).trim().slice(0, max));
export const int = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : NaN; };
export function need(cond, msg, status = 400) { if (!cond) fail(status, msg); }
/** Bell schedule → [{period, start, end}] in minutes from midnight. */
export function periodTimes(bell) {
  const toM = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  const out = []; let t = toM(bell.start || "08:30");
  for (let p = 1; p <= (bell.periods || 7); p++) {
    out.push({ period: p, start: t, end: t + bell.lesson });
    t += bell.lesson + (p === bell.lunchAfter ? bell.lunch : bell.break);
  }
  return out;
}
export const fileMeta = (f) => (f && typeof f === "object" && typeof f.id === "string" && /^[0-9a-f-]{36}$/.test(f.id) ? { id: f.id, name: str(f.name, 160), type: str(f.type, 120), size: int(f.size) || 0 } : null);
export const fileList = (a) => (Array.isArray(a) ? a.map(fileMeta).filter(Boolean).slice(0, 10) : []);

export async function notify(sql, userIds, n) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const rows = ids.map((user_id) => ({ user_id, kind: n.kind, title: str(n.title, 200), body: str(n.body, 500), link: str(n.link, 200) }));
  await sql`insert into notifications ${sql(rows, "user_id", "kind", "title", "body", "link")}`;
}
