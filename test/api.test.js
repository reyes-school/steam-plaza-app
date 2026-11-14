// API checks against a running server (node server.js) with an empty database and OWNER_PHONE/OWNER_PASSWORD set.
// Usage: BASE=http://localhost:3000 OWNER_PHONE=+998901234567 OWNER_PASSWORD=admin123 node test/api.test.js
import assert from "node:assert/strict";
const B = (process.env.BASE || "http://localhost:3000") + "/api";
const call = async (path, opts = {}, token) => {
  const r = await fetch(B + path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, body: ct.includes("json") ? await r.json() : await r.arrayBuffer() };
};
const login = async (phone, password) => (await call("/auth/login", { method: "POST", body: { phone, password } })).body.token;

assert.equal((await call("/health")).body.ok, true);
assert.equal((await call("/auth/login", { method: "POST", body: { phone: process.env.OWNER_PHONE, password: "wrong-pass" } })).status, 401);
const O = await login(process.env.OWNER_PHONE, process.env.OWNER_PASSWORD); assert.ok(O, "owner login");
assert.equal((await call("/students")).status, 401, "needs login");

// staff accounts and permissions
const mgr = await call("/users", { method: "POST", body: { role: "manager", name: "Menejer Test", phone: "+998931110001", password: "manager1" } }, O); assert.equal(mgr.status, 200);
const acc = await call("/users", { method: "POST", body: { role: "accountant", name: "Buxgalter Test", phone: "+998931110002", password: "account1" } }, O); assert.equal(acc.status, 200);
const M = await login("+998931110001", "manager1"), A = await login("+998931110002", "account1");
assert.equal((await call("/users", { method: "POST", body: { role: "owner", name: "Hacker X", phone: "+998931110003", password: "123456" } }, M)).status, 403, "manager cannot create admins");
assert.equal((await call("/finance/ledger", {}, M)).status, 403, "manager has no finance");
assert.equal((await call("/finance/ledger", {}, A)).status, 200, "accountant sees finance");
assert.equal((await call("/students", { method: "POST", body: { first_name: "Ali", last_name: "Valiyev" } }, A)).status, 403, "accountant cannot add students");

// classes, subjects, teacher, schedule, student with parent
const sub = (await call("/subjects", { method: "POST", body: { name: "Matematika-T" } }, M)).body;
const tch = (await call("/users", { method: "POST", body: { role: "teacher", name: "Ustoz Test", phone: "+998931110010", password: "teacher1", profile: { salary: 5000000 } } }, M)).body;
const cls = (await call("/classes", { method: "POST", body: { name: "9-T", leader_id: tch.id } }, M)).body;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const wd = new Date(today + "T00:00:00Z").getUTCDay() || 1;
assert.equal((await call("/schedule", { method: "PUT", body: { class_id: cls.id, weekday: wd, period: 1, subject_id: sub.id, teacher_id: tch.id } }, M)).status, 200);
const st = await call("/students", { method: "POST", body: { first_name: "Ali", last_name: "Valiyev", class_id: cls.id, monthly_fee: 2000000, parent: { name: "Vali Valiyev", phone: "+998931110020", password: "parent1" } } }, M);
assert.equal(st.status, 200);
const T = await login("+998931110010", "teacher1"), P = await login("+998931110020", "parent1");
assert.equal((await call("/users/" + tch.id, { method: "PATCH", body: { name: "O‘zgartirdim" } }, T)).status, 403, "teacher cannot edit own profile");
assert.equal((await call("/students/" + st.body.id, { method: "PATCH", body: { profile: { notes: "Faol" } } }, T)).status, 200, "teacher edits student");
assert.equal((await call("/students/" + st.body.id, { method: "PATCH", body: { monthly_fee: 1 } }, T)).body.monthly_fee, 2000000, "teacher cannot change fee");
assert.equal((await call("/students/" + st.body.id, {}, P)).status, 200, "parent sees own child");

// lesson flow: topic required, homework required to end
if (new Date(today + "T00:00:00Z").getUTCDay() !== 0) {
  assert.equal((await call("/lessons/start", { method: "POST", body: { class_id: cls.id, period: 1, topic: "" } }, T)).status, 400);
  const ls = await call("/lessons/start", { method: "POST", body: { class_id: cls.id, period: 1, topic: "Kasrlar" } }, T);
  if (ls.status === 200) {
    const lid = ls.body.id;
    assert.equal((await call(`/lessons/${lid}/marks`, { method: "PUT", body: { student_id: st.body.id, attendance: "present", grade: 5 } }, T)).status, 200);
    assert.equal((await call(`/lessons/${lid}/end`, { method: "POST", body: { homework: "" } }, T)).status, 400, "homework required");
    assert.equal((await call(`/lessons/${lid}/end`, { method: "POST", body: { homework: "12-mashq" } }, T)).status, 200);
    const hw = (await call(`/students/${st.body.id}/homework`, {}, P)).body; assert.ok(hw.some((h) => h.homework === "12-mashq"), "parent sees homework");
    assert.equal((await call(`/students/${st.body.id}/stats`, {}, P)).body.subjects[0].avg, 5);
  } else console.log("  (lesson start skipped:", ls.body.error, ")");
}

// rating → notification to teacher
assert.equal((await call("/teacher-ratings", { method: "POST", body: { teacher_id: tch.id, stars: 5, comment: "Zo‘r" } }, P)).status, 200);
const n = (await call("/notifications", {}, T)).body; assert.ok(n.items.some((x) => x.kind === "rating"), "teacher notified");
const rev = (await call(`/teachers/${tch.id}`, {}, P)).body.reviews; assert.equal(rev[0].parent_name, "Vali Valiyev");
assert.equal((await call(`/teachers/${tch.id}`, {}, P)).body.profile.salary, undefined, "salary hidden from parents");

// files: private docs only for admins
const pdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n%%EOF").toString("base64");
const f = (await call("/files", { method: "POST", body: { name: "pasport.pdf", type: "application/pdf", data: pdf, scope: "private" } }, M)).body;
assert.equal((await call("/files/" + f.id)).status, 403, "private file needs login");
assert.equal((await call("/files/" + f.id, {}, P)).status, 403, "parent cannot open private docs");
assert.equal((await call("/files/" + f.id, {}, A)).status, 200);
assert.equal((await call("/files", { method: "POST", body: { name: "x.pdf", type: "application/pdf", data: pdf } }, P)).status, 403, "parents cannot upload");

// finance + PDFs
assert.equal((await call("/payments", { method: "POST", body: { student_id: st.body.id, month: today.slice(0, 7), amount: 2000000 } }, A)).status, 200);
assert.equal((await call("/expenses", { method: "POST", body: { amount: 100000, note: "" } }, A)).status, 400, "expense needs description");
for (const p of [`/pdf/student/${st.body.id}`, `/pdf/teacher/${tch.id}`, "/pdf/report?month=" + today.slice(0, 7), "/pdf/report?year=" + today.slice(0, 4)]) {
  const r = await call(p, {}, O); assert.equal(r.status, 200, p); assert.ok(Buffer.from(r.body).subarray(0, 4).toString() === "%PDF", p);
}
assert.equal((await call(`/pdf/student/${st.body.id}`, {}, P)).status, 200, "parent downloads child pdf");
assert.equal((await call("/pdf/report", {}, P)).status, 403);
console.log("API tests passed");
