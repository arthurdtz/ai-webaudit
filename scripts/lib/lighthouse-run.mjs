// Executa o Lighthouse (mobile e desktop) usando o Chromium do Playwright e devolve um resumo enxuto.
// Laboratório ≠ campo: o resumo é sempre rotulado como dado de laboratório.
import { chromium } from "playwright";

const KEY_AUDITS = [
  "first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "interactive", "server-response-time",
  "largest-contentful-paint-element", "lcp-lazy-loaded", "prioritize-lcp-image", "layout-shifts", "render-blocking-resources", "unminified-javascript", "unused-javascript", "unused-css-rules",
  "uses-long-cache-ttl", "uses-text-compression", "third-party-summary", "unsized-images", "font-display", "uses-optimized-images", "uses-responsive-images", "modern-image-formats", "offscreen-images",
  "total-byte-weight", "dom-size", "redirects", "uses-http2", "viewport", "document-title", "meta-description", "http-status-code", "is-crawlable", "canonical", "hreflang", "link-text", "crawlable-anchors", "robots-txt",
  "errors-in-console", "is-on-https", "no-document-write", "csp-xss", "image-aspect-ratio",
];

function slim(lhr) {
  const audits = {};
  for (const id of KEY_AUDITS) {
    const a = lhr.audits?.[id]; if (!a) continue;
    audits[id] = { title: a.title, score: a.score, scoreDisplayMode: a.scoreDisplayMode, numericValue: a.numericValue ?? null, numericUnit: a.numericUnit ?? null, displayValue: a.displayValue ?? null };
    const items = a.details?.items; if (Array.isArray(items) && items.length) audits[id].items = JSON.parse(JSON.stringify(items.slice(0, 10), (k, v) => (typeof v === "string" && v.length > 240 ? v.slice(0, 240) + "…" : v)));
  }
  return {
    lab_data_notice: "Dado de LABORATÓRIO (Lighthouse, execução única, cache frio). Não representa usuários reais (campo/CrUX).",
    lighthouse_version: lhr.lighthouseVersion, user_agent: lhr.userAgent, fetch_time: lhr.fetchTime, requested_url: lhr.requestedUrl, final_url: lhr.finalDisplayedUrl ?? lhr.finalUrl,
    form_factor: lhr.configSettings?.formFactor, throttling_method: lhr.configSettings?.throttlingMethod, throttling: lhr.configSettings?.throttling,
    run_warnings: lhr.runWarnings, runtime_error: lhr.runtimeError ?? null,
    categories: Object.fromEntries(Object.entries(lhr.categories ?? {}).map(([k, c]) => [k, { score: c.score, title: c.title }])),
    audits,
  };
}

/** @returns {Promise<{ok:boolean, data?:object, error?:string}>} */
export async function runLighthouse(url, { mode = "mobile", categories = ["performance", "seo", "best-practices"], port = 9333 + Math.floor(Math.random() * 400) } = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`] });
    const { default: lighthouse } = await import("lighthouse");
    const flags = { port, output: "json", logLevel: "error", onlyCategories: categories, maxWaitForLoad: 45000 };
    let config;
    if (mode === "desktop") config = (await import("lighthouse/core/config/desktop-config.js")).default;
    const res = await lighthouse(url, flags, config);
    if (!res?.lhr) return { ok: false, error: "Lighthouse não devolveu resultado" };
    if (res.lhr.runtimeError) return { ok: false, error: `${res.lhr.runtimeError.code}: ${res.lhr.runtimeError.message}`, data: slim(res.lhr) };
    return { ok: true, data: slim(res.lhr) };
  } catch (e) {
    return { ok: false, error: String(e?.stack ?? e).slice(0, 1500) };
  } finally {
    try { await browser?.close(); } catch {}
  }
}
