// Upload compression: photos are re-encoded and resized, scanned PDFs get their page images re-compressed.
// The smaller result is kept only if it is really smaller; any failure keeps the original file.
import zlib from "node:zlib";

let sharpMod;
async function sharp() {
  if (sharpMod === undefined) { try { sharpMod = (await import("sharp")).default; } catch { sharpMod = null; console.warn("sharp topilmadi: rasmlar serverda siqilmaydi"); } }
  return sharpMod;
}
let pdfLib;
async function pdflib() { if (pdfLib === undefined) { try { pdfLib = await import("pdf-lib"); } catch { pdfLib = null; } } return pdfLib; }

const MAX_SIDE = Number(process.env.IMAGE_MAX_SIDE) || 2000;
const QUALITY = Number(process.env.IMAGE_QUALITY) || 78;

/** Image → smaller image of the same type (EXIF rotation applied, metadata such as GPS removed). */
export async function compressImage(buf, type) {
  const S = await sharp();
  if (!S || type === "image/gif") return null;
  const img = S(buf, { failOn: "none", limitInputPixels: 80e6 }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
  let out;
  if (type === "image/jpeg") out = await img.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  else if (type === "image/png") out = await img.png({ compressionLevel: 9, palette: true, quality: 85, effort: 4 }).toBuffer();
  else if (type === "image/webp") out = await img.webp({ quality: QUALITY - 3 }).toBuffer();
  else return null;
  return out.length < buf.length ? out : null;
}

/** PDF → re-saved with object streams; large page images (scans/photos) re-encoded as JPEG. */
export async function compressPdf(buf) {
  const L = await pdflib(), S = await sharp();
  if (!L) return null;
  const { PDFDocument, PDFName, PDFRawStream, PDFNumber, decodePDFRawStream } = L;
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  if (pdf.isEncrypted) return null;
  if (S) {
    const ctx = pdf.context;
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const d = obj.dict;
      if (d.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
      const raw = obj.contents;
      if (raw.length < 60 * 1024) continue;
      const filter = d.get(PDFName.of("Filter"));
      const w = d.get(PDFName.of("Width"))?.asNumber?.(), h = d.get(PDFName.of("Height"))?.asNumber?.();
      if (!w || !h || d.get(PDFName.of("SMask")) || d.get(PDFName.of("Mask")) || d.get(PDFName.of("ImageMask"))) continue;
      let input;
      try {
        if (filter === PDFName.of("DCTDecode")) {
          const cs = d.get(PDFName.of("ColorSpace"));
          if (cs !== PDFName.of("DeviceRGB") && cs !== PDFName.of("DeviceGray")) continue; // CMYK/ICC: leave as is
          if (d.get(PDFName.of("Decode"))) continue;
          input = S(Buffer.from(raw), { failOn: "none" });
        } else if (filter === PDFName.of("FlateDecode")) {
          const cs = d.get(PDFName.of("ColorSpace")), bpc = d.get(PDFName.of("BitsPerComponent"))?.asNumber?.();
          const ch = cs === PDFName.of("DeviceRGB") ? 3 : cs === PDFName.of("DeviceGray") ? 1 : 0;
          if (!ch || bpc !== 8 || d.get(PDFName.of("Decode"))) continue;
          const px = d.get(PDFName.of("DecodeParms")) ? Buffer.from(decodePDFRawStream(obj).decode()) : zlib.inflateSync(Buffer.from(raw));
          if (px.length !== w * h * ch) continue;
          input = S(px, { raw: { width: w, height: h, channels: ch } });
        } else continue;
        const resized = input.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
        const { data, info } = await resized.jpeg({ quality: 70, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        if (data.length >= raw.length * 0.9) continue;
        const nd = d.clone(ctx);
        nd.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        nd.delete(PDFName.of("DecodeParms"));
        nd.set(PDFName.of("Width"), PDFNumber.of(info.width));
        nd.set(PDFName.of("Height"), PDFNumber.of(info.height));
        nd.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
        nd.set(PDFName.of("ColorSpace"), PDFName.of(info.channels === 1 ? "DeviceGray" : "DeviceRGB"));
        nd.set(PDFName.of("Length"), PDFNumber.of(data.length));
        ctx.assign(ref, PDFRawStream.of(nd, new Uint8Array(data)));
      } catch { /* leave this image unchanged */ }
    }
  }
  const out = Buffer.from(await pdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false }));
  return out.length < buf.length * 0.97 ? out : null;
}

/** Returns { buf, type, before, after } — compressed when that helps, otherwise the original. */
export async function compressUpload(buf, type) {
  const before = buf.length;
  let out = null;
  try {
    const work = /^image\//.test(type) ? compressImage(buf, type) : type === "application/pdf" ? compressPdf(buf) : null;
    if (work) out = await Promise.race([work, new Promise((r) => setTimeout(() => r(null), Number(process.env.COMPRESS_TIMEOUT_MS) || 12000))]);
  } catch (e) { console.warn("compress failed:", e?.message || e); out = null; }
  const b = out && out.length < before ? out : buf;
  return { buf: b, before, after: b.length };
}
