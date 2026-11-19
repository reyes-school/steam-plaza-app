// Web Push (browser notifications even when the site is closed): Chrome, Edge, Firefox, Safari 16.4+ (iPhone: from the home-screen app).
// VAPID keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env, otherwise generated once and kept (encrypted) in the settings table.
import { sealStr, openStr } from "./crypto.js";

let wp, vapid;
async function lib() { if (wp === undefined) { try { wp = await import("web-push"); } catch { wp = null; console.warn("web-push topilmadi: push bildirishnomalar o‘chiq"); } } return wp; }

export async function vapidKeys(sql) {
  if (vapid) return vapid;
  const W = await lib(); if (!W) return null;
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const [row] = await sql`select value from settings where key = 'vapid'`;
    if (row?.value?.publicKey) { pub = row.value.publicKey; priv = openStr(row.value.privateKey); }
    else {
      const k = W.generateVAPIDKeys();
      await sql`insert into settings (key, value) values ('vapid', ${sql.json({ publicKey: k.publicKey, privateKey: sealStr(k.privateKey) })}) on conflict (key) do nothing`;
      const [again] = await sql`select value from settings where key = 'vapid'`;
      pub = again.value.publicKey; priv = openStr(again.value.privateKey);
    }
  }
  vapid = { publicKey: pub, privateKey: priv, subject: process.env.VAPID_SUBJECT || "mailto:admin@steamplaza.uz" };
  return vapid;
}

/** Sends one push per subscription of the given users; dead subscriptions are removed. Never throws. */
export async function pushTo(sql, userIds, n) {
  try {
    if (!userIds.length) return;
    const W = await lib(); const k = W && (await vapidKeys(sql)); if (!k) return;
    const subs = await sql`select id, endpoint, keys from push_subs where user_id = any(${userIds}::int[])`;
    if (!subs.length) return;
    const payload = JSON.stringify({ title: n.title, body: n.body || "", link: n.link || "", kind: n.kind || "" });
    const opts = { vapidDetails: k, TTL: 24 * 3600, timeout: 5000, urgency: "normal" };
    const dead = [];
    await Promise.allSettled(subs.map((s) => W.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, opts).catch((e) => {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id);
      else console.warn("push failed", e?.statusCode || e?.message);
    })));
    if (dead.length) await sql`delete from push_subs where id = any(${dead}::int[])`;
    await sql`update push_subs set last_ok = now() where id = any(${subs.map((s) => s.id).filter((id) => !dead.includes(id))}::int[])`;
  } catch (e) { console.warn("push error", e?.message || e); }
}
