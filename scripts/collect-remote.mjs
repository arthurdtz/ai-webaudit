#!/usr/bin/env node
// Coleta ATIVA-REMOTA (Fase 3, opt-in com --url; SPEC §8.3). SOMENTE leitura:
//   · apenas requisições GET (nunca POST/PUT/DELETE, nunca formulários, scanners, fuzzing, força bruta ou payloads);
//   · no máximo 20 páginas; 1 requisição por segundo; user-agent AI-WebAudit/<versão>;
//   · headers, robots.txt, sitemap, HTML das páginas e Lighthouse em até 3 URLs.
// Redireciona só dentro do mesmo site (mesmo host, ou apenas www./esquema). Recusa localhost e redes privadas.
// Uso: node scripts/collect-remote.mjs <url> <run> [--target <alvo>] [--max-pages 20] [--lighthouse-pages 3] [--skip-lighthouse]
// Observação: o Lighthouse carrega a página num navegador (GETs dos subrecursos da própria página) e NÃO obedece ao limite de 1 req/s das requisições deste script.
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { TOOL_NAME, USER_AGENT, assertRunDir, envelope, maskValue, parseArgs, pluginVersion, writeRaw } from "./lib/common.mjs";
import { extractPage } from "./lib/html-extract.mjs";

const { positional, opts } = parseArgs(process.argv.slice(2), { flags: ["target", "max-pages", "lighthouse-pages"], bools: ["skip-lighthouse"] });
if (positional.length !== 2) { console.error("Uso: node scripts/collect-remote.mjs <url> <run> [--target <alvo>] [--max-pages 20] [--lighthouse-pages 3] [--skip-lighthouse]"); process.exit(2); }
let start;
try { start = new URL(positional[0]); } catch { console.error(`URL inválida: ${positional[0]}`); process.exit(2); }
if (!/^https?:$/.test(start.protocol)) { console.error("Erro: apenas http(s)."); process.exit(2); }
const runArg = positional[1];
const targetArg = opts.target ?? (runArg.includes("/.webaudit/") ? runArg.slice(0, runArg.indexOf("/.webaudit/")) : null);
if (!targetArg) { console.error("Erro: informe --target <alvo> (o run precisa estar dentro de <alvo>/.webaudit/)."); process.exit(2); }
const { run } = assertRunDir(targetArg, runArg);

const VERSION = pluginVersion(); const UA = USER_AGENT();
const CMD = `collect-remote.mjs ${positional[0]} ${runArg}`;
const MAX_PAGES = Math.max(1, Math.min(20, Number(opts["max-pages"] ?? 20)));
const LH_PAGES = Math.max(0, Math.min(3, Number(opts["lighthouse-pages"] ?? 3)));
const MAX_BYTES = 2 * 1024 * 1024; const TIMEOUT = 15000; const MAX_HOPS = 10;
const outputs = []; const notes = []; let requests = 0;

// ── guarda de destino: nada de loopback/rede privada ──
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split(".").map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  if (net.isIPv6(ip)) { const x = ip.toLowerCase(); return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168."); }
  return false;
}
async function assertPublicHost(host) {
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error(`host não público: ${host}`);
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new Error(`endereço privado/loopback: ${host}`); return; }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length) throw new Error(`DNS sem resposta: ${host}`);
  const bad = addrs.find((a) => isPrivateIp(a.address)); if (bad) throw new Error(`${host} resolve para endereço privado/loopback (${bad.address})`);
}
try { await assertPublicHost(start.hostname); } catch (e) { console.error(`Erro: ${e.message}. A coleta remota é só para sites publicados; para localhost use collect-local.mjs.`); process.exit(2); }

// ── 1 requisição por segundo, só GET ──
let lastStart = 0;
async function throttle() { const wait = lastStart + 1000 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); lastStart = Date.now(); }
const wwwless = (h) => h.replace(/^www\./i, "").toLowerCase();
const sameSite = (a, b) => wwwless(new URL(a).hostname) === wwwless(new URL(b).hostname);

async function get(url, { follow = true, wantBody = true } = {}) {
  const chain = []; let cur = url;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await throttle(); requests++;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(cur, { method: "GET", redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5", "accept-encoding": "gzip, deflate, br" } });
      const headers = Object.fromEntries([...res.headers].map(([k, v]) => [k.toLowerCase(), v]));
      const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : (headers["set-cookie"] ? [headers["set-cookie"]] : []);
      chain.push({ url: cur, status: res.status, location: headers.location ?? null });
      if (res.status >= 300 && res.status < 400 && headers.location) {
        let next; try { next = new URL(headers.location, cur).href; } catch { return { chain, final_url: cur, status: res.status, headers, set_cookie: setCookie, error: "Location inválido" }; }
        if (!follow) return { chain, final_url: cur, status: res.status, headers, set_cookie: setCookie };
        if (!sameSite(cur, next)) { return { chain, final_url: cur, status: res.status, headers, set_cookie: setCookie, redirect_to_other_site: next, note: "Redirecionamento para outro site não seguido." }; }
        cur = next; continue;
      }
      let body = ""; let truncated = false; let bytes = 0;
      if (wantBody && res.body) {
        const reader = res.body.getReader(); const chunks = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > MAX_BYTES) { truncated = true; try { await reader.cancel(); } catch {} break; } chunks.push(value); }
        body = Buffer.concat(chunks).toString("utf8");
      }
      return { chain, final_url: cur, status: res.status, headers, set_cookie: setCookie, body, bytes, truncated };
    } catch (e) { return { chain, final_url: cur, status: 0, error: String(e?.name === "AbortError" ? "timeout" : e?.message ?? e) }; }
    finally { clearTimeout(timer); }
  }
  return { chain, final_url: cur, status: 0, error: `mais de ${MAX_HOPS} redirecionamentos` };
}

const parseCookie = (c) => { const parts = c.split(";").map((s) => s.trim()); const [name, ...v] = parts[0].split("="); const flags = {}; for (const p of parts.slice(1)) { const [k, ...r] = p.split("="); flags[k.toLowerCase()] = r.length ? r.join("=") : true; } return { name, value_masked: maskValue(v.join("=")), secure: Boolean(flags.secure), http_only: Boolean(flags.httponly), same_site: flags.samesite ?? null, domain: flags.domain ?? null, path: flags.path ?? null, max_age: flags["max-age"] ?? null, expires: flags.expires ?? null }; };
function securityHeaders(h, setCookie) {
  const csp = h["content-security-policy"] ?? null;
  const hsts = h["strict-transport-security"] ?? null;
  return {
    "strict-transport-security": hsts ? { value: hsts, max_age: Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? NaN) || null, include_subdomains: /includesubdomains/i.test(hsts), preload: /preload/i.test(hsts) } : null,
    "content-security-policy": csp ? { value: csp.slice(0, 1500), unsafe_inline: /'unsafe-inline'/.test(csp), unsafe_eval: /'unsafe-eval'/.test(csp), has_frame_ancestors: /frame-ancestors/i.test(csp), has_object_src_none: /object-src\s+'none'/i.test(csp), uses_nonce_or_hash: /'(nonce|sha(256|384|512))-/i.test(csp) } : null,
    "content-security-policy-report-only": h["content-security-policy-report-only"]?.slice(0, 500) ?? null,
    "x-content-type-options": h["x-content-type-options"] ?? null, "x-frame-options": h["x-frame-options"] ?? null, "referrer-policy": h["referrer-policy"] ?? null,
    "permissions-policy": h["permissions-policy"]?.slice(0, 500) ?? null, "cross-origin-opener-policy": h["cross-origin-opener-policy"] ?? null, "cross-origin-embedder-policy": h["cross-origin-embedder-policy"] ?? null, "cross-origin-resource-policy": h["cross-origin-resource-policy"] ?? null,
    "x-xss-protection": h["x-xss-protection"] ?? null, "expect-ct": h["expect-ct"] ?? null, "public-key-pins": h["public-key-pins"] ?? null,
    server: h.server ?? null, "x-powered-by": h["x-powered-by"] ?? null,
    "access-control-allow-origin": h["access-control-allow-origin"] ?? null, "access-control-allow-credentials": h["access-control-allow-credentials"] ?? null,
    "cache-control": h["cache-control"] ?? null, etag: Boolean(h.etag), "content-encoding": h["content-encoding"] ?? null, "content-type": h["content-type"] ?? null, "x-robots-tag": h["x-robots-tag"] ?? null, link: h.link?.slice(0, 300) ?? null,
    cookies: setCookie.map(parseCookie),
  };
}
function record(step, file, status, extra = {}) { outputs.push({ step, file, status, ...extra }); }
function save(step, name, startedAt, status, data, error, warnings) { const rel = writeRaw(run, `remote/${name}`, envelope({ tool: `${TOOL_NAME}/collect-remote:${step}`, version: VERSION, command: CMD, startedAt, status, error, warnings, data })); record(step, rel, status, error ? { error: String(error).slice(0, 200) } : {}); return rel; }
const slugOf = (u) => { const p = new URL(u).pathname; return p === "/" || p === "" ? "home" : p.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60) || "home"; };

const t0 = new Date().toISOString();
const origin = start.origin;

// ── A. página inicial, robots e sitemaps ──
const pages = []; const seen = new Set(); const queue = [];
const norm = (u) => { try { const x = new URL(u); x.hash = ""; x.pathname = x.pathname.replace(/\/index\.html?$/i, "/"); return x.href; } catch { return null; } };
queue.push(norm(start.href)); seen.add(queue[0]);

const robots = await get(`${origin}/robots.txt`);
const robotsData = { url: `${origin}/robots.txt`, status: robots.status, chain: robots.chain, content_type: robots.headers?.["content-type"] ?? null, bytes: robots.bytes ?? 0, error: robots.error ?? null, sitemap_lines: [], groups: [] };
const disallowed = []; // para marcar páginas que o robots restringe (informativo; a auditoria é do dono do site)
if (robots.status === 200 && robots.body) {
  let cur = null;
  for (const raw of robots.body.split(/\r?\n/)) { const line = raw.replace(/#.*$/, "").trim(); const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue; const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; robotsData.groups.push(cur); } cur.agents.push(v); }
    else if ((k === "allow" || k === "disallow") && cur) cur.rules.push({ type: k, path: v });
    else if (k === "sitemap") robotsData.sitemap_lines.push(v); }
  for (const g of robotsData.groups) if (g.agents.some((a) => a === "*" || /^ai-webaudit/i.test(a))) for (const r of g.rules) if (r.type === "disallow" && r.path) disallowed.push(r.path);
}
save("robots", "remote-robots.json", t0, robots.status === 0 ? "failed" : "ok", robotsData, robots.error);

const smUrls = robotsData.sitemap_lines.length ? robotsData.sitemap_lines.slice(0, 3) : [`${origin}/sitemap.xml`];
const sitemaps = []; const sitemapLocs = [];
for (const su of smUrls) {
  let u; try { u = new URL(su, origin).href; } catch { continue; }
  if (new URL(u).host !== start.host) { sitemaps.push({ url: u, skipped: "host diferente do site auditado" }); continue; }
  const r = await get(u);
  const locs = r.status === 200 ? [...(r.body ?? "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]) : [];
  const isIndex = /<sitemapindex/i.test(r.body ?? "");
  sitemaps.push({ url: u, status: r.status, chain: r.chain, content_type: r.headers?.["content-type"] ?? null, bytes: r.bytes ?? 0, is_index: isIndex, urls: locs.length, hosts: [...new Set(locs.map((l) => { try { return new URL(l).host; } catch { return "(inválida)"; } }))], http_urls: locs.filter((l) => l.startsWith("http://")).length, with_lastmod: ((r.body ?? "").match(/<lastmod>/gi) ?? []).length, sample: locs.slice(0, 15), error: r.error ?? null });
  if (!isIndex) sitemapLocs.push(...locs);
  else for (const child of locs.slice(0, 2)) { if (new URL(child).host !== start.host) continue; const c = await get(child); const cl = c.status === 200 ? [...(c.body ?? "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]) : []; sitemaps.push({ url: child, status: c.status, urls: cl.length, sample: cl.slice(0, 10), child_of: u }); sitemapLocs.push(...cl); }
}
save("sitemap", "remote-sitemaps.json", t0, "ok", { sitemaps, total_locs_seen: sitemapLocs.length });

// ── B. páginas (BFS) ──
const isHtmlish = (ct) => !ct || /html|xml/i.test(ct);
while (queue.length && pages.length < MAX_PAGES) {
  const url = queue.shift();
  const r = await get(url);
  const ct = r.headers?.["content-type"] ?? null;
  const rec = { url, final_url: r.final_url, status: r.status, redirect_chain: r.chain.length > 1 ? r.chain : undefined, redirect_to_other_site: r.redirect_to_other_site, error: r.error ?? null, content_type: ct, bytes: r.bytes ?? 0, truncated: r.truncated ?? false, restricted_by_robots: disallowed.some((d) => new URL(url).pathname.startsWith(d)), security_headers: securityHeaders(r.headers ?? {}, r.set_cookie ?? []) };
  if (r.status >= 200 && r.status < 300 && /html/i.test(ct ?? "") && r.body) {
    rec.html = extractPage(r.body, { maxItems: 40 });
    for (const m of r.body.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) { let u; try { u = new URL(m[1], r.final_url); } catch { continue; } if (!/^https?:$/.test(u.protocol) || u.host !== new URL(r.final_url).host) continue; if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|webm|mp3|woff2?|ttf|css|js|mjs|json|xml|txt|map)(?:$|\?)/i.test(u.pathname)) continue; const n = norm(u.href); if (n && !seen.has(n)) { seen.add(n); queue.push(n); } }
  }
  pages.push(rec);
}
// completa o orçamento com URLs do sitemap (mesmo host)
for (const l of sitemapLocs) { if (pages.length >= MAX_PAGES) break; const n = norm(l); if (!n || seen.has(n) || new URL(n).host !== start.host) continue; seen.add(n); const r = await get(n); const ct = r.headers?.["content-type"] ?? null; const rec = { url: n, final_url: r.final_url, status: r.status, redirect_chain: r.chain.length > 1 ? r.chain : undefined, error: r.error ?? null, content_type: ct, bytes: r.bytes ?? 0, from_sitemap: true, restricted_by_robots: disallowed.some((d) => new URL(n).pathname.startsWith(d)), security_headers: securityHeaders(r.headers ?? {}, r.set_cookie ?? []) }; if (r.status >= 200 && r.status < 300 && /html/i.test(ct ?? "") && r.body) rec.html = extractPage(r.body, { maxItems: 40 }); pages.push(rec); }
if (queue.length) notes.push(`${queue.length} link(s) interno(s) não visitados (limite de ${MAX_PAGES} páginas).`);
save("pages", "remote-pages.json", t0, pages.some((p) => p.status >= 200 && p.status < 300) ? "ok" : "failed", { start_url: start.href, max_pages: MAX_PAGES, rate_limit: "1 requisição/segundo", user_agent: UA, pages_total: pages.length, pages, notes }, pages.length ? null : "nenhuma página coletada");

// ── C. sonda de 404 (uma GET), http→https e TLS ──
{
  const startedAt = new Date().toISOString();
  const probe = `${origin}/webaudit-404-check-${Math.random().toString(36).slice(2, 10)}`;
  const r = await get(probe, { follow: false });
  const data = { probe_url: probe, status: r.status, chain: r.chain, content_type: r.headers?.["content-type"] ?? null, note: "Uma única GET a URL inexistente (comportamento 404 / soft 404)." };
  if (start.protocol === "https:") { const h = await get(`http://${start.host}/`, { follow: false }); data.http_to_https = { url: `http://${start.host}/`, status: h.status, location: h.headers?.location ?? null, chain: h.chain, error: h.error ?? null }; }
  save("probes", "remote-probes.json", startedAt, "ok", data);
}
if (start.protocol === "https:") {
  const startedAt = new Date().toISOString();
  const data = await new Promise((resolve) => {
    const s = tls.connect({ host: start.hostname, port: Number(start.port || 443), servername: start.hostname, timeout: 10000 }, () => {
      const c = s.getPeerCertificate(); const to = c?.valid_to ? new Date(c.valid_to) : null;
      resolve({ note: "Handshake TLS apenas (nenhum dado HTTP enviado).", protocol: s.getProtocol(), authorized: s.authorized, authorization_error: s.authorizationError ?? null, subject_cn: c?.subject?.CN ?? null, issuer: c?.issuer?.O ?? c?.issuer?.CN ?? null, valid_from: c?.valid_from ?? null, valid_to: c?.valid_to ?? null, days_remaining: to ? Math.floor((to - Date.now()) / 86400000) : null, san: (c?.subjectaltname ?? "").slice(0, 400) });
      s.end();
    });
    s.on("error", (e) => resolve({ error: e.message })); s.on("timeout", () => { resolve({ error: "timeout" }); s.destroy(); });
  });
  save("tls", "remote-tls.json", startedAt, data.error ? "failed" : "ok", data, data.error);
}

// ── D. Lighthouse (até 3 URLs, mobile e desktop) ──
if (!opts["skip-lighthouse"] && LH_PAGES > 0) {
  let runLighthouse; try { ({ runLighthouse } = await import("./lib/lighthouse-run.mjs")); } catch (e) { record("lighthouse", null, "failed", { error: `Playwright/Lighthouse indisponível: ${e.message}` }); }
  if (runLighthouse) for (const p of pages.filter((x) => x.status >= 200 && x.status < 300 && x.html).slice(0, LH_PAGES)) for (const mode of ["mobile", "desktop"]) {
    const startedAt = new Date().toISOString(); const r = await runLighthouse(p.final_url, { mode });
    save("lighthouse", `lighthouse-${slugOf(p.final_url)}-${mode}.json`, startedAt, r.ok ? "ok" : "failed", r.data ?? null, r.error);
  }
}

const failed = outputs.filter((o) => o.status === "failed").length;
const sumRel = writeRaw(run, "remote/remote-summary.json", envelope({ tool: `${TOOL_NAME}/collect-remote`, version: VERSION, command: CMD, startedAt: t0, status: failed === 0 ? "ok" : failed === outputs.length ? "failed" : "partial", data: { start_url: start.href, user_agent: UA, requests_made_by_script: requests, limits: { max_pages: MAX_PAGES, rate: "1 req/s", methods: "GET", lighthouse_urls: LH_PAGES }, notes, outputs } }));
console.log(JSON.stringify({ run, summary: sumRel, requests_made_by_script: requests, outputs }, null, 2));
