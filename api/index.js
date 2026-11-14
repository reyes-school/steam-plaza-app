// Single Vercel function for the whole API (vercel.json rewrites /api/* here with ?path=...).
import { dispatch } from "../lib/app.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  let path = url.searchParams.get("path");
  if (path == null) path = url.pathname.replace(/^\/api\/?/, "");
  url.searchParams.delete("path");
  req.url = "/" + path + (url.search || "");
  return dispatch(req, res, path);
}
