// Tiny router shared by the Vercel function (api/index.js) and the standalone server (server.js).
import { db, dbUrl } from "./db.js";
import { readToken } from "./auth.js";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };

/** Security headers for every API answer (the static site gets the same from server.js / vercel.json). */
export function secHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

/** Client IP. Behind nginx/Vercel the proxy sets X-Real-IP / X-Forwarded-For; set TRUST_PROXY=0 when the app faces the internet directly. */
export function clientIp(req) {
  const trust = process.env.TRUST_PROXY !== "0";
  if (trust) {
    const real = req.headers["x-real-ip"];
    if (real) return String(real).trim();
    const xff = req.headers["x-forwarded-for"];
    if (xff) { const parts = String(xff).split(",").map((x) => x.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  }
  return req.socket?.remoteAddress || "unknown";
}

/** Small in-memory sliding-window limiter (per process). Login attempts are also counted in the database (works across Vercel instances). */
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) { b = { start: now, n: 0 }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 50000) for (const [k, v] of buckets) if (now - v.start > 10 * 60 * 1000) buckets.delete(k);
  return b.n <= limit;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (now - v.start > 10 * 60 * 1000) buckets.delete(k); }, 60 * 1000).unref?.();

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  secHeaders(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

// JSON body limit: enough for one base64 file of MAX_FILE_MB (default 3 MB) plus some fields.
const MAX_BODY = Math.max(4.4, (Number(process.env.MAX_FILE_MB) || 3) * 1.4 + 0.2) * 1024 * 1024;
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
  const [u] = await sql`select id, role, name, phone, photo, profile, active, posts_seen_at, branch_id, token_version, demo from users where id = ${p.uid}`;
  if (!u || !u.active || (u.token_version || 0) !== (p.tv || 0)) return null;
  if (u.demo && !demoAllowed()) return null;
  return u;
}

export const demoAllowed = () => process.env.ALLOW_DEMO === "1" || process.env.NODE_ENV !== "production";

const APP_ORIGINS = ["capacitor://localhost", "ionic://localhost", "https://localhost", "http://localhost", ...String(process.env.CORS_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean)];
export async function dispatch(req, res, path) {
  const origin = req.headers.origin;
  if (origin && APP_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    const ip = clientIp(req);
    req.ip = ip;
    // general flood protection: RATE_LIMIT requests per minute per IP (default 600), uploads stricter
    if (!rateLimit("all|" + ip, Number(process.env.RATE_LIMIT) || 600, 60 * 1000)) fail(429, "Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring.");
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
    if (clean === "/health") return send(res, 200, await health());
    if (!found) return send(res, allowed ? 405 : 404, { error: allowed ? "Usul ruxsat etilmagan" : "Topilmadi" });
    const sql = await db();
    const url = new URL(req.url, "http://x");
    const ctx = { req, res, sql, params, query: Object.fromEntries(url.searchParams), user: null };
    if (found.auth) {
      ctx.user = await loadUser(sql, req);
      if (!ctx.user) fail(401, "Tizimga qayta kiring");
      if (found.roles && !found.roles.includes(ctx.user.role)) fail(403, "Bu bo‘lim uchun ruxsatingiz yo‘q");
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      if (!rateLimit("w|" + ip, Number(process.env.WRITE_RATE_LIMIT) || 180, 60 * 1000)) fail(429, "Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring.");
      const ct = String(req.headers["content-type"] || "");
      if (req.body === undefined && ct && !ct.startsWith("application/json")) fail(415, "Faqat JSON qabul qilinadi");
      ctx.body = await readBody(req);
      if (!ctx.body || typeof ctx.body !== "object" || Array.isArray(ctx.body)) fail(400, "JSON noto‘g‘ri");
    }
    const out = await found.handler(ctx);
    if (res.writableEnded) return;
    send(res, 200, out === undefined ? { ok: true } : out);
  } catch (e) {
    const status = e.status || (e.code === "23505" ? 409 : e.code === "23503" ? 409 : 500);
    if (status === 500) console.error(new Date().toISOString(), req.method, path, e);
    const msg = e.code === "23505" ? "Bunday yozuv allaqachon mavjud (masalan, telefon raqam band)" : e.code === "23503" ? "Bog‘liq yozuv topilmadi yoki o‘chirib bo‘lmaydi" : status === 500 && !e.expose ? "Serverda xatolik" : e.message;
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

/** Diagnostics without secrets: which settings are missing and whether the database answers. */
async function health() {
  const problems = [];
  if (!dbUrl()) problems.push("Baza ulanmagan: DATABASE_URL (yoki POSTGRES_URL) yo‘q. Vercel → Storage → Neon → Connect, keyin Redeploy.");
  if ((process.env.SESSION_SECRET || "").length < 32) problems.push("SESSION_SECRET yo‘q yoki 32 belgidan qisqa.");
  const out = { ok: false, owner: false, problems };
  if (dbUrl()) {
    try {
      const sql = await db();
      const [{ n }] = await sql`select count(*)::int as n from users where role = 'owner'`;
      out.owner = n > 0;
      if (!out.owner) problems.push("Bosh admin yaratilmagan: OWNER_PHONE (+998XXXXXXXXX) va OWNER_PASSWORD (kamida 8 belgi) qo‘shing, Redeploy qiling.");
    } catch (e) {
      console.error("health db", e);
      problems.push("Bazaga ulanib bo‘lmadi (server logini ko‘ring)");
    }
  }
  out.ok = problems.length === 0;
  return out;
}

/* ---------- branches (filial) and sections (maktab / bog‘cha) ---------- */
export const SECTION_L = { school: "Maktab", kindergarten: "Bog‘cha" };
/** Branch the user is limited to: null = all branches (bosh admin, or staff without a branch), 0 = nothing (accountant without a branch). */
export function scopeOf(user) {
  if (!user || user.role === "owner") return null;
  if (user.role === "accountant") return user.branch_id || 0;
  if (user.role === "manager") return user.branch_id || null;
  return null;
}
/** Filters for list/report endpoints: scoped staff always get their own branch; others may pick ?branch_id= and ?section=. */
export function filterOf(ctx) {
  const sc = scopeOf(ctx.user);
  const branch = sc !== null ? sc : int(ctx.query.branch_id) || null;
  const section = ["school", "kindergarten"].includes(ctx.query.section) ? ctx.query.section : null;
  return { branch, section };
}
export function inScope(user, branchId) {
  const sc = scopeOf(user);
  return sc === null || (sc !== 0 && sc === branchId);
}
export function needScope(user, branchId) { if (!inScope(user, branchId)) fail(403, "Bu boshqa filialga tegishli"); }

/* ---------- audit log ---------- */
export async function audit(ctx, action, entity = null, entityId = null, detail = null, branchId = null) {
  try {
    await ctx.sql`insert into audit_log (user_id, role, action, entity, entity_id, branch_id, detail, ip)
      values (${ctx.user?.id ?? null}, ${ctx.user?.role ?? null}, ${action}, ${entity}, ${entityId == null ? null : String(entityId)}, ${branchId}, ${detail ? ctx.sql.json(detail) : null}, ${ctx.req?.ip || null})`;
  } catch (e) { console.error("audit", e.message); }
}
