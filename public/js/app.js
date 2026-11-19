// Entry point: event wiring, uploads, polling, boot.
import { S, render, go, api, post, patch, ACTIONS, SUBMITS, setToken, loadMe, logout, toast, closeModal, openModal, retry, uploadFile, download, invalidate, run, parseHash, role, ADMINS, pickFiles, pickAndUpload, fmtLocal, native } from "./core.js";
import "./native.js";
import "./common.js";
import "./admin.js";
import "./teacher.js";
import "./parent.js";
import "./branches.js";
import { initPush, localNotify } from "./push.js";

/* ---------- generic actions ---------- */
Object.assign(ACTIONS, {
  go: (el) => { S.more = false; S.modal = null; go(el.dataset.r); },
  back: () => { if (history.length > 1) history.back(); else go(""); },
  set: (el) => { S.ui[el.dataset.k] = el.dataset.v; const f = ACTIONS["set:" + el.dataset.k]; if (f) f(el); render(); },
  more: () => { S.more = !S.more; render(); },
  "close-more": () => { S.more = false; render(); },
  "close-modal": () => closeModal(),
  logout: () => logout(),
  retry: (el) => retry(el.dataset.k),
  pdf: (el) => download(el.dataset.v, el.dataset.n),
  modal: (el) => openModal({ type: el.dataset.m, id: el.dataset.v ? Number(el.dataset.v) || el.dataset.v : null, extra: el.dataset.x || null }),
  "file-rm": (el) => { const l = S.files[el.dataset.k] || []; l.splice(Number(el.dataset.v), 1); render(); },
  "file-pick": (el) => pickAndUpload(el.dataset.k, { multiple: el.dataset.m === "1", accept: el.dataset.accept }),
  "file-open": async (el) => {
    if (native.save) { try { const blob = await api("/files/" + el.dataset.v); await native.save(blob, el.dataset.n || "hujjat"); } catch (e) { toast(e.message); } return; }
    const w = window.open("", "_blank");
    try { const blob = await api("/files/" + el.dataset.v); const url = URL.createObjectURL(blob); if (w) w.location = url; else location.href = url; }
    catch (e) { if (w) w.close(); toast(e.message); }
  },
  photo: (el) => pickFiles({ multiple: false, accept: "image/*" }).then(async ([file]) => {
    if (!file) return;
    const [kind, id] = el.dataset.k.split(":");
    await run("photo", async () => {
      const meta = await uploadFile(file, { square: 400 });
      if (kind === "student") await patch(`/students/${id}`, { photo: meta });
      else await patch(`/users/${id}`, { photo: meta });
    }, { ok: "Rasm yangilandi", invalidate: ["/students", "/teachers", "/ratings", "/users", "/lessons"] });
    if (kind === "user" && Number(id) === S.me.user.id) await loadMe();
  }),
  bell: async () => {
    openModal({ type: "notifications" });
    invalidate("/notifications");
    if (S.me.unread) { try { await post("/notifications/read", {}); S.me.unread = 0; render(); } catch {} }
  },
  "notif-go": (el) => { closeModal(); if (el.dataset.r) location.hash = el.dataset.r.replace(/^#/, ""); },
});

/* ---------- DOM events ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-a]");
  if (!el) return;
  if (el.classList.contains("overlay") && e.target.closest("[data-stop]")) return;
  if (el.tagName === "A" && !el.dataset.a) return;
  e.preventDefault();
  const fn = ACTIONS[el.dataset.a];
  if (fn) Promise.resolve(fn(el, e)).catch((err) => console.error(err));
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-submit]"); if (!f) return;
  e.preventDefault();
  const fn = SUBMITS[f.dataset.submit];
  if (fn) Promise.resolve(fn(f)).catch((err) => console.error(err));
});
document.addEventListener("input", (e) => {
  const el = e.target; if (!el.dataset?.f) return;
  if (el.dataset.phone) { const v = fmtLocal(el.value); if (v !== el.value) el.value = v; }
  S.f[el.dataset.f] = el.type === "checkbox" ? (el.checked ? "1" : "") : el.value;
  if (el.dataset.live) render();
});
// iOS-style large title: show the compact title in the bar once the page scrolls
addEventListener("scroll", () => document.body.classList.toggle("scrolled", scrollY > 36), { passive: true });
document.addEventListener("change", (e) => {
  const el = e.target; if (!el.dataset?.f) return;
  S.f[el.dataset.f] = el.type === "checkbox" ? (el.checked ? "1" : "") : el.value;
  // date/time inputs are typed segment by segment (day → month → year): re-rendering here would reset them, so only selects and checkboxes re-render
  const fn = ACTIONS["change:" + el.dataset.f];
  if (el.tagName === "SELECT" || el.type === "checkbox") { if (fn) fn(el); render(); }
  else if (fn) fn(el);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (S.modal || S.more)) { S.modal = null; S.more = false; render(); } });
window.addEventListener("hashchange", () => { S.more = false; S.modal = null; render(); window.scrollTo(0, 0); });

/* ---------- live refresh: notifications every 30 s, clock-driven views every 20 s ---------- */
setInterval(async () => {
  if (!S.me || document.hidden) return;
  try { const n = await api("/notifications"); if (n.unread !== S.me.unread) { const prev = S.me.unread || 0; S.me.unread = n.unread; localNotify(n.items, prev); render(); } } catch {}
}, 20000);
// a hidden tab still checks (slower) so the fallback notification can appear
setInterval(async () => {
  if (!S.me || !document.hidden || S.pushOn) return;
  try { const n = await api("/notifications"); if (n.unread > (S.me.unread || 0)) { const prev = S.me.unread || 0; S.me.unread = n.unread; localNotify(n.items, prev); } } catch {}
}, 60000);
setInterval(() => {
  if (!S.me || document.hidden) return;
  const busyTyping = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  const { name } = parseHash();
  if (["home", "today", "lesson", ""].includes(name)) { if (ADMINS.includes(role())) invalidate("/live", "/dashboard"); if (!busyTyping) render(); }
}, 20000);

/* ---------- boot ---------- */
(async function boot() {
  render();
  if (S.token) {
    try { await loadMe(); } catch (e) { if (e.status === 401) setToken(""); else toast("Server bilan aloqa yo‘q. Internetni tekshiring."); }
  }
  render();
  if (S.me) initPush().then(render);
})();
