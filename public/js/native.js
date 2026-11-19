// Native features for the iOS/Android apps (Capacitor). Does nothing in a normal browser.
import { S, render, native, toast, closeModal } from "./core.js";

const C = window.Capacitor;
if (native.isApp && C) {
  const P = C.Plugins || {};
  const platform = C.getPlatform ? C.getPlatform() : "";
  document.documentElement.classList.add("native", platform);

  // status bar: dark text on the light app background
  try { P.StatusBar?.setStyle({ style: "LIGHT" }); if (platform === "android") { P.StatusBar?.setOverlaysWebView({ overlay: false }); P.StatusBar?.setBackgroundColor({ color: "#F5F8F6" }); } } catch {}
  // keyboard: resize the web view instead of zooming/panning
  try { P.Keyboard?.setResizeMode?.({ mode: "native" }); P.Keyboard?.setAccessoryBarVisible?.({ isVisible: true }); } catch {}
  // hide the splash once the first screen is drawn
  setTimeout(() => { try { P.SplashScreen?.hide(); } catch {} }, 350);

  // Android back button: close sheet → go back → leave the app from the home screen
  P.App?.addListener?.("backButton", () => {
    if (S.modal || S.more) { S.modal = null; S.more = false; render(); return; }
    const h = location.hash.replace("#", "");
    if (h && !["home", "today", ""].includes(h)) history.back(); else P.App.exitApp();
  });
  // coming back to the app: refresh notifications count quickly
  P.App?.addListener?.("resume", () => { document.dispatchEvent(new Event("visibilitychange")); });

  // light haptic tap on primary controls
  native.haptic = (style = "LIGHT") => { try { P.Haptics?.impact({ style }); } catch {} };
  document.addEventListener("click", (e) => { if (e.target.closest(".tab, .btn, .seg button, .tog button, .starpick button")) native.haptic(); }, { passive: true });

  // files and PDFs: save to the device cache, then open the system share sheet (Files, Telegram, print…)
  const toBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  native.save = async (blob, name) => {
    try {
      const safe = String(name || "fayl").replace(/[^\w.\-]+/g, "_");
      const res = await P.Filesystem.writeFile({ path: safe, data: await toBase64(blob), directory: "CACHE" });
      await P.Share.share({ title: safe, url: res.uri, dialogTitle: "Saqlash yoki yuborish" });
    } catch (e) { if (!/cancel/i.test(String(e?.message || e))) toast("Faylni ochib bo‘lmadi"); }
  };
  void closeModal;
}
