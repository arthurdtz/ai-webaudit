#!/usr/bin/env node
// Servidor estático mínimo, SOMENTE em 127.0.0.1, para auditar sites sem build/servidor próprio (Fase 3, ativa-local).
// Uso: node scripts/serve-static.mjs <diretório> [porta]   (porta 0 = aleatória; imprime "LISTENING http://127.0.0.1:<porta>")
// Não executa código do alvo. Não segue links simbólicos para fora do diretório. Encerre com SIGTERM.
import { createServer } from "node:http";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const [dirArg, portArg = "0"] = process.argv.slice(2);
if (!dirArg) { console.error("Uso: node scripts/serve-static.mjs <diretório> [porta]"); process.exit(2); }
const root = realpathSync(resolve(dirArg));
const TYPES = { ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
  let p; try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
  // nunca serve arquivos ocultos (.env, .git, .webaudit…), exceto .well-known
  if (p.split("/").some((seg) => seg.startsWith(".") && seg !== "" && seg !== ".well-known")) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404 Not Found"); }
  let f = normalize(join(root, p));
  if (!(f === root || f.startsWith(root + sep))) { res.writeHead(403); return res.end(); }
  try {
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    else if (!existsSync(f) && existsSync(f + ".html")) f = f + ".html";
    const real = realpathSync(f);
    if (!(real === root || real.startsWith(root + sep)) || !statSync(real).isFile()) throw new Error("fora");
    const body = readFileSync(real);
    res.writeHead(200, { "Content-Type": TYPES[extname(real).toLowerCase()] ?? "application/octet-stream", "Content-Length": body.length });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    const nf = existsSync(join(root, "404.html")) ? readFileSync(join(root, "404.html")) : Buffer.from("404 Not Found");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); res.end(req.method === "HEAD" ? undefined : nf);
  }
});
server.listen(Number(portArg), "127.0.0.1", () => console.log(`LISTENING http://127.0.0.1:${server.address().port}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
