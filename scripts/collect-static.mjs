#!/usr/bin/env node
// Coleta ESTÁTICA (Fase 3): lê o alvo e grava em <run>/raw/. Nunca altera o alvo, nunca usa a rede.
// Uso: node scripts/collect-static.mjs <alvo> <run>      (<run> dentro de <alvo>/.webaudit/)
// Cada saída: { tool, version, command, started_at, finished_at, status, error?, data }. Falha = erro registrado, nunca dado estimado.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { TOOL_NAME, assertRunDir, envelope, lineIndex, maskValue, parseArgs, pluginVersion, writeRaw } from "./lib/common.mjs";
import { extractPage } from "./lib/html-extract.mjs";
import { scanText } from "./lib/secrets.mjs";
import { HTML_EXT, isProbablyText, readText, walk } from "./lib/walk.mjs";

const { positional } = parseArgs(process.argv.slice(2));
if (positional.length !== 2) { console.error("Uso: node scripts/collect-static.mjs <alvo> <run>"); process.exit(2); }
const { target, run } = assertRunDir(positional[0], positional[1]);
const VERSION = pluginVersion();
const CMD = `collect-static.mjs ${positional[0]} ${positional[1]}`;
const summary = [];

const git = (args, opts = {}) => { try { return execFileSync("git", ["-C", target, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 200 * 1024 * 1024, timeout: 90000, ...opts }); } catch { return null; } };
const inRepo = git(["rev-parse", "--is-inside-work-tree"])?.trim() === "true";

function step(name, file, fn) {
  const startedAt = new Date().toISOString();
  try {
    const { data, warnings, status } = fn();
    const rel = writeRaw(run, file, envelope({ tool: `${TOOL_NAME}/${name}`, version: VERSION, command: CMD, startedAt, status: status ?? "ok", warnings, data }));
    summary.push({ step: name, file: rel, status: status ?? "ok" });
  } catch (e) {
    const rel = writeRaw(run, file, envelope({ tool: `${TOOL_NAME}/${name}`, version: VERSION, command: CMD, startedAt, status: "failed", error: e?.stack ?? e }));
    summary.push({ step: name, file: rel, status: "failed", error: String(e?.message ?? e).slice(0, 300) });
  }
}

const { files, truncated } = walk(target, { maxFiles: 8000 });
const textFiles = files.filter((f) => isProbablyText(f));
const trackedList = inRepo ? new Set((git(["ls-files", "-z"]) ?? "").split("\0").filter(Boolean)) : null;
const isTracked = (rel) => (trackedList ? trackedList.has(rel) : null);
let ignoredCache = null;
function ignoredSet(rels) {
  if (!inRepo || !rels.length) return new Set();
  const out = git(["check-ignore", "--stdin", "-z"], { input: rels.join("\0") }) ?? "";
  return new Set(out.split("\0").filter(Boolean));
}

// ── 1. inventário ──
step("static-inventory", "static-inventory.json", () => {
  const byExt = {}; for (const f of files) byExt[f.ext || "(sem extensão)"] = (byExt[f.ext || "(sem extensão)"] ?? 0) + 1;
  const rel = (re) => files.filter((f) => re.test(f.rel)).map((f) => ({ file: f.rel, bytes: f.size }));
  return { data: {
    files_total: files.length, truncated, by_extension: byExt,
    html: rel(/\.(html?|xhtml)$/i), styles: rel(/\.(css|scss|sass|less)$/i).slice(0, 100), scripts: rel(/\.(m?js|cjs|jsx|ts|tsx|vue|svelte|astro)$/i).slice(0, 200),
    api_like: rel(/(^|\/)(api|functions|netlify\/functions)\/.+\.(m?js|cjs|ts|py|php)$/i),
    config_like: rel(/(^|\/)(vercel\.json|netlify\.toml|_headers|_redirects|wrangler\.(toml|jsonc?)|\.htaccess|nginx\.conf|firebase\.json|package\.json|next\.config\.\w+|astro\.config\.\w+|vite\.config\.\w+|robots\.txt|sitemap.*\.xml|llms\.txt|security\.txt)$/i).concat(rel(/(^|\/)\.well-known\//)),
    large_files: files.filter((f) => f.size > 500 * 1024 && /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|woff2?|ttf|otf|js|css)$/i.test(f.rel)).map((f) => ({ file: f.rel, bytes: f.size })).sort((a, b) => b.bytes - a.bytes).slice(0, 40),
    images: rel(/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i).slice(0, 200),
    fonts: rel(/\.(woff2?|ttf|otf|eot)$/i),
  } };
});

// ── 2. páginas (HTML disponível no disco) ──
const pageMeta = new Map();
step("static-pages", "static-pages.json", () => {
  const html = files.filter((f) => HTML_EXT.has(f.ext)).slice(0, 150);
  const pages = []; const warnings = [];
  for (const f of html) {
    const t = readText(f); if (t === null) { warnings.push(`não foi possível ler ${f.rel}`); continue; }
    const p = extractPage(t); p.file = f.rel; p.bytes = f.size; p.source = /^(dist|build|out|_site)\//.test(f.rel) ? "build" : "source"; pages.push(p);
    pageMeta.set(f.rel, p);
  }
  if (!html.length) warnings.push("nenhum arquivo HTML no disco (SPA/SSR sem build gerado?): metadados de página só existem com coleta ativa-local");
  return { data: { html_available: html.length > 0, pages_total: html.length, pages }, warnings, status: html.length ? "ok" : "partial" };
});

// ── 3. robots.txt e sitemaps locais ──
step("static-robots-sitemap", "static-robots-sitemap.json", () => {
  const find = (names) => names.map((n) => files.find((f) => f.rel === n)).find(Boolean);
  const robotsFile = find(["robots.txt", "public/robots.txt", "static/robots.txt"]);
  const warnings = []; const data = { robots: null, sitemaps: [] };
  if (robotsFile) {
    const t = readText(robotsFile) ?? "";
    const groups = []; let cur = null; const sitemapLines = []; const issues = [];
    t.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.replace(/#.*$/, "").trim(); if (!line) { return; }
      const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) { issues.push({ line: i + 1, issue: "linha inválida", text: raw.slice(0, 80) }); return; }
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v); }
      else if (k === "allow" || k === "disallow") { if (!cur) { issues.push({ line: i + 1, issue: `${k} antes de user-agent` }); return; } cur.rules.push({ type: k, path: v, line: i + 1 }); }
      else if (k === "sitemap") { sitemapLines.push({ url: v, absolute: /^https?:\/\//i.test(v), line: i + 1 }); }
      else if (k === "noindex") issues.push({ line: i + 1, issue: "noindex no robots.txt não é suportado pelo Google" });
      else if (k === "crawl-delay") issues.push({ line: i + 1, issue: "crawl-delay é ignorado pelo Google" });
      else issues.push({ line: i + 1, issue: `campo não suportado: ${k}` });
    });
    data.robots = { file: robotsFile.rel, bytes: robotsFile.size, has_bom: t.charCodeAt(0) === 0xfeff, over_500kib: robotsFile.size > 500 * 1024, groups,
      disallow_all_agents: groups.filter((g) => g.rules.some((r) => r.type === "disallow" && r.path === "/")).flatMap((g) => g.agents), sitemap_lines: sitemapLines, issues };
  } else warnings.push("robots.txt não encontrado no disco (pode ser gerado em runtime: verifique rota/handler)");
  const smFiles = files.filter((f) => /(^|\/)sitemap[^/]*\.xml$/i.test(f.rel)).slice(0, 10);
  const localPath = (u) => { try { const p = new URL(u).pathname; if (p === "/") return ["index.html"]; return [p.slice(1), p.slice(1) + ".html", p.slice(1).replace(/\/$/, "") + "/index.html"]; } catch { return []; } };
  for (const f of smFiles) {
    const t = readText(f) ?? ""; const locs = [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const hosts = [...new Set(locs.map((l) => { try { return new URL(l).host; } catch { return "(inválida)"; } }))];
    const checked = locs.slice(0, 200).map((loc) => { const cand = localPath(loc).find((c) => files.some((x) => x.rel === c || x.rel === "public/" + c)); const meta = cand ? pageMeta.get(cand) ?? pageMeta.get("public/" + cand) : null; const noindex = meta?.robots_meta?.some((r) => /noindex|none/i.test(r.content)) ?? null; return { loc, local_file: cand ?? null, noindex }; });
    data.sitemaps.push({ file: f.rel, bytes: f.size, is_index: /<sitemapindex/i.test(t), urls: locs.length, over_50k_urls: locs.length > 50000, over_50mb: f.size > 50 * 1024 * 1024, hosts, http_urls: locs.filter((l) => l.startsWith("http://")).length, relative_urls: locs.filter((l) => !/^https?:\/\//i.test(l)).length, with_lastmod: (t.match(/<lastmod>/gi) ?? []).length, with_priority: (t.match(/<priority>/gi) ?? []).length, with_changefreq: (t.match(/<changefreq>/gi) ?? []).length, xhtml_links: (t.match(/<xhtml:link/gi) ?? []).length, locs_checked: checked, noindex_urls: checked.filter((c) => c.noindex).map((c) => c.loc), missing_local_files: checked.filter((c) => !c.local_file).length });
  }
  if (!smFiles.length) warnings.push("sitemap não encontrado no disco");
  const llms = files.find((f) => /(^|\/)llms\.txt$/i.test(f.rel)); data.llms_txt = llms ? { file: llms.rel, bytes: llms.size } : null;
  const sec = files.find((f) => /(^|\/)\.well-known\/security\.txt$/i.test(f.rel) || f.rel === "security.txt");
  data.security_txt = sec ? { file: sec.rel, fields: Object.fromEntries((readText(sec) ?? "").split(/\r?\n/).filter((l) => /^[A-Za-z-]+:/.test(l)).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i), l.slice(i + 1).trim()]; })) } : null;
  return { data, warnings, status: "ok" };
});

// ── 4. headers declarados em arquivos de hosting ──
step("static-hosting-headers", "static-hosting-headers.json", () => {
  const declared = []; const other = []; const warnings = [];
  const get = (rel) => { const f = files.find((x) => x.rel === rel); return f ? { f, t: readText(f) ?? "" } : null; };
  const vj = get("vercel.json");
  if (vj) { try { const j = JSON.parse(vj.t); for (const h of j.headers ?? []) for (const kv of h.headers ?? []) declared.push({ file: "vercel.json", source: h.source, key: kv.key, value: kv.value }); other.push({ file: "vercel.json", redirects: (j.redirects ?? []).length, rewrites: (j.rewrites ?? []).length, cleanUrls: j.cleanUrls ?? null, trailingSlash: j.trailingSlash ?? null, functions: Object.keys(j.functions ?? {}) }); } catch (e) { warnings.push(`vercel.json inválido: ${e.message}`); } }
  for (const rel of ["_headers", "public/_headers"]) {
    const h = get(rel); if (!h) continue; let path = null;
    h.t.split(/\r?\n/).forEach((l) => { if (!l.trim() || l.trim().startsWith("#")) return; if (!/^\s/.test(l)) { path = l.trim(); return; } const m = /^\s+(!?\s*[A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(l); if (m) declared.push({ file: rel, source: path, key: m[1].trim(), value: m[2].trim() }); });
  }
  const nt = get("netlify.toml");
  if (nt) { let cur = null; let inValues = false; nt.t.split(/\r?\n/).forEach((l) => { const s = l.trim(); if (s === "[[headers]]") { cur = { source: null }; inValues = false; return; } if (s === "[headers.values]") { inValues = true; return; } if (s.startsWith("[")) { cur = null; inValues = false; return; } if (!cur) return; let m; if ((m = /^for\s*=\s*"([^"]*)"/.exec(s))) cur.source = m[1]; else if (inValues && (m = /^"?([A-Za-z0-9-]+)"?\s*=\s*["']([^"']*)["']/.exec(s))) declared.push({ file: "netlify.toml", source: cur.source, key: m[1], value: m[2] }); }); }
  const ha = get(".htaccess");
  if (ha) for (const m of ha.t.matchAll(/^\s*Header\s+(?:always\s+)?(set|add|append|unset|edit)\s+("?)([A-Za-z0-9-]+)\2(?:\s+("?)(.*?)\4)?\s*$/gim)) declared.push({ file: ".htaccess", source: "*", key: m[3], value: m[5] ?? "", action: m[1] });
  const ng = get("nginx.conf"); if (ng) for (const m of ng.t.matchAll(/^\s*add_header\s+([A-Za-z0-9-]+)\s+(.+?);/gim)) declared.push({ file: "nginx.conf", source: "*", key: m[1], value: m[2].replace(/^["']|["']$/g, "") });
  for (const f of files.filter((x) => /^next\.config\.(js|mjs|cjs|ts)$/.test(x.rel))) { const t = readText(f) ?? ""; if (/headers\s*\(/.test(t)) { for (const m of t.matchAll(/key\s*:\s*['"]([^'"]+)['"]\s*,\s*value\s*:\s*['"`]([^'"`]+)['"`]/g)) declared.push({ file: f.rel, source: "(ver next.config)", key: m[1], value: m[2], approximate: true }); } }
  const present = new Set(declared.map((d) => d.key.toLowerCase().replace(/^!\s*/, "")));
  const wanted = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "x-xss-protection", "access-control-allow-origin", "cache-control"];
  return { data: { note: "Cabeçalhos DECLARADOS em arquivos do repositório. O cabeçalho EFETIVO só existe com coleta ativa-local/remota; CDN/host podem acrescentar ou remover.", declared, other, security_headers_declared: Object.fromEntries(wanted.map((w) => [w, present.has(w)])), hosting_files_found: ["vercel.json", "netlify.toml", "_headers", "public/_headers", ".htaccess", "nginx.conf"].filter((n) => files.some((f) => f.rel === n)) }, warnings };
});

// ── 5. segredos (árvore atual + histórico), SEMPRE mascarados ──
step("static-secrets", "static-secrets.json", () => {
  const warnings = []; const hits = [];
  for (const f of textFiles) {
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock)$/.test(f.rel) || /\.(map|min\.js)$/.test(f.rel)) continue;
    const t = readText(f); if (t === null) continue;
    const at = lineIndex(t);
    for (const h of scanText(t, at)) hits.push({ file: f.rel, ...h });
  }
  const ign = ignoredSet([...new Set(hits.map((h) => h.file))]);
  for (const h of hits) { h.tracked = isTracked(h.file); h.gitignored = inRepo ? ign.has(h.file) : null; }
  const envFiles = files.filter((f) => f.name === ".env" || f.name.startsWith(".env.")).map((f) => {
    const t = readText(f) ?? ""; const names = [...t.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1]);
    return { file: f.rel, bytes: f.size, tracked: isTracked(f.rel), gitignored: inRepo ? ignoredSet([f.rel]).has(f.rel) : null, is_example: /example|sample|template/i.test(f.name), variable_names: names, secret_like_names: names.filter((n) => /(SECRET|PASSWORD|PASSWD|PRIVATE|TOKEN|SERVICE_ROLE|API_?KEY|ACCESS_?KEY|CLIENT_?SECRET)/i.test(n)) };
  });
  // histórico (somente leitura)
  const history = { scanned: false, commits_scanned: 0, hits: [], env_files_ever_added: [] };
  if (inRepo) {
    const out = git(["log", "--all", "-p", "-U0", "--no-color", "--max-count=200", "--format=COMMIT:%H"]);
    if (out === null) warnings.push("git log falhou (histórico não escaneado)");
    else {
      history.scanned = true; let commit = null; let file = null; let lineNo = 0;
      for (const line of out.split("\n")) {
        if (line.startsWith("COMMIT:")) { commit = line.slice(7, 15); history.commits_scanned++; continue; }
        if (line.startsWith("+++ b/")) { file = line.slice(6); continue; }
        if (line.startsWith("+++ ") || line.startsWith("--- ")) { if (line.startsWith("+++ /dev/null")) file = null; continue; }
        const hh = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line); if (hh) { lineNo = +hh[1] - 1; continue; }
        if (line.startsWith("+") && file) { lineNo++; if (line.length > 4000) continue; for (const h of scanText(line.slice(1), () => lineNo)) { if (h.confidence === "low") continue; if (history.hits.length < 200) history.hits.push({ commit, file, ...h, in_working_tree: files.some((x) => x.rel === file) }); } }
      }
      const added = git(["log", "--all", "--diff-filter=A", "--name-only", "--format="]) ?? "";
      history.env_files_ever_added = [...new Set(added.split("\n").filter((p) => /(^|\/)(\.env(\..*)?|.*\.pem|id_rsa|id_ed25519|.*\.p12|.*\.pfx)$/.test(p) && !/example|sample|template/i.test(p)))].map((p) => ({ file: p, still_tracked: isTracked(p) }));
    }
  } else warnings.push("alvo sem git: histórico não escaneado");
  const gi = files.find((f) => f.rel === ".gitignore"); const giText = gi ? readText(gi) ?? "" : "";
  return { data: { note: "Valores mascarados (máx. 4 primeiros caracteres + ****). Nunca o valor inteiro. 'confidence': high|medium|test_key|marker_fake|low.", working_tree_hits: hits.slice(0, 300), working_tree_hits_total: hits.length, env_files: envFiles, gitignore_ignores_env: /(^|\n)\s*\.env/.test(giText), history }, warnings };
});

// ── 6. variáveis expostas ao cliente ──
step("static-public-env", "static-public-env.json", () => {
  const PUBLIC = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_|NUXT_PUBLIC_|GATSBY_|EXPO_PUBLIC_|NG_APP_|VUE_APP_)/;
  const SECRETISH = /(SECRET|PASSWORD|PASSWD|PRIVATE|TOKEN|SERVICE_ROLE|CLIENT_SECRET|ACCESS_?KEY|API_?KEY(?!.*(PUBLIC|PUBLISHABLE)))/i;
  const vars = []; const used = [];
  for (const f of files.filter((x) => x.name === ".env" || x.name.startsWith(".env."))) {
    const t = readText(f) ?? ""; t.split(/\r?\n/).forEach((l, i) => { const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(l); if (!m || !PUBLIC.test(m[1])) return; const v = m[2].replace(/^["']|["']$/g, "").trim(); const shape = scanText(`${m[1]}=${v}`, () => i + 1).find((h) => h.confidence !== "low")?.pattern ?? null; vars.push({ file: f.rel, line: i + 1, name: m[1], value_masked: maskValue(v), value_length: v.length, tracked: isTracked(f.rel), name_looks_secret: SECRETISH.test(m[1]), value_shape: shape }); });
  }
  for (const f of textFiles.filter((x) => /\.(?:jsx?|tsx?|mjs|vue|svelte|astro|html?)$/.test(x.name))) {
    const t = readText(f); if (t === null) continue; const at = lineIndex(t);
    for (const m of t.matchAll(/(?:process\.env|import\.meta\.env)\.((?:NEXT_PUBLIC|VITE|PUBLIC|REACT_APP|NUXT_PUBLIC|GATSBY|EXPO_PUBLIC)_[A-Za-z0-9_]+)/g)) if (used.length < 200) used.push({ file: f.rel, line: at(m.index), name: m[1], name_looks_secret: SECRETISH.test(m[1]) });
  }
  return { data: { note: "Variáveis com prefixo público entram no bundle do navegador (Next.js: NEXT_PUBLIC_, Vite: VITE_, Astro: PUBLIC_…). Valores mascarados.", defined_in_env_files: vars, referenced_in_source: used }, status: "ok" };
});

writeRaw(run, "static-summary.json", envelope({ tool: `${TOOL_NAME}/collect-static`, version: VERSION, command: CMD, startedAt: new Date().toISOString(), status: summary.every((s) => s.status === "ok") ? "ok" : summary.some((s) => s.status === "failed") ? "partial" : "ok", data: { target, outputs: summary } }));
console.log(JSON.stringify({ target, run, outputs: summary }, null, 2));
void basename; void extname; void join; void readFileSync;
