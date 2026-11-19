// Encrypts files and personal profile fields that were saved before encryption (v4), or re-encrypts with a new key.
//   npm run encrypt              — encrypt everything that is still plain
//   npm run encrypt -- --rekey   — after changing DATA_KEY (old one in DATA_KEY_OLD): re-encrypt everything with the new key
// Take a backup first (deploy/backup.sh).
import { existsSync, readFileSync } from "node:fs";
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { db } = await import("../lib/db.js");
const { resealAll } = await import("../lib/reseal.js");
const { hasDataKey } = await import("../lib/crypto.js");
if (!hasDataKey()) console.warn("Diqqat: DATA_KEY yo‘q, kalit SESSION_SECRET dan olinadi.");
const sql = await db();
try {
  const r = await resealAll(sql, { rekey: process.argv.includes("--rekey"), log: console.warn });
  console.log(`Tayyor: ${r.files} ta fayl va ${r.profiles} ta profil shifrlandi.`);
} finally { await sql.end({ timeout: 2 }); }
