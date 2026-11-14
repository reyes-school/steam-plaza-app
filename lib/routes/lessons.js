// Lessons: schedule view (ahead + history), live status, the lesson workspace (start → marks → end with homework), unlock requests, homework for parents.
import { route, fail, need, str, int, STAFF, ADMINS, notify, fileList, isDate, today, addDays, weekday, periodTimes, nowMinutes } from "../http.js";
import { teacherClassIds, studentAccess } from "./core.js";
import { getSettings } from "../db.js";

const SLOT_COLS = (sql) => sql`l.id as lesson_id, l.topic, l.status, l.homework, l.hw_files, l.started_at, l.ended_at`;

/** Schedule for a range: real lesson rows for the past, weekly template merged with rows for today and later. */
async function slots(sql, { teacherId = null, classId = null, from, to }) {
  const t = today();
  const rows = await sql`select l.date, l.period, l.class_id, c.name as class_name, l.subject_id, sb.name as subject, l.teacher_id, u.name as teacher_name, ${SLOT_COLS(sql)}
    from lessons l join classes c on c.id = l.class_id join subjects sb on sb.id = l.subject_id join users u on u.id = l.teacher_id
    where l.date between ${from} and ${to} and (${teacherId}::int is null or l.teacher_id = ${teacherId}) and (${classId}::int is null or l.class_id = ${classId})`;
  const tpl = await sql`select sc.weekday, sc.period, sc.class_id, c.name as class_name, sc.subject_id, sb.name as subject, sc.teacher_id, u.name as teacher_name, sc.room
    from schedule sc join classes c on c.id = sc.class_id join subjects sb on sb.id = sc.subject_id join users u on u.id = sc.teacher_id
    where (${teacherId}::int is null or sc.teacher_id = ${teacherId}) and (${classId}::int is null or sc.class_id = ${classId})`;
  const key = (d, cls, p) => `${d}|${cls}|${p}`;
  const map = new Map(rows.map((r) => [key(r.date, r.class_id, r.period), { ...r, status: r.status }]));
  for (let d = from < t ? t : from; d <= to; d = addDays(d, 1)) {
    const wd = weekday(d);
    for (const s of tpl) if (s.weekday === wd && !map.has(key(d, s.class_id, s.period))) map.set(key(d, s.class_id, s.period), { ...s, date: d, lesson_id: null, status: "planned", hw_files: [] });
  }
  // the class may have a lesson row taught by another teacher (substitute) — keep only rows of this teacher
  return [...map.values()].filter((x) => !teacherId || x.teacher_id === teacherId).sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period || a.class_name.localeCompare(b.class_name));
}

route("GET", "/lessons", async ({ sql, user, query }) => {
  const from = isDate(query.from) ? query.from : today(), to = isDate(query.to) ? query.to : addDays(from, 6);
  need(to >= from && Date.parse(to) - Date.parse(from) <= 92 * 864e5, "Oraliq 3 oydan oshmasin");
  let teacherId = int(query.teacher_id) || null, classId = int(query.class_id) || null;
  if (user.role === "teacher" && !classId) teacherId = user.id;
  if (user.role === "teacher" && classId) need((await teacherClassIds(sql, user.id)).includes(classId), "Ruxsat yo‘q", 403);
  if (user.role === "parent") {
    const [k] = await sql`select 1 from students where parent_id = ${user.id} and class_id = ${classId}`;
    need(k, "Ruxsat yo‘q", 403); teacherId = null;
  }
  need(teacherId || classId, "O‘qituvchi yoki sinfni tanlang");
  return slots(sql, { teacherId, classId, from, to });
});

/** Everything running in the school today (admin dashboard, live view). */
route("GET", "/live", async ({ sql }) => {
  const t = today();
  const list = await slots(sql, { from: t, to: t });
  const settings = await getSettings(sql);
  return { date: t, now: nowMinutes(), times: periodTimes(settings.bell), lessons: list };
}, { roles: ADMINS });

async function loadLesson(sql, id) {
  const [l] = await sql`select l.*, c.name as class_name, sb.name as subject, u.name as teacher_name from lessons l
    join classes c on c.id = l.class_id join subjects sb on sb.id = l.subject_id join users u on u.id = l.teacher_id where l.id = ${int(id)}`;
  if (!l) fail(404, "Dars topilmadi");
  return l;
}
/** Teachers may change a lesson on its own day; afterwards only with an approved unlock (valid for the day it was approved). */
async function editState(sql, user, l) {
  if (STAFF.includes(user.role)) return "admin";
  if (user.role !== "teacher" || l.teacher_id !== user.id) return "readonly";
  if (l.date === today()) return "today";
  const [u] = await sql`select status, decided_at from unlocks where lesson_id = ${l.id} order by created_at desc limit 1`;
  if (u?.status === "approved" && u.decided_at && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(u.decided_at) === today()) return "unlocked";
  if (u?.status === "requested") return "requested";
  if (u?.status === "denied") return "denied";
  return "locked";
}
const canEdit = (st) => ["admin", "today", "unlocked"].includes(st);

route("POST", "/lessons/start", async ({ sql, user, body }) => {
  const date = isDate(body.date) ? body.date : today(), cls = int(body.class_id), p = int(body.period);
  const topic = str(body.topic, 300);
  need(topic.length >= 3, "Dars mavzusini kiriting");
  need(date === today() || STAFF.includes(user.role), "Darsni faqat o‘z kunida boshlash mumkin");
  const [tpl] = await sql`select subject_id, teacher_id from schedule where class_id = ${cls} and weekday = ${weekday(date)} and period = ${p}`;
  const [ex] = await sql`select * from lessons where date = ${date} and class_id = ${cls} and period = ${p}`;
  const subjectId = ex?.subject_id || tpl?.subject_id || int(body.subject_id);
  const teacherId = user.role === "teacher" ? user.id : ex?.teacher_id || tpl?.teacher_id;
  need(subjectId && teacherId, "Bu soatda dars jadvalda yo‘q");
  if (user.role === "teacher") need((tpl && tpl.teacher_id === user.id) || (ex && ex.teacher_id === user.id) || int(body.substitute) === 1, "Bu dars jadvalda boshqa o‘qituvchiga biriktirilgan", 403);
  if (date === today() && !STAFF.includes(user.role)) {
    const times = periodTimes((await getSettings(sql)).bell), slot = times.find((x) => x.period === p);
    if (slot) need(nowMinutes() >= slot.start - 15, `Dars ${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")} da boshlanadi. 15 daqiqa oldin boshlash mumkin.`);
  }
  if (ex && ex.status !== "planned") return { id: ex.id, already: true };
  const [l] = await sql`insert into lessons (date, class_id, period, subject_id, teacher_id, topic, status, started_at)
    values (${date}, ${cls}, ${p}, ${subjectId}, ${teacherId}, ${topic}, 'started', now())
    on conflict (date, class_id, period) do update set topic = excluded.topic, status = 'started', started_at = now(), teacher_id = excluded.teacher_id returning id`;
  return { id: l.id };
});

route("GET", "/lessons/:id", async ({ sql, user, params }) => {
  const l = await loadLesson(sql, params.id);
  if (user.role === "teacher") need(l.teacher_id === user.id || (await teacherClassIds(sql, user.id)).includes(l.class_id), "Ruxsat yo‘q", 403);
  else need(ADMINS.includes(user.role), "Ruxsat yo‘q", 403);
  const students = await sql`select s.id, s.first_name, s.last_name, s.gender, s.photo, a.status as attendance, g.value as grade, g.comment
    from students s left join attendance a on a.lesson_id = ${l.id} and a.student_id = s.id left join grades g on g.lesson_id = ${l.id} and g.student_id = s.id
    where s.class_id = ${l.class_id} and s.status = 'active' order by s.last_name, s.first_name`;
  const [prev] = await sql`select id, date, topic, homework, hw_files from lessons where class_id = ${l.class_id} and subject_id = ${l.subject_id}
    and (date < ${l.date} or (date = ${l.date} and period < ${l.period})) and homework is not null order by date desc, period desc limit 1`;
  const checks = prev ? await sql`select student_id, done from hw_checks where lesson_id = ${prev.id}` : [];
  const st = await editState(sql, user, l);
  return { ...l, students, prev: prev || null, checks: Object.fromEntries(checks.map((c) => [c.student_id, c.done])), edit: st, canEdit: canEdit(st) };
});

route("PUT", "/lessons/:id/marks", async ({ sql, user, params, body }) => {
  const l = await loadLesson(sql, params.id);
  need(canEdit(await editState(sql, user, l)), "Bu dars yopilgan. O‘zgartirish uchun admindan ruxsat so‘rang.", 423);
  need(l.status !== "planned", "Avval darsni boshlang");
  const sid = int(body.student_id);
  const [s] = await sql`select id from students where id = ${sid} and class_id = ${l.class_id}`;
  need(s, "O‘quvchi bu sinfda emas");
  if (body.attendance !== undefined) {
    if (body.attendance === null) await sql`delete from attendance where lesson_id = ${l.id} and student_id = ${sid}`;
    else { need(["present", "absent", "late"].includes(body.attendance), "Davomat qiymati noto‘g‘ri");
      await sql`insert into attendance (lesson_id, student_id, status) values (${l.id}, ${sid}, ${body.attendance}) on conflict (lesson_id, student_id) do update set status = excluded.status`; }
  }
  if (body.grade !== undefined) {
    if (body.grade === null) await sql`delete from grades where lesson_id = ${l.id} and student_id = ${sid}`;
    else { const v = int(body.grade); need(v >= 1 && v <= 5, "Baho 1–5");
      await sql`insert into grades (lesson_id, student_id, value, comment) values (${l.id}, ${sid}, ${v}, ${str(body.comment, 300) || null})
        on conflict (lesson_id, student_id) do update set value = excluded.value, comment = coalesce(excluded.comment, grades.comment), at = now()`; }
  }
  if (body.hw_done !== undefined) {
    const [prev] = await sql`select id from lessons where class_id = ${l.class_id} and subject_id = ${l.subject_id}
      and (date < ${l.date} or (date = ${l.date} and period < ${l.period})) and homework is not null order by date desc, period desc limit 1`;
    need(prev, "Oldingi darsda uyga vazifa berilmagan");
    if (body.hw_done === null) await sql`delete from hw_checks where lesson_id = ${prev.id} and student_id = ${sid}`;
    else await sql`insert into hw_checks (lesson_id, student_id, done, checked_in) values (${prev.id}, ${sid}, ${!!body.hw_done}, ${l.id})
      on conflict (lesson_id, student_id) do update set done = excluded.done, checked_in = excluded.checked_in, at = now()`;
  }
  return { ok: true };
});

route("PATCH", "/lessons/:id", async ({ sql, user, params, body }) => {
  const l = await loadLesson(sql, params.id);
  need(canEdit(await editState(sql, user, l)), "Bu dars yopilgan. O‘zgartirish uchun admindan ruxsat so‘rang.", 423);
  const upd = {};
  if (body.topic != null) { upd.topic = str(body.topic, 300); need(upd.topic.length >= 3, "Mavzuni kiriting"); }
  if (body.homework != null) { upd.homework = str(body.homework, 4000); need(l.status !== "ended" || upd.homework.length >= 3, "Uyga vazifa bo‘sh bo‘lmasin"); }
  if (body.hw_files !== undefined) upd.hw_files = sql.json(fileList(body.hw_files));
  if (!Object.keys(upd).length) return l;
  const [r] = await sql`update lessons set ${sql(upd)} where id = ${l.id} returning *`;
  return r;
});

route("POST", "/lessons/:id/end", async ({ sql, user, params, body }) => {
  const l = await loadLesson(sql, params.id);
  need(canEdit(await editState(sql, user, l)), "Bu dars yopilgan", 423);
  need(l.status === "started" || l.status === "ended", "Avval darsni boshlang");
  const hw = str(body.homework, 4000);
  need(hw.length >= 3, "Darsni tugatish uchun uyga vazifani kiriting");
  const files = fileList(body.hw_files);
  const [r] = await sql`update lessons set status = 'ended', ended_at = coalesce(ended_at, now()), homework = ${hw}, hw_files = ${sql.json(files)} where id = ${l.id} returning *`;
  return r;
});

/* ---------- unlock requests ---------- */
route("POST", "/lessons/:id/unlock", async ({ sql, user, params, body }) => {
  const l = await loadLesson(sql, params.id);
  need(user.role === "teacher" && l.teacher_id === user.id, "Ruxsat yo‘q", 403);
  const [open] = await sql`select id from unlocks where lesson_id = ${l.id} and status = 'requested'`;
  need(!open, "So‘rov allaqachon yuborilgan");
  const reason = str(body.reason, 500); need(reason.length >= 3, "Sababini yozing");
  await sql`insert into unlocks (lesson_id, teacher_id, reason) values (${l.id}, ${user.id}, ${reason})`;
  const admins = await sql`select id from users where role in ('owner','manager') and active`;
  await notify(sql, admins.map((a) => a.id), { kind: "unlock", title: "Tahrirlash uchun ruxsat so‘raldi", body: `${user.name}: ${l.class_name}, ${l.subject}, ${l.date}. ${reason}`, link: "#admin-unlocks" });
});
route("GET", "/unlocks", async ({ sql, query }) => {
  const st = ["requested", "approved", "denied"].includes(query.status) ? query.status : null;
  return sql`select un.*, u.name as teacher_name, l.date, l.period, c.name as class_name, sb.name as subject from unlocks un
    join users u on u.id = un.teacher_id join lessons l on l.id = un.lesson_id join classes c on c.id = l.class_id join subjects sb on sb.id = l.subject_id
    where (${st}::text is null or un.status = ${st}) order by un.created_at desc limit 200`;
}, { roles: STAFF });
route("POST", "/unlocks/:id/decide", async ({ sql, user, params, body }) => {
  const [u] = await sql`update unlocks set status = ${body.approve ? "approved" : "denied"}, decided_by = ${user.id}, decided_at = now() where id = ${int(params.id)} and status = 'requested' returning *`;
  need(u, "So‘rov topilmadi yoki allaqachon ko‘rib chiqilgan", 404);
  await notify(sql, [u.teacher_id], { kind: "unlock", title: body.approve ? "Tahrirlashga ruxsat berildi (bugun kun oxirigacha)" : "Tahrirlash so‘rovi rad etildi", body: "", link: "#teacher-schedule" });
}, { roles: STAFF });

/* ---------- homework for parents (and staff) ---------- */
route("GET", "/students/:id/homework", async (ctx) => {
  const { sql, query } = ctx;
  const s = await studentAccess(ctx, ctx.params.id);
  const to = isDate(query.to) ? query.to : today(), from = isDate(query.from) ? query.from : addDays(to, -13);
  return sql`select l.id, l.date, l.period, sb.name as subject, u.name as teacher_name, l.topic, l.homework, l.hw_files, l.status,
      h.done, g.value as grade, a.status as attendance
    from lessons l join subjects sb on sb.id = l.subject_id join users u on u.id = l.teacher_id
    left join hw_checks h on h.lesson_id = l.id and h.student_id = ${s.id}
    left join grades g on g.lesson_id = l.id and g.student_id = ${s.id}
    left join attendance a on a.lesson_id = l.id and a.student_id = ${s.id}
    where l.class_id = ${s.class_id} and l.date between ${from} and ${to} and l.status <> 'planned'
    order by l.date desc, l.period`;
});
