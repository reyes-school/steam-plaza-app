// Browser notifications for the website: Web Push through the service worker (works when the tab is closed),
// plus a fallback for the open tab when push is unavailable. Not used inside the iOS/Android apps.
import { S, api, post, render, toast, invalidate, native, beforeLogout } from "./core.js";

const SUPPORTED = !native.isApp && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
export const pushState = () => (!SUPPORTED ? "unsupported" : Notification.permission === "denied" ? "denied" : S.pushOn ? "on" : "off");

const b64ToBytes = (b64) => { const p = "=".repeat((4 - (b64.length % 4)) % 4); const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
let reg = null;
async function registration() {
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return reg;
}

/** Called after login: re-sends an existing subscription (keeps the server list fresh). Never asks for permission. */
export async function initPush() {
  if (!SUPPORTED || !S.me) return;
  try {
    const r = await registration();
    const sub = await r.pushManager.getSubscription();
    S.pushOn = !!sub && Notification.permission === "granted";
    if (S.pushOn) await post("/push/subscribe", { subscription: sub.toJSON() });
  } catch { S.pushOn = false; }
}

export async function enablePush() {
  if (!SUPPORTED) return toast("Bu brauzer bildirishnomalarni qo‘llamaydi. iPhone’da saytni “Bosh ekranga qo‘shish” orqali oching.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { render(); return toast("Bildirishnomalarga ruxsat berilmadi. Brauzer sozlamalaridan yoqing."); }
  try {
    const { publicKey } = await api("/push/key");
    if (!publicKey) throw new Error("Serverda push o‘chirilgan");
    const r = await registration();
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await post("/push/subscribe", { subscription: sub.toJSON() });
    S.pushOn = true; render();
    toast("Bildirishnomalar yoqildi");
  } catch (e) {
    toast(e?.name === "NotAllowedError" || e?.name === "AbortError" ? "Bildirishnomalarni yoqib bo‘lmadi: brauzer ruxsat bermadi (inkognito oynada ishlamaydi)" : e?.status ? e.message : "Bildirishnomalarni yoqib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring.");
  }
}

export async function disablePush() {
  try {
    const r = await registration(); const sub = await r.pushManager.getSubscription();
    if (sub) { await post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* ignore */ }
  S.pushOn = false; render(); toast("Bildirishnomalar o‘chirildi");
}

/** Fallback while the tab is open but push is off: a system notification when unread count grows and the tab is hidden. */
export function localNotify(items, prevUnread) {
  if (!SUPPORTED || S.pushOn || Notification.permission !== "granted" || !document.hidden) return;
  const fresh = items.filter((x) => !x.read).slice(0, Math.max(0, Math.min(3, items.filter((x) => !x.read).length - prevUnread)));
  for (const x of fresh) { try { const n = new Notification(x.title, { body: x.body || "", icon: "/icon-192.png", tag: "sp-" + x.id }); n.onclick = () => { window.focus(); if (x.link) location.hash = x.link.replace(/^#/, ""); n.close(); }; } catch { /* some browsers only allow SW notifications */ } }
}

// on logout this browser stops receiving the user's notifications
beforeLogout.push(async () => {
  if (!SUPPORTED || !reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); post("/push/unsubscribe", { endpoint: ep }).catch(() => {}); }
  S.pushOn = false;
});

// messages from the service worker: refresh the bell when a push arrives, open a page when a notification is tapped
if (SUPPORTED) navigator.serviceWorker.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type === "push" && S.me) { S.me.unread = (S.me.unread || 0) + 1; invalidate("/notifications"); if (!document.hidden && m.data?.title) toast(m.data.title); render(); }
  if (m.type === "open" && m.link) location.hash = m.link.replace(/^#/, "");
});
