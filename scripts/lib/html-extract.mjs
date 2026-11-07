// Extração de metadados de HTML por expressões regulares (sem dependências). Não executa JS.
import { lineIndex } from "./common.mjs";

const PLACEHOLDERS = [
  { id: "lorem-ipsum", re: /lorem ipsum|dolor sit amet/gi },
  { id: "todo", re: /\b(TODO|FIXME|TBD)\b|\[inserir[^\]]*\]|seu texto aqui|texto de exemplo|nome da empresa\b/gi },
  { id: "framework-title", re: /<title>\s*(Vite \+ React|Create Next App|React App|Document|Untitled|Astro|Home|Página|Page|Untitled Document)\s*<\/title>/gi },
  { id: "example-domain", re: /\b[\w.-]+@(example\.(com|org|net)|seudominio\.com(\.br)?)\b|\bwww\.seudominio\b/gi },
  { id: "fake-document", re: /\(00\)\s?0000-0000|00\.000\.000\/0001-00|000\.000\.000-00/g },
  { id: "placeholder-image", re: /placeholder\.com|via\.placeholder|picsum\.photos|placehold\.co|dummyimage\.com/gi },
];
const DEV_URL = /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|[\w-]+\.local|[\w-]*ngrok[\w.-]*|staging\.[\w.-]+|(?:dev|test|hml|homolog)\.[\w-]+\.[\w.-]+|[\w-]+\.(?:vercel\.app|netlify\.app|pages\.dev))\b/gi;
const MOJIBAKE = /Ã[§£©¡³ºµ¢ª]|â€[™œ"\u009d]|�/g;

function attrs(s) {
  const o = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return o;
}
const clip = (s, n = 160) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const stripTags = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function extractPage(htmlRaw, { maxItems = 60 } = {}) {
  const html = htmlRaw.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " ")); // preserva linhas
  const lineAt = lineIndex(html);
  const tag = (re) => { const out = []; let m; while ((m = re.exec(html))) out.push({ a: attrs(m[1] ?? ""), index: m.index, full: m[0] }); return out; };

  const htmlTag = /<html\b([^>]*)>/i.exec(html);
  const metas = tag(/<meta\b([^>]*)>/gi);
  const links = tag(/<link\b([^>]*)>/gi);
  const metaBy = (name) => metas.filter((m) => (m.a.name ?? "").toLowerCase() === name).map((m) => m.a.content ?? "");
  const titleM = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);

  const headings = []; { const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi; let m; while ((m = re.exec(html)) && headings.length < maxItems) headings.push({ level: +m[1], text: clip(stripTags(m[2]), 120), line: lineAt(m.index) }); }
  const images = tag(/<img\b([^>]*)>/gi).slice(0, 200).map((t) => ({ src: t.a.src ?? t.a["data-src"] ?? null, alt: "alt" in t.a ? t.a.alt : null, width: t.a.width ?? null, height: t.a.height ?? null, loading: t.a.loading ?? null, fetchpriority: t.a.fetchpriority ?? null, srcset: "srcset" in t.a, line: lineAt(t.index) }));

  const anchors = []; let anchorsNoHref = 0; let emptyAnchors = 0;
  { const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m; while ((m = re.exec(html))) { const a = attrs(m[1]); const inner = m[2]; const text = clip(stripTags(inner), 100); const imgAlt = /<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(inner); const hasHref = "href" in a; if (!hasHref) anchorsNoHref++; if (!text && !imgAlt?.[1] && !a["aria-label"] && !a.title) emptyAnchors++; if (anchors.length < 300) anchors.push({ href: hasHref ? a.href : null, text, rel: a.rel ?? null, target: a.target ?? null, line: lineAt(m.index) }); } }
  const fakeClickables = tag(/<(?:div|span|li|td|p)\b([^>]*\bonclick\s*=[^>]*)>/gi).slice(0, 40).map((t) => ({ line: lineAt(t.index), onclick: clip(t.a.onclick, 80) }));

  // formulários
  const forms = [];
  { const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi; let m;
    while ((m = re.exec(html)) && forms.length < 30) {
      const fa = attrs(m[1]); const inner = m[2]; const baseLine = lineAt(m.index);
      const labelsFor = new Set(); { const lr = /<label\b([^>]*)>/gi; let l; while ((l = lr.exec(inner))) { const la = attrs(l[1]); if (la.for) labelsFor.add(la.for); } }
      const wrapped = []; { const lr = /<label\b[^>]*>([\s\S]*?)<\/label>/gi; let l; while ((l = lr.exec(inner))) wrapped.push(l[1]); }
      const fields = [];
      const fr = /<(input|select|textarea|button)\b([^>]*)>/gi; let f;
      while ((f = fr.exec(inner))) {
        const a = attrs(f[2]); const type = (f[1] === "input" ? (a.type ?? "text") : f[1]).toLowerCase();
        if (["hidden", "submit", "button", "reset", "image"].includes(type) && f[1] !== "button") { if (type === "hidden") continue; }
        const wrappedLabel = wrapped.some((w) => w.includes(f[0]));
        fields.push({ tag: f[1], type, name: a.name ?? null, id: a.id ?? null, placeholder: a.placeholder ?? null, autocomplete: a.autocomplete ?? null, required: "required" in a, checked: "checked" in a, has_label: Boolean((a.id && labelsFor.has(a.id)) || wrappedLabel), aria_label: a["aria-label"] ?? a["aria-labelledby"] ?? a.title ?? null, line: baseLine + (inner.slice(0, f.index).match(/\n/g)?.length ?? 0) });
      }
      forms.push({ action: fa.action ?? null, method: (fa.method ?? "get").toLowerCase(), line: baseLine, has_novalidate: "novalidate" in fa, field_count: fields.length, fields: fields.slice(0, 40) });
    } }

  const scripts = [];
  { const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m; while ((m = re.exec(html)) && scripts.length < 80) { const a = attrs(m[1]); scripts.push({ src: a.src ?? null, type: a.type ?? null, async: "async" in a, defer: "defer" in a, module: a.type === "module", integrity: a.integrity ?? null, crossorigin: a.crossorigin ?? null, inline: !a.src, inline_bytes: a.src ? 0 : m[2].length, in_head: m.index < (html.search(/<\/head>/i) >>> 0 || Infinity), line: lineAt(m.index) }); } }

  const jsonld = [];
  { const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(html))) {
      const entry = { line: lineAt(m.index), parse_ok: true, types: [] };
      try { const j = JSON.parse(m[1]); entry.json = clip(JSON.stringify(j), 2500); const collect = (o) => { if (Array.isArray(o)) o.forEach(collect); else if (o && typeof o === "object") { if (o["@type"]) entry.types.push(...[].concat(o["@type"])); Object.values(o).forEach(collect); } }; collect(j); } catch (e) { entry.parse_ok = false; entry.error = e.message; entry.json = clip(m[1], 400); }
      jsonld.push(entry);
    } }

  const iframes = tag(/<iframe\b([^>]*)>/gi).slice(0, 30).map((t) => ({ src: t.a.src ?? null, title: t.a.title ?? null, loading: t.a.loading ?? null, line: lineAt(t.index) }));
  const styles = links.filter((l) => /stylesheet/i.test(l.a.rel ?? "")).map((l) => ({ href: l.a.href ?? null, media: l.a.media ?? null, line: lineAt(l.index) }));
  const preloads = links.filter((l) => /(preload|preconnect|dns-prefetch|prefetch)/i.test(l.a.rel ?? "")).map((l) => ({ rel: l.a.rel, href: l.a.href ?? null, as: l.a.as ?? null, crossorigin: "crossorigin" in l.a, fetchpriority: l.a.fetchpriority ?? null, line: lineAt(l.index) }));

  const hits = (re) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(html)) && out.length < 20) { out.push({ line: lineAt(m.index), match: clip(m[0], 80) }); if (m.index === re.lastIndex) re.lastIndex++; } return out; };
  const placeholders = []; for (const p of PLACEHOLDERS) for (const h of hits(p.re)) placeholders.push({ kind: p.id, ...h });
  const insecure = []; { const re = /\b(?:src|href|action|poster|data-src)\s*=\s*["'](http:\/\/[^"']+)["']|url\(\s*["']?(http:\/\/[^)"']+)/gi; let m; while ((m = re.exec(html)) && insecure.length < 30) insecure.push({ line: lineAt(m.index), url: clip(m[1] ?? m[2], 120) }); }
  const inlineHandlers = (html.match(/\son(click|load|error|mouseover|submit|change|focus)\s*=/gi) ?? []).length;
  const text = stripTags(html);
  const viewport = metaBy("viewport")[0] ?? null;

  return {
    lang: htmlTag ? (attrs(htmlTag[1]).lang ?? null) : null,
    has_html_tag: Boolean(htmlTag),
    charset: metas.find((m) => "charset" in m.a)?.a.charset ?? (metas.find((m) => (m.a["http-equiv"] ?? "").toLowerCase() === "content-type")?.a.content ?? null),
    viewport,
    viewport_blocks_zoom: viewport ? /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport) : false,
    title: titleM ? clip(stripTags(titleM[1]), 200) : null,
    title_count: (html.match(/<title\b/gi) ?? []).length,
    description: metaBy("description")[0] ?? null,
    canonical: links.filter((l) => /\bcanonical\b/i.test(l.a.rel ?? "")).map((l) => ({ href: l.a.href ?? null, line: lineAt(l.index), in_head: l.index < (html.search(/<\/head>/i) >>> 0 || Infinity) })),
    robots_meta: metas.filter((m) => ["robots", "googlebot", "bingbot"].includes((m.a.name ?? "").toLowerCase())).map((m) => ({ name: m.a.name, content: m.a.content ?? "", line: lineAt(m.index) })),
    open_graph: Object.fromEntries(metas.filter((m) => (m.a.property ?? "").startsWith("og:")).map((m) => [m.a.property, m.a.content ?? ""])),
    twitter: Object.fromEntries(metas.filter((m) => (m.a.name ?? "").startsWith("twitter:")).map((m) => [m.a.name, m.a.content ?? ""])),
    icons: links.filter((l) => /\bicon\b/i.test(l.a.rel ?? "")).map((l) => ({ rel: l.a.rel, href: l.a.href ?? null, sizes: l.a.sizes ?? null })),
    hreflang: links.filter((l) => /alternate/i.test(l.a.rel ?? "") && l.a.hreflang).map((l) => ({ hreflang: l.a.hreflang, href: l.a.href ?? null })),
    headings, h1_count: headings.filter((h) => h.level === 1).length,
    images: { total: (html.match(/<img\b/gi) ?? []).length, without_alt: images.filter((i) => i.alt === null).length, items: images.slice(0, maxItems) },
    links: { total: anchors.length, without_href: anchorsNoHref, empty_text: emptyAnchors, items: anchors.slice(0, 150) },
    fake_clickables: fakeClickables,
    forms, scripts, stylesheets: styles, resource_hints: preloads, jsonld, iframes,
    inline_event_handlers: inlineHandlers,
    word_count: text ? text.split(/\s+/).length : 0,
    placeholders,
    dev_urls: hits(DEV_URL),
    insecure_http_resources: insecure,
    mojibake: hits(MOJIBAKE),
  };
}
