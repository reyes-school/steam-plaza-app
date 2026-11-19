// Login, current user, users (staff/teachers/parents), settings, files, notifications, subjects, classes.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { route, fail, need, str, int, ADMINS, STAFF, notify, fileMeta, today, scopeOf, inScope, needScope, audit, rateLimit, demoAllowed } from "../http.js";
import { hashPassword, checkPassword, signToken, readToken, passwordProblem } from "../auth.js";
import { getSettings, normPhone, SECTIONS } from "../db.js";

export const pubUser = (u) => u && ({ id: u.id, role: u.role, name: u.name, phone: u.phone, photo: u.photo, profile: u.profile || {}, active: u.active, branch_id: u.branch_id ?? null });

/** Whether a scoped staff member (branch manager/accountant) may see or edit this user. */
export async function userInScope(sql, actor, t) {
  const sc = scopeOf(actor);
  if (sc === null) return true;
  if (sc === 0) return false;
  if (t.branch_id === sc) return true;
  if (t.role === "parent") { const [k] = await sql`select 1 from students where parent_id = ${t.id} and branch_id = ${sc} limit 1`; return !!k; }
  if (t.role === "teacher") { if (t.branch_id == null) { const [k] = await sql`select 1 from schedule sc join classes c on c.id = sc.class_id where sc.teacher_id = ${t.id} and c.branch_id = ${sc} union select 1 from classes where leader_id = ${t.id} and branch_id = ${sc} limit 1`; return !!k; } }
  return false;
}

/** Classes a teacher works with: from the weekly schedule plus the class they lead. */
export async function teacherClassIds(sql, tid) {
  const rows = await sql`select distinct class_id from schedule where teacher_id = ${tid} union select id from classes where leader_id = ${tid}`;
  return rows.map((r) => r.class_id);
}

/** Throws unless the user may see this student's full record. Returns the student row. */
export async function studentAccess(ctx, sid, { write = false } = {}) {
  const { sql, user } = ctx;
  const [s] = await sql`select * from students where id = ${int(sid)}`;
  if (!s) fail(404, "O‘quvchi topilmadi");
  if (["owner", "manager"].includes(user.role) && inScope(user, s.branch_id)) return s;
  if (user.role === "accountant" && !write && inScope(user, s.branch_id)) return s;
  if (user.role === "teacher" && (await teacherClassIds(sql, user.id)).includes(s.class_id)) return s;
  if (user.role === "parent" && !write && s.parent_id === user.id) return s;
  fail(403, "Bu o‘quvchi ma’lumotlari sizga yopiq");
}

/* ---------- auth ---------- */
// Brute-force protection: per IP (in memory) and per phone number (in the database, so it holds across server instances).
const LOCK_N = Number(process.env.LOGIN_MAX_ATTEMPTS) || 6, LOCK_MIN = Number(process.env.LOGIN_LOCK_MINUTES) || 15;
async function attempts(sql, key) {
  const [a] = await sql`select n, first_at from login_attempts where key = ${key}`;
  if (!a) return 0;
  if (Date.now() - new Date(a.first_at).getTime() > LOCK_MIN * 60 * 1000) { await sql`delete from login_attempts where key = ${key}`; return 0; }
  return a.n;
}
const bump = (sql, key) => sql`insert into login_attempts (key, n) values (${key}, 1) on conflict (key) do update set
  n = case when login_attempts.first_at < now() - make_interval(mins => ${LOCK_MIN}) then 1 else login_attempts.n + 1 end,
  first_at = case when login_attempts.first_at < now() - make_interval(mins => ${LOCK_MIN}) then now() else login_attempts.first_at end`;
route("POST", "/auth/login", async (ctx) => {
  const { sql, body, req } = ctx;
  if (!rateLimit("login|" + req.ip, 20, 10 * 60 * 1000)) fail(429, "Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring.");
  const phone = normPhone(body.phone);
  need(phone, "Telefon raqam yoki parol noto‘g‘ri", 401);
  const key = "p|" + phone;
  if ((await attempts(sql, key)) >= LOCK_N) fail(429, `Juda ko‘p noto‘g‘ri urinish. ${LOCK_MIN} daqiqadan keyin qayta urinib ko‘ring yoki administratorga murojaat qiling.`);
  const [u] = await sql`select * from users where phone = ${phone}`;
  const okPass = u ? await checkPassword(String(body.password || "").slice(0, 200), u.pass_hash) : await checkPassword("x", "s1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  if (!u || !u.active || !okPass || (u.demo && !demoAllowed())) {
    await bump(sql, key);
    await audit({ ...ctx, user: null }, "login.fail", "user", u?.id ?? null, { phone });
    fail(401, "Telefon raqam yoki parol noto‘g‘ri");
  }
  await sql`delete from login_attempts where key = ${key}`;
  await audit({ ...ctx, user: u }, "login.ok", "user", u.id);
  return { token: signToken(u), user: pubUser(u) };
}, { auth: false });

/** Log out on every device: old tokens stop working. */
route("POST", "/auth/logout-all", async (ctx) => {
  await ctx.sql`update users set token_version = token_version + 1 where id = ${ctx.user.id}`;
  await audit(ctx, "logout.all", "user", ctx.user.id);
});

route("GET", "/me", async ({ sql, user }) => {
  const settings = await getSettings(sql);
  const subjects = await sql`select id, name from subjects order by name`;
  const sc = scopeOf(user);
  const classes = await sql`select c.id, c.name, c.grade, c.room, c.leader_id, c.branch_id, c.section, u.name as leader_name, u.phone as leader_phone,
    (select count(*)::int from students s where s.class_id = c.id and s.status = 'active') as size
    from classes c left join users u on u.id = c.leader_id where (${sc}::int is null or c.branch_id = ${sc}) order by c.branch_id, c.section, c.grade nulls last, c.name`;
  const branches = await sql`select id, name, address, phone from branches where (${sc}::int is null or id = ${sc}) order by id`;
  let children = [], myClasses = [];
  if (user.role === "parent") children = await sql`select id, first_name, last_name, class_id, photo, gender, branch_id, section from students where parent_id = ${user.id} and status = 'active' order by first_name`;
  if (user.role === "teacher") myClasses = await teacherClassIds(sql, user.id);
  const [{ n }] = await sql`select count(*)::int as n from notifications where user_id = ${user.id} and not read`;
  return { user: pubUser(user), settings, subjects, classes, branches, scope: sc, children, myClasses, unread: n, today: today(), demo: demoAllowed() };
});

route("POST", "/me/password", async (ctx) => {
  const { sql, user, body } = ctx;
  const [u] = await sql`select pass_hash from users where id = ${user.id}`;
  need(await checkPassword(body.old || "", u.pass_hash), "Joriy parol noto‘g‘ri");
  const prob = passwordProblem(body.new); need(!prob, prob);
  // changing the password signs out every other device
  const [r] = await sql`update users set pass_hash = ${await hashPassword(body.new)}, token_version = token_version + 1 where id = ${user.id} returning id, role, token_version`;
  await audit(ctx, "password.change", "user", user.id);
  return { ok: true, token: signToken(r) };
});

/* ---------- users ---------- */
// Who may create/edit which role
const CAN_MANAGE = { owner: ["owner", "manager", "accountant", "teacher", "parent"], manager: ["teacher", "parent"], accountant: [] };
const canManage = (actor, role) => (CAN_MANAGE[actor] || []).includes(role);

route("GET", "/users", async ({ sql, query, user }) => {
  const role = str(query.role, 20), q = "%" + str(query.q, 60).toLowerCase().replace(/[%_\\]/g, "") + "%";
  const sc = scopeOf(user);
  const rows = await sql`select u.id, u.role, u.name, u.phone, u.photo, u.profile, u.active, u.branch_id, b.name as branch_name,
      (select count(*)::int from students s where s.parent_id = u.id and s.status = 'active') as children
    from users u left join branches b on b.id = u.branch_id where (${role} = '' or u.role = ${role}) and (lower(u.name) like ${q} or u.phone like ${q})
      and (${sc}::int is null or u.branch_id = ${sc}
        or (u.role = 'parent' and exists (select 1 from students s where s.parent_id = u.id and s.branch_id = ${sc}))
        or (u.role = 'teacher' and u.branch_id is null))
      and (${user.role === "owner"} or u.role not in ('owner'))
    order by u.active desc, u.name limit 1000`;
  if (user.role === "accountant") for (const r of rows) r.profile = { position: r.profile?.position, salary: r.profile?.salary };
  return rows;
}, { roles: ADMINS });

function cleanProfile(p, role) {
  p = p && typeof p === "object" ? p : {};
  const keys = role === "teacher"
    ? ["position", "subjects", "experience", "category", "education", "achievements", "birthDate", "address", "passport", "salary", "hiredOn", "about", "gender"]
    : role === "parent" ? ["address", "workplace", "passport", "relation", "phone2"] : ["position", "address", "passport", "hiredOn", "gender"];
  const o = {};
  for (const k of keys) if (p[k] != null) o[k] = k === "salary" ? int(p[k]) || 0 : str(p[k], 1000);
  return o;
}

export async function createUser(sql, actorRole, b, actor = null) {
  const role = str(b.role, 20);
  need(canManage(actorRole, role), "Bu rolni qo‘shishga ruxsatingiz yo‘q", 403);
  // branch: scoped managers add people only to their own branch; accountants and branch managers must have a branch
  const sc = actor ? scopeOf(actor) : null;
  let branch = sc !== null ? sc : int(b.branch_id) || null;
  if (role === "parent" || role === "owner") branch = null;
  if (role === "accountant") need(branch, "Buxgalter uchun filialni tanlang");
  if (branch) { const [br] = await sql`select id from branches where id = ${branch}`; need(br, "Filial topilmadi"); }
  const phone = normPhone(b.phone);
  need(phone, "Telefon raqam noto‘g‘ri (+998 XX XXX XX XX)");
  const name = str(b.name, 120); need(name.length >= 3, "F.I.Sh. kiriting");
  const pass = String(b.password || ""); const prob = passwordProblem(pass); need(!prob, prob);
  const [u] = await sql`insert into users (role, name, phone, pass_hash, profile, photo, branch_id)
    values (${role}, ${name}, ${phone}, ${await hashPassword(pass)}, ${sql.json(cleanProfile(b.profile, role))}, ${b.photo ? sql.json(fileMeta(b.photo)) : null}, ${branch})
    returning id, role, name, phone, photo, profile, active, branch_id`;
  return u;
}
route("POST", "/users", async (ctx) => {
  const u = await createUser(ctx.sql, ctx.user.role, ctx.body, ctx.user);
  await audit(ctx, "user.create", "user", u.id, { role: u.role, name: u.name }, u.branch_id);
  return u;
}, { roles: ADMINS });

route("PATCH", "/users/:id", async (ctx) => {
  const { sql, user, body, params } = ctx;
  const [t] = await sql`select * from users where id = ${int(params.id)}`;
  if (!t) fail(404, "Foydalanuvchi topilmadi");
  need(canManage(user.role, t.role) || (t.id === user.id && user.role === "owner"), "Bu foydalanuvchini tahrirlashga ruxsatingiz yo‘q", 403);
  need(await userInScope(sql, user, t), "Bu foydalanuvchi boshqa filialda", 403);
  const upd = {};
  if (body.branch_id !== undefined && user.role === "owner" && !["parent", "owner"].includes(t.role)) {
    upd.branch_id = int(body.branch_id) || null;
    need(t.role !== "accountant" || upd.branch_id, "Buxgalter uchun filialni tanlang");
    if (upd.branch_id !== t.branch_id) upd.token_version = (t.token_version || 0) + 1;
  }
  if (body.name != null) { upd.name = str(body.name, 120); need(upd.name.length >= 3, "F.I.Sh. kiriting"); }
  if (body.phone != null) { upd.phone = normPhone(body.phone); need(upd.phone, "Telefon raqam noto‘g‘ri"); }
  if (body.profile != null) upd.profile = sql.json({ ...(t.profile || {}), ...cleanProfile(body.profile, t.role) });
  if (body.photo !== undefined) upd.photo = body.photo ? sql.json(fileMeta(body.photo)) : null;
  if (body.active != null) { need(t.id !== user.id, "O‘zingizni o‘chira olmaysiz"); upd.active = !!body.active; if (!upd.active) upd.token_version = (t.token_version || 0) + 1; }
  if (body.password) { const prob = passwordProblem(body.password); need(!prob, prob); upd.pass_hash = await hashPassword(body.password); upd.token_version = (t.token_version || 0) + 1; }
  if (!Object.keys(upd).length) return { ok: true };
  const [u] = await sql`update users set ${sql(upd)} where id = ${t.id} returning id, role, name, phone, photo, profile, active, branch_id`;
  await audit(ctx, "user.update", "user", t.id, { fields: Object.keys(upd).filter((k) => k !== "pass_hash" && k !== "token_version"), password: !!body.password }, t.branch_id);
  return u;
}, { roles: ADMINS });

/* ---------- settings ---------- */
route("PUT", "/settings/:key", async (ctx) => {
  const { sql, params, body, user } = ctx;
  need(scopeOf(user) === null, "Umumiy sozlamalarni faqat bosh admin o‘zgartiradi", 403);
  const key = params.key;
  let v = body.value;
  if (key === "bell") {
    const t = /^\d{2}:\d{2}$/.test(v?.start) ? v.start : null; need(t, "Boshlanish vaqti HH:MM ko‘rinishida bo‘lsin");
    const n = (x, lo, hi) => { const k = int(x); need(k >= lo && k <= hi, "Qiymatlar noto‘g‘ri"); return k; };
    v = { start: t, lesson: n(v.lesson, 20, 120), break: n(v.break, 0, 60), lunchAfter: n(v.lunchAfter, 0, 12), lunch: n(v.lunch, 0, 120), periods: n(v.periods, 1, 12) };
  } else if (key === "school") {
    v = { name: str(v?.name, 80) || "Steam Plaza", subtitle: str(v?.subtitle, 80), phone: str(v?.phone, 40), address: str(v?.address, 200) };
  } else if (key === "expenseCategories") {
    v = (Array.isArray(v) ? v : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 20); need(v.length, "Kamida bitta toifa kerak");
  } else if (key === "teacherRating") {
    const a = int(v?.starsWeight); need(a >= 0 && a <= 100, "Og‘irlik 0–100");
    v = { starsWeight: a, openLessonWeight: 100 - a, openLessonTarget: Math.max(1, int(v?.openLessonTarget) || 2) };
  } else fail(404, "Bunday sozlama yo‘q");
  await sql`insert into settings (key, value) values (${key}, ${sql.json(v)}) on conflict (key) do update set value = excluded.value`;
  await audit(ctx, "settings.update", "settings", key);
  return v;
}, { roles: STAFF });

/* ---------- files ---------- */
const TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/vnd\.ms-(excel|powerpoint))$/;
const MAX_FILE = (Number(process.env.MAX_FILE_MB) || 3) * 1024 * 1024;
const FILE_DIR = process.env.FILE_DIR || "./uploads";
const onDisk = () => process.env.FILE_STORAGE === "disk";

/** The file's first bytes must match its declared type (stops HTML/JS uploaded as "image/png" etc.). */
function magicOk(type, b) {
  const hex = b.subarray(0, 12).toString("hex"), asc = b.subarray(0, 12).toString("latin1");
  if (type === "application/pdf") return asc.startsWith("%PDF-");
  if (type === "image/jpeg") return hex.startsWith("ffd8ff");
  if (type === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (type === "image/gif") return asc.startsWith("GIF87a") || asc.startsWith("GIF89a");
  if (type === "image/webp") return asc.startsWith("RIFF") && asc.slice(8, 12) === "WEBP";
  if (type.includes("openxmlformats")) return hex.startsWith("504b0304");
  return hex.startsWith("d0cf11e0a1b11ae1"); // legacy .doc/.xls/.ppt
}

route("POST", "/files", async ({ sql, user, body, req }) => {
  need(user.role !== "parent", "Ruxsat yo‘q", 403);
  need(rateLimit("up|" + user.id, 40, 10 * 60 * 1000), "Juda ko‘p fayl yuklandi. Birozdan keyin urinib ko‘ring.", 429);
  const type = str(body.type, 120);
  need(TYPES.test(type), "Faqat rasm, PDF, Word, Excel yoki PowerPoint fayl yuklash mumkin", 415);
  const m = typeof body.data === "string" ? /^data:[^;]*;base64,([A-Za-z0-9+/=]+)$/.exec(body.data) : null;
  need(m, "Fayl ma’lumoti noto‘g‘ri");
  const buf = Buffer.from(m[1], "base64");
  need(buf.length > 0, "Fayl bo‘sh");
  need(buf.length <= MAX_FILE, `Fayl ${Math.round(MAX_FILE / 1048576)} MB dan katta`, 413);
  need(magicOk(type, buf), "Fayl turi mazmuniga mos emas", 415);
  const scope = body.scope === "private" && ADMINS.includes(user.role) ? "private" : "public";
  const id = crypto.randomUUID(), name = str(body.name, 160) || "fayl";
  if (onDisk()) {
    await fs.mkdir(FILE_DIR, { recursive: true });
    await fs.writeFile(path.join(FILE_DIR, id), buf);
    await sql`insert into files (id, name, type, size, scope, path, created_by) values (${id}, ${name}, ${type}, ${buf.length}, ${scope}, ${id}, ${user.id})`;
  } else {
    await sql`insert into files (id, name, type, size, scope, data, created_by) values (${id}, ${name}, ${type}, ${buf.length}, ${scope}, ${buf}, ${user.id})`;
  }
  return { id, name, type, size: buf.length };
});

export async function readFileRow(sql, id) {
  const [f] = await sql`select id, name, type, size, scope, data, path, created_by from files where id = ${id}`;
  if (!f) return null;
  if (!f.data && f.path) f.data = await fs.readFile(path.join(FILE_DIR, f.path));
  return f;
}

// Public files (photos, homework, news) open by their unguessable id; private ones (documents, receipts) need an admin login.
route("GET", "/files/:id", async ({ sql, params, req, res }) => {
  need(/^[0-9a-f-]{36}$/.test(params.id), "Noto‘g‘ri id");
  const f = await readFileRow(sql, params.id);
  if (!f) fail(404, "Fayl topilmadi");
  if (f.scope !== "public") {
    const h = req.headers.authorization || "";
    const p = readToken(h.startsWith("Bearer ") ? h.slice(7) : "");
    const [u] = p ? await sql`select id, role, active, token_version from users where id = ${p.uid}` : [];
    if (!u || !u.active || (u.token_version || 0) !== (p.tv || 0) || !(ADMINS.includes(u.role) || u.id === f.created_by)) fail(403, "Bu fayl sizga yopiq");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", f.type);
  res.setHeader("Content-Length", f.data.length);
  const inline = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(f.type);
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.setHeader("Cache-Control", f.scope === "public" ? "private, max-age=86400" : "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader("X-Frame-Options", "DENY");
  res.end(f.data);
}, { auth: false });

/* ---------- notifications ---------- */
route("GET", "/notifications", async ({ sql, user }) => {
  const items = await sql`select id, kind, title, body, link, read, created_at from notifications where user_id = ${user.id} order by created_at desc limit 60`;
  return { items, unread: items.filter((n) => !n.read).length };
});
route("POST", "/notifications/read", async ({ sql, user, body }) => {
  if (Array.isArray(body.ids) && body.ids.length) await sql`update notifications set read = true where user_id = ${user.id} and id = any(${body.ids.map(int)})`;
  else await sql`update notifications set read = true where user_id = ${user.id} and not read`;
});

/* ---------- subjects & classes ---------- */
route("POST", "/subjects", async ({ sql, body }) => {
  const name = str(body.name, 60); need(name.length >= 2, "Fan nomini kiriting");
  const [s] = await sql`insert into subjects (name) values (${name}) returning id, name`; return s;
}, { roles: STAFF });
route("PATCH", "/subjects/:id", async ({ sql, body, params }) => {
  const name = str(body.name, 60); need(name.length >= 2, "Fan nomini kiriting");
  const [s] = await sql`update subjects set name = ${name} where id = ${int(params.id)} returning id, name`; return s;
}, { roles: STAFF });
route("DELETE", "/subjects/:id", async ({ sql, params }) => {
  const [{ n }] = await sql`select count(*)::int as n from lessons where subject_id = ${int(params.id)}`;
  need(n === 0, "Bu fan bo‘yicha darslar tarixi bor, o‘chirib bo‘lmaydi", 409);
  await sql`delete from subjects where id = ${int(params.id)}`;
}, { roles: STAFF });

async function classData(sql, user, b, old = null) {
  const name = str(b.name, 20); need(name.length >= 1, "Sinf yoki guruh nomini kiriting (masalan, 5-A)");
  const grade = int(b.grade ?? parseInt(name, 10));
  const sc = scopeOf(user);
  const branch_id = sc !== null ? sc : int(b.branch_id) || old?.branch_id || (await sql`select id from branches order by id limit 1`)[0]?.id || null;
  need(branch_id, "Filialni tanlang");
  const [br] = await sql`select id from branches where id = ${branch_id}`; need(br, "Filial topilmadi");
  const section = SECTIONS.includes(b.section) ? b.section : old?.section || "school";
  return { name, grade: Number.isFinite(grade) ? grade : null, room: str(b.room, 40) || null, leader_id: int(b.leader_id) || null, branch_id, section };
}
/** Students follow their class: branch and section are copied so finance and reports can group by them. */
export const syncStudents = (sql, classId) => sql`update students s set branch_id = c.branch_id, section = c.section from classes c where c.id = s.class_id and c.id = ${classId}`;
async function classOf(ctx, id) {
  const [c] = await ctx.sql`select * from classes where id = ${int(id)}`;
  if (!c) fail(404, "Sinf topilmadi");
  needScope(ctx.user, c.branch_id);
  return c;
}
route("POST", "/classes", async (ctx) => {
  const [c] = await ctx.sql`insert into classes ${ctx.sql(await classData(ctx.sql, ctx.user, ctx.body))} returning *`;
  await audit(ctx, "class.create", "class", c.id, { name: c.name }, c.branch_id);
  return c;
}, { roles: STAFF });
route("PATCH", "/classes/:id", async (ctx) => {
  const old = await classOf(ctx, ctx.params.id);
  const [c] = await ctx.sql`update classes set ${ctx.sql(await classData(ctx.sql, ctx.user, ctx.body, old))} where id = ${old.id} returning *`;
  await syncStudents(ctx.sql, c.id);
  await audit(ctx, "class.update", "class", c.id, { name: c.name }, c.branch_id);
  return c;
}, { roles: STAFF });
route("DELETE", "/classes/:id", async (ctx) => {
  const { sql, params } = ctx;
  await classOf(ctx, params.id);
  const [{ n }] = await sql`select count(*)::int as n from students where class_id = ${int(params.id)} and status = 'active'`;
  need(n === 0, "Sinfda o‘quvchilar bor. Avval ularni boshqa sinfga o‘tkazing.", 409);
  const [{ l }] = await sql`select count(*)::int as l from lessons where class_id = ${int(params.id)}`;
  need(l === 0, "Bu sinfda darslar tarixi bor, o‘chirib bo‘lmaydi", 409);
  await sql`delete from classes where id = ${int(params.id)}`;
  await audit(ctx, "class.delete", "class", params.id);
}, { roles: STAFF });

/* ---------- branches (filiallar) ---------- */
route("GET", "/branches", async ({ sql, user }) => {
  const sc = scopeOf(user);
  return sql`select b.*, (select count(*)::int from classes c where c.branch_id = b.id) as classes,
      (select count(*)::int from students s where s.branch_id = b.id and s.status = 'active' and s.section = 'school') as school_students,
      (select count(*)::int from students s where s.branch_id = b.id and s.status = 'active' and s.section = 'kindergarten') as kg_students
    from branches b where (${sc}::int is null or b.id = ${sc}) order by b.id`;
}, { roles: ADMINS });
const branchData = (b) => { const name = str(b.name, 80); need(name.length >= 2, "Filial nomini kiriting"); return { name, address: str(b.address, 200) || null, phone: str(b.phone, 40) || null }; };
route("POST", "/branches", async (ctx) => { const [b] = await ctx.sql`insert into branches ${ctx.sql(branchData(ctx.body))} returning *`; await audit(ctx, "branch.create", "branch", b.id, { name: b.name }); return b; }, { roles: ["owner"] });
route("PATCH", "/branches/:id", async (ctx) => {
  const [b] = await ctx.sql`update branches set ${ctx.sql(branchData(ctx.body))} where id = ${int(ctx.params.id)} returning *`;
  need(b, "Filial topilmadi", 404); await audit(ctx, "branch.update", "branch", b.id, { name: b.name }); return b;
}, { roles: ["owner"] });

/* ---------- audit log (bosh admin) ---------- */
route("GET", "/audit", async ({ sql, query }) => {
  const before = int(query.before) || null;
  return sql`select a.id, a.at, a.action, a.entity, a.entity_id, a.detail, a.ip, a.role, u.name as user_name, b.name as branch_name
    from audit_log a left join users u on u.id = a.user_id left join branches b on b.id = a.branch_id
    where (${before}::bigint is null or a.id < ${before}) and (${str(query.action, 40)} = '' or a.action like ${str(query.action, 40) + "%"})
    order by a.id desc limit 200`;
}, { roles: ["owner"] });

export { notify };
