/* ==========================================================================
   PREVIEW SERVER — server.js (sandbox only, NOT part of the deliverable)
   --------------------------------------------------------------------------
   Tiny dependency-free static file server. Serves the Smart Attendance
   System (a pure static site) from download/smart-attendance-system/ on
   port 3000 so the sandbox preview panel can display it.

   For real deployment use Firebase Hosting as documented in the README —
   this file exists only because the sandbox exposes a single port.
   ========================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = path.join(__dirname, "download", "smart-attendance-system");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".md":   "text/markdown; charset=utf-8"
};

const server = http.createServer((req, res) => {
  /* strip query string, decode, prevent path traversal */
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  urlPath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");

  let filePath = path.join(ROOT, urlPath);

  /* directory -> serve its index.html */
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Smart Attendance preview running at http://localhost:${PORT}`);
});
