// Varredura de arquivos do alvo (somente leitura).
import { readdirSync, statSync, readFileSync, openSync, readSync, closeSync } from "node:fs";
import { extname, join, relative } from "node:path";

export const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".webaudit", ".next", ".astro", ".cache", ".vercel", ".turbo", ".svelte-kit", ".nuxt",
  "coverage", "vendor", ".venv", "venv", "__pycache__", ".idea", ".vscode", ".parcel-cache", ".output", "bower_components",
]);
export const TEXT_EXT = new Set([
  ".html", ".htm", ".xhtml", ".css", ".scss", ".sass", ".less", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro",
  ".json", ".jsonc", ".md", ".mdx", ".txt", ".xml", ".yml", ".yaml", ".toml", ".ini", ".env", ".php", ".py", ".rb", ".go", ".java",
  ".sh", ".bash", ".conf", ".htaccess", ".svg", ".csv", ".webmanifest", ".map", ".lock",
]);
export const HTML_EXT = new Set([".html", ".htm", ".xhtml"]);

export function walk(root, { maxFiles = 6000, maxDepth = 12 } = {}) {
  const out = []; let truncated = false;
  const rec = (dir, depth) => {
    if (depth > maxDepth || truncated) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (truncated) return;
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) rec(abs, depth + 1); continue; }
      if (!e.isFile()) continue;
      let size = 0; try { size = statSync(abs).size; } catch { continue; }
      out.push({ rel: relative(root, abs).split("\\").join("/"), abs, size, ext: extname(e.name).toLowerCase(), name: e.name });
      if (out.length >= maxFiles) { truncated = true; return; }
    }
  };
  rec(root, 0);
  return { files: out, truncated };
}
export function isProbablyText(f) {
  if (f.size > 1024 * 1024) return false;
  if (TEXT_EXT.has(f.ext) || f.name.startsWith(".env") || f.name === ".htaccess" || f.name === "_headers" || f.name === "_redirects" || f.name === "robots.txt" || f.name === "Dockerfile") return true;
  if (f.ext === "") { // sem extensão: checa binário
    try { const fd = openSync(f.abs, "r"); const b = Buffer.alloc(512); const n = readSync(fd, b, 0, 512, 0); closeSync(fd); return !b.subarray(0, n).includes(0); } catch { return false; }
  }
  return false;
}
export function readText(f) { try { return readFileSync(f.abs, "utf8"); } catch { return null; } }
