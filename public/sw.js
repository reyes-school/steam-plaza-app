// Service worker: shows push notifications and opens the right page when one is tapped. No offline caching.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  const title = d.title || "Steam Plaza";
  e.waitUntil((async () => {
    // the open tab shows its own toast; still show a system notification when no tab is focused
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const focused = wins.some((w) => w.focused && w.visibilityState === "visible");
    for (const w of wins) w.postMessage({ type: "push", data: d });
    if (focused) return;
    await self.registration.showNotification(title, { body: d.body || "", icon: "/icon-192.png", badge: "/logo-mark.png", tag: d.kind ? "sp-" + d.kind + "-" + (d.link || "") : undefined, renotify: !!d.kind, data: { link: d.link || "" }, lang: "uz" });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "";
  const url = new URL("/" + (link ? "#" + link.replace(/^#/, "") : ""), self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (new URL(w.url).origin === self.location.origin) { await w.focus(); w.postMessage({ type: "open", link }); return; }
    await self.clients.openWindow(url);
  })());
});
