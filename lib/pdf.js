// Branded PDF building blocks: logo header, brand colours (green #083F2C, gold #D5A042), tables, bar charts.
import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { toRu } from "../public/js/i18n.js";

const F = (n) => fileURLToPath(new URL(`./fonts/${n}`, import.meta.url));
const LOGO = fileURLToPath(new URL("../public/logo-full.png", import.meta.url));
export const C = { green: "#083F2C", green2: "#1F6B4F", gold: "#D5A042", gold2: "#F3E3BF", ink: "#14231C", muted: "#5D6B64", line: "#DCE3DF", soft: "#F3F6F4", bad: "#B3261E", good: "#1E7B4A", info: "#1F4FA8" };
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const fmtMonth = (ym) => { const [y, m] = ym.split("-").map(Number); const n = MONTHS[m - 1]; return n[0].toUpperCase() + n.slice(1) + " " + y; };
const MONTHS_S = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
export const fmtMonthS = (ym) => MONTHS_S[Number(ym.split("-")[1]) - 1];
export const fmtNum = (n) => (n == null ? "—" : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "));
export const fmtDate = (iso) => { if (!iso) return "—"; const s = typeof iso === "string" ? iso : new Date(iso).toISOString(); const [y, m, d] = s.slice(0, 10).split("-").map(Number); return `${d}-${MONTHS[m - 1]} ${y}`; };
export const fmtAvg = (n) => (n == null ? "—" : Number(n).toFixed(1).replace(".", ","));

export function makeDoc({ title: title0, subtitle: subtitle0, school, lang }) {
  const T = lang === "ru" ? (v) => (typeof v === "string" ? toRu(v) : v) : (v) => v;
  const title = T(title0), subtitle = T(subtitle0);
  const doc = new PDFDocument({ size: "A4", margins: { top: 108, bottom: 56, left: 44, right: 44 }, bufferPages: true, info: { Title: title, Author: school?.name || "Steam Plaza" } });
  doc.registerFont("R", F("nunito-400.ttf"));
  doc.registerFont("B", F("nunito-700.ttf"));
  doc.registerFont("H", F("manrope-800.ttf"));
  const chunks = []; doc.on("data", (c) => chunks.push(c));
  const header = () => {
    const w = doc.page.width;
    doc.save().rect(0, 0, w, 84).fill(C.green).restore();
    doc.save().rect(0, 84, w, 4).fill(C.gold).restore();
    try { doc.save().roundedRect(36, 14, 132, 56, 10).fill("#FFFFFF").restore(); doc.image(LOGO, 44, 19, { fit: [116, 46] }); } catch { /* logo optional */ }
    doc.font("H").fontSize(17).fillColor("#FFFFFF").text(title, 184, 22, { width: w - 228, align: "right" });
    if (subtitle) doc.font("R").fontSize(10).fillColor(C.gold2).text(subtitle, 184, 46, { width: w - 228, align: "right" });
    doc.x = doc.page.margins.left; doc.y = doc.page.margins.top; doc.fillColor(C.ink);
  };
  header();
  doc.on("pageAdded", header);
  const pendingPdfs = [];
  const stamp = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" }).format(new Date());
  const api = {
    doc,
    h2(text) { this.space(70); doc.moveDown(0.6); const y = doc.y; doc.save().rect(doc.page.margins.left, y + 2, 4, 14).fill(C.gold).restore(); doc.font("H").fontSize(13).fillColor(C.green).text(T(text), doc.page.margins.left + 12, y); doc.moveDown(0.4); doc.fillColor(C.ink); doc.x = doc.page.margins.left; },
    p(text, opts = {}) { doc.font(opts.bold ? "B" : "R").fontSize(opts.size || 10).fillColor(opts.color || C.ink).text(T(text), doc.page.margins.left, doc.y, { width: this.width(), ...opts }); },
    width() { return doc.page.width - doc.page.margins.left - doc.page.margins.right; },
    space(h) { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); },
    /** Header card with the profile photo (or initials) and name. photo: Buffer (JPEG/PNG) or null */
    profile({ name, sub: sub0, badges: badges0 = [], photo }) {
      const sub = T(sub0), badges = badges0.map(T);
      this.space(110);
      const x0 = doc.page.margins.left, y = doc.y, W = this.width(), R = 42;
      doc.save().roundedRect(x0, y, W, 100, 12).fill(C.soft).restore();
      doc.save().roundedRect(x0, y, 5, 100, 2).fill(C.gold).restore();
      const cx = x0 + 22 + R, cy = y + 50;
      doc.save().circle(cx, cy, R + 3).fill(C.gold).restore();
      let drawn = false;
      if (photo) { try { doc.save(); doc.circle(cx, cy, R).clip(); doc.image(photo, cx - R, cy - R, { width: R * 2, height: R * 2, cover: [R * 2, R * 2], align: "center", valign: "center" }); doc.restore(); drawn = true; } catch { doc.restore(); } }
      if (!drawn) {
        doc.save().circle(cx, cy, R).fill(C.green).restore();
        const ini = String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
        doc.font("H").fontSize(26).fillColor(C.gold).text(ini, cx - R, cy - 16, { width: R * 2, align: "center" });
      }
      const tx = cx + R + 20;
      doc.font("H").fontSize(18).fillColor(C.green).text(name, tx, y + 22, { width: W - (tx - x0) - 16 });
      if (sub) doc.font("R").fontSize(10.5).fillColor(C.muted).text(sub, tx, doc.y + 2, { width: W - (tx - x0) - 16 });
      if (badges.length) { let bx = tx; const by = doc.y + 6; for (const b of badges) { doc.font("B").fontSize(8.5); const w = doc.widthOfString(b) + 16; doc.save().roundedRect(bx, by, w, 16, 8).fill(C.gold2).restore(); doc.fillColor("#7A5410").text(b, bx + 8, by + 4, { lineBreak: false }); bx += w + 6; } }
      doc.y = y + 112; doc.x = x0; doc.fillColor(C.ink);
    },
    /** Two-column key/value list */
    kv(pairs, cols = 2) {
      const w = this.width() / cols, x0 = doc.page.margins.left;
      const items = pairs.filter((p) => p && p[1] != null && p[1] !== "");
      for (let i = 0; i < items.length; i += cols) {
        this.space(30); const y = doc.y; let h = 0;
        items.slice(i, i + cols).forEach(([k, v], j) => {
          doc.font("R").fontSize(8).fillColor(C.muted).text(T(k).toUpperCase(), x0 + j * w, y, { width: w - 12 });
          doc.font("B").fontSize(10.5).fillColor(C.ink).text(T(String(v)), x0 + j * w, y + 11, { width: w - 12 });
          h = Math.max(h, doc.y - y);
        });
        doc.y = y + h + 6;
      }
      doc.x = x0;
    },
    /** Stat tiles in a row: [{label, value, tone}] */
    tiles(list) {
      this.space(62); const n = list.length, gap = 8, w = (this.width() - gap * (n - 1)) / n, y = doc.y, x0 = doc.page.margins.left;
      list.forEach((t, i) => {
        const x = x0 + i * (w + gap);
        doc.save().roundedRect(x, y, w, 52, 8).fill(t.tone === "gold" ? "#FBF2DF" : t.tone === "bad" ? "#FCEBEB" : C.soft).restore();
        doc.font("R").fontSize(8).fillColor(C.muted).text(T(t.label), x + 10, y + 9, { width: w - 20 });
        doc.font("H").fontSize(14).fillColor(t.tone === "bad" ? C.bad : C.green).text(String(t.value), x + 10, y + 24, { width: w - 20 });
      });
      doc.y = y + 62; doc.x = x0;
    },
    /** cols: [{label, width (fraction), align}], rows: arrays of strings; rowStyle(i,row) -> {color, bold, fill} */
    table(cols0, rows0, { rowStyle, total: total0 } = {}) {
      const cols = cols0.map((c) => ({ ...c, label: T(c.label) })), rows = rows0.map((r) => r.map((v) => T(v))), total = total0 && total0.map((v) => T(v));
      const x0 = doc.page.margins.left, W = this.width();
      const widths = cols.map((c) => c.width * W);
      const drawHead = () => {
        const y = doc.y; doc.save().rect(x0, y, W, 20).fill(C.green).restore();
        let x = x0; cols.forEach((c, i) => { doc.font("B").fontSize(8.5).fillColor("#FFFFFF").text(c.label, x + 6, y + 6, { width: widths[i] - 12, align: c.align || "left" }); x += widths[i]; });
        doc.y = y + 20;
      };
      this.space(44); drawHead();
      rows.forEach((r, ri) => {
        const st = (rowStyle && rowStyle(ri, r)) || {};
        doc.font(st.bold ? "B" : "R").fontSize(9);
        const h = Math.max(18, ...r.map((v, i) => doc.heightOfString(String(v ?? ""), { width: widths[i] - 12 }) + 8));
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) { doc.addPage(); drawHead(); }
        const y = doc.y;
        if (st.fill || ri % 2) doc.save().rect(x0, y, W, h).fill(st.fill || C.soft).restore();
        let x = x0;
        r.forEach((v, i) => { const color = (st.colors && st.colors[i]) || st.color || C.ink; doc.font(st.bold ? "B" : "R").fontSize(9).fillColor(color).text(String(v ?? ""), x + 6, y + 4, { width: widths[i] - 12, align: cols[i].align || "left" }); x += widths[i]; });
        doc.y = y + h;
      });
      if (total) { const y = doc.y; doc.save().rect(x0, y, W, 20).fill(C.gold2).restore(); let x = x0; total.forEach((v, i) => { doc.font("B").fontSize(9).fillColor(C.ink).text(String(v ?? ""), x + 6, y + 6, { width: widths[i] - 12, align: cols[i].align || "left" }); x += widths[i]; }); doc.y = y + 22; }
      doc.moveDown(0.3); doc.x = x0;
    },
    /** Grouped vertical bars. groups: [{label, values: [n...]}], series: [{name, color}] */
    bars(groups0, series0, { height = 150, format = (v) => fmtNum(v / 1e6) } = {}) {
      const groups = groups0.map((g) => ({ ...g, label: T(g.label) })), series = series0.map((x) => ({ ...x, name: T(x.name) }));
      this.space(height + 40);
      const x0 = doc.page.margins.left + 34, W = this.width() - 34, y0 = doc.y + 6, H = height;
      const max = Math.max(1, ...groups.flatMap((g) => g.values.map((v) => Math.max(0, v))));
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const y = y0 + H - (H * i) / steps;
        doc.save().moveTo(x0, y).lineTo(x0 + W, y).lineWidth(0.5).strokeColor(C.line).stroke().restore();
        doc.font("R").fontSize(7).fillColor(C.muted).text(format((max * i) / steps), x0 - 34, y - 4, { width: 30, align: "right" });
      }
      const gw = W / groups.length, bw = Math.min(16, (gw * 0.7) / series.length);
      groups.forEach((g, gi) => {
        const gx = x0 + gi * gw + (gw - bw * series.length) / 2;
        g.values.forEach((v, si) => { const h = (Math.max(0, v) / max) * H; doc.save().rect(gx + si * bw, y0 + H - h, bw - 2, h).fill(series[si].color).restore(); });
        doc.font("R").fontSize(7).fillColor(C.muted).text(g.label, x0 + gi * gw, y0 + H + 4, { width: gw, align: "center" });
      });
      let lx = doc.page.margins.left; const ly = y0 + H + 18;
      series.forEach((s) => { doc.save().rect(lx, ly + 2, 8, 8).fill(s.color).restore(); doc.font("R").fontSize(8).fillColor(C.ink).text(s.name, lx + 12, ly, { lineBreak: false }); lx += doc.widthOfString(s.name) + 28; });
      doc.y = ly + 18; doc.x = doc.page.margins.left;
    },
    /** Horizontal bar per item (e.g. subject averages 0..5) */
    hbars(items, { max = 5, format = fmtAvg } = {}) {
      const x0 = doc.page.margins.left, W = this.width(), lw = 150, bw = W - lw - 50;
      for (const it of items) {
        this.space(20); const y = doc.y;
        doc.font("R").fontSize(9).fillColor(C.ink).text(T(it.label), x0, y + 2, { width: lw - 8, ellipsis: true, lineBreak: false });
        doc.save().roundedRect(x0 + lw, y + 3, bw, 9, 4).fill(C.soft).restore();
        const v = Math.max(0, Math.min(max, it.value || 0));
        doc.save().roundedRect(x0 + lw, y + 3, (bw * v) / max, 9, 4).fill(it.color || (v >= 4.5 ? C.green : v >= 3.5 ? C.green2 : v >= 3 ? C.gold : C.bad)).restore();
        doc.font("B").fontSize(9).fillColor(C.ink).text(format(it.value), x0 + lw + bw + 8, y + 1, { width: 42 });
        doc.y = y + 18;
      }
      doc.x = x0;
    },
    /**
     * Uploaded documents: a list with "Ilova N", then every photo/scan on its own page;
     * PDF documents are appended after the report in done(). items come from loadAttachments().
     */
    attachments(items, { heading = "Yuklangan hujjatlar", note = {}, date = (v) => v } = {}) {
      if (!items.length) return;
      this.h2(heading);
      this.table([{ label: "Ilova", width: 0.1, align: "center" }, { label: "Hujjat", width: 0.28 }, { label: "Fayl", width: 0.3 }, { label: "Sana", width: 0.14 }, { label: "Holati", width: 0.18 }],
        items.map((it) => [it.no ? String(it.no) : "—", it.title, it.name, date(it.date), it.status === "pdf" ? `${it.pages}${it.total > it.pages ? "/" + it.total : ""} bet, PDF ichida` : (note[it.status] || "") + (it.reason ? ` (${it.reason})` : "")]),
        { rowStyle: (i) => ({ colors: { 4: ["image", "pdf"].includes(items[i].status) ? C.good : C.muted } }) });
      const imgs = items.filter((it) => it.status === "image");
      if (imgs.length || items.some((it) => it.status === "pdf")) this.p("Hujjatlarning o‘zi keyingi sahifalarda “Ilova” raqami bilan berilgan.", { size: 8.5, color: C.muted });
      for (const it of imgs) {
        doc.addPage();
        const x0 = doc.page.margins.left;
        doc.font("H").fontSize(13).fillColor(C.green).text(T(`Ilova ${it.no}. ${it.title}`), x0, doc.y, { width: this.width() });
        doc.font("R").fontSize(9).fillColor(C.muted).text(`${it.name} · ${date(it.date)}`, x0, doc.y + 2, { width: this.width() });
        const top = doc.y + 10, H = doc.page.height - doc.page.margins.bottom - top - 6;
        try { doc.image(it.img, x0, top, { fit: [this.width(), H], align: "center", valign: "top" }); } catch { doc.font("R").fontSize(10).fillColor(C.bad).text(T("Rasmni chizib bo‘lmadi"), x0, top); }
        doc.x = x0; doc.y = doc.page.height - doc.page.margins.bottom - 4;
      }
      pendingPdfs.push(...items.filter((it) => it.status === "pdf"));
    },
    async done() {
      const range = doc.bufferedPageRange();
      const extra = pendingPdfs.reduce((a, it) => a + it.pages, 0), total = range.count + extra;
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
        const y = doc.page.height - 38, w = doc.page.width;
        doc.save().moveTo(44, y - 6).lineTo(w - 44, y - 6).lineWidth(0.5).strokeColor(C.line).stroke().restore();
        doc.font("R").fontSize(8).fillColor(C.muted).text(`${school?.name || "Steam Plaza"}${school?.phone ? " · " + school.phone : ""}${school?.address ? " · " + school.address : ""}`, 44, y, { width: w - 200, lineBreak: false });
        doc.text(`${stamp} · ${i + 1}/${total}`, w - 200, y, { width: 156, align: "right", lineBreak: false });
        doc.page.margins.bottom = mb;
      }
      const base = await new Promise((res) => { doc.on("end", () => res(Buffer.concat(chunks))); doc.end(); });
      if (!pendingPdfs.length) return base;
      return appendPdfs(base, pendingPdfs, { T, first: range.count, total });
    },
  };
  return api;
}

/** Appends attached PDF documents after the report; each page gets a small "Ilova N" label and page number. */
async function appendPdfs(base, items, { T, first, total }) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const { readFile } = await import("node:fs/promises");
  const out = await PDFDocument.load(base);
  out.registerFontkit(fontkit);
  const font = await out.embedFont(await readFile(F("nunito-400.ttf")), { subset: true });
  let pageNo = first;
  for (const it of items) {
    let copied;
    try { copied = await out.copyPages(it.pdf, [...Array(it.pages).keys()]); } catch { continue; }
    copied.forEach((pg, k) => {
      out.addPage(pg); pageNo++;
      if ((pg.getRotation().angle || 0) % 360 !== 0) return;
      const box = pg.getCropBox();
      const label = `${T(`Ilova ${it.no}. ${it.title}`)} · ${it.name} · ${k + 1}/${it.pages}`.slice(0, 140);
      const size = 7.5, w = Math.min(box.width - 16, font.widthOfTextAtSize(label, size) + font.widthOfTextAtSize(`   ${pageNo}/${total}`, size) + 12);
      pg.drawRectangle({ x: box.x + 8, y: box.y + 6, width: w, height: 14, color: rgb(1, 1, 1), opacity: 0.85, borderColor: rgb(0.86, 0.89, 0.87), borderWidth: 0.5 });
      pg.drawText(`${label}   ${pageNo}/${total}`, { x: box.x + 14, y: box.y + 10.5, size, font, color: rgb(0.03, 0.25, 0.17), maxWidth: box.width - 28 });
    });
  }
  return Buffer.from(await out.save({ useObjectStreams: true }));
}

export function sendPdf(res, buf, filename) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", buf.length);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
}
