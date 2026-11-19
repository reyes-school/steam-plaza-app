// Encrypts data stored before encryption existed (files and profile fields), or re-encrypts everything with a new DATA_KEY (rekey).
import fs from "node:fs/promises";
import path from "node:path";
import { sealFile, openFile, isSealedFile, sealProfile, openDeep, cryptoReady } from "./crypto.js";

const FILE_DIR = () => process.env.FILE_DIR || "./uploads";

export async function resealAll(sql, { rekey = false, limit = Infinity, log = () => {} } = {}) {
  if (!cryptoReady()) return { files: 0, profiles: 0 };
  let files = 0, profiles = 0, last = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    if (files >= limit) break;
    const rows = await sql`select id, path, (data is not null) as indb from files where id > ${last} order by id limit 50`;
    if (!rows.length) break;
    for (const r of rows) {
      last = r.id;
      try {
        if (r.indb) {
          const [{ data }] = await sql`select data from files where id = ${r.id}`;
          if (isSealedFile(data) && !rekey) continue;
          await sql`update files set data = ${sealFile(openFile(data))} where id = ${r.id}`; files++;
        } else if (r.path) {
          const p = path.join(FILE_DIR(), r.path);
          const data = await fs.readFile(p);
          if (isSealedFile(data) && !rekey) continue;
          await fs.writeFile(p + ".tmp", sealFile(openFile(data))); await fs.rename(p + ".tmp", p); files++;
        }
      } catch (e) { log(`fayl ${r.id}: ${e.message}`); }
    }
  }
  for (const table of ["users", "students"]) {
    const rows = table === "users" ? await sql`select id, profile from users where profile is not null` : await sql`select id, profile from students where profile is not null`;
    for (const r of rows) {
      const plain = openDeep(r.profile || {});
      if (rekey && JSON.stringify(plain).includes("🔒") && !JSON.stringify(r.profile).includes("🔒")) { log(`${table} ${r.id}: kalit mos emas, o‘tkazib yuborildi`); continue; }
      const val = rekey ? sealProfile(plain) : sealProfile(r.profile);
      if (JSON.stringify(val) === JSON.stringify(r.profile)) continue;
      if (table === "users") await sql`update users set profile = ${sql.json(val)} where id = ${r.id}`;
      else await sql`update students set profile = ${sql.json(val)} where id = ${r.id}`;
      profiles++;
    }
  }
  return { files, profiles };
}
