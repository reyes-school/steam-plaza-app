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
  if (s.length < 16) throw Object.assign(new Error("SESSION_SECRET sozlanmagan (kamida 16 belgi)"), { status: 500, expose: true });
  return s;
}
const b64u = (b) => Buffer.from(b).toString("base64url");
const TTL = 1000 * 60 * 60 * 24 * 30;

export function signToken(user) {
  const body = b64u(JSON.stringify({ uid: user.id, role: user.role, iat: Date.now() }));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.uid || Date.now() - p.iat > TTL) return null;
    return p;
  } catch { return null; }
}
