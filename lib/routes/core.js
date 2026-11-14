// Login, current user, users (staff/teachers/parents), settings, files, notifications, subjects, classes.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { route, fail, need, str, int, ADMINS, STAFF, notify, fileMeta, today } from "../http.js";
import { hashPassword, checkPassword, signToken, readToken } from "../auth.js";
import { getSettings, normPhone } from "../db.js";

export const pubUser = (u) => u && ({ id: u.id, role: u.role, name: u.name, phone: u.phone, photo: u.photo, profile: u.profile || {}, active: u.active });

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
  if (["owner", "manager"].includes(user.role)) return s;
  if (user.role === "accountant" && !write) return s;
  if (user.role === "teacher" && (await teacherClassIds(sql, user.id)).includes(s.class_id)) return s;
  if (user.role === "parent" && !write && s.parent_id === user.id) return s;
  fail(403, "Bu o‘quvchi ma’lumotlari sizga yopiq");
}

/* ---------- auth ---------- */
const attempts = new Map();
route("POST", "/auth/login", async ({ sql, body, req }) => {
  const phone = normPhone(body.phone);
  const key = (req.headers["x-forwarded-for"] || "").split(",")[0] + "|" + phone;
  const a = attempts.get(key) || { n: 0, t: 0 };
  if (a.n >= 8 && Date.now() - a.t < 10 * 60 * 1000) fail(429, "Juda ko‘p urinish. 10 daqiqadan keyin qayta urinib ko‘ring.");
  const [u] = phone ? await sql`select * from users where phone = ${phone}` : [];
  if (!u || !u.active || !(await checkPassword(body.password || "", u.pass_hash))) {
    attempts.set(key, { n: a.n + 1, t: Date.now() });
    fail(401, "Telefon raqam yoki parol noto‘g‘ri");
  }
  attempts.delete(key);
  return { token: signToken(u), user: pubUser(u) };
}, { auth: false });



route("GET", "/me", async ({ sql, user }) => {
  const settings = await getSettings(sql);
  const subjects = await sql`select id, name from subjects order by name`;
  const classes = await sql`select c.id, c.name, c.grade, c.room, c.leader_id, u.name as leader_name, u.phone as leader_phone,
    (select count(*)::int from students s where s.class_id = c.id and s.status = 'active') as size
    from classes c left join users u on u.id = c.leader_id order by c.grade nulls last, c.name`;
  let children = [], myClasses = [];
  if (user.role === "parent") children = await sql`select id, first_name, last_name, class_id, photo, gender from students where parent_id = ${user.id} and status = 'active' order by first_name`;
  if (user.role === "teacher") myClasses = await teacherClassIds(sql, user.id);
  const [{ n }] = await sql`select count(*)::int as n from notifications where user_id = ${user.id} and not read`;
  return { user: pubUser(user), settings, subjects, classes, children, myClasses, unread: n, today: today() };
});

route("POST", "/me/password", async ({ sql, user, body }) => {
  const [u] = await sql`select pass_hash from users where id = ${user.id}`;
  need(await checkPassword(body.old || "", u.pass_hash), "Joriy parol noto‘g‘ri");
  need(String(body.new || "").length >= 6, "Yangi parol kamida 6 belgi bo‘lsin");
  await sql`update users set pass_hash = ${await hashPassword(body.new)} where id = ${user.id}`;
});

/* ---------- users ---------- */
// Who may create/edit which role
const CAN_MANAGE = { owner: ["owner", "manager", "accountant", "teacher", "parent"], manager: ["teacher", "parent"], accountant: [] };
const canManage = (actor, role) => (CAN_MANAGE[actor] || []).includes(role);

route("GET", "/users", async ({ sql, query }) => {
  const role = str(query.role, 20), q = "%" + str(query.q, 60).toLowerCase() + "%";
  const rows = await sql`select u.id, u.role, u.name, u.phone, u.photo, u.profile, u.active,
      (select count(*)::int from students s where s.parent_id = u.id and s.status = 'active') as children
    from users u where (${role} = '' or u.role = ${role}) and (lower(u.name) like ${q} or u.phone like ${q})
    order by u.active desc, u.name limit 500`;
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

export async function createUser(sql, actorRole, b) {
  const role = str(b.role, 20);
  need(canManage(actorRole, role), "Bu rolni qo‘shishga ruxsatingiz yo‘q", 403);
  const phone = normPhone(b.phone);
  need(phone, "Telefon raqam noto‘g‘ri (+998 XX XXX XX XX)");
  const name = str(b.name, 120); need(name.length >= 3, "F.I.Sh. kiriting");
  const pass = String(b.password || ""); need(pass.length >= 6, "Parol kamida 6 belgi bo‘lsin");
  const [u] = await sql`insert into users (role, name, phone, pass_hash, profile, photo)
    values (${role}, ${name}, ${phone}, ${await hashPassword(pass)}, ${sql.json(cleanProfile(b.profile, role))}, ${b.photo ? sql.json(fileMeta(b.photo)) : null})
    returning id, role, name, phone, photo, profile, active`;
  return u;
}
route("POST", "/users", async ({ sql, user, body }) => createUser(sql, user.role, body), { roles: ADMINS });

route("PATCH", "/users/:id", async ({ sql, user, body, params }) => {
  const [t] = await sql`select * from users where id = ${int(params.id)}`;
  if (!t) fail(404, "Foydalanuvchi topilmadi");
  need(canManage(user.role, t.role) || (t.id === user.id && user.role === "owner"), "Bu foydalanuvchini tahrirlashga ruxsatingiz yo‘q", 403);
  const upd = {};
  if (body.name != null) { upd.name = str(body.name, 120); need(upd.name.length >= 3, "F.I.Sh. kiriting"); }
  if (body.phone != null) { upd.phone = normPhone(body.phone); need(upd.phone, "Telefon raqam noto‘g‘ri"); }
  if (body.profile != null) upd.profile = sql.json({ ...(t.profile || {}), ...cleanProfile(body.profile, t.role) });
  if (body.photo !== undefined) upd.photo = body.photo ? sql.json(fileMeta(body.photo)) : null;
  if (body.active != null) { need(t.id !== user.id, "O‘zingizni o‘chira olmaysiz"); upd.active = !!body.active; }
  if (body.password) { need(String(body.password).length >= 6, "Parol kamida 6 belgi bo‘lsin"); upd.pass_hash = await hashPassword(body.password); }
  if (!Object.keys(upd).length) return { ok: true };
  const [u] = await sql`update users set ${sql(upd)} where id = ${t.id} returning id, role, name, phone, photo, profile, active`;
  return u;
}, { roles: ADMINS });

/* ---------- settings ---------- */
route("PUT", "/settings/:key", async ({ sql, params, body }) => {
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
  return v;
}, { roles: STAFF });

/* ---------- files ---------- */
const TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|application\/vnd\.ms-(excel|powerpoint))$/;
const MAX_FILE = (Number(process.env.MAX_FILE_MB) || 3) * 1024 * 1024;
const FILE_DIR = process.env.FILE_DIR || "./uploads";
const onDisk = () => process.env.FILE_STORAGE === "disk";

route("POST", "/files", async ({ sql, user, body }) => {
  need(user.role !== "parent", "Ruxsat yo‘q", 403);
  const type = str(body.type, 120);
  need(TYPES.test(type), "Faqat rasm, PDF, Word, Excel yoki PowerPoint fayl yuklash mumkin", 415);
  const m = typeof body.data === "string" ? /^data:[^;]*;base64,([A-Za-z0-9+/=]+)$/.exec(body.data) : null;
  need(m, "Fayl ma’lumoti noto‘g‘ri");
  const buf = Buffer.from(m[1], "base64");
  need(buf.length > 0, "Fayl bo‘sh");
  need(buf.length <= MAX_FILE, `Fayl ${Math.round(MAX_FILE / 1048576)} MB dan katta`, 413);
  if (type === "application/pdf") need(buf.subarray(0, 4).toString("latin1") === "%PDF", "PDF fayl buzilgan", 415);
  if (type.startsWith("image/")) need(!buf.subarray(0, 4).toString("latin1").startsWith("%PDF"), "Fayl turi mos emas", 415);
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
    const [u] = p ? await sql`select id, role, active from users where id = ${p.uid}` : [];
    if (!u || !u.active || !(ADMINS.includes(u.role) || u.id === f.created_by)) fail(403, "Bu fayl sizga yopiq");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", f.type);
  res.setHeader("Content-Length", f.data.length);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.setHeader("Cache-Control", f.scope === "public" ? "public, max-age=31536000, immutable" : "private, max-age=600");
  res.setHeader("X-Content-Type-Options", "nosniff");
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

const classData = (b) => {
  const name = str(b.name, 20); need(name.length >= 1, "Sinf nomini kiriting (masalan, 5-A)");
  const grade = int(b.grade ?? parseInt(name, 10));
  return { name, grade: Number.isFinite(grade) ? grade : null, room: str(b.room, 40) || null, leader_id: int(b.leader_id) || null };
};
route("POST", "/classes", async ({ sql, body }) => { const [c] = await sql`insert into classes ${sql(classData(body))} returning *`; return c; }, { roles: STAFF });
route("PATCH", "/classes/:id", async ({ sql, body, params }) => { const [c] = await sql`update classes set ${sql(classData(body))} where id = ${int(params.id)} returning *`; return c; }, { roles: STAFF });
route("DELETE", "/classes/:id", async ({ sql, params }) => {
  const [{ n }] = await sql`select count(*)::int as n from students where class_id = ${int(params.id)} and status = 'active'`;
  need(n === 0, "Sinfda o‘quvchilar bor. Avval ularni boshqa sinfga o‘tkazing.", 409);
  const [{ l }] = await sql`select count(*)::int as l from lessons where class_id = ${int(params.id)}`;
  need(l === 0, "Bu sinfda darslar tarixi bor, o‘chirib bo‘lmaydi", 409);
  await sql`delete from classes where id = ${int(params.id)}`;
}, { roles: STAFF });

export { notify };
