// Load or clear demo data from the command line:  npm run demo   |   npm run demo -- clear
// Refuses in production unless ALLOW_DEMO=1. Prints the demo logins.
import { existsSync, readFileSync } from "node:fs";
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { db } = await import("../lib/db.js");
const { demoAllowed } = await import("../lib/http.js");
const admin = await import("../lib/routes/admin.js");
const ROLE = { owner: "Bosh admin", manager: "Menejer", accountant: "Buxgalter", teacher: "O‘qituvchi", parent: "Ota-ona" };
const sql = await db();
try {
  if (process.argv[2] === "clear") { await admin.clearDemo(sql); console.log("Demo ma’lumotlar o‘chirildi."); }
  else {
    if (!demoAllowed()) { console.error("Production rejimida demo o‘chirilgan. Sinov serverida ALLOW_DEMO=1 qo‘ying."); process.exit(1); }
    const [{ n }] = await sql`select count(*)::int as n from users where demo`;
    if (n === 0) await admin.loadDemo(sql); else console.log("Demo ma’lumotlar allaqachon yuklangan.");
    console.log(`\nDemo loginlar (parol hammasida: ${admin.DEMO_PASSWORD})`);
    for (const a of admin.DEMO_ACCOUNTS) console.log(`  ${ROLE[a.role].padEnd(11)} ${a.phone}  ${a.note}`);
  }
} finally { await sql.end({ timeout: 2 }); }
