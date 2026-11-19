// Ratings (students, teachers), per-student subject/topic statistics, dashboard.
import { route, fail, need, int, str, ADMINS, FINANCE, today, addDays, weekday, curMonth, monthShift, monthEnd, isMonth, scopeOf, filterOf } from "../http.js";
import { studentAccess, teacherClassIds } from "./core.js";
import { getSettings } from "../db.js";

export function periodRange(period, ref = today()) {
  if (period === "day") return [ref, ref];
  if (period === "week") { const w = weekday(ref); return [addDays(ref, w === 0 ? -6 : 1 - w), ref]; }
  if (period === "year") { const y = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7)); const sy = m >= 9 ? y : y - 1; return [`${sy}-09-01`, ref]; }
  return [ref.slice(0, 7) + "-01", ref];
}

/** Students ranked by average grade in a period. scope: class_id, or grade number, or whole school. */
export async function studentRanking(sql, { period = "week", classId = null, grade = null, ref, branch = null, section = null }) {
  const [from, to] = periodRange(period, ref);
  return sql`select s.id, s.first_name, s.last_name, s.gender, s.photo, s.class_id, c.name as class_name,
      x.avg, coalesce(x.n, 0) as n,
      (select count(*)::int from achievements a where a.student_id = s.id) as achievements
    from students s left join classes c on c.id = s.class_id
    left join (select g.student_id, round(avg(g.value)::numeric, 2)::float as avg, count(*)::int as n from grades g join lessons l on l.id = g.lesson_id
      where l.date between ${from} and ${to} group by g.student_id) x on x.student_id = s.id
    where s.status = 'active' and (${classId}::int is null or s.class_id = ${classId}) and (${grade}::int is null or c.grade = ${grade})
      and (${branch}::int is null or s.branch_id = ${branch}) and (${section}::text is null or s.section = ${section})
    order by x.avg desc nulls last, x.n desc nulls last, s.last_name`;
}

route("GET", "/ratings/students", async (ctx) => {
  const { sql, query, user } = ctx;
  const period = ["day", "week", "month", "year"].includes(query.period) ? query.period : "week";
  // parents see the ranking of their children's branch; branch staff their own branch
  let branch = ADMINS.includes(user.role) ? filterOf(ctx).branch : null;
  if (user.role === "parent") {
    const brs = (await sql`select distinct branch_id from students where parent_id = ${user.id} and status = 'active'`).map((r) => r.branch_id);
    branch = brs.includes(int(query.branch_id)) ? int(query.branch_id) : brs[0] ?? -1;
  }
  const rows = await studentRanking(sql, { period, classId: int(query.class_id) || null, grade: int(query.grade) || null, branch, section: "school" });
  const [from, to] = periodRange(period);
  let rank = 0, last = null;
  rows.forEach((r, i) => { if (r.avg == null) { r.rank = null; return; } if (r.avg !== last) { rank = i + 1; last = r.avg; } r.rank = rank; });
  return { period, from, to, rows };
});

/** Teacher ranking for a month (YYYY-MM) or a year (YYYY): parents' stars (smoothed) + open lessons. */
export async function teacherRanking(sql, { month = null, year = null }) {
  const st = await getSettings(sql);
  const w = st.teacherRating || { starsWeight: 70, openLessonWeight: 30, openLessonTarget: 2 };
  const prefix = month || year || curMonth();
  const target = (w.openLessonTarget || 2) * (year ? 10 : 1);
  const rows = await sql`select u.id, u.name, u.photo, u.profile->>'gender' as gender,
      coalesce((select array_agg(distinct sb.name) from schedule sc join subjects sb on sb.id = sc.subject_id where sc.teacher_id = u.id), '{}') as subjects,
      (select coalesce(sum(stars), 0)::int from teacher_ratings r where r.teacher_id = u.id and r.month like ${prefix + "%"}) as stars_sum,
      (select count(*)::int from teacher_ratings r where r.teacher_id = u.id and r.month like ${prefix + "%"}) as votes,
      (select count(*)::int from posts p where p.author_id = u.id and p.kind = 'openlesson' and coalesce(p.event->>'date', to_char(p.created_at, 'YYYY-MM-DD')) like ${prefix + "%"}) as open_lessons,
      (select count(*)::int from lessons l where l.teacher_id = u.id and l.status = 'ended' and l.date like ${prefix + "%"}) as lessons
    from users u where u.role = 'teacher' and u.active`;
  const PRIOR_N = 3, PRIOR = 4.0;
  for (const r of rows) {
    r.stars = r.votes ? Math.round((r.stars_sum / r.votes) * 100) / 100 : null;
    const smooth = (r.stars_sum + PRIOR * PRIOR_N) / (r.votes + PRIOR_N);
    const starsPart = r.votes ? (smooth / 5) * w.starsWeight : 0;
    const openPart = Math.min(r.open_lessons / target, 1) * w.openLessonWeight;
    r.score = Math.round((starsPart + openPart) * 10) / 10;
  }
  rows.sort((a, b) => b.score - a.score || b.votes - a.votes || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return { period: year ? "year" : "month", key: prefix, weights: w, target, rows };
}
route("GET", "/ratings/teachers", async ({ sql, query }) => teacherRanking(sql, { month: isMonth(query.month) ? query.month : null, year: /^\d{4}$/.test(query.year || "") ? query.year : null }));

/** Monthly learning statistics of one student: subjects, topics with low grades, attendance, homework, 6-month trend. */
export async function studentStats(sql, sid, month) {
  const prev = monthShift(month, -1), from6 = monthShift(month, -5);
  const grades = await sql`select l.date, l.topic, sb.name as subject, g.value, g.comment from grades g join lessons l on l.id = g.lesson_id join subjects sb on sb.id = l.subject_id
    where g.student_id = ${sid} and l.date between ${from6 + "-01"} and ${monthEnd(month)} order by l.date`;
  const inM = grades.filter((g) => g.date.startsWith(month)), inP = grades.filter((g) => g.date.startsWith(prev));
  const avg = (a) => (a.length ? Math.round((a.reduce((x, g) => x + g.value, 0) / a.length) * 100) / 100 : null);
  const names = [...new Set(grades.map((g) => g.subject))].sort();
  const subjects = names.map((n) => {
    const m = inM.filter((g) => g.subject === n), p = inP.filter((g) => g.subject === n);
    const topics = {};
    for (const g of m) { const k = g.topic || "Mavzusiz"; (topics[k] = topics[k] || []).push(g.value); }
    return { subject: n, avg: avg(m), n: m.length, prevAvg: avg(p), grades: m.map((g) => ({ date: g.date, topic: g.topic, value: g.value })),
      topics: Object.entries(topics).map(([topic, v]) => ({ topic, avg: avg(v.map((value) => ({ value }))), n: v.length })).sort((a, b) => a.avg - b.avg) };
  }).filter((s) => s.n || s.prevAvg != null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  const weak = inM.filter((g) => g.value <= 3).map((g) => ({ date: g.date, subject: g.subject, topic: g.topic, value: g.value }));
  const trend = [];
  for (let m = from6; m <= month; m = monthShift(m, 1)) {
    const a = grades.filter((g) => g.date.startsWith(m));
    trend.push({ month: m, avg: avg(a), n: a.length, bySubject: Object.fromEntries(names.map((n) => [n, avg(a.filter((g) => g.subject === n))])) });
  }
  const [att] = await sql`select count(*) filter (where a.status = 'present')::int as present, count(*) filter (where a.status = 'absent')::int as absent,
      count(*) filter (where a.status = 'late')::int as late from attendance a join lessons l on l.id = a.lesson_id where a.student_id = ${sid} and l.date like ${month + "%"}`;
  const [hw] = await sql`select count(*) filter (where h.done)::int as done, count(*) filter (where not h.done)::int as missed from hw_checks h join lessons l on l.id = h.lesson_id
    where h.student_id = ${sid} and l.date like ${month + "%"}`;
  return { month, avg: avg(inM), prevAvg: avg(inP), subjects, weak, trend, attendance: att, homework: hw,
    best: subjects.filter((s) => s.avg != null).slice(0, 2).map((s) => s.subject), worst: subjects.filter((s) => s.avg != null).slice(-2).reverse().map((s) => s.subject) };
}
route("GET", "/students/:id/stats", async (ctx) => {
  const s = await studentAccess(ctx, ctx.params.id);
  const month = isMonth(ctx.query.month) ? ctx.query.month : curMonth();
  const out = await studentStats(ctx.sql, s.id, month);
  if (s.class_id) {
    const list = await studentRanking(ctx.sql, { period: "month", classId: s.class_id, ref: month === curMonth() ? today() : monthEnd(month) });
    const i = list.findIndex((r) => r.id === s.id);
    out.classRank = list[i]?.avg != null ? i + 1 : null; out.classSize = list.length;
  }
  return out;
});

/** Rank of each of the parent's children (day/week/month) for the home screen. */
route("GET", "/my/ranks", async ({ sql, user }) => {
  const kids = await sql`select id, class_id from students where parent_id = ${user.id} and status = 'active'`;
  const out = {};
  for (const k of kids) {
    out[k.id] = {};
    for (const p of ["day", "week", "month"]) {
      const list = await studentRanking(sql, { period: p, classId: k.class_id });
      const i = list.findIndex((r) => r.id === k.id);
      out[k.id][p] = { rank: list[i]?.avg != null ? i + 1 : null, avg: list[i]?.avg ?? null, total: list.length, top: list[0]?.avg != null ? { id: list[0].id, name: `${list[0].first_name} ${list[0].last_name}` } : null };
    }
  }
  return out;
}, { roles: ["parent"] });

/* ---------- dashboard ---------- */
route("GET", "/dashboard", async (ctx) => {
  const { sql, user } = ctx;
  const t = today(), m = curMonth();
  const { branch: b, section: sx } = filterOf(ctx);
  const [c] = await sql`select (select count(*)::int from students where status = 'active' and (${b}::int is null or branch_id = ${b}) and (${sx}::text is null or section = ${sx})) as students,
    (select count(*)::int from users where role = 'teacher' and active and (${b}::int is null or branch_id = ${b} or branch_id is null)) as teachers,
    (select count(*)::int from classes where (${b}::int is null or branch_id = ${b}) and (${sx}::text is null or section = ${sx})) as classes,
    (select count(distinct s.parent_id)::int from students s where s.status = 'active' and (${b}::int is null or s.branch_id = ${b})) as parents,
    (select count(*)::int from unlocks un join lessons l on l.id = un.lesson_id join classes c on c.id = l.class_id where un.status = 'requested' and (${b}::int is null or c.branch_id = ${b})) as unlocks,
    (select count(*)::int from contracts ct join students s on s.id = ct.student_id where ct.status = 'pending' and (${b}::int is null or s.branch_id = ${b})) as contracts,
    (select count(*)::int from absences a join students s on s.id = a.student_id where ${t} between a.date_from and a.date_to and (${b}::int is null or s.branch_id = ${b})) as absences,
    (select count(*)::int from lessons l join classes c on c.id = l.class_id where l.date = ${t} and l.status = 'started' and (${b}::int is null or c.branch_id = ${b})) as live,
    (select count(*)::int from lessons l join classes c on c.id = l.class_id where l.date = ${t} and l.status = 'ended' and (${b}::int is null or c.branch_id = ${b})) as ended`;
  const out = { counts: c, date: t, branch: b };
  if (FINANCE.includes(user.role)) {
    const [f] = await sql`select (select coalesce(sum(amount),0)::bigint from payments where to_char(paid_at at time zone 'Asia/Tashkent', 'YYYY-MM') = ${m} and (${b}::int is null or branch_id = ${b}) and (${sx}::text is null or section = ${sx})) as income,
      (select coalesce(sum(amount),0)::bigint from salaries where month = ${m} and (${b}::int is null or branch_id = ${b}) and (${sx}::text is null or section = ${sx})) as salaries,
      (select coalesce(sum(amount),0)::bigint from expenses where month = ${m} and (${b}::int is null or branch_id = ${b}) and (${sx}::text is null or section = ${sx})) as expenses`;
    out.finance = { month: m, income: Number(f.income), salaries: Number(f.salaries), expenses: Number(f.expenses), profit: Number(f.income) - Number(f.salaries) - Number(f.expenses) };
  }
  out.topStudents = (await studentRanking(sql, { period: "week", branch: b })).filter((r) => r.avg != null).slice(0, 5);
  out.topTeachers = (await teacherRanking(sql, { month: m })).rows.slice(0, 5);
  return out;
}, { roles: ADMINS });

export { teacherClassIds, fail, need, str };
