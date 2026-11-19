// Copies the web app (../public) into www/ and points it at the live server from app.config.json.
import { cpSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
const cfg = JSON.parse(readFileSync(new URL("../app.config.json", import.meta.url)));
const api = String(process.env.API_URL || cfg.apiUrl || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(api)) { console.error("app.config.json: apiUrl https:// bilan boshlanishi kerak"); process.exit(1); }
const src = new URL("../../public/", import.meta.url), dst = new URL("../www/", import.meta.url);
if (!existsSync(src)) { console.error("../public topilmadi"); process.exit(1); }
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
writeFileSync(new URL("config.js", dst), `window.SP_CONFIG = { api: ${JSON.stringify(api)} };\n`);
console.log("www tayyor → API:", api);
