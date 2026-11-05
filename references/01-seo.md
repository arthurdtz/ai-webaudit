# 01 — SEO

Prefixo: `SEO` · Subagente: `search-visibility` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo Google/Bing/specs; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

## 1. Escopo e fronteiras

- **Desta área:** rastreamento e indexação em buscadores tradicionais — `robots.txt`, sitemap, canonical, `noindex`/`X-Robots-Tag`, títulos, descrições, headings (visão de busca), URLs, links internos, redirects, códigos de status, hreflang, **validade técnica** de dados estruturados, renderização JS do ponto de vista de indexação.
- **De outras áreas (só referenciar via `related_ids`):**
  - robots por user-agent de IA, conteúdo sem JavaScript para crawlers de IA, `llms.txt` → `AIO`
  - `LocalBusiness`, NAP, mapa → `LOC`
  - qualidade editorial, autoria, E-E-A-T → `CONT`
  - clareza de entidades e citações em IA → `GEO`; estrutura de resposta direta e FAQ como conteúdo → `AEO`
  - headers de segurança → `API`; links quebrados (404 para o usuário), formulários, Open Graph → `QA`
  - estrutura de headings para leitor de tela → `A11Y`
  - configuração/uso do Search Console, monitoramento → `OPS`
  - LCP/INP/CLS → `PERF`

## 2. Quando acionar

- **Aplicável:** qualquer site com páginas HTML públicas (estático, SSR, SSG ou SPA).
- **Não aplicável / reduzido:** app inteiro atrás de login (só checar `robots`/`noindex` da área pública); site de staging intencionalmente bloqueado (registrar como esperado, não como achado, se a evidência mostrar ambiente separado).

## 3. Verificações

### SEO-C01 — `noindex` em páginas que deveriam ser indexáveis  [OFICIAL]
- **O que verificar:** `<meta name="robots">` / `<meta name="googlebot">` com `noindex` ou `none`, e `X-Robots-Tag: noindex|none` (configs de hosting: `vercel.json`, `netlify.toml`, `_headers`, `next.config.*`, `.htaccess`, `wrangler.*`) em páginas públicas que não são rascunho, admin, agradecimento ou resultado de busca interna.
- **Como verificar:** `estatica`; confirmar cabeçalho real com `ativa-remota`/`ativa-local`.
- **Evidência esperada:** `file:line` da diretiva ou cabeçalho em `raw/`.
- **Severidade padrão:** `IMPORTANTE`.
  - Sobe para `CRITICO` (`CONFIRMADO`) quando está em layout/template global, ou no cabeçalho global, afetando o site inteiro em produção.
  - Desce para `OPCIONAL` quando condicionada a ambiente de staging comprovado no código (ex.: `if (process.env.VERCEL_ENV !== 'production')`).
- **Correção:** remover a diretiva ou condicioná-la ao ambiente.
  - Next.js: `metadata.robots` no `layout.tsx`/`page.tsx`; `headers()` em `next.config`.
  - Astro: meta no layout compartilhado.
  - Vite/React: `index.html` e `react-helmet`/equivalente.
  - HTML estático: meta em cada página; `_headers`/`vercel.json`.
- **Validação:** o HTML e os cabeçalhos finais das páginas afetadas não contêm `noindex`.
- Fonte: F1 (block-indexing).

### SEO-C02 — Regras de `robots.txt` bloqueando conteúdo ou recursos necessários  [OFICIAL]
- **O que verificar:** `robots.txt` na raiz do host (`/robots.txt`, UTF-8, ≤ 500 KiB). Procurar `Disallow: /` para `User-agent: *` ou `Googlebot`; bloqueio de diretórios de páginas públicas; bloqueio de CSS/JS/imagens que a página precisa para renderizar; `noindex` dentro do `robots.txt` (não suportado pelo Google); campo `crawl-delay` (ignorado pelo Google); linha `Sitemap:` com URL relativa (precisa ser absoluta).
- **Como verificar:** `estatica` (arquivo local, `public/robots.txt`, geração em código); `ativa-remota` para o arquivo servido.
- **Evidência esperada:** linhas do arquivo (`file:line`) ou corpo/status em `raw/`.
- **Severidade padrão:** `IMPORTANTE`.
  - Sobe para `CRITICO` (`CONFIRMADO`) quando `Disallow: /` vale para todos os crawlers em produção.
  - Desce para `MELHORIA` para `crawl-delay` ou diretivas ignoradas sem efeito prejudicial.
- **Correção:** ajustar grupos; lembrar que cada crawler segue só o grupo mais específico (grupos específicos e `*` não se mesclam); em conflito allow × disallow vale a regra mais específica (caminho mais longo) e, em empate, a menos restritiva.
- **Validação:** URLs-chave permitidas para `Googlebot` e `*`; recursos de renderização não bloqueados.
- Fonte: F2, F3.

### SEO-C03 — `robots.txt` ausente ou com resposta problemática  [OFICIAL]
- **O que verificar:** arquivo existe na raiz do host; resposta `2xx`. `5xx` pausa o rastreamento do site (Google usa cópia em cache por até 30 dias); `4xx` (exceto 429) = sem restrições; redirect > 5 saltos vira 404; redirects por JS/meta refresh não são seguidos. Cada subdomínio precisa do próprio arquivo.
- **Como verificar:** `estatica` (existência no código/build), `ativa-remota` (status real).
- **Evidência esperada:** `file` ausente ou status/cabeçalhos em `raw/`.
- **Severidade padrão:** `MELHORIA` quando ausente (sem robots.txt = sem restrições; é válido).
  - Sobe para `IMPORTANTE` quando a resposta é `5xx` persistente ou rota de SPA devolvendo HTML `200` no lugar do arquivo.
- **Correção:** publicar `robots.txt` mínimo com `Sitemap:` absoluto; garantir que o framework sirva o arquivo estático antes do fallback da SPA.
- **Validação:** `GET /robots.txt` → `200`, `text/plain`.
- Fonte: F3.

### SEO-C04 — Combinação `Disallow` + `noindex` ou canonical em URL bloqueada  [OFICIAL]
- **O que verificar:** URL com `noindex` (meta/header) **também** bloqueada no `robots.txt` — o crawler não vê a diretiva e a URL ainda pode aparecer se linkada. Idem canonical apontando para URL bloqueada.
- **Como verificar:** `estatica` (cruzar regras de robots com templates/headers).
- **Evidência esperada:** par de arquivos/linhas (regra + diretiva).
- **Severidade padrão:** `IMPORTANTE`; desce para `MELHORIA` se a URL é claramente irrelevante (ex.: busca interna).
- **Correção:** para tirar do índice, permitir rastreamento e usar `noindex`; para poupar rastreamento, usar `Disallow` e aceitar que a URL pode aparecer sem descrição.
- **Validação:** regras coerentes, sem URL em ambos os mecanismos.
- Fonte: F2, F1.

### SEO-C05 — Sitemap ausente, inválido ou incoerente  [OFICIAL]
- **O que verificar:** sitemap XML (ou RSS/Atom/texto) existe e é referenciado (`Sitemap:` no robots ou Search Console); UTF-8; ≤ 50 MB sem compactar e ≤ 50.000 URLs por arquivo (usar índice se exceder); URLs absolutas, com protocolo/host canônico; sem URLs `noindex`, redirecionadas, 4xx/5xx ou duplicadas; `<lastmod>` só se verdadeiro (Google usa apenas se consistentemente verificável); `<priority>`/`<changefreq>` são ignorados pelo Google. Sitemap só afeta URLs do seu diretório pai e abaixo; URLs HTTP não devem constar.
- **Como verificar:** `estatica` (arquivo, plugin/gerador: `next-sitemap`, `@astrojs/sitemap`, `app/sitemap.ts`); `ativa-remota` para o servido.
- **Evidência esperada:** trechos do XML, contagem, status em `raw/`.
- **Severidade padrão:** `MELHORIA` para sitemap ausente (é uma dica, não garantia).
  - Sobe para `IMPORTANTE` quando lista URLs `noindex`/4xx/redirecionadas em volume, ou URLs com host errado (staging, `localhost`).
  - `OPCIONAL` para `priority`/`changefreq` presentes (ignorados, sem dano).
- **Correção:** gerar sitemap a partir das rotas públicas indexáveis; URLs absolutas do domínio de produção; adicionar `Sitemap:` ao robots.
- **Validação:** todas as URLs do sitemap respondem `200`, sem `noindex`, canônicas.
- Fonte: F4.

### SEO-C06 — Canonical ausente, incorreto ou conflitante  [OFICIAL]
- **O que verificar:** `<link rel="canonical">` no `<head>` (só aceito ali); URL **absoluta**; uma por página; canonical autorreferente nas páginas canônicas; sem fragmento; sem apontar para URL com `noindex`, bloqueada, redirecionada ou 4xx; sem mistura HTML+header com alvos diferentes; sem `hreflang`/`lang`/`media`/`type` no mesmo `<link>`; apontando para HTTPS (não HTTP); canonical injetada por JS igual à do HTML.
- **Como verificar:** `estatica`; `ativa-local`/`ativa-remota` para HTML renderizado.
- **Evidência esperada:** `file:line` do `<link>` ou saída em `raw/`.
- **Severidade padrão:** `IMPORTANTE` para canonical apontando para URL errada/ausente em páginas duplicadas; `MELHORIA` para ausência de canonical autorreferente em página única.
  - Sobe para `CRITICO` (`CONFIRMADO`) quando o template global aponta todas as páginas para a home ou para domínio de staging.
- **Correção:** gerar canonical absoluta a partir do domínio de produção + caminho da página (Next.js `metadata.alternates.canonical`; Astro `Astro.site`/`Astro.url`; HTML estático: manual por página).
- **Validação:** cada página tem exatamente uma canonical, absoluta, para si mesma (ou para o duplicado preferido).
- Fonte: F5.

### SEO-C07 — `<title>` ausente, duplicado ou genérico  [OFICIAL]
- **O que verificar:** cada página tem `<title>` único, descritivo e conciso; sem texto genérico ("Home", "Untitled", "Document", nome do framework); sem repetição de palavras-chave; nome da marca no início ou fim com separador; sem boilerplate idêntico em muitas páginas; idioma coerente com a página. **Não há limite de tamanho** oficial (o resultado é truncado conforme a largura do dispositivo) — não reportar "título longo" como falha por contagem de caracteres.
- **Como verificar:** `estatica`; `ativa-local` para HTML renderizado em SPA.
- **Evidência esperada:** `file:line` do `<title>`; lista de títulos duplicados.
- **Severidade padrão:** `IMPORTANTE` quando ausente ou idêntico em várias páginas; `MELHORIA` para título genérico/pouco descritivo.
- **Correção:** título por rota gerado de dados da página (Next.js `metadata.title`; Astro prop no layout; React `Helmet`).
- **Validação:** títulos únicos por URL indexável.
- Fonte: F6.

### SEO-C08 — Meta description ausente ou duplicada  [OFICIAL → efeito limitado]
- **O que verificar:** `<meta name="description">` presente, única por página e fiel ao conteúdo. O Google gera o snippet do conteúdo e usa a meta description só quando ela descreve melhor a página; sem limite oficial de tamanho.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` ou lista de páginas sem a tag/com texto repetido.
- **Severidade padrão:** `MELHORIA` (efeito indireto, sem garantia de exibição).
- **Correção:** descrição curta e específica por página.
- **Validação:** presença e unicidade nas páginas indexáveis.
- **Nunca afirmar:** que a meta description melhora ranking.
- Fonte: F7.

### SEO-C09 — Controles de snippet usados de forma indevida  [OFICIAL]
- **O que verificar:** `nosnippet`, `max-snippet:0` ou `data-nosnippet` em áreas de conteúdo principal sem intenção declarada.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `MELHORIA`; sobe para `IMPORTANTE` se global (layout/header) sem justificativa.
- **Correção:** remover ou restringir ao trecho sensível. **Validação:** diretivas ausentes do conteúdo principal.
- Fonte: F7.

### SEO-C10 — Estrutura de URLs  [OFICIAL + PRÁTICA]
- **O que verificar:** palavras separadas por hífen (não `_`); URLs descritivas em vez de IDs aleatórios [PRÁTICA]; caixa consistente (URLs diferenciam maiúsculas/minúsculas; o servidor não deve servir a mesma página em duas caixas); **sem fragmentos (`#`) para alterar conteúdo** (usar History API); parâmetros que não mudam conteúdo (IDs de sessão, referral, ordenação) gerando URLs duplicadas; filtros combináveis criando explosão de URLs; caracteres não ASCII percent-encoded.
- **Como verificar:** `estatica` (rotas, router, sitemap).
- **Evidência esperada:** exemplos de URL/rota com `file:line`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` para roteamento SPA por fragmento (`#/rota`) em site que deveria ser indexado, ou parâmetros de sessão gerando duplicatas em larga escala (`CONFIRMADO`).
- **Correção:** roteamento por History API; canonical + redirect para a forma preferida; bloquear no robots só URLs de busca interna/filtros irrelevantes.
- **Validação:** cada conteúdo tem uma URL; roteador sem `#/`.
- Fonte: F8, F11.

### SEO-C11 — Links internos não rastreáveis ou âncoras vazias  [OFICIAL]
- **O que verificar:** navegação com `<a href>` (não `<span onclick>`, `routerLink` sem `href`, `javascript:`); âncora com texto descritivo (evitar "clique aqui"); link em imagem com `alt` descritivo (o `alt` vira texto-âncora; `alt` vazio em link de imagem é prática ruim); páginas importantes linkadas a partir de ao menos uma outra (órfãs); ausência de links `nofollow` em links internos sem motivo; links externos pagos/UGC com `sponsored`/`ugc`/`nofollow`.
- **Como verificar:** `estatica`; `ativa-local` para links gerados por JS.
- **Evidência esperada:** `file:line`; lista de páginas órfãs (rotas sem link de entrada).
- **Severidade padrão:** `IMPORTANTE` para navegação principal sem `<a href>` em site que depende dela; `MELHORIA` para âncoras genéricas/`alt` vazio.
- **Correção:** trocar por `<a href>` (componente `Link` do framework já gera); `alt` descritivo.
- **Validação:** todas as rotas indexáveis alcançáveis por `<a href>` a partir da home.
- Links quebrados (404) → `QA`.
- Fonte: F9, F11.

### SEO-C12 — Redirects mal configurados  [OFICIAL]
- **O que verificar:** mudanças permanentes com `301`/`308` (não `302`/`307`); cadeias longas (Googlebot segue até 10 saltos; preferir 1); redirects por JS ou meta refresh onde havia opção de servidor (JS é o menos confiável); variantes `http→https` e `www`/apex consolidadas em uma só; ciclos.
- **Como verificar:** `estatica` (configs `redirects`, `vercel.json`, `_redirects`, `next.config`); `ativa-remota`/`ativa-local` para a cadeia real.
- **Evidência esperada:** regra com `file:line` ou cadeia de status em `raw/`.
- **Severidade padrão:** `IMPORTANTE` para ciclo, cadeia > 3 saltos ou http/www sem consolidação (`CONFIRMADO`); `MELHORIA` para `302` onde a mudança é permanente.
- **Correção:** `301`/`308` direto ao destino final. **Validação:** 1 salto até o destino canônico.
- Fonte: F10, F12.

### SEO-C13 — Códigos de status e soft 404  [OFICIAL]
- **O que verificar:** URL inexistente retorna `404` (ou `410`) e não `200`; página de erro tem conteúdo de erro mas status `200` (soft 404); SPA sem status significativo (workaround: redirecionar para URL 404 real ou injetar `noindex` na view de erro); páginas que exigem login retornam `401`/`403`; `5xx` persistente; `401`/`403` usados para limitar rastreamento (não é indicado).
- **Como verificar:** `estatica` (config de 404 do host/framework); `ativa-remota`/`ativa-local` com URL inexistente (única requisição GET).
- **Evidência esperada:** status e corpo em `raw/`; `file:line` da rota catch-all.
- **Severidade padrão:** `IMPORTANTE` para soft 404 generalizado (`CONFIRMADO`); `MELHORIA` caso isolado.
- **Correção:** `404.html`/`not-found` do framework com status 404; fallback de SPA só para rotas conhecidas. **Validação:** URL aleatória → 404.
- Fonte: F12, F13.

### SEO-C14 — hreflang  [OFICIAL]
- **O que verificar (só se houver versões localizadas):** retorno recíproco entre todas as versões; autorreferência; mesmo conjunto em todas; `x-default` quando há seletor/redirecionamento; códigos ISO 639-1 (+ ISO 3166-1 alpha-2 opcional; **região sozinha é inválida**; `UK`/`EU` são inválidos, usar `GB`); URLs absolutas com protocolo; um único método (HTML, header ou sitemap); canonical no mesmo idioma.
- **Como verificar:** `estatica`; `ativa-remota` para reciprocidade real.
- **Evidência esperada:** `file:line` das tags; tabela de reciprocidade.
- **Severidade padrão:** `IMPORTANTE` para falta de reciprocidade/códigos inválidos (`CONFIRMADO`); `MELHORIA` para falta de `x-default`.
- **Correção:** gerar o conjunto a partir de uma única fonte de rotas. **Validação:** matriz de links de retorno completa.
- Não acionar em site de um único idioma.
- Fonte: F14.

### SEO-C15 — Dados estruturados: validade técnica  [OFICIAL]
- **O que verificar:** JSON-LD (formato recomendado) bem-formado; propriedades **obrigatórias** do tipo presentes; marcação corresponde ao conteúdo visível; sem conteúdo oculto, avaliações falsas ou tipo irrelevante; páginas com marcação acessíveis ao Googlebot; imagens da marcação rastreáveis; **tipos descontinuados não são recomendados**: FAQ (`FAQPage`, deixou de aparecer na Pesquisa a partir de 07/05/2026), HowTo (rich result removido em 2023), Sitelinks search box, Practice problem, Special announcement, Course info, Estimated salary, Learning video, Vehicle listing. Markup válido **não garante** rich result.
- **Como verificar:** `estatica` (blocos `<script type="application/ld+json">`, microdata, RDFa); `manual` para o Rich Results Test (ferramenta externa).
- **Evidência esperada:** `file:line` do bloco; propriedade faltante.
- **Severidade padrão:** `IMPORTANTE` para JSON-LD inválido ou marcação enganosa/oculta (risco de ação manual); `MELHORIA` para propriedades recomendadas ausentes; `OPCIONAL` para marcação de tipo descontinuado já presente (sem dano; pode permanecer, não recomendar novo uso).
- **Correção:** corrigir sintaxe/propriedades; remover marcação que não reflete o conteúdo visível. **Validação:** JSON parseia; propriedades obrigatórias presentes; conteúdo marcado visível.
- `LocalBusiness`/`Organization` local → `LOC`; FAQ como conteúdo → `AEO`.
- Fonte: F15, F16, F17.

### SEO-C16 — Conteúdo, links e metadados dependentes de JavaScript  [OFICIAL]
- **O que verificar:** conteúdo principal e links presentes no HTML renderizado (Google renderiza JS, mas depende de fila/recursos); `noindex` no HTML original **impede** a renderização e alterações por JS (não usar `noindex` na fonte se a página deve ser indexada); canonical no HTML (ou idêntica se injetada por JS; nunca duas); título/descrição únicos mesmo em SPA; navegação por History API; assets com *fingerprint* no nome (cache agressivo); web components: só o que aparece no HTML renderizado é indexado.
- **Como verificar:** `estatica` (framework, modo de renderização); `ativa-local` para comparar HTML bruto × renderizado.
- **Evidência esperada:** trecho do HTML bruto vazio vs. renderizado em `raw/`; config de renderização com `file:line`.
- **Severidade padrão:** `IMPORTANTE` para SPA puro (app shell vazio) em site que precisa de busca orgânica (`CONFIRMADO`); `MELHORIA` para metadados só via JS.
- **Correção:** SSR/SSG/pré-renderização para páginas indexáveis (Next.js SSG/SSR; Astro por padrão; Vite: pré-render ou SSR).
- **Validação:** HTML bruto de cada página-chave contém título, canonical, texto principal e links.
- Disponibilidade sem JS para **crawlers de IA** → `AIO` (referenciar).
- Fonte: F13.

## 4. Falsos positivos e armadilhas

- Site em staging/pré-lançamento com `noindex` e `Disallow: /` **intencionais**: marcar como esperado se a evidência mostrar que não vão para produção; reportar como risco de publicação (`QA`) se o mesmo arquivo for usado em produção.
- Páginas utilitárias (login, carrinho, agradecimento, busca interna) com `noindex` são corretas.
- Título "longo" não é falha (sem limite oficial).
- `priority`/`changefreq` presentes: ignorados, não prejudicam.
- Sitemap ausente em site pequeno bem linkado não é falha grave.
- Ordem de headings não afeta a Pesquisa do Google (afeta acessibilidade → `A11Y`); não reportar como SEO.
- `robots.txt` gerado em runtime (rotas de framework) pode não existir como arquivo: verificar rota/handler antes de reportar ausência.
- `nofollow` em links externos é legítimo; só é problema se aplicado a links internos sem motivo.
- Canonical relativa em HTML estático local pode ser artefato de desenvolvimento: confirmar no build/produção.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `metadata`/`generateMetadata`, `app/robots.ts`, `app/sitemap.ts`, `alternates.canonical`; verificar `next.config` (`redirects`, `headers`); páginas `use client` sem SSR perdem conteúdo no HTML bruto. |
| Astro | HTML estático por padrão; `site` em `astro.config` necessário para canonical/sitemap absolutos; `@astrojs/sitemap`. |
| Vite/React (SPA) | `index.html` único: título/canonical/descrição por rota exigem biblioteca de head; sem SSR o HTML bruto fica vazio; roteador deve usar History API. |
| HTML estático | Tudo manual por página; conferir cópia/cola de canonical/título entre páginas; `_redirects`/`.htaccess` para redirects. |
| Outros (WordPress, PHP…) | Plugins de SEO podem gerar sitemap/canonical; verificar duplicação entre plugin e tema; "desencorajar buscadores" do CMS = `noindex` global. |

## 6. O que nunca afirmar

- Que o site "está indexado", "vai ranquear" ou "está otimizado para o Google" sem dados de Search Console (não acessível aqui).
- Que meta description, ordem de headings, quantidade de palavras ou palavras-chave na URL melhoram ranking.
- Que dados estruturados garantem rich results, ou que FAQ/HowTo geram rich result hoje.
- Que `robots.txt` remove páginas do índice.
- Contagem de caracteres "ideal" para título/descrição como regra oficial.
- Que E-E-A-T é fator de ranking (a documentação diz que não é).
- Prazos de reindexação.

## 7. Fontes

- F1 — Block Search indexing with `noindex` — https://developers.google.com/search/docs/crawling-indexing/block-indexing — acessado em 2026-11-05
- F2 — Introduction to robots.txt — https://developers.google.com/search/docs/crawling-indexing/robots/intro — 2026-11-05
- F3 — How Google interprets the robots.txt specification — https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt — 2026-11-05
- F4 — Build and submit a sitemap — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap — 2026-11-05
- F5 — Consolidate duplicate URLs / canonicalization — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls — 2026-11-05
- F6 — Influence your title links — https://developers.google.com/search/docs/appearance/title-link — 2026-11-05
- F7 — Control your snippets / meta description — https://developers.google.com/search/docs/appearance/snippet — 2026-11-05
- F8 — URL structure best practices — https://developers.google.com/search/docs/crawling-indexing/url-structure — 2026-11-05
- F9 — Make your links crawlable — https://developers.google.com/search/docs/crawling-indexing/links-crawlable — 2026-11-05
- F10 — Redirects and Google Search — https://developers.google.com/search/docs/crawling-indexing/301-redirects — 2026-11-05
- F11 — SEO Starter Guide — https://developers.google.com/search/docs/fundamentals/seo-starter-guide — 2026-11-05
- F12 — HTTP status codes, and network and DNS errors — https://developers.google.com/search/docs/crawling-indexing/http-network-errors — 2026-11-05
- F13 — JavaScript SEO basics (status codes, soft 404 em SPA) — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics — 2026-11-05
- F14 — Localized versions / hreflang — https://developers.google.com/search/docs/specialty/international/localized-versions — 2026-11-05
- F15 — General structured data guidelines — https://developers.google.com/search/docs/appearance/structured-data/sd-policies — 2026-11-05
- F16 — Structured data search gallery — https://developers.google.com/search/docs/appearance/structured-data/search-gallery — 2026-11-05
- F17 — Google Search documentation updates (FAQ removido em 07/05/2026; Sitelinks search box, Practice problem, Special announcement, Course info e outros descontinuados) — https://developers.google.com/search/updates — 2026-11-05 (leitura parcial da página: ~100 mil dos ~195 mil caracteres) — e HowTo: https://developers.google.com/search/blog/2023/08/howto-faq-changes
