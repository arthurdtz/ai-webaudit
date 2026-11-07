#!/usr/bin/env node
// Coleta ATIVA-LOCAL (Fase 3): Lighthouse (mobile e desktop), axe via Playwright, capturas 360/768/1440,
// erros de console, requisições/cookies antes de qualquer interação e links internos quebrados.
// Aceita APENAS localhost / 127.0.0.1 / ::1. Grava só em <run>/raw/. Falha = erro registrado, nunca dado estimado.
// Uso: node scripts/collect-local.mjs <url-localhost> <run> [--target <alvo>] [--max-pages 20] [--browser-pages 5]
//        [--lighthouse-pages 3] [--skip-lighthouse] [--skip-axe] [--skip-screenshots]
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { TOOL_NAME, assertRunDir, envelope, parseArgs, pluginVersion, writeRaw } from "./lib/common.mjs";

const { positional, opts } = parseArgs(process.argv.slice(2), { flags: ["target", "max-pages", "browser-pages", "lighthouse-pages"], bools: ["skip-lighthouse", "skip-axe", "skip-screenshots"] });
if (positional.length !== 2) { console.error("Uso: node scripts/collect-local.mjs <url-localhost> <run> [--target <alvo>] [opções]"); process.exit(2); }
let base;
try { base = new URL(positional[0]); } catch { console.error(`URL inválida: ${positional[0]}`); process.exit(2); }
if (!/^https?:$/.test(base.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  console.error(`Erro: a coleta ativa-local aceita apenas localhost, 127.0.0.1 ou ::1 (recebido: ${base.hostname}). Para sites publicados use collect-remote.mjs com --url.`);
  process.exit(2);
}
const runArg = positional[1];
const targetArg = opts.target ?? (runArg.includes("/.webaudit/") ? runArg.slice(0, runArg.indexOf("/.webaudit/")) : null);
if (!targetArg) { console.error("Erro: informe --target <alvo> (o run precisa estar dentro de <alvo>/.webaudit/)."); process.exit(2); }
const { run } = assertRunDir(targetArg, runArg);
const VERSION = pluginVersion();
const CMD = `collect-local.mjs ${positional[0]} ${runArg}`;
const MAX_PAGES = Math.max(1, Math.min(60, Number(opts["max-pages"] ?? 20)));
const BROWSER_PAGES = Math.max(1, Math.min(10, Number(opts["browser-pages"] ?? 5)));
const LH_PAGES = Math.max(0, Math.min(3, Number(opts["lighthouse-pages"] ?? 3)));
const VIEWPORTS = [{ w: 360, h: 800 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }];
const outputs = []; const tools = {};
const slugOf = (u) => { const p = new URL(u).pathname; return p === "/" || p === "" ? "home" : p.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60) || "home"; };
const sameOrigin = (u) => { try { return new URL(u).origin === base.origin; } catch { return false; } };
const SKIP_EXT = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|mp4|webm|mp3|woff2?|ttf|css|js|mjs|json|xml|txt|map)(?:$|\?)/i;

function record(step, file, status, startedAt, extra = {}) { outputs.push({ step, file, status, ...extra }); void startedAt; }
async function fetchText(url, ms = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": `AI-WebAudit/${VERSION}` } }); const body = r.status >= 300 && r.status < 400 ? "" : await r.text(); return { status: r.status, location: r.headers.get("location"), type: r.headers.get("content-type"), body, headers: Object.fromEntries(r.headers) }; }
  catch (e) { return { status: 0, error: String(e?.message ?? e) }; } finally { clearTimeout(t); }
}

// ── 1. descoberta de páginas e links quebrados ──
const startedLinks = new Date().toISOString();
const pages = []; const linkChecks = new Map(); const broken = [];
try {
  const queue = [base.origin + (base.pathname || "/") + base.search]; const seen = new Set(queue.map((u) => u.split("#")[0]));
  while (queue.length && pages.length < MAX_PAGES) {
    const url = queue.shift();
    const r = await fetchText(url);
    const info = { url, status: r.status, content_type: r.type ?? null, location: r.location ?? null, error: r.error ?? null };
    if (r.status >= 200 && r.status < 300 && /html/i.test(r.type ?? "")) {
      pages.push({ ...info, raw_html: r.body, headers: r.headers });
      for (const m of r.body.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) {
        let u; try { u = new URL(m[1], url); } catch { continue; }
        if (!/^https?:$/.test(u.protocol) || !sameOrigin(u.href)) continue;
        const clean = u.origin + u.pathname.replace(/\/index\.html?$/i, "/") + u.search;
        if (SKIP_EXT.test(clean)) continue;
        if (!seen.has(clean)) { seen.add(clean); queue.push(clean); }
      }
    } else { linkChecks.set(url, info); if (r.status === 0 || r.status >= 400) broken.push(info); }
  }
  // verifica links internos que ficaram na fila (limite de páginas atingido) e links de assets simples
  for (const url of queue.slice(0, 80)) { const r = await fetchText(url); const info = { url, status: r.status, location: r.location ?? null, error: r.error ?? null }; linkChecks.set(url, info); if (r.status === 0 || r.status >= 400) broken.push(info); }
  const rel = writeRaw(run, "local/local-links.json", envelope({ tool: `${TOOL_NAME}/collect-local:links`, version: VERSION, command: CMD, startedAt: startedLinks, status: "ok", data: { start_url: base.href, pages_crawled: pages.map((p) => ({ url: p.url, status: p.status })), links_not_followed_due_to_page_limit: queue.length, broken_internal_links: broken, redirects: [...linkChecks.values()].filter((l) => l.status >= 300 && l.status < 400), note: "Somente GET em localhost; links externos não são verificados no modo local." } }));
  record("links", rel, "ok", startedLinks, { pages: pages.length, broken: broken.length });
} catch (e) {
  const rel = writeRaw(run, "local/local-links.json", envelope({ tool: `${TOOL_NAME}/collect-local:links`, version: VERSION, command: CMD, startedAt: startedLinks, status: "failed", error: e?.stack ?? e }));
  record("links", rel, "failed", startedLinks, { error: String(e?.message ?? e).slice(0, 200) });
}
if (!pages.length) {
  const rel = writeRaw(run, "local/local-summary.json", envelope({ tool: `${TOOL_NAME}/collect-local`, version: VERSION, command: CMD, startedAt: startedLinks, status: "failed", error: `Nenhuma página HTML respondeu 2xx em ${base.href}. O servidor está no ar?`, data: { outputs } }));
  console.error(`Falha: nenhuma página HTML respondeu 2xx em ${base.href}. Resumo: ${rel}`); process.exit(1);
}

// ── 2. navegador: capturas, console, requisições, cookies, axe ──
let chromium, AxeBuilder;
try { ({ chromium } = await import("playwright")); const ax = await import("@axe-core/playwright"); AxeBuilder = ax.AxeBuilder ?? ax.default; }
catch (e) { const rel = writeRaw(run, "local/browser-unavailable.json", envelope({ tool: `${TOOL_NAME}/collect-local:browser`, version: VERSION, command: CMD, startedAt: new Date().toISOString(), status: "failed", error: `Playwright/axe indisponível: ${e?.message}. Rode scripts/doctor.sh --install` })); record("browser", rel, "failed", "", { error: "Playwright indisponível" }); }

const slimAxe = (r) => {
  const nodes = (arr) => arr.slice(0, 40).map((v) => ({ id: v.id, impact: v.impact ?? null, help: v.help, help_url: v.helpUrl, tags: v.tags.filter((t) => /^wcag|^best/.test(t)).slice(0, 6), nodes_total: v.nodes.length, nodes: v.nodes.slice(0, 8).map((n) => ({ target: n.target, html: (n.html ?? "").slice(0, 200), summary: (n.failureSummary ?? "").slice(0, 300) })) }));
  return { engine: r.testEngine, url: r.url, timestamp: r.timestamp, violations: nodes(r.violations), incomplete: nodes(r.incomplete), passes_count: r.passes.length, inapplicable_count: r.inapplicable.length, notice: "Itens 'incomplete' exigem revisão manual e NÃO são achados. Automação cobre só parte dos critérios WCAG." };
};
const wc = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

if (chromium) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    tools.playwright = { version: (await import("playwright/package.json", { with: { type: "json" } }).then((m) => m.default.version).catch(() => null)), chromium: browser.version() };
    for (const pg of pages.slice(0, BROWSER_PAGES)) {
      const slug = slugOf(pg.url); const startedAt = new Date().toISOString();
      const pageData = { url: pg.url, slug, lab_data_notice: "Coleta em localhost, contexto limpo, sem interação. Não representa usuários reais.", raw_html: { bytes: pg.raw_html.length, word_count: wc(pg.raw_html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ")), link_count: (pg.raw_html.match(/<a\b[^>]*\bhref=/gi) ?? []).length, has_h1: /<h1\b/i.test(pg.raw_html) }, main_response_headers: pg.headers, viewports: [] };
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, userAgent: `AI-WebAudit/${VERSION} Playwright`, locale: "pt-BR" });
        const page = await ctx.newPage(); const v = { width: vp.w, height: vp.h, console: [], page_errors: [], failed_requests: [], http_errors: [], third_party_hosts: {}, error: null };
        page.on("console", (m) => { if (["error", "warning"].includes(m.type()) && v.console.length < 50) v.console.push({ type: m.type(), text: m.text().slice(0, 400), location: m.location()?.url ? `${m.location().url}:${m.location().lineNumber}` : null }); });
        page.on("pageerror", (e) => { if (v.page_errors.length < 30) v.page_errors.push(String(e?.message ?? e).slice(0, 400)); });
        page.on("requestfailed", (r) => { if (v.failed_requests.length < 50) v.failed_requests.push({ url: r.url().slice(0, 200), failure: r.failure()?.errorText ?? null, type: r.resourceType() }); });
        page.on("response", (r) => { const u = r.url(); if (r.status() >= 400 && v.http_errors.length < 50) v.http_errors.push({ url: u.slice(0, 200), status: r.status() }); try { const h = new URL(u).host; if (h !== base.host && !u.startsWith("data:")) { const e = (v.third_party_hosts[h] ??= { requests: 0, types: new Set() }); e.requests++; e.types.add(r.request().resourceType()); } } catch {} });
        try {
          const resp = await page.goto(pg.url, { waitUntil: "networkidle", timeout: 30000 });
          v.status = resp?.status() ?? null;
          v.title = await page.title();
          const m = await page.evaluate(() => {
            const de = document.documentElement; const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
            const small = []; for (const el of document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[onclick]")) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 24) { if (small.length < 40) small.push({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("placeholder") || "").trim().slice(0, 50), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10, id: el.id || null, cls: (el.className?.toString() ?? "").slice(0, 60) }); } }
            const body = document.body; const text = body?.innerText ?? "";
            const lcpCandidates = [...document.images].filter(vis).slice(0, 3).map((i) => ({ src: i.currentSrc || i.src, loading: i.loading, natural: [i.naturalWidth, i.naturalHeight], rendered: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)], above_fold: i.getBoundingClientRect().top < innerHeight }));
            return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, horizontal_overflow: de.scrollWidth > de.clientWidth + 1, rendered_word_count: text.trim() ? text.trim().split(/\s+/).length : 0, rendered_link_count: document.querySelectorAll("a[href]").length, has_h1: Boolean(document.querySelector("h1")), small_targets: small, first_images: lcpCandidates, lang: de.lang || null, viewport_meta: document.querySelector('meta[name="viewport"]')?.content ?? null, focus_outline_rules: [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].filter((r) => /:focus/.test(r.selectorText ?? "") && /outline\s*:\s*(none|0)/.test(r.cssText)).map((r) => r.cssText.slice(0, 160)); } catch { return []; } }).slice(0, 10) };
          });
          Object.assign(v, m);
          const cookies = await ctx.cookies(); v.cookies_after_load = cookies.map((c) => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires, http_only: c.httpOnly, secure: c.secure, same_site: c.sameSite, value_length: c.value.length }));
          v.storage_keys = await page.evaluate(() => ({ localStorage: Object.keys(localStorage).slice(0, 30), sessionStorage: Object.keys(sessionStorage).slice(0, 30) })).catch(() => null);
          if (!opts["skip-screenshots"]) { const dir = join(run, "raw", "local", "screens"); mkdirSync(dir, { recursive: true }); const f = join(dir, `${slug}-${vp.w}.png`); await page.screenshot({ path: f, fullPage: true }); v.screenshot = `raw/local/screens/${slug}-${vp.w}.png`; }
          if (!opts["skip-axe"] && AxeBuilder && (vp.w === 360 || vp.w === 1440)) {
            try { const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze(); tools.axe = r.testEngine; const rel = writeRaw(run, `local/axe-${slug}-${vp.w}.json`, envelope({ tool: `${TOOL_NAME}/collect-local:axe`, version: r.testEngine?.version, command: CMD, startedAt, status: "ok", data: slimAxe(r) })); v.axe = rel; record("axe", rel, "ok", startedAt, { violations: r.violations.length, incomplete: r.incomplete.length }); }
            catch (e) { const rel = writeRaw(run, `local/axe-${slug}-${vp.w}.json`, envelope({ tool: `${TOOL_NAME}/collect-local:axe`, version: null, command: CMD, startedAt, status: "failed", error: e?.stack ?? e })); record("axe", rel, "failed", startedAt, { error: String(e?.message ?? e).slice(0, 200) }); }
          }
        } catch (e) { v.error = String(e?.message ?? e).slice(0, 500); }
        v.third_party_hosts = Object.fromEntries(Object.entries(v.third_party_hosts).map(([h, e]) => [h, { requests: e.requests, types: [...e.types] }]));
        pageData.viewports.push(v); await ctx.close();
      }
      const status = pageData.viewports.every((v) => v.error) ? "failed" : pageData.viewports.some((v) => v.error) ? "partial" : "ok";
      const rel = writeRaw(run, `local/page-${slug}.json`, envelope({ tool: `${TOOL_NAME}/collect-local:browser`, version: tools.playwright?.chromium, command: CMD, startedAt, status, data: pageData }));
      record("browser", rel, status, startedAt, { viewports: pageData.viewports.length });
    }
  } catch (e) {
    const rel = writeRaw(run, "local/browser-error.json", envelope({ tool: `${TOOL_NAME}/collect-local:browser`, version: null, command: CMD, startedAt: new Date().toISOString(), status: "failed", error: e?.stack ?? e }));
    record("browser", rel, "failed", "", { error: String(e?.message ?? e).slice(0, 200) });
  } finally { try { await browser?.close(); } catch {} }
}

// ── 3. Lighthouse (mobile e desktop, até 3 páginas) ──
if (!opts["skip-lighthouse"] && LH_PAGES > 0 && chromium) {
  const { runLighthouse } = await import("./lib/lighthouse-run.mjs");
  for (const pg of pages.slice(0, LH_PAGES)) {
    for (const mode of ["mobile", "desktop"]) {
      const startedAt = new Date().toISOString(); const slug = slugOf(pg.url);
      const r = await runLighthouse(pg.url, { mode });
      if (r.data?.lighthouse_version) tools.lighthouse = { version: r.data.lighthouse_version };
      const rel = writeRaw(run, `local/lighthouse-${slug}-${mode}.json`, envelope({ tool: `${TOOL_NAME}/collect-local:lighthouse`, version: r.data?.lighthouse_version, command: `${CMD} (lighthouse ${mode} ${pg.url})`, startedAt, status: r.ok ? "ok" : "failed", error: r.error, data: r.data ?? null }));
      record("lighthouse", rel, r.ok ? "ok" : "failed", startedAt, { mode, ...(r.ok ? { performance: r.data.categories?.performance?.score } : { error: (r.error ?? "").slice(0, 200) }) });
    }
  }
}

const failed = outputs.filter((o) => o.status === "failed").length;
const sumRel = writeRaw(run, "local/local-summary.json", envelope({ tool: `${TOOL_NAME}/collect-local`, version: VERSION, command: CMD, startedAt: startedLinks, status: failed === 0 ? "ok" : failed === outputs.length ? "failed" : "partial", data: { start_url: base.href, pages_crawled: pages.length, tools, viewports: VIEWPORTS, outputs } }));
console.log(JSON.stringify({ run, summary: sumRel, tools, outputs }, null, 2));
void dirname;
