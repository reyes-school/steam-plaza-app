// Payments, salaries, expenses, debts, monthly reports, bank payment order reading.
import { route, fail, need, str, int, FINANCE, ADMINS, fileMeta, isMonth, isDate, curMonth, monthShift, monthEnd, today } from "../http.js";
import { getSettings } from "../db.js";
import { readFileRow } from "./core.js";

const monthOf = (col) => `to_char(${col} at time zone 'Asia/Tashkent', 'YYYY-MM')`;

route("GET", "/finance/ledger", async ({ sql, query }) => {
  const m = isMonth(query.month) ? query.month : curMonth();
  const payments = await sql`select p.*, s.first_name || ' ' || s.last_name as student_name, c.name as class_name from payments p
    join students s on s.id = p.student_id left join classes c on c.id = s.class_id where ${sql.unsafe(monthOf("p.paid_at"))} = ${m} order by p.paid_at desc`;
  const salaries = await sql`select x.*, u.name as teacher_name from salaries x join users u on u.id = x.teacher_id where ${sql.unsafe(monthOf("x.paid_at"))} = ${m} or x.month = ${m} order by x.paid_at desc`;
  const expenses = await sql`select * from expenses where month = ${m} order by created_at desc`;
  return { month: m, payments, salaries, expenses };
}, { roles: FINANCE });

const receipt = (sql, r) => (r ? sql.json(fileMeta(r)) : null);
route("POST", "/payments", async ({ sql, user, body }) => {
  const amount = int(body.amount); need(amount > 0, "Summani kiriting");
  need(isMonth(body.month), "Qaysi oy uchun to‘lov ekanini tanlang");
  const [s] = await sql`select id from students where id = ${int(body.student_id)}`; need(s, "O‘quvchini tanlang");
  const [p] = await sql`insert into payments (student_id, month, amount, method, note, receipt, created_by)
    values (${s.id}, ${body.month}, ${amount}, ${str(body.method, 30) || "Naqd"}, ${str(body.note, 300) || null}, ${receipt(sql, body.receipt)}, ${user.id}) returning *`;
  return p;
}, { roles: FINANCE });
route("POST", "/salaries", async ({ sql, user, body }) => {
  const amount = int(body.amount); need(amount > 0, "Summani kiriting");
  need(isMonth(body.month), "Oyni tanlang");
  const [t] = await sql`select id from users where id = ${int(body.teacher_id)} and role = 'teacher'`; need(t, "O‘qituvchini tanlang");
  const [x] = await sql`insert into salaries (teacher_id, month, amount, note, receipt, created_by) values (${t.id}, ${body.month}, ${amount}, ${str(body.note, 300) || null}, ${receipt(sql, body.receipt)}, ${user.id}) returning *`;
  return x;
}, { roles: FINANCE });
route("POST", "/expenses", async ({ sql, user, body }) => {
  const amount = int(body.amount); need(amount > 0, "Summani kiriting");
  const note = str(body.note, 2000); need(note.length >= 3, "Xarajat tavsifini yozing: nima uchun sarflandi");
  const cats = (await getSettings(sql)).expenseCategories;
  const [e] = await sql`insert into expenses ${sql({
    month: isMonth(body.month) ? body.month : curMonth(), category: cats.includes(body.category) ? body.category : cats[cats.length - 1], amount, note,
    recipient: str(body.recipient, 200) || null, doc_no: str(body.doc_no, 60) || null, doc_date: isDate(body.doc_date) ? body.doc_date : null,
    source: body.source === "bank" ? "bank" : "cash", receipt: receipt(sql, body.receipt), created_by: user.id,
  })} returning *`;
  return e;
}, { roles: FINANCE });
const TABLES = { payments: "payments", salaries: "salaries", expenses: "expenses" };
route("PATCH", "/finance/:kind/:id", async ({ sql, params, body }) => {
  const t = TABLES[params.kind]; need(t, "Noto‘g‘ri tur", 404);
  const [r] = await sql`update ${sql(t)} set receipt = ${receipt(sql, body.receipt)} where id = ${int(params.id)} returning *`;
  need(r, "Yozuv topilmadi", 404); return r;
}, { roles: FINANCE });
route("DELETE", "/finance/:kind/:id", async ({ sql, params }) => {
  const t = TABLES[params.kind]; need(t, "Noto‘g‘ri tur", 404);
  await sql`delete from ${sql(t)} where id = ${int(params.id)}`;
}, { roles: ["owner"] });

/** Debt per active student: monthly fee × months since joining (up to the current month) minus what was paid. */
route("GET", "/finance/debts", async ({ sql }) => {
  const cur = curMonth();
  const rows = await sql`select s.id, s.first_name, s.last_name, s.monthly_fee, s.joined_on, c.name as class_name, p.name as parent_name, p.phone as parent_phone,
      coalesce((select sum(amount) from payments x where x.student_id = s.id), 0)::bigint as paid,
      (select max(month) from payments x where x.student_id = s.id) as last_month
    from students s left join classes c on c.id = s.class_id left join users p on p.id = s.parent_id
    where s.status = 'active' and s.monthly_fee > 0`;
  const out = [];
  for (const r of rows) {
    const start = (r.joined_on || today()).slice(0, 7);
    let months = 0; for (let m = start; m <= cur; m = monthShift(m, 1)) months++;
    const due = months * r.monthly_fee, debt = due - Number(r.paid);
    if (debt > 0) out.push({ ...r, paid: Number(r.paid), due, debt, monthsOwed: Math.ceil(debt / r.monthly_fee) });
  }
  return out.sort((a, b) => b.debt - a.debt);
}, { roles: ADMINS });

/** Month-by-month figures: income (cash received), salaries, expenses by category, students and teachers. */
export async function monthReports(sql, from, to) {
  const cats = (await getSettings(sql)).expenseCategories;
  const inc = await sql`select ${sql.unsafe(monthOf("paid_at"))} as m, sum(amount)::bigint as v from payments group by 1`;
  const sal = await sql`select month as m, sum(amount)::bigint as v from salaries group by 1`;
  const exp = await sql`select month as m, category, sum(amount)::bigint as v from expenses group by 1, 2`;
  const stu = await sql`select joined_on, left_on from students`;
  const tch = await sql`select created_at, active from users where role = 'teacher'`;
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
route("GET", "/reports/months", async ({ sql, query }) => {
  const to = isMonth(query.to) ? query.to : curMonth(), from = isMonth(query.from) ? query.from : monthShift(to, -11);
  need(from <= to, "Oraliq noto‘g‘ri");
  return monthReports(sql, from, to);
}, { roles: FINANCE });

/* ---------- bank payment order reading (needs ANTHROPIC_API_KEY) ---------- */
route("POST", "/finance/extract", async ({ sql, body }) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) fail(501, "ANTHROPIC_API_KEY sozlanmagan");
  need(/^[0-9a-f-]{36}$/.test(body.file_id || ""), "Fayl tanlanmagan");
  const f = await readFileRow(sql, body.file_id); need(f, "Fayl topilmadi", 404);
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
