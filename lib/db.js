// Database connection and schema. Works the same on Vercel (Neon) and on your own server (PostgreSQL 14+).
import postgres from "postgres";
import { hashPassword } from "./auth.js";

let sql = null;
let ready = null;

/** Connection string: DATABASE_URL, or the names the Vercel/Neon integration may create instead. */
export function dbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || "";
}
export function getSql() {
  const url = dbUrl();
  if (!url) throw Object.assign(new Error("Baza ulanmagan: DATABASE_URL yoki POSTGRES_URL topilmadi"), { status: 500, expose: true });
  if (!sql) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    sql = postgres(url, {
      prepare: !/-pooler\.|pgbouncer=true/.test(url),
      ssl: local || process.env.DATABASE_SSL === "0" ? false : "require",
      max: process.env.VERCEL ? 3 : 10,
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: () => {},
    });
  }
  return sql;
}

/** Returns the connection after making sure the schema exists (runs once per process). */
export async function db() {
  const s = getSql();
  if (!ready) ready = migrate(s).catch((e) => { ready = null; throw e; });
  await ready;
  return s;
}

const SCHEMA = `
create table if not exists settings (key text primary key, value jsonb not null);
create table if not exists files (
  id uuid primary key, name text not null, type text not null, size integer not null,
  scope text not null default 'public', data bytea, path text,
  created_by integer, created_at timestamptz not null default now());
create table if not exists users (
  id serial primary key,
  role text not null check (role in ('owner','manager','accountant','teacher','parent')),
  name text not null, phone text not null unique, pass_hash text not null,
  photo jsonb, active boolean not null default true, profile jsonb not null default '{}',
  demo boolean not null default false, posts_seen_at timestamptz,
  created_at timestamptz not null default now());
create table if not exists subjects (id serial primary key, name text not null unique, demo boolean not null default false);
create table if not exists classes (
  id serial primary key, name text not null unique, grade integer, room text,
  leader_id integer references users(id) on delete set null, demo boolean not null default false);
create table if not exists students (
  id serial primary key, first_name text not null, last_name text not null,
  birth_date text, gender text check (gender in ('m','f')),
  class_id integer references classes(id) on delete set null,
  parent_id integer references users(id) on delete set null,
  photo jsonb, monthly_fee integer not null default 0, joined_on text, left_on text,
  status text not null default 'active' check (status in ('active','left')),
  profile jsonb not null default '{}', demo boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists students_class_idx on students(class_id);
create index if not exists students_parent_idx on students(parent_id);
create table if not exists schedule (
  id serial primary key,
  class_id integer not null references classes(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 6), period integer not null check (period between 1 and 12),
  subject_id integer not null references subjects(id) on delete cascade,
  teacher_id integer not null references users(id) on delete cascade, room text,
  unique (class_id, weekday, period));
create index if not exists schedule_teacher_idx on schedule(teacher_id);
create table if not exists lessons (
  id serial primary key, date text not null,
  class_id integer not null references classes(id) on delete cascade, period integer not null,
  subject_id integer not null references subjects(id) on delete cascade,
  teacher_id integer not null references users(id) on delete cascade,
  topic text, status text not null default 'planned' check (status in ('planned','started','ended')),
  started_at timestamptz, ended_at timestamptz, homework text, hw_files jsonb not null default '[]',
  unique (date, class_id, period));
create index if not exists lessons_teacher_idx on lessons(teacher_id, date);
create index if not exists lessons_class_idx on lessons(class_id, date);
create index if not exists lessons_date_idx on lessons(date);
create table if not exists attendance (
  lesson_id integer not null references lessons(id) on delete cascade,
  student_id integer not null references students(id) on delete cascade,
  status text not null check (status in ('present','absent','late')),
  primary key (lesson_id, student_id));
create table if not exists grades (
  lesson_id integer not null references lessons(id) on delete cascade,
  student_id integer not null references students(id) on delete cascade,
  value integer not null check (value between 1 and 5), comment text,
  at timestamptz not null default now(), primary key (lesson_id, student_id));
create index if not exists grades_student_idx on grades(student_id);
create table if not exists hw_checks (
  lesson_id integer not null references lessons(id) on delete cascade,
  student_id integer not null references students(id) on delete cascade,
  done boolean not null, checked_in integer references lessons(id) on delete set null,
  at timestamptz not null default now(), primary key (lesson_id, student_id));
create index if not exists hw_checks_student_idx on hw_checks(student_id);
create table if not exists unlocks (
  id serial primary key, lesson_id integer not null references lessons(id) on delete cascade,
  teacher_id integer not null references users(id) on delete cascade, reason text,
  status text not null default 'requested' check (status in ('requested','approved','denied')),
  decided_by integer, decided_at timestamptz, created_at timestamptz not null default now());
create table if not exists feedback (
  id serial primary key, student_id integer not null references students(id) on delete cascade,
  teacher_id integer not null references users(id) on delete cascade, text text not null,
  created_at timestamptz not null default now());
create index if not exists feedback_student_idx on feedback(student_id, created_at desc);
create table if not exists teacher_ratings (
  parent_id integer not null references users(id) on delete cascade,
  teacher_id integer not null references users(id) on delete cascade,
  month text not null, student_id integer references students(id) on delete set null,
  stars integer not null check (stars between 1 and 5), comment text,
  created_at timestamptz not null default now(), primary key (parent_id, teacher_id, month));
create index if not exists trates_teacher_idx on teacher_ratings(teacher_id, month);
create table if not exists posts (
  id serial primary key, kind text not null check (kind in ('news','openlesson')),
  title text not null, body text not null default '', files jsonb not null default '[]',
  author_id integer references users(id) on delete cascade, class_ids integer[], event jsonb,
  created_at timestamptz not null default now());
create index if not exists posts_created_idx on posts(created_at desc);
create table if not exists notifications (
  id serial primary key, user_id integer not null references users(id) on delete cascade,
  kind text not null, title text not null, body text, link text, read boolean not null default false,
  created_at timestamptz not null default now());
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create table if not exists achievements (
  id serial primary key, student_id integer not null references students(id) on delete cascade,
  title text not null, kind text not null default 'olympiad', level text, place integer, subject text,
  date text, file jsonb, created_at timestamptz not null default now());
create index if not exists achievements_student_idx on achievements(student_id);
create table if not exists documents (
  id serial primary key, owner_type text not null check (owner_type in ('student','teacher')),
  owner_id integer not null, kind text not null, name text, file jsonb not null,
  created_by integer, created_at timestamptz not null default now());
create index if not exists documents_owner_idx on documents(owner_type, owner_id);
create table if not exists contracts (
  id serial primary key, student_id integer not null references students(id) on delete cascade,
  number text not null, parent_name text, monthly integer not null default 0,
  status text not null default 'pending' check (status in ('pending','signed','ended')),
  created_at timestamptz not null default now());
create table if not exists payments (
  id serial primary key, student_id integer not null references students(id) on delete cascade,
  month text not null, amount integer not null, method text, note text, receipt jsonb,
  paid_at timestamptz not null default now(), created_by integer);
create index if not exists payments_student_idx on payments(student_id);
create index if not exists payments_paid_idx on payments(paid_at);
create table if not exists salaries (
  id serial primary key, teacher_id integer not null references users(id) on delete cascade,
  month text not null, amount integer not null, note text, receipt jsonb,
  paid_at timestamptz not null default now(), created_by integer);
create index if not exists salaries_teacher_idx on salaries(teacher_id);
create table if not exists expenses (
  id serial primary key, month text not null, category text not null, amount integer not null,
  note text not null default '', recipient text, doc_no text, doc_date text,
  source text not null default 'cash', receipt jsonb, demo boolean not null default false,
  created_by integer, created_at timestamptz not null default now());
create index if not exists expenses_month_idx on expenses(month);
create table if not exists branches (
  id serial primary key, name text not null unique, address text, phone text,
  created_at timestamptz not null default now());
alter table classes add column if not exists branch_id integer references branches(id) on delete restrict;
alter table classes add column if not exists section text not null default 'school';
alter table students add column if not exists branch_id integer references branches(id) on delete restrict;
alter table students add column if not exists section text not null default 'school';
alter table users add column if not exists branch_id integer references branches(id) on delete set null;
alter table users add column if not exists token_version integer not null default 0;
alter table payments add column if not exists branch_id integer references branches(id) on delete set null;
alter table payments add column if not exists section text;
alter table salaries add column if not exists branch_id integer references branches(id) on delete set null;
alter table salaries add column if not exists section text;
alter table expenses add column if not exists branch_id integer references branches(id) on delete set null;
alter table expenses add column if not exists section text;
alter table posts add column if not exists branch_id integer references branches(id) on delete set null;
create index if not exists classes_branch_idx on classes(branch_id, section);
create index if not exists students_branch_idx on students(branch_id, section);
create index if not exists payments_branch_idx on payments(branch_id);
create index if not exists expenses_branch_idx on expenses(branch_id, month);
create index if not exists salaries_branch_idx on salaries(branch_id, month);
create table if not exists login_attempts (key text primary key, n integer not null, first_at timestamptz not null default now());
create table if not exists audit_log (
  id bigserial primary key, at timestamptz not null default now(), user_id integer, role text, action text not null,
  entity text, entity_id text, branch_id integer, detail jsonb, ip text);
create index if not exists audit_at_idx on audit_log(at desc);
create table if not exists absences (
  id serial primary key, student_id integer not null references students(id) on delete cascade,
  parent_id integer references users(id) on delete set null, date_from text not null, date_to text not null,
  reason text not null, kind text not null default 'other', created_at timestamptz not null default now(),
  seen_by integer, seen_at timestamptz);
create index if not exists absences_student_idx on absences(student_id, date_from);
create index if not exists absences_dates_idx on absences(date_from, date_to);
create table if not exists menu (
  date text not null, meal text not null check (meal in ('breakfast','lunch','snack')),
  dish text not null, items text, demo boolean not null default false, primary key (date, meal));
`;

export const DEFAULT_SETTINGS = {
  school: { name: "Steam Plaza", subtitle: "Aviation maktabi", phone: "", address: "" },
  bell: { start: "08:30", lesson: 45, break: 10, lunchAfter: 4, lunch: 40, periods: 7 },
  expenseCategories: ["Ijara va kommunal", "Oziq-ovqat", "O‘quv jihozlari", "Ta’mirlash va boshqa", "Soliq va bank xizmatlari"],
  teacherRating: { starsWeight: 70, openLessonWeight: 30, openLessonTarget: 2 },
};

async function migrate(s) {
  await s.unsafe(SCHEMA);
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await s`insert into settings (key, value) values (${k}, ${s.json(v)}) on conflict (key) do nothing`;
  }
  // branches: every school has at least two branches (filial), each with a school and a kindergarten section
  const [{ b }] = await s`select count(*)::int as b from branches`;
  if (b === 0) await s`insert into branches (name) values ('1-filial'), ('2-filial') on conflict do nothing`;
  const [first] = await s`select id from branches order by id limit 1`;
  await s`update classes set branch_id = ${first.id} where branch_id is null`;
  await s`update students st set branch_id = c.branch_id, section = c.section from classes c where c.id = st.class_id and (st.branch_id is distinct from c.branch_id or st.section is distinct from c.section)`;
  await s`update students set branch_id = ${first.id} where branch_id is null`;
  await s`update payments p set branch_id = st.branch_id, section = st.section from students st where st.id = p.student_id and p.branch_id is null`;
  await s`update salaries x set branch_id = coalesce(u.branch_id, ${first.id}) from users u where u.id = x.teacher_id and x.branch_id is null`;
  const [{ n }] = await s`select count(*)::int as n from users`;
  if (n === 0) {
    const phone = normPhone(process.env.OWNER_PHONE || "");
    const pass = process.env.OWNER_PASSWORD || "";
    if (phone && pass.length >= 8) {
      await s`insert into users (role, name, phone, pass_hash, profile) values ('owner', ${process.env.OWNER_NAME || "Bosh admin"}, ${phone}, ${await hashPassword(pass)}, ${s.json({ position: "Direktor" })})`;
    }
  }
}

export const SECTIONS = ["school", "kindergarten"];

export function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return d.length === 12 && d.startsWith("998") ? "+" + d : "";
}

export async function getSettings(s) {
  const rows = await s`select key, value from settings`;
  const o = { ...DEFAULT_SETTINGS };
  for (const r of rows) o[r.key] = r.value;
  return o;
}
