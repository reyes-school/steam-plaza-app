// Encryption at rest (AES-256-GCM) for uploaded files and sensitive profile fields.
// Key: DATA_KEY (64 hex chars, or base64 of 32 bytes, or any string of 32+ characters).
// Without DATA_KEY the key is derived from SESSION_SECRET (works, but then SESSION_SECRET must never change).
// DATA_KEY_OLD may hold a previous key: data written with it still opens while you re-encrypt.
import crypto from "node:crypto";

const FILE_MAGIC = Buffer.from("SPE1");
const STR_PREFIX = "enc:v1:";
/** Profile keys that are stored encrypted (personal data: documents, address, health, phones, birth data). */
export const SECRET_KEYS = ["passport", "address", "health", "notes", "phone", "phone2", "birthPlace", "birthDate", "certificate", "workplace"];

function parseKey(v) {
  v = String(v || "").trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(v)) { const b = Buffer.from(v, "base64"); if (b.length === 32) return b; }
  if (v.length >= 32) return crypto.createHash("sha256").update(v).digest();
  return null;
}
let cache = null;
function keys() {
  const sig = `${process.env.DATA_KEY || ""}|${process.env.DATA_KEY_OLD || ""}|${process.env.SESSION_SECRET || ""}`;
  if (cache && cache.sig === sig) return cache.list;
  const list = [];
  const main = parseKey(process.env.DATA_KEY);
  if (main) list.push(main);
  const old = parseKey(process.env.DATA_KEY_OLD);
  if (old) list.push(old);
  const ss = process.env.SESSION_SECRET || "";
  if (ss.length >= 16) list.push(Buffer.from(crypto.hkdfSync("sha256", ss, "steamplaza", "data-at-rest-v1", 32)));
  cache = { sig, list };
  return list;
}
/** true when a dedicated DATA_KEY is configured (health check warns otherwise in production). */
export const hasDataKey = () => !!parseKey(process.env.DATA_KEY);
export const cryptoReady = () => keys().length > 0;

function seal(buf) {
  const key = keys()[0];
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
function open(box) {
  const iv = box.subarray(0, 12), tag = box.subarray(12, 28), ct = box.subarray(28);
  for (const key of keys()) {
    try {
      const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]);
    } catch { /* try the next key */ }
  }
  throw new Error("decrypt failed");
}

/* ---------- files ---------- */
export const isSealedFile = (b) => Buffer.isBuffer(b) && b.length > 32 && b.subarray(0, 4).equals(FILE_MAGIC);
/** File bytes → encrypted bytes (unchanged when no key is available). */
export function sealFile(buf) {
  if (isSealedFile(buf)) return buf;
  const box = seal(buf);
  return box ? Buffer.concat([FILE_MAGIC, box]) : buf;
}
/** Encrypted or old plain file bytes → plain bytes. */
export function openFile(buf) {
  buf = Buffer.from(buf);
  return isSealedFile(buf) ? open(buf.subarray(4)) : buf;
}

/* ---------- strings ---------- */
export const isSealed = (v) => typeof v === "string" && v.startsWith(STR_PREFIX);
export function sealStr(v) {
  if (typeof v !== "string" || v === "" || isSealed(v)) return v;
  const box = seal(Buffer.from(v, "utf8"));
  return box ? STR_PREFIX + box.toString("base64url") : v;
}
let warned = false;
export function openStr(v) {
  if (!isSealed(v)) return v;
  try { return open(Buffer.from(v.slice(STR_PREFIX.length), "base64url")).toString("utf8"); }
  catch { if (!warned) { warned = true; console.error("DATA_KEY: shifrlangan maydonni ochib bo‘lmadi (kalit o‘zgarganmi?)"); } return "🔒"; }
}
/** Encrypts the sensitive keys of a profile object (already encrypted values stay as they are). */
export function sealProfile(p) {
  if (!p || typeof p !== "object") return p;
  const o = { ...p };
  for (const k of SECRET_KEYS) if (typeof o[k] === "string" && o[k]) o[k] = sealStr(o[k]);
  return o;
}
/** Deep copy with every encrypted string opened. Used on API responses and in PDF exports. */
export function openDeep(v, depth = 0) {
  if (typeof v === "string") return isSealed(v) ? openStr(v) : v;
  if (!v || typeof v !== "object" || depth > 12 || Buffer.isBuffer(v) || v instanceof Date) return v;
  if (Array.isArray(v)) { let out = null; for (let i = 0; i < v.length; i++) { const x = openDeep(v[i], depth + 1); if (x !== v[i]) { out ||= v.slice(); out[i] = x; } } return out || v; }
  let out = null;
  for (const k of Object.keys(v)) { const x = openDeep(v[k], depth + 1); if (x !== v[k]) { out ||= { ...v }; out[k] = x; } }
  return out || v;
}
