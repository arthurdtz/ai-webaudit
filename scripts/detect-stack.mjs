#!/usr/bin/env node
// Reconhecimento (Fase 1): gera o context.json do alvo. Somente leitura.
// Uso: node scripts/detect-stack.mjs <alvo> [--out <arquivo>]
//   --out deve ficar dentro de <alvo>/.webaudit/ (senão recusa). Sem --out, imprime no stdout.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { PLUGIN_ROOT, TOOL_NAME, parseArgs, pluginVersion } from "./lib/common.mjs";
import { HTML_EXT, isProbablyText, readText, walk } from "./lib/walk.mjs";

const { positional, opts } = parseArgs(process.argv.slice(2), { flags: ["out"] });
if (positional.length !== 1) { console.error("Uso: node scripts/detect-stack.mjs <alvo> [--out <arquivo>]"); process.exit(2); }
let target;
try { target = realpathSync(resolve(positional[0])); } catch { console.error(`Alvo não encontrado: ${positional[0]}`); process.exit(2); }
const pluginReal = realpathSync(PLUGIN_ROOT);
if (target === pluginReal || target.startsWith(pluginReal + sep)) { console.error("Erro: o alvo é o diretório do plugin. A auditoria roda no projeto aberto, nunca no plugin."); process.exit(3); }

const git = (...args) => { try { return execFileSync("git", ["-C", target, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const inRepo = git("rev-parse", "--is-inside-work-tree") === "true";
const gitInfo = inRepo
  ? { is_repo: true, root: git("rev-parse", "--show-toplevel"), commit: git("rev-parse", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD"), dirty: (git("status", "--porcelain") ?? "") !== "", remotes: (git("remote") ?? "").split("\n").filter(Boolean) }
  : { is_repo: false, commit: null, branch: null, dirty: null };

const { files, truncated } = walk(target);
const byRel = new Map(files.map((f) => [f.rel, f]));
const has = (rel) => byRel.has(rel);
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(target, rel), "utf8")); } catch { return null; } };

// ── package.json, gerenciador, dependências ──
const pkg = has("package.json") ? readJson("package.json") : null;
const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
const lockfiles = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock", "composer.lock", "Gemfile.lock", "poetry.lock", "requirements.txt"].filter(has);
const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : (has("bun.lockb") || has("bun.lock")) ? "bun" : has("package-lock.json") ? "npm" : pkg ? "npm (sem lockfile)" : null;
const scripts = pkg?.scripts ?? {};
const pickScripts = Object.fromEntries(Object.entries(scripts).filter(([k]) => /^(build|dev|start|preview|serve|test|lint|export|generate)$/.test(k)));

// ── framework ──
const D = (n) => n in deps;
const frameworks = [];
if (D("next")) frameworks.push({ name: "Next.js", version: deps.next, evidence: "dependência next" });
if (D("astro")) frameworks.push({ name: "Astro", version: deps.astro, evidence: "dependência astro" });
if (D("nuxt")) frameworks.push({ name: "Nuxt", version: deps.nuxt, evidence: "dependência nuxt" });
if (D("gatsby")) frameworks.push({ name: "Gatsby", version: deps.gatsby, evidence: "dependência gatsby" });
if (D("@sveltejs/kit")) frameworks.push({ name: "SvelteKit", version: deps["@sveltejs/kit"], evidence: "dependência @sveltejs/kit" });
if (D("@remix-run/react") || D("@remix-run/node")) frameworks.push({ name: "Remix", evidence: "dependência @remix-run/*" });
if (D("vite") && !frameworks.length) frameworks.push({ name: D("react") ? "Vite/React (SPA)" : D("vue") ? "Vite/Vue (SPA)" : "Vite", version: deps.vite, evidence: "dependência vite" });
if (D("react-scripts")) frameworks.push({ name: "Create React App (SPA)", evidence: "dependência react-scripts" });
if (D("express") || D("fastify") || D("koa")) frameworks.push({ name: "Node server (express/fastify/koa)", evidence: "dependência de servidor" });
if (files.some((f) => f.rel.startsWith("wp-content/") || f.rel === "wp-config.php")) frameworks.push({ name: "WordPress", evidence: "wp-content/wp-config.php" });
if (has("composer.json")) frameworks.push({ name: "PHP (composer)", evidence: "composer.json" });
if (has("_config.yml")) frameworks.push({ name: "Jekyll", evidence: "_config.yml" });
if (has("hugo.toml") || has("config.toml") && files.some((f) => f.rel.startsWith("content/"))) frameworks.push({ name: "Hugo", evidence: "hugo.toml/content" });
const htmlFiles = files.filter((f) => HTML_EXT.has(f.ext));
const buildDirs = ["dist", "build", "out", "public", "_site", ".output"].filter((d) => files.some((f) => f.rel.startsWith(d + "/")));
const sourceHtml = htmlFiles.filter((f) => !/^(dist|build|out|_site)\//.test(f.rel));
const framework = frameworks[0]?.name ?? (sourceHtml.length ? "HTML estático" : (pkg ? "Node/JS (sem framework detectado)" : "desconhecido"));

// ── páginas e rotas ──
const routes = [];
const add = (kind, path, file) => { if (routes.length < 300) routes.push({ kind, path, file }); };
for (const f of sourceHtml) add("html", "/" + f.rel.replace(/(^|\/)index\.html?$/, "$1").replace(/\/$/, "") , f.rel);
for (const f of files) {
  let m;
  if ((m = /^(?:src\/)?app\/(.*)\/?page\.(?:[jt]sx?|mdx)$/.exec(f.rel))) add("next-app", "/" + m[1].replace(/\/\([^)]+\)/g, "").replace(/^\([^)]+\)\/?/, ""), f.rel);
  else if ((m = /^(?:src\/)?app\/page\.(?:[jt]sx?|mdx)$/.exec(f.rel))) add("next-app", "/", f.rel);
  else if ((m = /^(?:src\/)?pages\/(?!api\/)(.+)\.(?:[jt]sx?|mdx|astro|vue|md)$/.exec(f.rel)) && !/\/_/.test("/" + f.rel)) add(D("astro") ? "astro" : "pages", "/" + m[1].replace(/\/?index$/, ""), f.rel);
}
const apiRoutes = files.filter((f) => /^(?:src\/)?(?:app\/api\/.*\/route|pages\/api\/|api\/|functions\/|netlify\/functions\/|src\/pages\/api\/|app\/.*\/route\.)/.test(f.rel) && /\.(?:[jt]sx?|mjs|cjs|py|php)$/.test(f.ext || f.name)).map((f) => f.rel);

// ── hosting ──
const hostingNames = ["vercel.json", "vercel.toml", "vercel.ts", "netlify.toml", "_headers", "_redirects", "public/_headers", "public/_redirects", "wrangler.toml", "wrangler.json", "wrangler.jsonc", ".htaccess", "nginx.conf", "firebase.json", "render.yaml", "fly.toml", "Dockerfile", "docker-compose.yml", "next.config.js", "next.config.mjs", "next.config.ts", "astro.config.mjs", "astro.config.ts", "vite.config.js", "vite.config.ts", "nuxt.config.ts", "svelte.config.js", ".github/workflows"];
const hosting = hostingNames.filter((n) => has(n) || files.some((f) => f.rel.startsWith(n + "/")));
const hostingGuess = has("vercel.json") || has("vercel.toml") || hosting.includes(".vercel") ? "vercel" : has("netlify.toml") || has("_headers") || has("_redirects") ? "netlify" : has("wrangler.toml") || has("wrangler.json") ? "cloudflare" : has(".htaccess") ? "apache" : has("firebase.json") ? "firebase" : "desconhecido";

// ── varredura de conteúdo (formulários, analytics, consentimento, sinais) ──
const textFiles = files.filter((f) => isProbablyText(f) && !/\.(map|lock|svg)$/.test(f.name) && !/-lock\.json$/.test(f.name) && f.name !== "package-lock.json");
const forms = []; const analytics = new Map(); const consent = new Set(); const thirdParty = new Set();
const signals = { whatsapp_link: false, tel_link: false, address_like: false, localbusiness_schema: false, ecommerce_words: false, auth_words: false, blog_words: false, cookies_code: false, upload_input: false, dynamic_forms_js: false };
const langs = new Map();
let htmlWithText = 0;
const ANALYTICS = [
  ["ga4/gtag", /gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]|googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/g],
  ["gtm", /googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)|['"](GTM-[A-Z0-9]{4,})['"]/g],
  ["meta-pixel", /fbq\(\s*['"]init['"]\s*,\s*['"]?(\d{6,})|connect\.facebook\.net\/[^'"]+\/fbevents\.js/g],
  ["google-ads", /AW-\d{6,}/g], ["tiktok-pixel", /analytics\.tiktok\.com|ttq\.load\(/g], ["linkedin-insight", /snap\.licdn\.com\/li\.lms-analytics|_linkedin_partner_id/g],
  ["hotjar", /static\.hotjar\.com|hotjar\.com\/c\/hotjar/g], ["clarity", /clarity\.ms\/tag/g], ["plausible", /plausible\.io\/js/g], ["posthog", /posthog\.(?:com|init)/g], ["matomo", /matomo\.js|piwik\.js/g], ["vercel-analytics", /@vercel\/analytics|va\.vercel-scripts\.com/g],
];
const CONSENT = [["cookiebot", /cookiebot/i], ["onetrust", /onetrust|optanon/i], ["klaro", /klaro/i], ["cookieconsent", /cookieconsent|cookie-consent|cookie_consent/i], ["iubenda", /iubenda/i], ["osano", /osano/i], ["termly", /termly/i], ["consent-mode", /gtag\(\s*['"]consent['"]/], ["banner-generico", /(aceitar|rejeitar|gerenciar)\s+(todos\s+os\s+)?cookies|cookie[-_ ]?banner|cookies?-?notice/i]];
const THIRD = [/youtube\.com\/embed|youtube-nocookie\.com/i, /google\.com\/maps|maps\.googleapis\.com/i, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, /recaptcha|hcaptcha/i, /player\.vimeo\.com/i, /(?:tawk\.to|crisp\.chat|intercom\.io|drift\.com|zopim|hs-scripts\.com|jivosite)/i];
for (const f of textFiles) {
  const t = readText(f); if (t === null) continue;
  const isHtml = HTML_EXT.has(f.ext);
  const isCode = isHtml || /\.(?:jsx?|tsx?|mjs|vue|svelte|astro|php|md|mdx)$/.test(f.name);
  if (!isCode) continue;
  const fc = (t.match(/<form\b/gi) ?? []).length; if (fc) forms.push({ file: f.rel, count: fc });
  for (const [vendor, re] of ANALYTICS) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { const id = m.slice(1).find(Boolean) ?? null; const k = vendor; const e = analytics.get(k) ?? { vendor, ids: new Set(), files: new Set() }; if (id) e.ids.add(id); e.files.add(f.rel); analytics.set(k, e); if (m.index === re.lastIndex) re.lastIndex++; } }
  for (const [n, re] of CONSENT) if (re.test(t)) consent.add(n);
  for (const re of THIRD) { const m = re.exec(t); if (m) thirdParty.add(m[0].toLowerCase()); }
  if (/wa\.me\/|api\.whatsapp\.com\/send/i.test(t)) signals.whatsapp_link = true;
  if (/href\s*=\s*["']tel:/i.test(t)) signals.tel_link = true;
  if (/\b(Rua|Av\.?|Avenida|Alameda|Travessa|Rodovia)\s+[A-ZÀ-Ú][\wÀ-ú ]+,?\s*\d+/.test(t) || /"streetAddress"/.test(t)) signals.address_like = true;
  if (/"@type"\s*:\s*"(LocalBusiness|Dentist|Restaurant|Store|HairSalon|MedicalBusiness|ProfessionalService|AutoRepair|LegalService|RealEstateAgent)"/.test(t)) signals.localbusiness_schema = true;
  if (/\b(carrinho|checkout|add-to-cart|addToCart|comprar agora|stripe|mercadopago|pagseguro)\b/i.test(t)) signals.ecommerce_words = true;
  if (/\b(login|signin|sign-in|signup|auth|session|jwt|passport|next-auth|clerk|supabase\.auth)\b/i.test(t) && /\.(?:jsx?|tsx?|mjs|php|vue)$/.test(f.name)) signals.auth_words = true;
  if (/\b(blog|artigo|postagem|publicado em|dicas)\b/i.test(t) && isHtml) signals.blog_words = true;
  if (/document\.cookie|cookies\(\)|Set-Cookie|js-cookie/i.test(t)) signals.cookies_code = true;
  if (/type\s*=\s*["']file["']/i.test(t)) signals.upload_input = true;
  if (isHtml) {
    const lang = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(t)?.[1]; if (lang) langs.set(lang, (langs.get(lang) ?? 0) + 1);
    const visible = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").trim(); if (visible.split(" ").length > 40) htmlWithText++;
  }
}
const envFiles = files.filter((f) => f.name === ".env" || f.name.startsWith(".env.")).map((f) => f.rel);
const appCode = files.some((f) => /\.(?:jsx?|tsx?|mjs|php|py|rb|go|vue|svelte|astro)$/.test(f.name) && !/^(dist|build|out|public|static|assets)\//.test(f.rel) && !/^(js|scripts)\/(analytics|main)\.js$/.test(f.rel)) || apiRoutes.length > 0;
const mainLang = [...langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

// ── tipo provável de site ──
let siteType = "desconhecido"; const why = [];
if (signals.ecommerce_words && (D("stripe") || /woocommerce/i.test(JSON.stringify(deps)) || routes.some((r) => /cart|carrinho|checkout|produto|product/i.test(r.path)))) { siteType = "e-commerce"; why.push("rotas/dependências de carrinho, checkout ou pagamento"); }
else if (signals.auth_words && !htmlFiles.length) { siteType = "aplicação (SaaS/painel)"; why.push("autenticação e ausência de páginas HTML públicas"); }
else if ((signals.address_like || signals.localbusiness_schema) && (signals.tel_link || signals.whatsapp_link || signals.localbusiness_schema)) { siteType = "negócio local"; why.push("endereço/LocalBusiness com telefone ou WhatsApp"); }
else if (signals.blog_words && routes.length > 3) { siteType = "blog"; why.push("conteúdo de artigos em várias rotas"); }
else if (routes.filter((r) => r.kind !== "api").length <= 3 && (forms.length || signals.whatsapp_link)) { siteType = "landing page"; why.push("poucas páginas com formulário/WhatsApp"); }
else if (routes.length) { siteType = "institucional"; why.push("várias páginas públicas sem sinais de loja/aplicação"); }

const context = {
  tool: TOOL_NAME, tool_version: pluginVersion(), generated_at: new Date().toISOString(), command: `detect-stack.mjs ${positional[0]}`,
  target_path: target, git: gitInfo,
  stack: {
    framework, frameworks, language: mainLang, package_manager: pm, lockfiles: lockfiles, has_package_json: Boolean(pkg), package_name: pkg?.name ?? null,
    dependencies_count: Object.keys(pkg?.dependencies ?? {}).length, dev_dependencies_count: Object.keys(pkg?.devDependencies ?? {}).length,
    notable_dependencies: Object.keys(deps).filter((n) => /^(next|react|vue|svelte|astro|vite|express|stripe|@supabase|firebase|prisma|mongoose|sequelize|tailwindcss|next-auth|@clerk|jsonwebtoken|bcrypt|multer|dompurify)/.test(n)).slice(0, 40),
    build_output_dirs: buildDirs,
  },
  commands: { scripts: pickScripts, build: scripts.build ? `${pm?.split(" ")[0] ?? "npm"} run build` : null, dev: scripts.dev ? `${pm?.split(" ")[0] ?? "npm"} run dev` : null, preview: scripts.preview ? `${pm?.split(" ")[0] ?? "npm"} run preview` : (scripts.start ? `${pm?.split(" ")[0] ?? "npm"} start` : null), static_servable: Boolean(sourceHtml.length) && !pkg },
  site_type: siteType, site_type_reason: why,
  pages: { html_files: sourceHtml.map((f) => f.rel), routes: routes.slice(0, 200), routes_total: routes.length },
  hosting: { guess: hostingGuess, config_files: hosting },
  api: { present: apiRoutes.length > 0, files: apiRoutes.slice(0, 80) },
  forms: { total: forms.reduce((s, f) => s + f.count, 0), files: forms.slice(0, 40) },
  analytics: [...analytics.values()].map((e) => ({ vendor: e.vendor, ids: [...e.ids].slice(0, 5), files: [...e.files].slice(0, 10) })),
  consent_signals: [...consent],
  third_party_signals: [...thirdParty].slice(0, 30),
  env_files: envFiles,
  language: mainLang,
  signals: {
    html_public: htmlFiles.length > 0 || routes.length > 0,
    has_text_content: htmlWithText > 0,
    has_cta_or_form: forms.length > 0 || signals.whatsapp_link,
    whatsapp_link: signals.whatsapp_link, tel_link: signals.tel_link,
    has_tracking: analytics.size > 0,
    cookies_or_third_party: signals.cookies_code || thirdParty.size > 0 || analytics.size > 0,
    local_business: siteType === "negócio local" || signals.localbusiness_schema,
    has_api: apiRoutes.length > 0, has_hosting_config: hosting.length > 0,
    has_app_code: appCode, has_dependencies: Object.keys(deps).length > 0,
    has_auth_code: signals.auth_words, has_upload: signals.upload_input, has_env_files: envFiles.length > 0, ecommerce: signals.ecommerce_words,
  },
  walk: { files_scanned: files.length, truncated },
};

const json = JSON.stringify(context, null, 2) + "\n";
if (opts.out) {
  const out = resolve(opts.out); const wa = join(target, ".webaudit");
  mkdirSync(dirname(out), { recursive: true });
  const real = join(realpathSync(dirname(out)), out.split(sep).pop());
  if (!(real.startsWith(wa + sep))) { console.error(`Erro: --out precisa ficar dentro de ${wa}/ (recebido: ${real}).`); process.exit(2); }
  writeFileSync(out, json);
  console.log(`context.json gravado em ${out}`);
} else process.stdout.write(json);
void existsSync;
