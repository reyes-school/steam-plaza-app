// Students, teachers, schedule, achievements, documents, menu, posts, feedback, teacher ratings, contracts.
import { route, fail, need, str, int, ADMINS, STAFF, FINANCE, notify, fileMeta, fileList, isDate, curMonth, today, addDays, weekday, scopeOf, filterOf, needScope, inScope, audit } from "../http.js";
import { pubUser, teacherClassIds, studentAccess, createUser } from "./core.js";
import { normPhone } from "../db.js";

const sName = (s) => `${s.last_name} ${s.first_name}`;

/* ---------- students ---------- */
route("GET", "/students", async (ctx) => {
  const { sql, user, query } = ctx;
  const { branch, section } = ["owner", "manager", "accountant"].includes(user.role) ? filterOf(ctx) : { branch: null, section: null };
  const cls = int(query.class_id) || null, q = "%" + str(query.q, 60).toLowerCase().replace(/[%_\\]/g, "") + "%", status = query.status === "left" ? "left" : query.status === "all" ? null : "active";
  let scope = null;
  if (user.role === "teacher") scope = await teacherClassIds(sql, user.id);
  const rows = await sql`select s.id, s.first_name, s.last_name, s.gender, s.birth_date, s.class_id, c.name as class_name, s.photo, s.status,
      s.monthly_fee, s.joined_on, s.parent_id, p.name as parent_name, p.phone as parent_phone, s.branch_id, s.section
    from students s left join classes c on c.id = s.class_id left join users p on p.id = s.parent_id
    where (${cls}::int is null or s.class_id = ${cls}) and (${status}::text is null or s.status = ${status})
      and (${branch}::int is null or s.branch_id = ${branch}) and (${section}::text is null or s.section = ${section})
      and (lower(s.first_name || ' ' || s.last_name) like ${q} or coalesce(p.phone,'') like ${q})
      and (${scope === null} or s.class_id = any(${scope || []}::int[]))
      and (${user.role !== "parent"} or s.parent_id = ${user.id})
    order by c.grade nulls last, c.name, s.last_name, s.first_name limit 2000`;
  if (user.role === "teacher") for (const r of rows) delete r.monthly_fee;
  return rows;
});

const STUDENT_PROFILE = ["address", "prevSchool", "notes", "health", "interests", "birthPlace", "certificate", "phone"];
function studentProfile(p, old = {}) {
  const o = { ...old };
  if (p && typeof p === "object") for (const k of STUDENT_PROFILE) if (p[k] !== undefined) o[k] = str(p[k], 1000);
  return o;
}

/** Class → branch/section of the student, checked against the user's branch. */
async function classPlace(sql, user, classId) {
  if (!classId) { const sc = scopeOf(user); need(sc === null, "Sinf yoki guruhni tanlang"); return null; }
  const [c] = await sql`select id, branch_id, section from classes where id = ${classId}`;
  need(c, "Sinf topilmadi"); needScope(user, c.branch_id);
  return c;
}

route("POST", "/students", async (ctx) => {
  const { sql, user, body } = ctx;
  const place = await classPlace(sql, user, int(body.class_id) || null);
  const first = str(body.first_name, 60), last = str(body.last_name, 60);
  need(first.length >= 2 && last.length >= 2, "Ism va familiyani kiriting");
  need(!body.birth_date || isDate(body.birth_date), "Tug‘ilgan sana noto‘g‘ri");
  return sql.begin(async (tx) => {
    let parentId = int(body.parent_id) || null;
    if (!parentId && body.parent && body.parent.phone) {
      const phone = normPhone(body.parent.phone); need(phone, "Ota-ona telefon raqami noto‘g‘ri");
      const [ex] = await tx`select id, role from users where phone = ${phone}`;
      if (ex) { need(ex.role === "parent", "Bu raqam boshqa rol uchun band"); parentId = ex.id; }
      else parentId = (await createUser(tx, user.role === "owner" ? "owner" : "manager", { ...body.parent, role: "parent" }, user)).id;
    } else if (parentId) { const [ex] = await tx`select role from users where id = ${parentId}`; need(ex?.role === "parent", "Ota-ona topilmadi"); }
    const [s] = await tx`insert into students ${tx({
      first_name: first, last_name: last, birth_date: body.birth_date || null, gender: body.gender === "f" ? "f" : "m",
      class_id: int(body.class_id) || null, parent_id: parentId, monthly_fee: Math.max(0, int(body.monthly_fee) || 0),
      joined_on: isDate(body.joined_on) ? body.joined_on : today(), photo: body.photo ? tx.json(fileMeta(body.photo)) : null,
      profile: tx.json(studentProfile(body.profile)),
      branch_id: place?.branch_id ?? (int(body.branch_id) || (await tx`select id from branches order by id limit 1`)[0].id), section: place?.section || (body.section === "kindergarten" ? "kindergarten" : "school"),
    })} returning *`;
    await audit({ ...ctx, sql: tx }, "student.create", "student", s.id, { name: `${s.last_name} ${s.first_name}` }, s.branch_id);
    return s;
  });
}, { roles: STAFF });

route("PATCH", "/students/:id", async (ctx) => {
  const { sql, user, body } = ctx;
  const s = await studentAccess(ctx, ctx.params.id, { write: true });
  const upd = {};
  if (body.photo !== undefined) upd.photo = body.photo ? sql.json(fileMeta(body.photo)) : null;
  if (body.profile) upd.profile = sql.json(studentProfile(body.profile, s.profile));
  if (body.first_name != null) { upd.first_name = str(body.first_name, 60); need(upd.first_name.length >= 2, "Ismni kiriting"); }
  if (body.last_name != null) { upd.last_name = str(body.last_name, 60); need(upd.last_name.length >= 2, "Familiyani kiriting"); }
  if (body.birth_date !== undefined) { need(!body.birth_date || isDate(body.birth_date), "Sana noto‘g‘ri"); upd.birth_date = body.birth_date || null; }
  if (body.gender) upd.gender = body.gender === "f" ? "f" : "m";
  if (STAFF.includes(user.role)) {
    if (body.class_id !== undefined) {
      upd.class_id = int(body.class_id) || null;
      const place = await classPlace(sql, user, upd.class_id);
      if (place) { upd.branch_id = place.branch_id; upd.section = place.section; }
    }
    if (body.monthly_fee != null) upd.monthly_fee = Math.max(0, int(body.monthly_fee) || 0);
    if (body.joined_on && isDate(body.joined_on)) upd.joined_on = body.joined_on;
    if (body.parent_id !== undefined) upd.parent_id = int(body.parent_id) || null;
    if (body.status) { upd.status = body.status === "left" ? "left" : "active"; upd.left_on = upd.status === "left" ? today() : null; }
  }
  if (!Object.keys(upd).length) return s;
  const [r] = await sql`update students set ${sql(upd)} where id = ${s.id} returning *`;
  await audit(ctx, "student.update", "student", s.id, { fields: Object.keys(upd) }, r.branch_id);
  return r;
});

route("GET", "/students/:id", async (ctx) => {
  const { sql, user } = ctx;
  const s = await studentAccess(ctx, ctx.params.id);
  const [cls] = s.class_id ? await sql`select c.id, c.name, c.room, c.leader_id, u.name as leader_name, u.phone as leader_phone from classes c left join users u on u.id = c.leader_id where c.id = ${s.class_id}` : [null];
  const [parent] = s.parent_id ? await sql`select id, name, phone, profile from users where id = ${s.parent_id}` : [null];
  const achievements = await sql`select * from achievements where student_id = ${s.id} order by date desc nulls last, id desc`;
  const feedback = await sql`select f.id, f.text, f.created_at, u.name as teacher_name, f.teacher_id from feedback f join users u on u.id = f.teacher_id where f.student_id = ${s.id} order by f.created_at desc limit 30`;
  const out = { ...s, class: cls, parent, achievements, feedback };
  if (ADMINS.includes(user.role)) {
    out.documents = await sql`select * from documents where owner_type = 'student' and owner_id = ${s.id} order by created_at desc`;
    out.contracts = await sql`select * from contracts where student_id = ${s.id} order by created_at desc`;
  }
  if (user.role !== "teacher") out.payments = await sql`select id, month, amount, method, note, receipt, paid_at from payments where student_id = ${s.id} order by paid_at desc`;
  else { delete out.monthly_fee; if (parent) delete parent.profile; }
  return out;
});

/** Public card: what any logged-in user may see about a student (used when parents tap a name in the rating). */
route("GET", "/students/:id/card", async ({ sql, params, user }) => {
  const [s] = await sql`select s.id, s.first_name, s.last_name, s.gender, s.photo, s.class_id, s.branch_id, c.name as class_name, s.profile->>'interests' as interests
    from students s left join classes c on c.id = s.class_id where s.id = ${int(params.id)} and s.status = 'active'`;
  if (!s) fail(404, "O‘quvchi topilmadi");
  // parents see cards only of children in the same branch as their own children; staff only within their branch
  if (user.role === "parent") { const [k] = await sql`select 1 from students where parent_id = ${user.id} and branch_id = ${s.branch_id} limit 1`; need(k, "Bu o‘quvchi ma’lumotlari sizga yopiq", 403); }
  else if (ADMINS.includes(user.role)) needScope(user, s.branch_id);
  delete s.branch_id;
  const achievements = await sql`select id, title, kind, level, place, subject, date from achievements where student_id = ${s.id} order by date desc nulls last, id desc`;
  const m = curMonth();
  const subjects = await sql`select sb.name as subject, round(avg(g.value)::numeric, 2)::float as avg, count(*)::int as n
    from grades g join lessons l on l.id = g.lesson_id join subjects sb on sb.id = l.subject_id
    where g.student_id = ${s.id} and l.date like ${m + "%"} group by sb.name order by avg desc`;
  return { ...s, achievements, subjects, month: m };
});

/* ---------- achievements ---------- */
route("POST", "/students/:id/achievements", async (ctx) => {
  const { sql, body } = ctx;
  const s = await studentAccess(ctx, ctx.params.id, { write: true });
  const title = str(body.title, 200); need(title.length >= 3, "Yutuq nomini kiriting");
  const [a] = await sql`insert into achievements ${sql({
    student_id: s.id, title, kind: ["olympiad", "contest", "sport", "other"].includes(body.kind) ? body.kind : "olympiad",
    level: str(body.level, 40) || null, place: int(body.place) || null, subject: str(body.subject, 60) || null,
    date: isDate(body.date) ? body.date : today(), file: body.file ? sql.json(fileMeta(body.file)) : null,
  })} returning *`;
  if (s.parent_id) await notify(sql, [s.parent_id], { kind: "achievement", title: "Yangi yutuq", body: `${sName(s)}: ${title}`, link: `#student-${s.id}` });
  return a;
});
route("DELETE", "/achievements/:id", async (ctx) => {
  const [a] = await ctx.sql`select student_id from achievements where id = ${int(ctx.params.id)}`;
  if (!a) fail(404, "Topilmadi");
  await studentAccess(ctx, a.student_id, { write: true });
  await ctx.sql`delete from achievements where id = ${int(ctx.params.id)}`;
}, { roles: STAFF });

/* ---------- documents (students & teachers) ---------- */
async function docOwnerScope(ctx, type, id) {
  if (type === "student") await studentAccess(ctx, id);
}
route("GET", "/documents", async (ctx) => {
  const { sql, query } = ctx;
  const type = query.owner_type === "teacher" ? "teacher" : "student";
  await docOwnerScope(ctx, type, query.owner_id);
  return sql`select * from documents where owner_type = ${type} and owner_id = ${int(query.owner_id)} order by created_at desc`;
}, { roles: ADMINS });
route("POST", "/documents", async (ctx) => {
  const { sql, user, body } = ctx;
  const type = body.owner_type === "teacher" ? "teacher" : "student";
  await docOwnerScope(ctx, type, body.owner_id);
  const file = fileMeta(body.file); need(file, "Fayl biriktiring");
  const [d] = await sql`insert into documents ${sql({ owner_type: type, owner_id: int(body.owner_id), kind: str(body.kind, 40) || "other", name: str(body.name, 160) || file.name, file: sql.json(file), created_by: user.id })} returning *`;
  await audit(ctx, "document.add", type, d.owner_id, { kind: d.kind, name: d.name });
  return d;
}, { roles: ADMINS });
route("DELETE", "/documents/:id", async (ctx) => {
  const [d] = await ctx.sql`select * from documents where id = ${int(ctx.params.id)}`;
  if (!d) fail(404, "Hujjat topilmadi");
  await docOwnerScope(ctx, d.owner_type, d.owner_id);
  await ctx.sql`delete from documents where id = ${d.id}`;
  await audit(ctx, "document.delete", d.owner_type, d.owner_id, { kind: d.kind, name: d.name });
}, { roles: STAFF });

/* ---------- teachers ---------- */
route("GET", "/teachers", async ({ sql, user }) => {
  const sc = scopeOf(user);
  const rows = await sql`select u.id, u.name, u.phone, u.photo, u.profile, u.active, u.branch_id,
      coalesce((select array_agg(distinct sb.name) from schedule sc join subjects sb on sb.id = sc.subject_id where sc.teacher_id = u.id), '{}') as subjects,
      coalesce((select array_agg(distinct c.name) from schedule sc join classes c on c.id = sc.class_id where sc.teacher_id = u.id), '{}') as classes,
      (select round(avg(stars)::numeric, 2)::float from teacher_ratings r where r.teacher_id = u.id) as stars,
      (select count(*)::int from teacher_ratings r where r.teacher_id = u.id) as votes
    from users u where u.role = 'teacher' and (u.active or ${ADMINS.includes(user.role)})
      and (${sc}::int is null or u.branch_id = ${sc} or (u.branch_id is null and exists (select 1 from schedule sc join classes c on c.id = sc.class_id where sc.teacher_id = u.id and c.branch_id = ${sc})) or u.branch_id is null)
    order by u.active desc, u.name`;
  return rows.map((r) => STAFF.includes(user.role) ? r : user.role === "accountant" ? { ...r, profile: { ...publicTeacherProfile(r.profile), salary: r.profile?.salary } } : { ...r, profile: publicTeacherProfile(r.profile) });
});
const publicTeacherProfile = (p = {}) => ({ position: p.position, subjects: p.subjects, experience: p.experience, category: p.category, education: p.education, achievements: p.achievements, about: p.about, gender: p.gender });

/** Reviews shown to other parents/teachers: no parent names, only the child's first name. */
export const anonReview = (r) => ({ stars: r.stars, comment: r.comment, month: r.month, created_at: r.created_at, class_name: r.class_name, student_name: String(r.student_name || "").split(" ")[0] || null, student_gender: r.student_gender });
export async function teacherReviews(sql, tid) {
  return sql`select r.stars, r.comment, r.month, r.created_at, r.parent_id, p.name as parent_name, s.id as student_id,
      s.first_name || ' ' || s.last_name as student_name, c.name as class_name, s.photo as student_photo, s.gender as student_gender
    from teacher_ratings r join users p on p.id = r.parent_id left join students s on s.id = r.student_id left join classes c on c.id = s.class_id
    where r.teacher_id = ${tid} order by r.created_at desc limit 300`;
}

route("GET", "/teachers/:id", async ({ sql, user, params }) => {
  const [t] = await sql`select * from users where id = ${int(params.id)} and role = 'teacher'`;
  if (!t) fail(404, "O‘qituvchi topilmadi");
  const self = user.id === t.id, admin = ADMINS.includes(user.role) && (inScope(user, t.branch_id) || t.branch_id == null);
  const schedule = await sql`select sc.weekday, sc.period, sc.room, c.id as class_id, c.name as class_name, sb.name as subject from schedule sc
    join classes c on c.id = sc.class_id join subjects sb on sb.id = sc.subject_id where sc.teacher_id = ${t.id} order by sc.weekday, sc.period`;
  const leads = await sql`select id, name from classes where leader_id = ${t.id}`;
  const reviews = await teacherReviews(sql, t.id);
  const openLessons = await sql`select id, title, event, created_at, files from posts where kind = 'openlesson' and author_id = ${t.id} order by created_at desc limit 100`;
  const out = { ...pubUser(t), profile: admin || self ? t.profile : publicTeacherProfile(t.profile), schedule, leads, reviews: admin || self ? reviews : reviews.map(anonReview), openLessons };
  if (!admin && !self && user.role !== "parent") delete out.phone;
  if (admin || self) {
    out.lessonsByMonth = await sql`select substr(date, 1, 7) as month, count(*)::int as total, count(*) filter (where status = 'ended')::int as ended
      from lessons where teacher_id = ${t.id} group by 1 order by 1 desc limit 24`;
    out.recentLessons = await sql`select l.id, l.date, l.period, l.topic, l.status, l.homework, c.name as class_name, sb.name as subject
      from lessons l join classes c on c.id = l.class_id join subjects sb on sb.id = l.subject_id where l.teacher_id = ${t.id} and l.status <> 'planned'
      order by l.date desc, l.period desc limit 60`;
  }
  if ((["owner", "accountant"].includes(user.role) && admin) || self) out.salaries = await sql`select id, month, amount, note, receipt, paid_at from salaries where teacher_id = ${t.id} order by month desc, paid_at desc`;
  if (admin) out.documents = await sql`select * from documents where owner_type = 'teacher' and owner_id = ${t.id} order by created_at desc`;
  return out;
});

/* ---------- schedule ---------- */
route("GET", "/schedule", async ({ sql, query }) => {
  const cls = int(query.class_id) || null, tid = int(query.teacher_id) || null;
  return sql`select sc.id, sc.class_id, c.name as class_name, sc.weekday, sc.period, sc.room, sc.subject_id, sb.name as subject, sc.teacher_id, u.name as teacher_name
    from schedule sc join classes c on c.id = sc.class_id join subjects sb on sb.id = sc.subject_id join users u on u.id = sc.teacher_id
    where (${cls}::int is null or sc.class_id = ${cls}) and (${tid}::int is null or sc.teacher_id = ${tid}) order by sc.weekday, sc.period, c.name`;
});
route("PUT", "/schedule", async (ctx) => {
  const { sql, body } = ctx;
  const cls = int(body.class_id), wd = int(body.weekday), p = int(body.period);
  need(cls && wd >= 1 && wd <= 6 && p >= 1 && p <= 12, "Sinf, kun va soatni tanlang");
  const [cl] = await sql`select branch_id from classes where id = ${cls}`; need(cl, "Sinf topilmadi"); needScope(ctx.user, cl.branch_id);
  if (!body.subject_id) { await sql`delete from schedule where class_id = ${cls} and weekday = ${wd} and period = ${p}`; return { ok: true, removed: true }; }
  const sid = int(body.subject_id), tid = int(body.teacher_id);
  need(sid && tid, "Fan va o‘qituvchini tanlang");
  const [tt] = await sql`select id from users where id = ${tid} and role = 'teacher' and active`; need(tt, "O‘qituvchi topilmadi");
  const [busy] = await sql`select c.name from schedule sc join classes c on c.id = sc.class_id where sc.teacher_id = ${tid} and sc.weekday = ${wd} and sc.period = ${p} and sc.class_id <> ${cls}`;
  need(!busy, `Bu o‘qituvchi shu vaqtda ${busy?.name} sinfida dars o‘tadi`, 409);
  const [r] = await sql`insert into schedule (class_id, weekday, period, subject_id, teacher_id, room) values (${cls}, ${wd}, ${p}, ${sid}, ${tid}, ${str(body.room, 40) || null})
    on conflict (class_id, weekday, period) do update set subject_id = excluded.subject_id, teacher_id = excluded.teacher_id, room = excluded.room returning *`;
  return r;
}, { roles: STAFF });

/* ---------- menu ---------- */
route("GET", "/menu", async ({ sql, query }) => {
  const from = isDate(query.from) ? query.from : today(), to = isDate(query.to) ? query.to : from;
  return sql`select date, meal, dish, items from menu where date between ${from} and ${to} order by date, meal`;
});
route("PUT", "/menu", async ({ sql, body }) => {
  need(isDate(body.date) && ["breakfast", "lunch", "snack"].includes(body.meal), "Sana va taomni tanlang");
  const dish = str(body.dish, 120);
  if (!dish) { await sql`delete from menu where date = ${body.date} and meal = ${body.meal}`; return { ok: true }; }
  await sql`insert into menu (date, meal, dish, items) values (${body.date}, ${body.meal}, ${dish}, ${str(body.items, 300)})
    on conflict (date, meal) do update set dish = excluded.dish, items = excluded.items`;
}, { roles: STAFF });

/* ---------- posts: news and open lessons ---------- */
async function visibleClassFilter(sql, user) {
  if (user.role === "parent") return (await sql`select distinct class_id from students where parent_id = ${user.id} and class_id is not null`).map((r) => r.class_id);
  return null; // staff and teachers see everything
}
/** Branches whose news the user sees: parents — their children's branches; branch staff — their own; others — all (null). */
async function visibleBranches(sql, user) {
  if (user.role === "parent") return (await sql`select distinct branch_id from students where parent_id = ${user.id} and branch_id is not null`).map((r) => r.branch_id);
  const sc = scopeOf(user);
  return sc === null ? null : [sc];
}
route("GET", "/posts", async ({ sql, user, query }) => {
  const kind = ["news", "openlesson"].includes(query.kind) ? query.kind : null;
  const author = int(query.author_id) || null, limit = Math.min(50, int(query.limit) || 20);
  const before = query.before ? new Date(query.before) : null;
  const cls = await visibleClassFilter(sql, user), brs = await visibleBranches(sql, user);
  const rows = await sql`select p.id, p.kind, p.title, left(p.body, 280) as excerpt, p.files, p.class_ids, p.event, p.created_at, p.author_id, p.branch_id, u.name as author_name, u.photo as author_photo
    from posts p left join users u on u.id = p.author_id
    where (${kind}::text is null or p.kind = ${kind}) and (${author}::int is null or p.author_id = ${author})
      and (${before}::timestamptz is null or p.created_at < ${before})
      and (${cls === null} or p.class_ids is null or p.class_ids && ${cls || []}::int[])
      and (${brs === null} or p.branch_id is null or p.branch_id = any(${brs || []}::int[]))
    order by p.created_at desc limit ${limit}`;
  if (!before) await sql`update users set posts_seen_at = now() where id = ${user.id}`;
  return rows;
});
route("GET", "/posts/:id", async ({ sql, user, params }) => {
  const [p] = await sql`select p.*, u.name as author_name, u.photo as author_photo from posts p left join users u on u.id = p.author_id where p.id = ${int(params.id)}`;
  if (!p) fail(404, "Xabar topilmadi");
  const cls = await visibleClassFilter(sql, user);
  if (cls && p.class_ids && !p.class_ids.some((c) => cls.includes(c))) fail(403, "Bu xabar sizga yopiq");
  const brs = await visibleBranches(sql, user);
  if (brs && p.branch_id && !brs.includes(p.branch_id)) fail(403, "Bu xabar sizga yopiq");
  if (p.class_ids?.length) p.class_names = (await sql`select name from classes where id = any(${p.class_ids}) order by name`).map((r) => r.name);
  return p;
});
route("POST", "/posts", async ({ sql, user, body }) => {
  const kind = body.kind === "openlesson" ? "openlesson" : "news";
  need(kind === "openlesson" ? ["teacher", "owner", "manager"].includes(user.role) : STAFF.includes(user.role), "Ruxsat yo‘q", 403);
  const title = str(body.title, 160); need(title.length >= 3, "Sarlavha kiriting");
  const text = str(body.body, 20000);
  const classIds = Array.isArray(body.class_ids) && body.class_ids.length ? body.class_ids.map(int).filter(Boolean).slice(0, 100) : null;
  const sc = scopeOf(user);
  const branchId = sc !== null ? sc : int(body.branch_id) || null;
  if (classIds && sc !== null) { const bad = await sql`select id from classes where id = any(${classIds}) and branch_id <> ${sc}`; need(!bad.length, "Boshqa filial sinfi tanlangan", 403); }
  let event = null;
  if (kind === "openlesson") {
    need(isDate(body.event?.date), "Ochiq dars sanasini kiriting");
    event = { date: body.event.date, time: str(body.event.time, 10), subject: str(body.event.subject, 60), place: str(body.event.place, 80), class: str(body.event.class, 40) };
  }
  const [p] = await sql`insert into posts (kind, title, body, files, author_id, class_ids, event, branch_id)
    values (${kind}, ${title}, ${text}, ${sql.json(fileList(body.files))}, ${user.id}, ${classIds}, ${event ? sql.json(event) : null}, ${branchId}) returning *`;
  const parents = classIds
    ? await sql`select distinct parent_id as id from students where class_id = any(${classIds}) and status = 'active' and parent_id is not null`
    : await sql`select distinct u.id from users u join students s on s.parent_id = u.id where u.role = 'parent' and u.active and s.status = 'active' and (${branchId}::int is null or s.branch_id = ${branchId})`;
  const teachers = kind === "news" ? await sql`select id from users where role = 'teacher' and active and id <> ${user.id}` : [];
  await notify(sql, [...parents, ...teachers].map((r) => r.id), { kind, title: kind === "openlesson" ? "Ochiq dars e’lon qilindi" : "Yangi xabar", body: title, link: `#post-${p.id}` });
  return p;
});
route("DELETE", "/posts/:id", async ({ sql, user, params }) => {
  const [p] = await sql`select author_id, branch_id from posts where id = ${int(params.id)}`;
  if (!p) fail(404, "Topilmadi");
  need(p.author_id === user.id || (STAFF.includes(user.role) && scopeOf(user) === null), "Ruxsat yo‘q", 403);
  await sql`delete from posts where id = ${int(params.id)}`;
});

/* ---------- teacher → parent feedback ---------- */
route("POST", "/feedback", async (ctx) => {
  const { sql, user, body } = ctx;
  need(user.role === "teacher" || STAFF.includes(user.role), "Ruxsat yo‘q", 403);
  const s = await studentAccess(ctx, body.student_id, { write: true });
  const text = str(body.text, 2000); need(text.length >= 3, "Fikringizni yozing");
  const [f] = await sql`insert into feedback (student_id, teacher_id, text) values (${s.id}, ${user.id}, ${text}) returning *`;
  if (s.parent_id) await notify(sql, [s.parent_id], { kind: "feedback", title: `${user.name}: farzandingiz haqida fikr`, body: text.slice(0, 140), link: `#student-${s.id}` });
  return f;
});

/* ---------- parent → teacher rating ---------- */
route("POST", "/teacher-ratings", async ({ sql, user, body }) => {
  const tid = int(body.teacher_id), stars = int(body.stars);
  need(stars >= 1 && stars <= 5, "1 dan 5 gacha yulduz tanlang");
  const kids = await sql`select s.id, s.first_name from students s where s.parent_id = ${user.id} and s.status = 'active'
    and (s.class_id in (select class_id from schedule where teacher_id = ${tid}) or s.class_id in (select id from classes where leader_id = ${tid}))`;
  need(kids.length, "Faqat farzandingizga dars beradigan o‘qituvchini baholay olasiz", 403);
  const comment = str(body.comment, 1000), m = curMonth();
  const kid = kids.find((k) => k.id === int(body.student_id)) || kids[0];
  await sql`insert into teacher_ratings (parent_id, teacher_id, month, student_id, stars, comment) values (${user.id}, ${tid}, ${m}, ${kid.id}, ${stars}, ${comment || null})
    on conflict (parent_id, teacher_id, month) do update set stars = excluded.stars, comment = excluded.comment, student_id = excluded.student_id, created_at = now()`;
  await notify(sql, [tid], { kind: "rating", title: `Yangi baho: ${"★".repeat(stars)}`, body: `${user.name}${comment ? ": " + comment.slice(0, 120) : ""}`, link: "#teacher-reviews" });
  return { ok: true, month: m };
}, { roles: ["parent"] });
route("GET", "/teachers/:id/reviews", async ({ sql, params, user }) => {
  const rows = await teacherReviews(sql, int(params.id));
  return ADMINS.includes(user.role) || user.id === int(params.id) ? rows : rows.map(anonReview);
});

/* ---------- contracts ---------- */
route("GET", "/contracts", async (ctx) => {
  const { branch, section } = filterOf(ctx);
  return ctx.sql`select ct.*, s.first_name || ' ' || s.last_name as student_name, c.name as class_name, s.branch_id, s.section,
    (select count(*)::int from documents d where d.owner_type = 'student' and d.owner_id = s.id and d.kind in ('passport','metrika','atestat')) as docs
  from contracts ct join students s on s.id = ct.student_id left join classes c on c.id = s.class_id
  where (${branch}::int is null or s.branch_id = ${branch}) and (${section}::text is null or s.section = ${section}) order by ct.created_at desc`;
}, { roles: ADMINS });
route("POST", "/contracts", async (ctx) => {
  const { sql, body } = ctx;
  const [s] = await sql`select s.*, p.name as parent_name from students s left join users p on p.id = s.parent_id where s.id = ${int(body.student_id)}`;
  need(s, "O‘quvchini tanlang"); needScope(ctx.user, s.branch_id);
  const [{ n }] = await sql`select count(*)::int as n from contracts`;
  const number = `SH-${today().slice(0, 4)}/${String(n + 1).padStart(4, "0")}`;
  const [c] = await sql`insert into contracts (student_id, number, parent_name, monthly) values (${s.id}, ${number}, ${str(body.parent_name, 120) || s.parent_name || ""}, ${Math.max(0, int(body.monthly) || s.monthly_fee)}) returning *`;
  await audit(ctx, "contract.create", "contract", c.id, { number }, s.branch_id);
  return c;
}, { roles: ADMINS });
route("PATCH", "/contracts/:id", async (ctx) => {
  const { sql, body, params } = ctx;
  const status = ["pending", "signed", "ended"].includes(body.status) ? body.status : null; need(status, "Holat noto‘g‘ri");
  const [old] = await sql`select s.branch_id from contracts ct join students s on s.id = ct.student_id where ct.id = ${int(params.id)}`;
  need(old, "Shartnoma topilmadi", 404); needScope(ctx.user, old.branch_id);
  const [c] = await sql`update contracts set status = ${status} where id = ${int(params.id)} returning *`;
  await audit(ctx, "contract.status", "contract", c.id, { status }, old.branch_id);
  return c;
}, { roles: ADMINS });

export { FINANCE };

/* ---------- absence notices: parent tells the school the child cannot come ---------- */
const ABS_KIND = { sick: "Kasal", family: "Oilaviy sabab", trip: "Safar", other: "Boshqa sabab" };
route("POST", "/absences", async (ctx) => {
  const { sql, user, body } = ctx;
  const [s] = await sql`select s.*, c.name as class_name, c.leader_id from students s left join classes c on c.id = s.class_id where s.id = ${int(body.student_id)} and s.status = 'active'`;
  need(s && s.parent_id === user.id, "Farzandingizni tanlang", 403);
  const from = isDate(body.date_from) ? body.date_from : null, to = isDate(body.date_to) ? body.date_to : from;
  need(from && to && to >= from, "Sanalarni to‘g‘ri tanlang");
  need(from >= addDays(today(), -3), "O‘tgan sanalar uchun 3 kundan oldingisini kiritib bo‘lmaydi");
  need(Date.parse(to) - Date.parse(from) <= 30 * 864e5, "Ko‘pi bilan 31 kun");
  const reason = str(body.reason, 1000); need(reason.length >= 3, "Sababini qisqacha yozing");
  const kind = ABS_KIND[body.kind] ? body.kind : "other";
  const [dup] = await sql`select id from absences where student_id = ${s.id} and date_from = ${from} and date_to = ${to}`;
  need(!dup, "Bu kunlar uchun xabar allaqachon yuborilgan", 409);
  const [a] = await sql`insert into absences (student_id, parent_id, date_from, date_to, reason, kind) values (${s.id}, ${user.id}, ${from}, ${to}, ${reason}, ${kind}) returning *`;
  // who is told: class leader, every teacher who has a lesson with the class on those days, and the branch administration
  const wds = new Set(); for (let d = from; d <= to && wds.size < 7; d = addDays(d, 1)) wds.add(weekday(d));
  const teachers = s.class_id ? await sql`select distinct teacher_id as id from schedule where class_id = ${s.class_id} and weekday = any(${[...wds]}::int[])` : [];
  const admins = await sql`select id from users where active and (role = 'owner' or (role = 'manager' and (branch_id is null or branch_id = ${s.branch_id})))`;
  const when = from === to ? from : `${from} — ${to}`;
  const text = `${s.last_name} ${s.first_name}${s.class_name ? " (" + s.class_name + ")" : ""}: ${when}. ${ABS_KIND[kind]}: ${reason.slice(0, 120)}`;
  await notify(sql, [s.leader_id, ...teachers.map((t) => t.id)], { kind: "absence", title: "Ota-ona: farzandi darsga kela olmaydi", body: text, link: "#absences" });
  await notify(sql, admins.map((x) => x.id), { kind: "absence", title: "Kelmaslik haqida xabar", body: text, link: "#absences" });
  await audit(ctx, "absence.create", "student", s.id, { from, to, kind }, s.branch_id);
  return a;
}, { roles: ["parent"] });

route("GET", "/absences", async (ctx) => {
  const { sql, user, query } = ctx;
  const from = isDate(query.from) ? query.from : addDays(today(), -30), to = isDate(query.to) ? query.to : addDays(today(), 60);
  let classes = null, branch = null, parent = null;
  if (user.role === "parent") parent = user.id;
  else if (user.role === "teacher") classes = await teacherClassIds(sql, user.id);
  else branch = filterOf(ctx).branch;
  return sql`select a.*, s.first_name, s.last_name, s.photo, s.gender, s.class_id, c.name as class_name, s.branch_id, s.section, p.name as parent_name, p.phone as parent_phone, sb.name as seen_by_name
    from absences a join students s on s.id = a.student_id left join classes c on c.id = s.class_id left join users p on p.id = a.parent_id left join users sb on sb.id = a.seen_by
    where a.date_to >= ${from} and a.date_from <= ${to}
      and (${parent}::int is null or s.parent_id = ${parent})
      and (${classes === null} or s.class_id = any(${classes || []}::int[]))
      and (${branch}::int is null or s.branch_id = ${branch})
    order by a.date_from desc, a.created_at desc limit 300`;
});
route("POST", "/absences/:id/seen", async (ctx) => {
  const { sql, user, params } = ctx;
  const [a] = await sql`select a.id, s.class_id, s.branch_id from absences a join students s on s.id = a.student_id where a.id = ${int(params.id)}`;
  need(a, "Topilmadi", 404);
  if (user.role === "teacher") need((await teacherClassIds(sql, user.id)).includes(a.class_id), "Ruxsat yo‘q", 403);
  else needScope(user, a.branch_id);
  await sql`update absences set seen_by = ${user.id}, seen_at = now() where id = ${a.id} and seen_by is null`;
}, { roles: ["owner", "manager", "teacher"] });
route("DELETE", "/absences/:id", async (ctx) => {
  const [a] = await ctx.sql`select * from absences where id = ${int(ctx.params.id)}`;
  need(a && a.parent_id === ctx.user.id, "Topilmadi", 404);
  need(a.date_from >= today(), "Boshlangan xabarni bekor qilib bo‘lmaydi");
  await ctx.sql`delete from absences where id = ${a.id}`;
}, { roles: ["parent"] });
