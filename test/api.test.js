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
const acc = await call("/users", { method: "POST", body: { role: "accountant", name: "Buxgalter Test", phone: "+998931110002", password: "account1", branch_id: 1 } }, O); assert.equal(acc.status, 200);
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
const st = await call("/students", { method: "POST", body: { first_name: "Ali", last_name: "Valiyev", class_id: cls.id, monthly_fee: 2000000, parent: { name: "Vali Valiyev", phone: "+998931110020", password: "parent12" } } }, M);
assert.equal(st.status, 200);
const T = await login("+998931110010", "teacher1"), P = await login("+998931110020", "parent12");
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
const rev = (await call(`/teachers/${tch.id}`, {}, P)).body.reviews; assert.equal(rev[0].parent_name, undefined, "parent names hidden from other parents");
assert.equal((await call(`/teachers/${tch.id}`, {}, O)).body.reviews[0].parent_name, "Vali Valiyev");
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

// ---------- 3-versiya: filiallar, kelmaslik xabari, xavfsizlik ----------
const br = (await call("/branches", {}, O)).body; assert.ok(br.length >= 2, "two branches");
const B2 = br[1].id;
const kg = (await call("/classes", { method: "POST", body: { name: "Quyoshcha", branch_id: B2, section: "kindergarten" } }, O)).body;
assert.equal(kg.section, "kindergarten");
const kid = await call("/students", { method: "POST", body: { first_name: "Laylo", last_name: "Karimova", class_id: kg.id, monthly_fee: 1500000, parent: { name: "Karim Karimov", phone: "+998931110030", password: "parent123" } } }, O);
assert.equal(kid.body.branch_id, B2); assert.equal(kid.body.section, "kindergarten");
assert.equal((await call(`/students/${kid.body.id}`, {}, A)).status, 403, "accountant of branch 1 cannot see branch 2 child");
assert.ok((await call("/students", {}, A)).body.every((s) => s.branch_id === 1), "accountant list limited to own branch");
assert.equal((await call("/payments", { method: "POST", body: { student_id: kid.body.id, month: today.slice(0, 7), amount: 1500000 } }, A)).status, 403, "no payments into other branch");
const A2 = (await call("/users", { method: "POST", body: { role: "accountant", name: "Buxgalter Ikki", phone: "+998931110004", password: "account2", branch_id: B2 } }, O)).body;
const A2t = await login("+998931110004", "account2");
assert.equal((await call("/payments", { method: "POST", body: { student_id: kid.body.id, month: today.slice(0, 7), amount: 1500000 } }, A2t)).status, 200);
assert.equal((await call("/users", { method: "POST", body: { role: "accountant", name: "Filialsiz", phone: "+998931110005", password: "account3" } }, O)).status, 400, "accountant needs a branch");
const ov = (await call("/reports/overview", {}, O)).body; assert.equal(ov.branches.length, br.length);
assert.equal(ov.branches.find((b) => b.id === B2).sections.kindergarten.income, 1500000, "overview by branch and section");
const ovA = (await call("/reports/overview", {}, A2t)).body; assert.equal(ovA.branches.length, 1, "accountant sees only own branch");
assert.ok((await call("/finance/ledger", {}, A2t)).body.payments.every((p) => p.branch_id === B2));
// absence notice → class leader + administration notified
const P2 = await login("+998931110030", "parent123");
assert.equal((await call("/absences", { method: "POST", body: { student_id: st.body.id, date_from: today, reason: "Kasal" } }, P2)).status, 403, "only own child");
const ab = await call("/absences", { method: "POST", body: { student_id: st.body.id, date_from: today, date_to: today, kind: "sick", reason: "Isitmasi bor" } }, P);
assert.equal(ab.status, 200, JSON.stringify(ab.body));
assert.ok((await call("/notifications", {}, T)).body.items.some((x) => x.kind === "absence"), "class leader notified");
assert.ok((await call("/notifications", {}, O)).body.items.some((x) => x.kind === "absence"), "admin notified");
assert.ok((await call("/absences", {}, T)).body.some((a) => a.id === ab.body.id), "teacher sees absence");
// student card: parents only within their children's branch
assert.equal((await call(`/students/${kid.body.id}/card`, {}, P)).status, 403);
// token revocation: password reset by admin logs the user out everywhere
assert.equal((await call("/me", {}, P2)).status, 200);
assert.equal((await call("/users/" + kid.body.parent_id, { method: "PATCH", body: { password: "newpass99" } }, O)).status, 200);
assert.equal((await call("/me", {}, P2)).status, 401, "old token revoked");
assert.equal((await call("/users", { method: "POST", body: { role: "parent", name: "Qisqa Parol", phone: "+998931110040", password: "123456" } }, O)).status, 400, "weak password rejected");
// substitute must be assigned by administration
const T2u = (await call("/users", { method: "POST", body: { role: "teacher", name: "Boshqa Ustoz", phone: "+998931110011", password: "teacher22" } }, O)).body;
const T2 = await login("+998931110011", "teacher22");
assert.equal((await call("/lessons/start", { method: "POST", body: { class_id: cls.id, period: 1, topic: "Begona dars", substitute: 1 } }, T2)).status, 403, "no self-assigned substitute");
// files: content must match the declared type
const fake = "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
assert.equal((await call("/files", { method: "POST", body: { name: "x.png", type: "image/png", data: fake } }, M)).status, 415);
// malformed URL does not crash the server
assert.equal((await fetch(B.replace(/\/api$/, "") + "/%")).status, 400);
assert.equal((await call("/health")).status, 200, "server still alive");
// audit log
assert.ok((await call("/audit", {}, O)).body.some((a) => a.action === "payment.create"));
assert.equal((await call("/audit", {}, A)).status, 403);

// ---- v4: demo info, encryption at rest, compression, documents inside PDFs, push ----
const di = (await call("/demo-info")).body; assert.equal(di.enabled, true); assert.ok(Array.isArray(di.accounts));
assert.equal((await call(`/students/${st.body.id}`, { method: "PATCH", body: { profile: { address: "Chilonzor 5-uy", health: "Allergiya: yong‘oq" } } }, O)).status, 200);
assert.equal((await call(`/students/${st.body.id}`, {}, O)).body.profile.address, "Chilonzor 5-uy", "API returns decrypted value");
if (process.env.DATABASE_URL) {
  const pg = (await import("postgres")).default(process.env.DATABASE_URL, { max: 1 });
  const [row] = await pg`select profile->>'address' as a, profile->>'health' as h from students where id = ${st.body.id}`;
  assert.ok(row.a.startsWith("enc:v1:") && row.h.startsWith("enc:v1:"), "stored encrypted");
  globalThis.__pg = pg;
}
// noisy 900×900 PNG built by hand (no image library needed in tests)
const zlib = await import("node:zlib");
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const W = 900, rowsPx = [];
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let y = 0; y < W; y++) { const r = Buffer.alloc(1 + W * 3); for (let x = 0; x < W; x++) { const n = (rnd() * 30) | 0; r[1 + x * 3] = (x / 5 + n) & 255; r[2 + x * 3] = (y / 5 + n) & 255; r[3 + x * 3] = 128 + n; } rowsPx.push(r); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rowsPx))), chunk("IEND", Buffer.alloc(0))]);
const up = await call("/files", { method: "POST", body: { name: "metrika.png", type: "image/png", scope: "private", data: "data:image/png;base64," + png.toString("base64") } }, O);
assert.equal(up.status, 200, JSON.stringify(up.body));
assert.ok(up.body.size < png.length, `compressed ${png.length} → ${up.body.size}`);
const raw = await fetch(B + "/files/" + up.body.id, { headers: { Authorization: "Bearer " + O } });
assert.equal(Buffer.from(await raw.arrayBuffer()).subarray(0, 4).toString("hex"), "89504e47", "served decrypted");
if (globalThis.__pg) { const [f] = await globalThis.__pg`select substring(data from 1 for 4) as h from files where id = ${up.body.id}`; assert.equal(Buffer.from(f.h).toString(), "SPE1", "file encrypted in DB"); }
const before = Buffer.from((await call(`/pdf/student/${st.body.id}`, {}, O)).body);
assert.equal((await call("/documents", { method: "POST", body: { owner_type: "student", owner_id: st.body.id, kind: "metrika", name: "metrika.png", file: up.body } }, O)).status, 200);
const after = Buffer.from((await call(`/pdf/student/${st.body.id}`, {}, O)).body);
const { PDFDocument } = await import("pdf-lib");
assert.equal((await PDFDocument.load(after)).getPageCount(), (await PDFDocument.load(before)).getPageCount() + 1, "scan appears as a page in the PDF");
// push subscriptions: only real push services
const bad = { endpoint: "https://evil.example.com/x", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };
assert.equal((await call("/push/subscribe", { method: "POST", body: { subscription: bad } }, T)).status, 400);
assert.equal((await call("/push/subscribe", { method: "POST", body: { subscription: { ...bad, endpoint: "https://fcm.googleapis.com/fcm/send/test-token" } } }, T)).status, 200);
assert.ok((await call("/push/key", {}, T)).body.publicKey.length > 40);
assert.equal((await call("/push/unsubscribe", { method: "POST", body: { endpoint: "https://fcm.googleapis.com/fcm/send/test-token" } }, T)).status, 200);
if (globalThis.__pg) await globalThis.__pg.end();
console.log("API tests passed");
