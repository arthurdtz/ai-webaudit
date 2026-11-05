# 04 — AIO (prontidão técnica para crawlers e agentes de IA)

Prefixo: `AIO` · Subagente: `ai-visibility` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo provedor; **[PRÁTICA]** = recomendação sem garantia oficial → severidade máxima `MELHORIA`. Esta área tem pouca documentação oficial: a maioria dos itens de "disponibilidade do conteúdo" é **[PRÁTICA]**.

## 1. Escopo e fronteiras

- **Desta área:** regras de `robots.txt` por user-agent de IA; distinção treino × busca × acesso disparado por usuário; bloqueios de hosting/CDN/WAF a esses agentes; conteúdo disponível no HTML sem executar JavaScript; HTML semântico legível por máquina; `llms.txt`.
- **De outras áreas (só referenciar):**
  - `robots.txt` geral, `noindex`, canonical, sitemap, controles de snippet (`nosnippet`, `max-snippet`) → `SEO` (SEO-C01…C09). Elegibilidade para AI Overviews/AI Mode = página indexada **e** elegível a snippet → depende desses checks.
  - Renderização JS do ponto de vista do Google → `SEO-C16`.
  - Clareza de entidades, citações, dados originais → `GEO`; respostas diretas, FAQ como conteúdo → `AEO`.
  - Headers de segurança, rate limit → `API`; performance → `PERF`; estrutura de headings para leitor de tela → `A11Y`.

## 2. Quando acionar

- **Aplicável:** qualquer site público com conteúdo textual que o dono queira (ou não) expor a motores de IA.
- **Não aplicável / reduzido:** app inteiro atrás de login; site cujo dono declarou que **não** quer aparecer em IA (verificar só coerência das regras, não recomendar liberar).
- **A decisão de permitir ou bloquear é do dono do site.** Esta área verifica *coerência e efeito*, nunca impõe uma política.

## 3. Verificações

### AIO-C01 — Inventário e coerência das regras de robots para agentes de IA  [OFICIAL]
- **O que verificar:** listar no `robots.txt` os grupos para agentes de IA e classificar por função, com os **nomes atuais da documentação oficial**:

  | Função | Tokens (doc oficial) | Efeito documentado do bloqueio |
  |---|---|---|
  | Treino | `GPTBot` (OpenAI), `ClaudeBot` (Anthropic), `Google-Extended` (Google) | Sinaliza que o conteúdo não deve ser usado para treinar modelos. `Google-Extended` também limita *grounding* em Gemini Apps/Vertex AI; **não** afeta inclusão nem ranking na Pesquisa Google nem os AI Overviews/AI Mode. |
  | Busca | `OAI-SearchBot` (OpenAI), `Claude-SearchBot` (Anthropic), `PerplexityBot` (Perplexity) | Pode reduzir/excluir a presença do site nas respostas de busca desses produtos (OpenAI: sites bloqueados "não serão mostrados" nas respostas de busca do ChatGPT, mas podem aparecer como links de navegação). |
  | Disparado por usuário | `ChatGPT-User` (OpenAI), `Claude-User` (Anthropic), `Perplexity-User` (Perplexity) | OpenAI diz que regras de robots "podem não se aplicar"; Perplexity diz que `Perplexity-User` "geralmente ignora robots.txt"; Anthropic diz que bloquear pode reduzir visibilidade em busca dirigida pelo usuário. |

  Verificar: (a) bloqueio **acidental** — `User-agent: *` com `Disallow: /` (ou lista copiada de "bloquear IA") que derruba os agentes de **busca** sem decisão declarada; (b) grupos específicos que sobrescrevem `*` sem querer (cada crawler segue só o grupo mais específico); (c) tokens com grafia errada ou **não documentados** (ex.: `anthropic-ai` não consta na documentação oficial consultada; `noai`/`noimageai` não foram encontrados em documentação oficial dos provedores — não tratar como controle); (d) `Crawl-delay`: a Anthropic declara suportar; o Google ignora.
- **Como verificar:** `estatica` (`robots.txt`, `app/robots.ts`, geradores); `ativa-remota` para o arquivo servido.
- **Evidência esperada:** linhas do robots (`file:line`) + tabela função × regra.
- **Severidade padrão:** `MELHORIA`.
  - Sobe para `IMPORTANTE` (`CONFIRMADO`) quando um `Disallow: /` genérico ou lista copiada bloqueia agentes de busca e o projeto declara no código/README o objetivo de aparecer em IA.
  - `OPCIONAL` quando a regra é coerente com política declarada (apenas registrar inventário).
- **Correção:** escrever grupos explícitos e comentados por função; se o dono quer aparecer em busca de IA mas não treinar, permitir os agentes de busca e bloquear os de treino.
- **Validação:** para cada agente, a regra efetiva (grupo mais específico) corresponde à política decidida.
- Fontes: F1, F2, F3, F4, F5.

### AIO-C02 — Política de IA explícita e documentada  [PRÁTICA]
- **O que verificar:** existe decisão registrada (comentário no `robots.txt`, README ou política do site) sobre treino × busca × agentes de usuário; ausência de regras = permitir tudo, o que é válido mas deve ser escolha consciente.
- **Como verificar:** `estatica`; `manual` para confirmar a intenção com o dono.
- **Evidência esperada:** ausência/presença de comentário ou documento.
- **Severidade padrão:** `OPCIONAL`.
- **Correção:** registrar a política no próprio `robots.txt` (comentários `#`). **Validação:** política legível junto às regras.

### AIO-C03 — Bloqueio por hosting, CDN ou WAF independente do robots  [OFICIAL + manual]
- **O que verificar:** regras de WAF/CDN/hosting (Cloudflare, Vercel Firewall, Netlify, `.htaccess`, `nginx`) que bloqueiam por user-agent ou IP agentes de IA ou todo "bot", **contradizendo** o `robots.txt`; desafios de bot (CAPTCHA/JS challenge) na página pública. A Anthropic **desaconselha bloquear por IP** para opt-out, pois isso impede o agente de ler o `robots.txt` e o opt-out pode não funcionar. Listas de IP publicadas: Anthropic `claude.com/crawling/bots.json`; Perplexity `perplexity.ai/perplexitybot.json` e `perplexity-user.json`. Para OpenAI e Google, a documentação consultada não indicou lista de IPs nesta revisão.
- **Como verificar:** `estatica` para regras em arquivos do repositório (`wrangler.*`, `vercel.json`, `_headers`, `nginx.conf`, `.htaccess`); painéis de CDN/WAF → `manual`. **Não** simular user-agents de terceiros com `--url` (a coleta remota usa UA identificado `AI-WebAudit/<versão>`).
- **Evidência esperada:** regra com `file:line`; ou item em `not_tested` para configuração fora do repositório.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando regra no repositório bloqueia agentes de busca de IA e contradiz política declarada.
- **Correção:** alinhar WAF/CDN ao robots; permitir agentes desejados; não depender de bloqueio por IP para opt-out.
- **Validação:** regras de edge e robots dizem a mesma coisa para cada agente.
- Fontes: F2, F4, F5.

### AIO-C04 — Conteúdo principal disponível no HTML sem executar JavaScript  [PRÁTICA; base oficial parcial]
- **O que verificar:** o HTML **bruto** (sem renderizar) de cada página-chave contém o texto principal, títulos, links e metadados. Base: o Google renderiza JS, mas recomenda SSR/pré-renderização porque "nem todos os bots executam JavaScript"; **nenhum** dos provedores de IA consultados documenta execução de JS por seus agentes (OpenAI, Anthropic, Perplexity) — portanto, não presumir que executam.
- **Como verificar:** `estatica` (framework e modo de renderização: Next.js `use client`/SPA, Vite sem SSR, Astro, HTML estático); `ativa-local` comparando resposta HTTP bruta × DOM renderizado.
- **Evidência esperada:** trecho do HTML bruto (vazio/app shell) vs. renderizado em `raw/`; `file:line` da configuração de renderização.
- **Severidade padrão:** `MELHORIA` (prática sem garantia oficial para agentes de IA).
  - Observação: o mesmo problema pode ser `IMPORTANTE` em `SEO-C16` (base oficial do Google). Registrar aqui com `related_ids` apontando para o achado de SEO; não duplicar a causa raiz como `IMPORTANTE` nas duas áreas.
- **Correção:** SSR/SSG/pré-renderização das páginas de conteúdo (Next.js SSG/SSR e Server Components; Astro padrão; Vite: pré-render/SSR; HTML estático já cumpre).
- **Validação:** `GET` sem JS retorna o texto principal e os links de navegação.
- Fontes: F6 (JS SEO basics), F7.

### AIO-C05 — Conteúdo importante disponível como texto e em HTML semântico  [OFICIAL parcial + PRÁTICA]
- **O que verificar:** informação-chave (oferta, preços, endereço, respostas) em texto HTML, **não só em imagem, vídeo, `<canvas>` ou PDF escaneado** [OFICIAL — o Google pede "conteúdo importante disponível como texto"]; uso de elementos semânticos (`<main>`, `<article>`, `<nav>`, `<header>`, `<footer>`, `<section>`, listas, tabelas de dados, `<time>`) em vez de `<div>` genéricas [PRÁTICA]; hierarquia de títulos coerente para leitura por máquina [PRÁTICA; para leitor de tela → `A11Y`]; **respostas importantes escondidas em abas/menus expansíveis** (a Microsoft alerta que sistemas de IA "podem não renderizar conteúdo oculto") e **informação crítica só em PDF** (usar HTML, que traz títulos e metadados) [PRÁTICA, recomendação da Microsoft sem garantia]; conteúdo de abas deve estar no HTML, não carregado só ao clicar. Acordeões/abas **não** são violação de spam do Google.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` de trechos com conteúdo só em imagem ou estrutura sem semântica.
- **Severidade padrão:** `MELHORIA`.
  - Sobe para `IMPORTANTE` (`CONFIRMADO`) apenas na parte [OFICIAL]: página cujo conteúdo principal existe só como imagem/`canvas`.
- **Correção:** converter para texto real; usar elementos semânticos do framework/HTML. **Validação:** o texto principal é extraível do HTML bruto.
- Fonte: F3, F9.

### AIO-C06 — Conteúdo atrás de barreiras (login, paywall, interstitial, cookie wall)  [PRÁTICA]
- **O que verificar:** páginas públicas que exigem interação (aceitar cookies, preencher formulário, rolagem infinita sem URLs paginadas) para exibir o conteúdo principal; overlays que cobrem o HTML sem alternativa.
- **Como verificar:** `estatica`; `ativa-local` para observar o HTML bruto.
- **Evidência esperada:** `file:line` do componente; HTML bruto sem o conteúdo.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** manter o conteúdo no HTML e usar overlay apenas visual; URLs paginadas. **Validação:** HTML bruto contém o conteúdo sem interação.
- Consentimento em si → `PRIV`; paywall com marcação → `SEO-C15`.

### AIO-C07 — `llms.txt` (proposta, não padrão)  [PRÁTICA]
- **O que verificar:** se existe `/llms.txt`, validar o formato da proposta (Markdown; H1 obrigatório com o nome do projeto; resumo em blockquote opcional; seções H2 com links `[nome](url)`; seção `Optional`) e que as URLs listadas existem. **A ausência não é falha.** O Google afirma que **não é preciso** criar "arquivos de texto para IA" nem marcação especial para aparecer em AI Overviews/AI Mode; `llms.txt` é uma proposta de Jeremy Howard (03/09/2024), sem endosso de órgão de padrões.
- **Como verificar:** `estatica`; `ativa-remota` opcional.
- **Evidência esperada:** `file` presente com problema de formato, ou ausência (não reportar ausência).
- **Severidade padrão:** `OPCIONAL` (máximo). Nunca `MELHORIA` ou superior; nunca prometer efeito em citação ou ranking.
- **Correção:** se o dono quiser publicar, gerar a partir das páginas principais. **Validação:** estrutura conforme a proposta; links respondem `200`.
- Fontes: F8, F9.

### AIO-C08 — Entendimento incorreto do controle de IA da Pesquisa Google  [OFICIAL]
- **O que verificar:** comentários, README ou regras indicando que `Google-Extended` remove o site dos AI Overviews/AI Mode (incorreto: eles seguem os controles da Pesquisa — `Googlebot`, `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`); regra `Disallow` para `Googlebot` usada só para "bloquear IA" (derruba também a Pesquisa).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` da regra/comentário.
- **Severidade padrão:** `MELHORIA` para premissa incorreta sem efeito; `IMPORTANTE` (`CONFIRMADO`) quando a regra bloqueia `Googlebot` por esse motivo (cruzar `SEO-C02`).
- **Correção:** usar `Google-Extended` para treino/grounding de Gemini; usar controles de snippet/`noindex` para limitar exibição na Pesquisa. **Validação:** regras compatíveis com a documentação.
- Fonte: F3, F4.

## 4. Falsos positivos e armadilhas

- Bloquear agentes de treino (`GPTBot`, `ClaudeBot`, `Google-Extended`) é escolha legítima; não é falha e **não** reduz presença na busca do Google.
- `ChatGPT-User`/`Perplexity-User` podem ignorar robots por serem disparados por usuário; um grupo `Disallow` para eles não garante bloqueio.
- Site com política "não aparecer em IA" e regras coerentes: não reportar como problema.
- HTML bruto vazio em app atrás de login não é achado.
- Lista de tokens muda: antes de afirmar que um token é "oficial", conferir a página do provedor (OpenAI `developers.openai.com/api/docs/bots`, Anthropic Help Center, Google crawlers, Perplexity docs).
- Não confundir "agente de busca" (indexa para citar) com "agente de treino".

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `app/robots.ts` gera o arquivo; Server Components entregam HTML; componentes `use client` com dados carregados no cliente podem sair vazios no HTML bruto. |
| Astro | HTML estático por padrão (bom para AIO-C04); `public/robots.txt` ou endpoint. |
| Vite/React (SPA) | HTML bruto = shell; AIO-C04 relevante; considerar pré-render/SSR. |
| HTML estático | Conteúdo já no HTML; foco em semântica e robots. |
| Outros (WordPress etc.) | Plugins podem inserir regras de IA no `robots.txt` virtual; conferir o arquivo servido, não só o do disco. |

## 6. O que nunca afirmar

- Que bloquear ou permitir um agente de IA garante ou impede citação, tráfego ou presença em respostas.
- Que `llms.txt` melhora visibilidade em IA (o Google diz que não é necessário; não há padrão).
- Que `Google-Extended` afeta ranking ou AI Overviews.
- Que um agente de IA específico executa (ou não) JavaScript sem documentação do provedor.
- Que o site "está otimizado para IA" ou "pronto para IA".
- Que `robots.txt` impede acesso (é um pedido; `ChatGPT-User`/`Perplexity-User` podem ignorá-lo).
- Nomes de user-agent de memória: sempre conferir a documentação vigente.

## 7. Fontes

- F1 — OpenAI, Overview of OpenAI crawlers (OAI-SearchBot, GPTBot, ChatGPT-User, OAI-AdsBot) — https://developers.openai.com/api/docs/bots — acessado em 2026-11-05
- F2 — Anthropic, "Does Anthropic crawl data from the web, and how can site owners block the crawler?" (ClaudeBot, Claude-User, Claude-SearchBot) — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler — 2026-11-05
- F3 — Google, AI features and your website — https://developers.google.com/search/docs/appearance/ai-features — 2026-11-05
- F4 — Google, Common crawlers (Google-Extended e demais tokens) — https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers — 2026-11-05
- F5 — Perplexity, Perplexity crawlers (PerplexityBot, Perplexity-User) — https://docs.perplexity.ai/guides/bots — 2026-11-05
- F6 — Google, JavaScript SEO basics — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics — 2026-11-05
- F7 — Google, Overview of Google crawlers and fetchers — https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers — 2026-11-05
- F8 — llms.txt proposal — https://llmstxt.org/ — 2026-11-05
- F9 — Microsoft Bing, Optimizing Your Content for Inclusion in AI Search Answers, 08/10/2025 (abas/menus expansíveis, PDFs, imagens) — https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers — 2026-11-05
