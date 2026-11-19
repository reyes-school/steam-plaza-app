// Standalone server for your own VPS: serves the web app from ./public and the API under /api.
// Usage: node server.js   (reads .env if present; PORT defaults to 3000, HOST to 127.0.0.1 — put nginx in front)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { dispatch } = await import("./lib/app.js");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const ROOT = resolve("public");

// Content-Security-Policy: scripts only from this site; no inline scripts, no frames, no plugins.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:", "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join("; ");
function staticHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return await dispatch(req, res, url.pathname.slice(5));
    if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end(); }
    let p;
    try { p = normalize(decodeURIComponent(url.pathname)); } catch { res.statusCode = 400; return res.end("Bad request"); }
    if (p.includes("\0")) { res.statusCode = 400; return res.end("Bad request"); }
    if (p === "/" || p === sep || !extname(p)) p = "/index.html";
    const file = resolve(join(ROOT, p));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.statusCode = 404; return res.end("Not found"); }
    staticHeaders(res);
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error("not a file");
      res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
      res.setHeader("Cache-Control", /\.(html|js|css)$/.test(p) ? "no-cache" : "public, max-age=3600");
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
    } catch { res.statusCode = 404; res.end("Not found"); }
  } catch (e) {
    console.error(new Date().toISOString(), "request failed", e);
    if (!res.headersSent) { res.statusCode = 500; res.end("Server error"); } else res.destroy();
  }
});
// Slow-client protection (slowloris): limits on headers, whole request and idle keep-alive.
server.headersTimeout = 15_000;
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS) || 60_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 60;
server.maxRequestsPerSocket = 1000;
server.on("clientError", (err, socket) => { if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); else socket.destroy(); });
process.on("unhandledRejection", (e) => console.error(new Date().toISOString(), "unhandledRejection", e));
server.listen(port, host, () => console.log(`Steam Plaza: http://${host}:${port}`));
