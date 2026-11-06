# 08 — Performance e Core Web Vitals

Prefixo: `PERF` · Subagente: `performance` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo Google/web.dev/Chrome; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Regra central.** **Laboratório ≠ campo.** Lighthouse é medição de laboratório (um dispositivo, uma rede, um local, cache frio). Os limiares de Core Web Vitals valem para o **percentil 75 de dados de campo**. Sem medição, o item vai para `not_tested`: **nunca estimar** LCP, INP, CLS ou nota. Nenhum achado de performance chega a `CRITICO` (não há falha de segurança/funcionamento) — o teto é `IMPORTANTE`.

## 1. Escopo e fronteiras

- **Desta área:** LCP, INP, CLS (INP substituiu o FID); imagens (carregamento, dimensões, peso); fontes; JS/CSS (bloqueio, tamanho); cache; compressão; *resource hints*; scripts de terceiros (**impacto de performance**); medição de laboratório e campo.
- **De outras áreas (só referenciar via `related_ids`):**
  - `alt` de imagem, foco, movimento reduzido → `A11Y`
  - existência/configuração de tags GA4/GTM/Pixel, eventos, duplicação → `ANL` (aqui só o **custo de performance** do script)
  - widget de chat/WhatsApp que ajuda conversão mas pesa → trade-off com `CRO`
  - banner de cookies (consentimento) → `PRIV`; aqui só o **deslocamento de layout** que ele causa
  - headers de segurança → `API`; renderização JS para indexação → `SEO-C16`; HTML sem JS para IA → `AIO-C04`
  - links quebrados, erros de console → `QA`
- **Medição é coleta** (Fase 3 do orquestrador): o subagente analisa `raw/` e código; não roda ferramentas.

## 2. Quando acionar

- **Aplicável:** qualquer site com páginas públicas.
- **Reduzido:** site sem build/servidor possível → só verificações `estatica`; métricas medidas vão para `not_tested`.
- **Medição de laboratório** (`ativa-local`/`ativa-remota`): Lighthouse, mobile e desktop, até 3 páginas principais (SPEC §8). `ativa-remota` só com `--url`.

## 3. Verificações

### PERF-C01 — Métricas de laboratório (Lighthouse) interpretadas com seus limites  [OFICIAL]
- **O que verificar:** nos relatórios Lighthouse em `raw/` (mobile e desktop, por página), registrar LCP, CLS, TBT e a nota **como números de laboratório**, com versão do Lighthouse e condições. Comparar com os limiares oficiais de **campo** apenas como **indicador**:

  | Métrica | Bom (p75, campo) | Ruim |
  |---|---|---|
  | LCP | ≤ 2,5 s | > 4,0 s |
  | INP | ≤ 200 ms | > 500 ms |
  | CLS | ≤ 0,1 | > 0,25 |

  A nota Lighthouse tem faixas 0–49 (ruim), 50–89 (precisa melhorar), 90–100 (bom); é média ponderada de métricas (na página oficial consultada, pesos do Lighthouse 10: FCP 10%, Speed Index 10%, LCP 25%, TBT 30%, CLS 25%) e **varia entre execuções** (testes A/B, anúncios, rede, extensões) → tratar como distribuição, não número único. **INP não é medido** por Lighthouse de carregamento de página; TBT é só proxy aproximado e não substitui o INP.
- **Como verificar:** `ativa-local` / `ativa-remota` (relatório em `raw/`); sem relatório → `not_tested`.
- **Evidência esperada:** `raw_ref` do JSON do Lighthouse, versão, comando, horário, modo (mobile/desktop).
- **Severidade padrão:** `MELHORIA` (laboratório "precisa melhorar": LCP > 2,5 s ou CLS > 0,1).
  - Sobe para `IMPORTANTE` quando o laboratório cai na faixa **ruim** (LCP > 4,0 s ou CLS > 0,25) de forma consistente em mais de uma execução e há causa identificável (outros checks `PERF-C03…C13`).
  - Nunca `CRITICO`.
- **Correção:** tratar a causa (checks seguintes), não a métrica. **Validação:** nova execução do mesmo script/condições; comparar medianas de várias execuções.
- **Atenção:** informar sempre "dado de laboratório, não de usuários reais". Se o relatório não existe, **não** inferir valores a partir do código.
- Fonte: F1, F2, F3, F4, F5.

### PERF-C02 — Dados de campo (CrUX/Search Console) — verificação manual  [OFICIAL; manual]
- **O que verificar:** se o site tem dados de campo e como estão (p75 de LCP/INP/CLS, mobile e desktop). O CrUX só inclui páginas/origens **publicamente descobríveis** (indexáveis, resposta 200 após redirects) e **populares o bastante** (limiar não divulgado); páginas com pouco tráfego **não** têm dados. Só o dono acessa PageSpeed Insights, relatório de Core Web Vitals do Search Console ou CrUX.
- **Como verificar:** `manual` → `not_tested` (`PERF-C02`).
- **Evidência esperada:** nenhuma (item de checklist).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono informa p75 de campo por métrica e dispositivo; sem dado de campo, registrar "sem dados suficientes" e basear a priorização em laboratório, **dizendo isso no relatório**.
- Fonte: F5, F6.

### PERF-C03 — Elemento de LCP descobrível e priorizado  [OFICIAL]
- **O que verificar:** a imagem candidata a LCP (herói, banner) está no **HTML inicial** com `src`/`srcset` (não injetada por JS, `data-src` ou só como `background-image` CSS); **não** usa `loading="lazy"`; tem `fetchpriority="high"` (em no máximo uma ou duas imagens); quando vem de CSS/JS, há `<link rel="preload" as="image">`. LCP inclui `<img>`, `<svg><image>`, `<video>` (poster), `background-image` com `url()` e blocos de texto. Partes ideais do LCP (diretriz, não regra): TTFB ~40%, atraso de carregamento do recurso < 10%, duração do download ~40%, atraso de renderização < 10%.
- **Como verificar:** `estatica` (templates/componentes); `ativa-local` para confirmar o elemento LCP real no relatório.
- **Evidência esperada:** `file:line` da imagem; elemento LCP do relatório (`raw_ref`).
- **Severidade padrão:** `IMPORTANTE` quando a imagem LCP tem `loading="lazy"` ou só existe via JS/CSS sem preload (`CONFIRMADO` por código); `MELHORIA` quando só falta `fetchpriority`.
- **Correção:** remover `lazy`, adicionar `fetchpriority="high"`, expor no HTML; Next.js `priority` no `<Image>`; Astro `loading="eager"`/`fetchpriority`. **Validação:** relatório mostra LCP element sem atraso de descoberta.
- Fonte: F7, F8.

### PERF-C04 — Lazy loading correto  [OFICIAL]
- **O que verificar:** `loading="lazy"` só em imagens/iframes **fora da viewport inicial**; sem `lazy` em imagens acima da dobra; `lazy` + `fetchpriority="high"` não faz sentido; imagens com `lazy` têm `width`/`height` (senão aumentam CLS); `loading` não funciona em `background-image` CSS; `display:none` não carrega, `opacity:0` carrega.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `IMPORTANTE` para `lazy` em imagem acima da dobra/LCP (`CONFIRMADO`); `MELHORIA` para imagens abaixo da dobra sem `lazy`.
- **Correção:** `lazy` apenas abaixo da dobra; iframes pesados (mapa, vídeo) com `loading="lazy"`. **Validação:** nenhuma imagem inicial com `lazy`.
- Fonte: F9.

### PERF-C05 — Dimensões de imagens, vídeo e iframes (CLS)  [OFICIAL]
- **O que verificar:** `<img>`, `<video>`, `<iframe>` com `width` e `height` (valores intrínsecos) + CSS `height: auto; max-width: 100%`, ou `aspect-ratio`; `<source>` de `<picture>` também com dimensões. Imagens/vídeos de dimensão desconhecida são causa principal de CLS.
- **Como verificar:** `estatica`; confirmar com CLS de laboratório (`ativa-local`).
- **Evidência esperada:** `file:line`; lista de elementos sem dimensão.
- **Severidade padrão:** `IMPORTANTE` quando faltam em imagens acima da dobra e o laboratório mostra CLS > 0,1 atribuído a elas; `MELHORIA` caso contrário.
- **Correção:** adicionar `width`/`height` ou `aspect-ratio`. **Validação:** CLS de laboratório cai e nenhuma mudança atribuída a essas imagens.
- Fonte: F10, F11.

### PERF-C06 — Peso e adequação das imagens  [PRÁTICA]
- **O que verificar:** imagens com dimensões intrínsecas muito maiores que o tamanho exibido; ausência de imagens responsivas (`srcset`/`sizes`) quando a mesma imagem serve celular e desktop; arquivos sem compressão; formatos modernos (AVIF/WebP) quando o resultado permanece visualmente aceitável. A página consultada (web.dev/learn) afirma que "a única forma de apresentar uma imagem mais rápido é reduzir seu tamanho de transferência" e recomenda servir só o ativo adequado ao contexto; **nenhum limiar numérico nem a eficácia de AVIF/WebP foram confirmados nas fontes lidas** — sem número oficial, **não usar KB como regra**.
- **Como verificar:** `estatica` (arquivos de imagem, tags); `ativa-local` (transferência real do LCP em `raw/`).
- **Evidência esperada:** nome do arquivo, dimensões intrínsecas vs. exibidas, tamanho em bytes (medido, não estimado).
- **Severidade padrão:** `MELHORIA`.
- **Correção:** otimizar/redimensionar; `srcset`/`sizes`; componente de imagem do framework (`next/image`, `astro:assets`). **Validação:** tamanho transferido da imagem LCP diminui e LCP de laboratório não piora.
- **Nunca** sugerir "economia de X%" sem medir.
- Fonte: F12.

### PERF-C07 — Fontes web  [OFICIAL]
- **O que verificar:** `@font-face` declarado no `<head>`/CSS crítico; **WOFF2** (melhor compressão, ~30% melhor que WOFF segundo a fonte); `font-display` coerente (`optional` para evitar *layout shift*; `swap` se o texto deve aparecer logo; `block` se deve usar a fonte web); `size-adjust`/`ascent-override`/`descent-override`/`line-gap-override` para casar métricas do fallback; no máximo a fonte mais importante em `preload` (preload ignora `unicode-range`), com `crossorigin`; poucas famílias/pesos (variáveis quando há muitos estilos); subconjunto de glifos; ícones em SVG em vez de fonte de ícones; fontes de terceiros com `preconnect` (origem do CSS e, com `crossorigin`, do arquivo); auto-hospedar só com CDN e HTTP/2, senão não há ganho garantido.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do `@font-face`/`<link>`; formato e `font-display`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando fontes causam CLS medido no laboratório (> 0,1 atribuído ao texto) ou a fonte web bloqueia a renderização do LCP de texto.
- **Correção:** WOFF2 + `font-display` + métricas de fallback; Next.js `next/font`. **Validação:** CLS de laboratório sem mudanças atribuídas à troca de fonte.
- Fonte: F13, F10.

### PERF-C08 — Conteúdo tardio sem espaço reservado (anúncios, embeds, banners)  [OFICIAL]
- **O que verificar:** widgets, anúncios, embeds, banners de cookie, formulários inseridos dinamicamente **sem espaço reservado** (`min-height`/`aspect-ratio`/esqueleto) ou empurrando o conteúdo; conteúdo injetado no topo da página; animações por `top/left/width/height` em vez de `transform`; placeholder removido quando o anúncio não carrega. Consentimento em si → `PRIV`.
- **Como verificar:** `estatica`; `ativa-local` com captura/CLS em `raw/`.
- **Evidência esperada:** `file:line` do componente; entradas de *layout shift* do relatório.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando o laboratório atribui CLS > 0,1 a esse elemento.
- **Correção:** reservar espaço, sobrepor em vez de empurrar, animar com `transform`. **Validação:** CLS de laboratório < 0,1 sem deslocamentos atribuídos.
- Fonte: F10, F11.

### PERF-C09 — Scripts e CSS bloqueantes de renderização  [OFICIAL parcial + PRÁTICA]
- **O que verificar:** `<script src>` no `<head>` sem `async`/`defer` que não precise rodar antes da renderização; CSS não crítico bloqueando renderização; bundles muito grandes carregados na página inicial; `preload` de JS demais competindo por banda (pode prejudicar o INP). Fonte oficial: carregar scripts de terceiros de forma assíncrona "a menos que precisem rodar antes da renderização"; `defer` executa em ordem após o *parsing*. **Não há limite oficial de KB para bundle** → não reportar por tamanho absoluto; usar tamanho **medido** da saída de build como evidência e comparar com a necessidade da página.
- **Como verificar:** `estatica` (templates, `next.config`, `vite.config`); saída de build existente em `raw/`; `ativa-local` para TBT e o diagnóstico do Lighthouse.
- **Evidência esperada:** `file:line` do `<script>`; tamanho de bundle medido.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando script/CSS bloqueante atrasa o LCP medido no laboratório (> 2,5 s com causa nesses recursos).
- **Correção:** `defer`/`async`; *code splitting*; carregar o que for interativo sob demanda. **Validação:** TBT e LCP de laboratório não pioram; script deixa de aparecer como bloqueante.
- INP real só em campo (PERF-C02).
- Fonte: F14, F15, F16.

### PERF-C10 — Cache HTTP  [OFICIAL]
- **O que verificar:** ativos com *fingerprint* no nome (`style.x234dff.css`, `main.abc123.js`) com `Cache-Control: max-age=31536000` (valor máximo suportado; `immutable` opcional, ignorado por alguns navegadores); HTML e URLs sem versão com `no-cache` (revalidar) + `ETag`; `no-store` só em conteúdo que **não** deve ser armazenado; ausência de `Cache-Control` não desliga o cache (o navegador "adivinha" uma política) → definir explicitamente. Configs: `vercel.json`, `netlify.toml`, `_headers`, `next.config` `headers()`, `.htaccess`, `nginx.conf`.
- **Como verificar:** `estatica` (config de hosting); `ativa-remota`/`ativa-local` para cabeçalhos reais.
- **Evidência esperada:** regra com `file:line` ou cabeçalhos em `raw/`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando ativos versionados têm `no-store`/`max-age` curto em larga escala **e** foi medido impacto (relatório Lighthouse de cache).
- **Correção:** `max-age=31536000, immutable` em `/assets/*` com hash; `no-cache` em HTML. **Validação:** cabeçalhos corretos por tipo de recurso.
- **Atenção:** nunca recomendar `max-age` longo em URL sem versionamento (usuário preso a versão antiga).
- Fonte: F17.

### PERF-C11 — Compressão de texto  [OFICIAL]
- **O que verificar:** HTML, CSS, JS e SVG servidos com **Brotli** (preferível) ou gzip; imagens não precisam recompressão; arquivos muito pequenos (~4–5 KB) podem não se beneficiar. A fonte indica compressão frequentemente de 70–90% em arquivos maiores (tabela dela: 65–86% em bibliotecas JS no nível máximo). Compressão estática (pré-comprimida) permite níveis máximos; dinâmica usa níveis intermediários.
- **Como verificar:** `ativa-remota`/`ativa-local` (cabeçalho `Content-Encoding` e tamanho transferido vs. recurso); `estatica` (config de CDN/servidor).
- **Evidência esperada:** cabeçalhos de resposta em `raw/`.
- **Severidade padrão:** `IMPORTANTE` quando recursos de texto grandes (JS/CSS/HTML) são servidos **sem compressão** (`CONFIRMADO` por cabeçalhos); `MELHORIA` quando só gzip está disponível.
- **Correção:** ativar Brotli/gzip no host/CDN (maioria das plataformas já faz). **Validação:** `Content-Encoding: br|gzip` nos recursos de texto.
- Fonte: F18.

### PERF-C12 — Scripts de terceiros: custo de performance  [OFICIAL parcial]
- **O que verificar:** tags de terceiros (analytics, chat, pixels, mapas, vídeo, fontes, testes A/B) carregadas de forma síncrona ou cedo demais; `preconnect` só para origens críticas (a fonte indica economia de 100–500 ms por conexão antecipada; conexões não usadas fecham em ~10 s; `dns-prefetch` para origens menos importantes); conteúdo abaixo da dobra e embeds (vídeo, mapa) carregados sob demanda; auto-hospedar traz controle de cache mas risco de versões desatualizadas. O **impacto** só se afirma com medição (peso, tempo de bloqueio no relatório).
- **Como verificar:** `estatica` (inventário de `<script src>`/`<iframe>`/`<link>`); `ativa-local` com relatório de terceiros em `raw/`.
- **Evidência esperada:** lista de origens + `file:line`; diagnóstico de terceiros do Lighthouse.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando o relatório mostra tempo de bloqueio relevante atribuído a um terceiro **e** LCP/TBT em faixa ruim.
- **Correção:** `async`/`defer`, carga sob demanda, `preconnect` seletivo. **Validação:** relatório com menor bloqueio atribuído.
- **Trade-offs obrigatórios:** analytics/pixel necessários a `ANL`; chat/WhatsApp a `CRO`; consentimento a `PRIV` → preencher `tradeoffs` e `related_ids`; nunca recomendar remover sem apresentar o custo/benefício.
- Fonte: F16.

### PERF-C13 — *Resource hints* mal usados  [OFICIAL]
- **O que verificar:** `preload` sem `as` ou com valor inválido (pode buscar o recurso duas vezes); `preload` de fonte **sem `crossorigin`** ("será buscada duas vezes"); preloads não usados (aviso no console ~3 s após `load`); excesso de preloads (quando tudo é prioridade, nada é); `preconnect` desnecessário; preload de JS demais na inicialização (compete com o INP).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do `<link>`.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** ajustar atributos; manter só o essencial. **Validação:** sem avisos de preload no console; sem recursos duplicados.
- Fonte: F15.

## 4. Falsos positivos e armadilhas

- **Nota Lighthouse baixa sem causa identificada não é achado:** é um número de laboratório variável. Registrar a métrica e a causa; sem causa, `not_tested`/observação.
- Laboratório e campo divergem (cache, *bfcache*, interações reais); bom no laboratório não prova bom em campo e vice-versa.
- LCP pode ser texto, não imagem; checar o elemento no relatório antes de "otimizar imagem".
- Um `preload` correto da imagem LCP não é "uso excessivo".
- `loading="lazy"` em imagens abaixo da dobra é correto.
- Bundle "grande" não é falha sem evidência de impacto medido.
- CLS pode vir de banner de cookies/terceiros que só aparecem em produção; avisar quando ambiente local difere.
- CrUX **não existe** para sites novos/pouco visitados; ausência de dados ≠ site ruim.
- Serviços de hosting já aplicam Brotli/cache em ativos versionados por padrão; verificar cabeçalho real antes de apontar.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `next/image` (`priority` no LCP, `sizes`), `next/font`, Server Components reduzem JS; `Script` com `strategy`; cache de ativos `_next/static` já versionado. |
| Astro | HTML estático com pouco JS por padrão; `astro:assets`; *islands* com `client:*` definem custo de JS. |
| Vite/React (SPA) | Sem SSR, LCP depende de JS; *code splitting* com `React.lazy`; hash nos ativos do build; ver `SEO-C16`/`AIO-C04`. |
| HTML estático | Tudo manual: `width`/`height`, `defer`, cache e compressão via `_headers`/`.htaccess`/host. |
| Outros (WordPress etc.) | Plugins e temas adicionam muito JS/CSS e terceiros; conferir cache de página e compressão do host. |

## 6. O que nunca afirmar

- Valores de LCP, INP, CLS, TBT ou nota **sem medição** (nem "estimativa pelo código").
- Que o site "passa" ou "falha" nos Core Web Vitals com base só em laboratório — a avaliação oficial é por campo, p75.
- Que INP foi medido por Lighthouse de carregamento.
- Ganhos esperados (segundos, %, conversão); a menção a ganho de vendas em estudo de caso (web.dev) **não** se aplica a este site.
- Que AVIF/WebP, `preload` ou CDN "resolvem" a performance sem medição.
- Que a nota Lighthouse é "a nota do Google" ou fator de ranking.
- Que terceiros devem ser removidos sem considerar `ANL`/`CRO`/`PRIV`.
- Pesos do Lighthouse como atuais sem checar a versão instalada (a página consultada documenta os do Lighthouse 10).

## 7. Fontes

- F1 — web.dev, Web Vitals (Core Web Vitals, limiares, p75, campo vs. laboratório) — https://web.dev/articles/vitals — acessado em 2026-11-05
- F2 — web.dev, Largest Contentful Paint (LCP) — https://web.dev/articles/lcp — 2026-11-05
- F3 — web.dev, Interaction to Next Paint (INP) (200 ms / 500 ms; substituiu FID; TBT proxy) — https://web.dev/articles/inp — 2026-11-05
- F4 — web.dev, Cumulative Layout Shift (CLS) (0,1 / 0,25) — https://web.dev/articles/cls — 2026-11-05
- F5 — web.dev, Why lab and field data can be different — https://web.dev/articles/lab-and-field-data-differences — 2026-11-05
- F6 — Chrome for Developers, CrUX methodology (elegibilidade) — https://developer.chrome.com/docs/crux/methodology — 2026-11-05
- F7 — web.dev, Optimize Largest Contentful Paint — https://web.dev/articles/optimize-lcp — 2026-11-05
- F8 — web.dev, LCP (elementos elegíveis) — mesma URL de F2.
- F9 — web.dev, Browser-level image lazy-loading — https://web.dev/articles/browser-level-image-lazy-loading — 2026-11-05
- F10 — web.dev, Optimize Cumulative Layout Shift — https://web.dev/articles/optimize-cls — 2026-11-05
- F11 — web.dev, CLS (causas e animações) — mesma URL de F4.
- F12 — web.dev Learn Images, Performance issues — https://web.dev/learn/images/performance-issues — 2026-11-05
- F13 — web.dev, Best practices for fonts — https://web.dev/articles/font-best-practices — 2026-11-05
- F14 — Chrome for Developers, Lighthouse performance scoring (pesos do Lighthouse 10; faixas de nota; variabilidade) — https://developer.chrome.com/docs/lighthouse/performance/performance-scoring — 2026-11-05
- F15 — web.dev, Preload critical assets — https://web.dev/articles/preload-critical-assets — 2026-11-05
- F16 — web.dev, Efficiently load third-party JavaScript — https://web.dev/articles/efficiently-load-third-party-javascript — 2026-11-05
- F17 — web.dev, Prevent unnecessary network requests with the HTTP Cache — https://web.dev/articles/http-cache — 2026-11-05
- F18 — web.dev, Enable text compression — https://web.dev/articles/reduce-network-payloads-using-text-compression — 2026-11-05
- Consultado sem detalhe útil: Chrome for Developers, Lighthouse overview — https://developer.chrome.com/docs/lighthouse/overview — 2026-11-05 (não traz versão, INP nem modelo de *throttling*).
- Não consultado nesta revisão: guias de AVIF/WebP, `bfcache` em detalhe, e o relatório de terceiros do Lighthouse; limiar numérico de TBT.
