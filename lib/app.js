// Registers every route once. Used by api/index.js (Vercel) and server.js (your own server).
import "./routes/core.js";
import "./routes/school.js";
import "./routes/lessons.js";
import "./routes/stats.js";
import "./routes/finance.js";
import "./routes/pdf.js";
import "./routes/admin.js";
export { dispatch } from "./http.js";
