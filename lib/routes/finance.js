// Payments, salaries, expenses, debts, monthly reports (overall → branch → school/kindergarten), bank payment order reading.
import { route, fail, need, str, int, FINANCE, ADMINS, fileMeta, isMonth, isDate, curMonth, monthShift, monthEnd, today, scopeOf, filterOf, needScope, audit, SECTION_L } from "../http.js";
import { getSettings, SECTIONS } from "../db.js";
import { readFileRow } from "./core.js";

const monthOf = (col) => `to_char(${col} at time zone 'Asia/Tashkent', 'YYYY-MM')`;
const secOf = (v) => (SECTIONS.includes(v) ? v : null);

route("GET", "/finance/ledger", async (ctx) => {
  const { sql, query } = ctx;
  const { branch, section } = filterOf(ctx);
  const m = isMonth(query.month) ? query.month : curMonth();
  const payments = await sql`select p.*, s.first_name || ' ' || s.last_name as student_name, c.name as class_name, b.name as branch_name from payments p
    join students s on s.id = p.student_id left join classes c on c.id = s.class_id left join branches b on b.id = p.branch_id
    where ${sql.unsafe(monthOf("p.paid_at"))} = ${m} and (${branch}::int is null or p.branch_id = ${branch}) and (${section}::text is null or p.section = ${section}) order by p.paid_at desc`;
  const salaries = await sql`select x.*, u.name as teacher_name, b.name as branch_name from salaries x join users u on u.id = x.teacher_id left join branches b on b.id = x.branch_id
    where (${sql.unsafe(monthOf("x.paid_at"))} = ${m} or x.month = ${m}) and (${branch}::int is null or x.branch_id = ${branch}) and (${section}::text is null or x.section = ${section}) order by x.paid_at desc`;
  const expenses = await sql`select e.*, b.name as branch_name from expenses e left join branches b on b.id = e.branch_id
    where e.month = ${m} and (${branch}::int is null or e.branch_id = ${branch}) and (${section}::text is null or e.section = ${section}) order by e.created_at desc`;
  return { month: m, branch, section, payments, salaries, expenses };
}, { roles: FINANCE });

const receipt = (sql, r) => (r ? sql.json(fileMeta(r)) : null);
/** Branch for a new salary/expense: scoped accountants always their own; the owner may choose, or leave it empty for central (umumiy) costs. */
function branchFor(ctx, fallback = null) {
  const sc = scopeOf(ctx.user);
  if (sc !== null) { need(sc, "Sizga filial biriktirilmagan", 403); return sc; }
  return int(ctx.body.branch_id) || fallback || null;
}
route("POST", "/payments", async (ctx) => {
  const { sql, user, body } = ctx;
  const amount = int(body.amount); need(amount > 0 && amount < 1e10, "Summani kiriting");
  need(isMonth(body.month), "Qaysi oy uchun to‘lov ekanini tanlang");
  const [s] = await sql`select id, branch_id, section from students where id = ${int(body.student_id)}`; need(s, "O‘quvchini tanlang");
  needScope(user, s.branch_id);
  const [p] = await sql`insert into payments (student_id, month, amount, method, note, receipt, created_by, branch_id, section)
    values (${s.id}, ${body.month}, ${amount}, ${str(body.method, 30) || "Naqd"}, ${str(body.note, 300) || null}, ${receipt(sql, body.receipt)}, ${user.id}, ${s.branch_id}, ${s.section}) returning *`;
  await audit(ctx, "payment.create", "payment", p.id, { student_id: s.id, amount, month: body.month }, s.branch_id);
  return p;
}, { roles: FINANCE });
route("POST", "/salaries", async (ctx) => {
  const { sql, user, body } = ctx;
  const amount = int(body.amount); need(amount > 0 && amount < 1e10, "Summani kiriting");
  need(isMonth(body.month), "Oyni tanlang");
  const [t] = await sql`select id, branch_id from users where id = ${int(body.teacher_id)} and role = 'teacher'`; need(t, "O‘qituvchini tanlang");
  const branch = branchFor(ctx, t.branch_id);
  const [x] = await sql`insert into salaries (teacher_id, month, amount, note, receipt, created_by, branch_id, section)
    values (${t.id}, ${body.month}, ${amount}, ${str(body.note, 300) || null}, ${receipt(sql, body.receipt)}, ${user.id}, ${branch}, ${secOf(body.section)}) returning *`;
  await audit(ctx, "salary.create", "salary", x.id, { teacher_id: t.id, amount, month: body.month }, branch);
  return x;
}, { roles: FINANCE });
route("POST", "/expenses", async (ctx) => {
  const { sql, user, body } = ctx;
  const amount = int(body.amount); need(amount > 0 && amount < 1e11, "Summani kiriting");
  const note = str(body.note, 2000); need(note.length >= 3, "Xarajat tavsifini yozing: nima uchun sarflandi");
  const cats = (await getSettings(sql)).expenseCategories;
  const branch = branchFor(ctx);
  const [e] = await sql`insert into expenses ${sql({
    month: isMonth(body.month) ? body.month : curMonth(), category: cats.includes(body.category) ? body.category : cats[cats.length - 1], amount, note,
    recipient: str(body.recipient, 200) || null, doc_no: str(body.doc_no, 60) || null, doc_date: isDate(body.doc_date) ? body.doc_date : null,
    source: body.source === "bank" ? "bank" : "cash", receipt: receipt(sql, body.receipt), created_by: user.id, branch_id: branch, section: secOf(body.section),
  })} returning *`;
  await audit(ctx, "expense.create", "expense", e.id, { amount, category: e.category }, branch);
  return e;
}, { roles: FINANCE });
const TABLES = { payments: "payments", salaries: "salaries", expenses: "expenses" };
async function finRow(ctx) {
  const t = TABLES[ctx.params.kind]; need(t, "Noto‘g‘ri tur", 404);
  const [r] = await ctx.sql`select id, branch_id, amount from ${ctx.sql(t)} where id = ${int(ctx.params.id)}`;
  need(r, "Yozuv topilmadi", 404);
  if (r.branch_id == null) need(scopeOf(ctx.user) === null, "Bu umumiy (markaziy) yozuv", 403); else needScope(ctx.user, r.branch_id);
  return [t, r];
}
route("PATCH", "/finance/:kind/:id", async (ctx) => {
  const [t, row] = await finRow(ctx);
  const [r] = await ctx.sql`update ${ctx.sql(t)} set receipt = ${receipt(ctx.sql, ctx.body.receipt)} where id = ${row.id} returning *`;
  await audit(ctx, "finance.receipt", t, row.id, null, row.branch_id);
  return r;
}, { roles: FINANCE });
route("DELETE", "/finance/:kind/:id", async (ctx) => {
  const [t, row] = await finRow(ctx);
  await ctx.sql`delete from ${ctx.sql(t)} where id = ${row.id}`;
  await audit(ctx, "finance.delete", t, row.id, { amount: row.amount }, row.branch_id);
}, { roles: ["owner"] });

/** Debt per active student: monthly fee × months since joining (up to the current month) minus what was paid. */
export async function debtRows(sql, { branch = null, section = null } = {}) {
  const cur = curMonth();
  const rows = await sql`select s.id, s.first_name, s.last_name, s.monthly_fee, s.joined_on, s.branch_id, s.section, c.name as class_name, p.name as parent_name, p.phone as parent_phone,
      coalesce((select sum(amount) from payments x where x.student_id = s.id), 0)::bigint as paid,
      (select max(month) from payments x where x.student_id = s.id) as last_month
    from students s left join classes c on c.id = s.class_id left join users p on p.id = s.parent_id
    where s.status = 'active' and s.monthly_fee > 0 and (${branch}::int is null or s.branch_id = ${branch}) and (${section}::text is null or s.section = ${section})`;
  const out = [];
  for (const r of rows) {
    const start = (r.joined_on || today()).slice(0, 7);
    let months = 0; for (let m = start; m <= cur; m = monthShift(m, 1)) months++;
    const due = months * r.monthly_fee, debt = due - Number(r.paid);
    if (debt > 0) out.push({ ...r, paid: Number(r.paid), due, debt, monthsOwed: Math.ceil(debt / r.monthly_fee) });
  }
  return out.sort((a, b) => b.debt - a.debt);
}
route("GET", "/finance/debts", async (ctx) => debtRows(ctx.sql, filterOf(ctx)), { roles: ADMINS });

/** Month-by-month figures: income (cash received), salaries, expenses by category, students and teachers. */
export async function monthReports(sql, from, to, { branch = null, section = null } = {}) {
  const cats = (await getSettings(sql)).expenseCategories;
  const B = (col) => sql`(${branch}::int is null or ${sql(col)} = ${branch})`, Sx = (col) => sql`(${section}::text is null or ${sql(col)} = ${section})`;
  const inc = await sql`select ${sql.unsafe(monthOf("paid_at"))} as m, sum(amount)::bigint as v from payments where ${B("branch_id")} and ${Sx("section")} group by 1`;
  const sal = await sql`select month as m, sum(amount)::bigint as v from salaries where ${B("branch_id")} and ${Sx("section")} group by 1`;
  const exp = await sql`select month as m, category, sum(amount)::bigint as v from expenses where ${B("branch_id")} and ${Sx("section")} group by 1, 2`;
  const stu = await sql`select joined_on, left_on from students where ${B("branch_id")} and ${Sx("section")}`;
  const tch = await sql`select created_at, active from users where role = 'teacher' and (${branch}::int is null or branch_id = ${branch} or branch_id is null)`;
  const out = [];
  for (let m = from; m <= to; m = monthShift(m, 1)) {
    const end = monthEnd(m);
    const byCat = Object.fromEntries(cats.map((c) => [c, 0]));
    for (const e of exp) if (e.m === m) byCat[e.category] = (byCat[e.category] || 0) + Number(e.v);
    const income = Number(inc.find((x) => x.m === m)?.v || 0), salaries = Number(sal.find((x) => x.m === m)?.v || 0);
    const expenses = Object.values(byCat).reduce((a, b) => a + b, 0);
    out.push({
      month: m, income, salaries, byCat, expenses, out: salaries + expenses, profit: income - salaries - expenses,
      students: stu.filter((s) => (s.joined_on || "0000") <= end && (!s.left_on || s.left_on > end)).length,
      teachers: tch.filter((t) => new Date(t.created_at).toISOString().slice(0, 10) <= end).length,
    });
  }
  return { categories: cats, months: out };
}
route("GET", "/reports/months", async (ctx) => {
  const { sql, query } = ctx;
  const to = isMonth(query.to) ? query.to : curMonth(), from = isMonth(query.from) ? query.from : monthShift(to, -11);
  need(from <= to && from >= monthShift(to, -36), "Oraliq noto‘g‘ri");
  return monthReports(sql, from, to, filterOf(ctx));
}, { roles: FINANCE });

/** One month: the whole organisation, then every branch, then school / kindergarten inside each branch. */
export async function overview(sql, month, onlyBranch = null) {
  const zero = () => ({ income: 0, salaries: 0, expenses: 0, out: 0, profit: 0, students: 0, classes: 0, debt: 0, debtors: 0, absences: 0 });
  const branches = await sql`select id, name, address from branches where (${onlyBranch}::int is null or id = ${onlyBranch}) order by id`;
  const key = (b, s) => `${b ?? "x"}|${s ?? "x"}`;
  const cell = new Map();
  const add = (b, s, f, v) => { const k = key(b, s); if (!cell.has(k)) cell.set(k, zero()); cell.get(k)[f] += Number(v) || 0; };
  for (const r of await sql`select branch_id, section, sum(amount)::bigint as v from payments where ${sql.unsafe(monthOf("paid_at"))} = ${month} group by 1, 2`) add(r.branch_id, r.section, "income", r.v);
  for (const r of await sql`select branch_id, section, sum(amount)::bigint as v from salaries where month = ${month} group by 1, 2`) add(r.branch_id, r.section, "salaries", r.v);
  for (const r of await sql`select branch_id, section, sum(amount)::bigint as v from expenses where month = ${month} group by 1, 2`) add(r.branch_id, r.section, "expenses", r.v);
  for (const r of await sql`select branch_id, section, count(*)::int as v from students where status = 'active' group by 1, 2`) add(r.branch_id, r.section, "students", r.v);
  for (const r of await sql`select branch_id, section, count(*)::int as v from classes group by 1, 2`) add(r.branch_id, r.section, "classes", r.v);
  for (const r of await sql`select s.branch_id, s.section, count(*)::int as v from absences a join students s on s.id = a.student_id where ${today()} between a.date_from and a.date_to group by 1, 2`) add(r.branch_id, r.section, "absences", r.v);
  for (const d of await debtRows(sql)) { add(d.branch_id, d.section, "debt", d.debt); add(d.branch_id, d.section, "debtors", 1); }
  const sum = (list) => { const o = zero(); for (const x of list) for (const k of Object.keys(o)) o[k] += x[k]; o.out = o.salaries + o.expenses; o.profit = o.income - o.out; return o; };
  const fin = (o) => ({ ...o, out: o.salaries + o.expenses, profit: o.income - o.salaries - o.expenses });
  const outB = branches.map((b) => {
    const sections = Object.fromEntries(SECTIONS.map((s) => [s, fin(cell.get(key(b.id, s)) || zero())]));
    const common = fin(cell.get(key(b.id, null)) || zero()); // costs of the branch not tied to school or kindergarten
    return { ...b, sections, common, total: sum([...Object.values(sections), common]) };
  });
  const central = onlyBranch ? null : fin(cell.get(key(null, null)) || zero()); // head-office costs without a branch
  const total = sum([...outB.map((b) => b.total), ...(central ? [central] : [])]);
  const bySection = Object.fromEntries(SECTIONS.map((s) => [s, sum(outB.map((b) => b.sections[s]))]));
  return { month, total, bySection, central, branches: outB, labels: SECTION_L };
}
route("GET", "/reports/overview", async (ctx) => {
  const m = isMonth(ctx.query.month) ? ctx.query.month : curMonth();
  const sc = scopeOf(ctx.user);
  need(sc !== 0, "Sizga filial biriktirilmagan", 403);
  return overview(ctx.sql, m, sc);
}, { roles: ADMINS });

/* ---------- bank payment order reading (needs ANTHROPIC_API_KEY) ---------- */
route("POST", "/finance/extract", async ({ sql, body, user }) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) fail(501, "ANTHROPIC_API_KEY sozlanmagan");
  need(/^[0-9a-f-]{36}$/.test(body.file_id || ""), "Fayl tanlanmagan");
  const f = await readFileRow(sql, body.file_id); need(f, "Fayl topilmadi", 404);
  need(f.created_by === user.id || user.role === "owner", "Faqat o‘zingiz yuklagan faylni o‘qitish mumkin", 403);
  need(f.type === "application/pdf" || /^image\/(jpeg|png|webp|gif)$/.test(f.type), "Faqat PDF yoki rasm");
  const cats = (await getSettings(sql)).expenseCategories;
  const prompt = `Bu O‘zbekiston bankining to‘lov topshiriqnomasi (платежное поручение). FAQAT bitta JSON qaytaring:
{"amount": so‘mdagi summa (butun son), "purpose": "to‘lov maqsadi", "recipient": "oluvchi", "date": "YYYY-MM-DD", "number": "hujjat raqami", "category": ${JSON.stringify(cats)} dan biri}
Topilmagan maydon uchun null. Summani raqamdan oling.`;
  const b64 = Buffer.from(f.data).toString("base64");
  const block = f.type === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } } : { type: "image", source: { type: "base64", media_type: f.type, data: b64 } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 800, messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }] }),
  });
  if (!r.ok) { console.error("anthropic", r.status, (await r.text()).slice(0, 300)); fail(502, "AI xizmati javob bermadi"); }
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  try { const m = text.match(/\{[\s\S]*\}/); return { fields: m ? JSON.parse(m[0]) : null }; } catch { return { fields: null }; }
}, { roles: FINANCE });
