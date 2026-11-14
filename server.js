// Standalone server for your own VPS: serves the web app from ./public and the API under /api.
// Usage: node server.js   (reads .env if present; PORT defaults to 3000)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { dispatch } = await import("./lib/app.js");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const port = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) return dispatch(req, res, url.pathname.slice(5));
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || !extname(p)) p = "/index.html";
  const file = join("public", p);
  try {
    await stat(file);
    res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", p === "/index.html" ? "no-cache" : "public, max-age=3600");
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(port, () => console.log(`Steam Plaza: http://localhost:${port}`));
