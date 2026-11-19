// Uploaded documents inside profile PDFs: photos/scans become pages, PDF documents are appended page by page.
// Word/Excel files can't be drawn into a PDF, so they are only listed.
import { readFileRow } from "./routes/core.js";

let sharpMod;
async function sharp() { if (sharpMod === undefined) { try { sharpMod = (await import("sharp")).default; } catch { sharpMod = null; } } return sharpMod; }

// Vercel responses are limited to 4.5 MB, so attachments are capped there; on own server 40 MB.
const CAP = () => (Number(process.env.PDF_ATTACH_MAX_MB) || (process.env.VERCEL ? 3.2 : 40)) * 1024 * 1024;
const MAX_PAGES = () => Number(process.env.PDF_ATTACH_MAX_PAGES) || 60;

/** Image → JPEG/PNG buffer small enough for a PDF page (rotated per EXIF), or null. */
async function pageImage(buf, type) {
  const S = await sharp();
  if (!S) return /^image\/(jpeg|png)$/.test(type) ? buf : null;
  try {
    const img = S(buf, { failOn: "none" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true });
    const meta = await S(buf, { failOn: "none" }).metadata();
    return meta.hasAlpha ? await img.flatten({ background: "#ffffff" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer() : await img.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  } catch { return /^image\/(jpeg|png)$/.test(type) ? buf : null; }
}

/**
 * docs: rows { kind, name, file: {id,type,size}, created_at }, label(kind) → title.
 * Returns items with status: image | pdf | listed (Office) | big (over the size cap) | bad (unreadable/encrypted).
 */
export async function loadAttachments(sql, docs, label) {
  const { PDFDocument } = await import("pdf-lib");
  let used = 0, pages = 0, n = 0;
  const out = [];
  for (const d of docs) {
    const it = { title: label(d.kind), name: d.name || d.file?.name || "fayl", date: d.created_at, type: d.file?.type || "", status: "listed" };
    out.push(it);
    const isImg = /^image\//.test(it.type), isPdf = it.type === "application/pdf";
    if (!d.file?.id || (!isImg && !isPdf)) continue;
    if (pages >= MAX_PAGES()) { it.status = "big"; continue; }
    let f;
    try { f = await readFileRow(sql, d.file.id); } catch { f = null; }
    if (!f?.data) { it.status = "bad"; continue; }
    const buf = Buffer.from(f.data);
    if (isImg) {
      const img = await pageImage(buf, it.type);
      if (!img) { it.status = "bad"; continue; }
      if (used + img.length > CAP()) { it.status = "big"; continue; }
      used += img.length; pages++; it.status = "image"; it.img = img; it.no = ++n;
    } else {
      if (used + buf.length > CAP()) { it.status = "big"; continue; }
      try {
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
        if (pdf.isEncrypted) { it.status = "bad"; it.reason = "parol bilan himoyalangan"; continue; }
        const count = pdf.getPageCount();
        if (!count) { it.status = "bad"; continue; }
        const take = Math.min(count, MAX_PAGES() - pages);
        used += buf.length; pages += take; it.status = "pdf"; it.pdf = pdf; it.pages = take; it.total = count; it.no = ++n;
      } catch { it.status = "bad"; }
    }
  }
  return out;
}

export const ATTACH_NOTE = { image: "PDF ichida", pdf: "PDF ichida", listed: "Faqat ro‘yxatda (Word/Excel)", big: "Hajm katta — qo‘shilmadi", bad: "Ochib bo‘lmadi" };
