const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const host = "127.0.0.1";
const port = Number(process.argv[2] || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendFile(res, filePath, method) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(method === "HEAD" ? undefined : (error.code === "ENOENT" ? "Not found" : "Server error"));
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });

    if (method === "HEAD") {
      res.end();
      return;
    }

    res.end(data);
  });
}

http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isDirectory()) {
      sendFile(res, path.join(filePath, "index.html"), req.method);
      return;
    }

    // Saubere Adressen, wie Netlify sie ausliefert: /turmbau findet
    // turmbau.html. Das ist nicht Bequemlichkeit, sondern die Form, in der
    // eine Adresse weitergegeben wird – und genau in dieser Form stand die
    // Schranke einmal offen, weil entitlement.js die Endung erwartete. Solange
    // dieser Server nur turmbau.html kannte, konnte keine Browser-Prüfung das
    // je bemerken.
    if (error && !path.extname(filePath)) {
      const mitEndung = `${filePath}.html`;
      fs.stat(mitEndung, (fehlt) => {
        if (!fehlt) sendFile(res, mitEndung, req.method);
        else sendFile(res, filePath, req.method);
      });
      return;
    }

    sendFile(res, filePath, req.method);
  });
}).listen(port, host, () => {
  console.log(`Lernapp PWA server listening on http://${host}:${port}`);
});
