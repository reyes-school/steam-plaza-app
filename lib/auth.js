import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pass), salt, 32);
  return `s1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(pass, stored) {
  const [v, salt, key] = String(stored || "").split("$");
  if (v !== "s1" || !salt || !key) return false;
  const got = await scrypt(String(pass), Buffer.from(salt, "base64"), 32);
  const want = Buffer.from(key, "base64");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw Object.assign(new Error("SESSION_SECRET sozlanmagan (kamida 32 belgi)"), { status: 500, expose: true });
  return s;
}
const b64u = (b) => Buffer.from(b).toString("base64url");
const TTL = 1000 * 60 * 60 * 24 * (Number(process.env.SESSION_DAYS) || 30);

export function signToken(user) {
  const body = b64u(JSON.stringify({ uid: user.id, role: user.role, tv: user.token_version || 0, iat: Date.now() }));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 1000) return null;
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.uid || Date.now() - p.iat > TTL) return null;
    return p;
  } catch { return null; }
}

/** Password rules for new passwords: at least 8 characters, letters and digits, not a trivial sequence. */
export function passwordProblem(pass) {
  const p = String(pass || "");
  if (p.length < 8) return "Parol kamida 8 belgi bo‘lsin";
  if (p.length > 200) return "Parol juda uzun";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Parolda harf va raqam bo‘lsin";
  if (/^(12345678|password|qwerty|11111111|00000000|parol123)/i.test(p)) return "Bu parol juda oddiy";
  return null;
}
