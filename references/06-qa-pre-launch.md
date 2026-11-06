# 06 — QA e Pré-lançamento

Prefixo: `QA` · Subagente: `release-qa` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado (Google, MDN, Open Graph); **[FUNCIONAMENTO]** = defeito observável de engenharia (link quebrado, erro, placeholder, build) sem fonte normativa: **não** é "prática recomendada sem garantia" — a severidade vem do **dano comprovado por evidência** (código ou execução), nunca de opinião. Quando a verificação é uma sugestão de qualidade sem defeito observável, o teto é `MELHORIA`.

**Regra central.** QA verifica **se funciona e se está pronto para publicar**. Todo achado exige evidência observada (arquivo/linha, saída de build, captura, requisição). **Formulários nunca são enviados** (SPEC §8.3; em ativa-local, nada que dispare envio real, e-mail ou escrita em serviço de terceiros). Nenhum resultado afirma "site pronto"; no `pre-launch` o relatório usa "Bloqueadores conhecidos: SIM (n) / NÃO IDENTIFICADOS".

## 1. Escopo e fronteiras

- **Desta área:** links quebrados; páginas 404/500; funcionamento de formulários (sem enviar); responsividade em **360 / 768 / 1440 px**; erros de console e de rede; *mixed content*; favicon; Open Graph; conteúdo placeholder (`lorem ipsum`, `TODO`…); URLs de staging/localhost no código; build de produção.
- **De outras áreas (só referenciar via `related_ids`):**
  - `noindex` esquecido, canonical/sitemap com host de staging, soft 404, redirects → `SEO` (SEO-C01, C05, C06, C12, C13). **Aqui:** só a **existência e usabilidade** da página de erro.
  - fricção do formulário, CTA, link `wa.me` → `CRO`; validação no servidor, CSRF, abuso, segredos → `API`/`SEC`
  - rótulos e erros acessíveis de formulário, alvos de toque, `lang` → `A11Y`
  - peso, LCP, CLS → `PERF`; tags de medição, IDs de teste de GA/Pixel → `ANL`
  - consentimento, política de privacidade → `PRIV`
  - backups, SSL/domínio, monitoramento, atualização de dependências → `OPS`
  - conteúdo editorial raso/duplicado → `CONT`
- **Desempate QA × CONT/SEO:** placeholder e conteúdo "de modelo" = `QA`; texto fraco ou raso = `CONT`; metadado errado de busca = `SEO`.

## 2. Quando acionar

- **Aplicável:** qualquer projeto web; **sempre** no `pre-launch`.
- **Reduzido:** sem servidor possível → só `estatica`; build, console, captura e responsividade vão para `not_tested`.
- **Ativa-local:** requer aprovação única de build/servidor (SPEC §8.2). **Ativa-remota** só com `--url` (GET, ≤ 20 páginas, 1 req/s).
- **Viewports 360/768/1440** são definição **do projeto** (não de norma): registrar como "viewports de teste do plugin".

## 3. Verificações

### QA-C01 — Links internos e âncoras quebrados  [FUNCIONAMENTO]
- **O que verificar:** `href`/`src` internos que apontam para rota, arquivo ou âncora (`#id`) **inexistente**; `href="#"` ou `javascript:void(0)` em links de navegação/CTA; item de menu sem destino; logo sem link para a home; links relativos errados após mudança de pasta (`../`); caixa de caracteres (URLs diferenciam maiúsculas/minúsculas). Rotas dinâmicas verificadas contra o roteador do framework.
- **Como verificar:** `estatica` (cruzar `href` com rotas/arquivos); `ativa-local`/`ativa-remota` (GET dos links internos; status 4xx/5xx).
- **Evidência esperada:** `file:line` do link + destino inexistente; ou status em `raw/`.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`).
  - Sobe para `CRITICO` quando o **CTA principal, o menu principal ou o link de contato/compra** leva a erro (falha grave de funcionamento comprovada).
  - Desce para `MELHORIA` para link isolado em página secundária.
- **Correção:** corrigir destino ou remover o link. **Validação:** todos os links internos retornam 2xx/3xx esperado; âncoras existem.
- Links não rastreáveis para busca (`<span onclick>`) → `SEO-C11`.
- Fonte: F8 (rotas/URLs diferenciam caixa).

### QA-C02 — Links de contato e links placeholder  [FUNCIONAMENTO]
- **O que verificar:** `mailto:`, `tel:` e `wa.me` presentes e **não placeholder** (números/e-mails óbvios de modelo: `0000`, `123456`, `email@example.com`, `contato@seudominio.com`); `tel:` com formato internacional; `href` vazio; ícones sociais apontando para a home da rede em vez do perfil. **O formato correto e a mensagem pré-preenchida do link de WhatsApp** são tratados em `CRO` (aqui só: não é placeholder e está presente).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do link.
- **Severidade padrão:** `IMPORTANTE` para canal de contato principal com dado placeholder (`CONFIRMADO`); `CRITICO` quando é **o único** canal de conversão do site de uma empresa em pré-lançamento; `MELHORIA` para redes sociais genéricas.
- **Correção:** dados reais do dono (nunca inventar). **Validação:** nenhum link de contato com valor de modelo.
- Fonte: —

### QA-C03 — Páginas de erro 404 e 500  [OFICIAL (status) + FUNCIONAMENTO (usabilidade)]
- **O que verificar:** existe página **404 personalizada** com navegação de volta (link para home/busca) e o **status HTTP continua 404** (soft 404 → `SEO-C13`); tratamento de erro 500/exceção sem **mostrar rastros de pilha, caminhos ou variáveis** ao visitante (vazamento → `SEC`/`API`); erro de rota em SPA tem tela de erro.
- **Como verificar:** `estatica` (arquivo `404.html`, `not-found`, `error.tsx`, config de host); `ativa-local`/`ativa-remota` com **uma** GET a URL aleatória inexistente.
- **Evidência esperada:** status e corpo em `raw/`; `file` da página de erro.
- **Severidade padrão:** `MELHORIA` para 404 padrão do host/framework sem navegação; `IMPORTANTE` (`CONFIRMADO`) quando a página de erro expõe pilha/caminhos internos (registrar também em `SEC` por `related_ids`).
- **Correção:** criar `404`/`not-found` com link para a home e manter status 404. **Validação:** URL inexistente → 404 + página útil, sem detalhes internos.
- Fonte: F9 (status HTTP; consultada em SEO).

### QA-C04 — Formulários: ligação e validação (sem enviar)  [OFICIAL (validação HTML) + FUNCIONAMENTO]
- **O que verificar (estático e DOM, **sem submissão**):** `<form>` com destino e método definidos (`action` real **ou** manipulador JS que chama endpoint existente no repositório); `action="#"`/vazio/placeholder (`/f/YOUR_ID`, `SEU_ID`) em formulário de produção; endpoint (`api/`, rota de servidor, função serverless) **existe no código**; variáveis de ambiente do serviço de e-mail/CRM referenciadas e documentadas; campos com `name`; botão de envio com `type="submit"`; feedback de sucesso/erro; atributos nativos de validação (`required`, `type="email"`, `pattern`, `minlength`/`maxlength`). **A validação do cliente não substitui a do servidor** (MDN: "nunca confie em dados vindos do cliente"); existência de validação no servidor → `API`/`SEC`. Mensagens de erro acessíveis (`aria-live`, texto não só cor) → `A11Y-C05`.
- **Como verificar:** `estatica`; `ativa-local` inspecionando o DOM (`form.checkValidity()` não envia dados); **nunca** enviar nem acionar `fetch` do formulário.
- **Evidência esperada:** `file:line` do `<form>` e do endpoint ausente.
- **Severidade padrão:** `IMPORTANTE` para falta de feedback/validação; `CRITICO` (`CONFIRMADO`) quando o formulário de contato/orçamento/compra **não tem destino funcional** no código (`action` placeholder, endpoint inexistente, ID de serviço de modelo).
- **Correção:** apontar para o endpoint real; adicionar validação e feedback. **Validação:** o fluxo de envio **testado manualmente pelo dono em ambiente de teste**; no plugin, apenas a ligação estática confere.
- **Atenção:** o plugin **não prova** que o formulário envia; registrar "envio não testado" em `not_tested`.
- Fricção do formulário → `CRO`.
- Fonte: F5.

### QA-C05 — Responsividade em 360 / 768 / 1440 px  [FUNCIONAMENTO]
- **O que verificar:** em cada largura: **rolagem horizontal da página** (`scrollWidth > clientWidth`), texto cortado/sobreposto, imagens estourando o container, menu móvel utilizável, botões visíveis e clicáveis, tabelas e mapas contidos; `<meta name="viewport" content="width=device-width, initial-scale=1">` presente (ausência faz o celular renderizar largura de desktop; a página MDN sobre viewport **não pôde ser lida** nesta revisão — afirmação baseada em evidência da medição). Acessibilidade de zoom (`user-scalable=no`) → `A11Y-C09`; tamanho de alvos → `A11Y-C10`.
- **Como verificar:** `ativa-local` (capturas em `raw/` + medição de overflow); `estatica` (larguras fixas em `px`, ausência de viewport).
- **Evidência esperada:** captura por largura; valor medido de `scrollWidth`/`clientWidth`.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) para rolagem horizontal ou conteúdo cortado em 360 px **medido**; `MELHORIA` para detalhes visuais.
- **Correção:** layout fluido, `max-width: 100%`, remover larguras fixas. **Validação:** sem overflow em 360, 768 e 1440.
- **Atenção:** julgamento estético ("ficou feio") é `manual`; só reportar defeitos objetivos.
- Fonte: F10.

### QA-C06 — Erros de console e de rede  [FUNCIONAMENTO]
- **O que verificar:** na carga de cada página-chave: exceções JavaScript não capturadas; `console.error`; requisições com 4xx/5xx (imagens, fontes, scripts, API); erros de CORS; avisos de *mixed content*; recurso `favicon.ico` 404; erros de hidratação (frameworks); erros de CSP.
- **Como verificar:** `ativa-local` (captura de console e requisições em `raw/`); sem execução → `not_tested`.
- **Evidência esperada:** mensagens exatas (mascarar segredos) + URL da página.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) para exceção na carga ou recurso crítico (script/CSS/dado principal) falhando; `MELHORIA` para avisos e recursos secundários.
- **Correção:** tratar a causa. **Validação:** nova carga sem erros nas mesmas páginas.
- **Atenção:** erros de terceiros (extensões, anúncios) podem aparecer só em produção; informar o ambiente de coleta.
- Fonte: —

### QA-C07 — *Mixed content* e URLs `http://`  [OFICIAL]
- **O que verificar:** página servida em HTTPS carregando recursos por `http://`. **Bloqueáveis** (scripts, CSS/`<link href>`, `<iframe>`, `fetch`/XHR, fontes, `srcset`/`<picture>`, `<object>`) são **bloqueados** pelo navegador; **atualizáveis** (`<img src>`, `<audio>`, `<video>`, imagens de CSS) são convertidos para `https://` automaticamente, mas **bloqueados** se o host for um **endereço IP**; **downloads** mistos são bloqueados por padrão. Procurar `http://` em `src`, `href`, `url()`, `action`, configuração de API.
- **Como verificar:** `estatica` (busca por `http://` excluindo `localhost` de desenvolvimento e `xmlns`); `ativa-local`/`ativa-remota` (avisos do console).
- **Evidência esperada:** `file:line`; aviso de console em `raw/`.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando o recurso bloqueável via `http://` quebra função em produção HTTPS; `MELHORIA` para atualizáveis.
- **Correção:** `https://` ou URL relativa; versão HTTPS do recurso de terceiro; no servidor, CSP `upgrade-insecure-requests` (cabeçalho → `API`). **Validação:** console sem avisos de *mixed content*.
- Redirecionamento HTTP→HTTPS → `SEO-C12`.
- Fonte: F6.

### QA-C08 — Favicon  [OFICIAL]
- **O que verificar:** `<link rel="icon" href="…">` no `<head>` da **home** (valores aceitos: `icon`, `shortcut icon`, `apple-touch-icon`, `apple-touch-icon-precomposed`); arquivo existe e carrega (sem 404); **quadrado (1:1), mínimo 8×8 px**, recomendado **maior que 48×48 px**; formatos aceitos: BMP, GIF, ICO, PNG, JPEG, PPM, TIFF; URL **estável**; **não bloqueado por `robots.txt`** (o Googlebot precisa rastrear a home e o `Googlebot-Image` o arquivo); um favicon por *hostname*. O favicon padrão do framework (logo do Vite/Next) indica projeto não finalizado (→ `QA-C10`).
- **Como verificar:** `estatica`; `ativa-local`/`ativa-remota` (GET do arquivo).
- **Evidência esperada:** `file:line` do `<link>` ou ausência; status do arquivo.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` apenas se o favicon do framework/modelo vai para produção (`CONFIRMADO`, também `QA-C10`).
- **Correção:** criar ícone da marca e declarar. **Validação:** aba do navegador mostra o ícone; requisição 200.
- Nunca afirmar que o Google **vai exibir** o favicon (recrawl leva dias a semanas).
- Fonte: F1.

### QA-C09 — Open Graph (compartilhamento)  [OFICIAL (protocolo) + FUNCIONAMENTO]
- **O que verificar:** `<meta property="og:…">` no `<head>` com as **quatro propriedades obrigatórias** do protocolo: `og:title`, `og:type`, `og:image`, `og:url` (`og:url` = URL canônica, ID permanente); recomendadas `og:description`, `og:site_name`, `og:locale`; se há `og:image`, deve haver `og:image:alt` (e `og:image:width`/`height` ajudam); URLs completas apontando para recursos **existentes** em produção (não `localhost`, staging ou arquivo ausente); valores coerentes com título e canonical da página (→ `SEO-C06`/`SEO-C07`). **Twitter/X Cards:** sem fonte consultada nesta revisão — verificar `twitter:card` apenas como **observação**. O protocolo **não garante** como cada plataforma exibe o cartão.
- **Como verificar:** `estatica`; `ativa-remota` para `og:image` real.
- **Evidência esperada:** `file:line` das metas ou ausência.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando `og:image`/`og:url` apontam para `localhost`, staging ou arquivo inexistente.
- **Correção:** metas por página com dados reais; imagem existente. **Validação:** todas as páginas-chave com as quatro propriedades obrigatórias apontando para URLs de produção; depurador de cada rede (manual) confirma.
- Fonte: F2.

### QA-C10 — Conteúdo placeholder e de modelo  [FUNCIONAMENTO]
- **O que verificar (em conteúdo **visível ao público**):** `lorem ipsum`; `TODO`/`FIXME`/`XXX`/`TBD`/`[inserir …]`/"Seu texto aqui"/"Título da página"/"Nome da empresa"; títulos padrão de framework (`Vite + React`, `Create Next App`, `Astro`, `Document`, `React App`); `example.com`/`seudominio.com`/`email@example.com`; telefone/CNPJ/CPF de modelo (`(00) 0000-0000`, `00.000.000/0001-00`); imagens de modelo ou `placeholder.com`/`via.placeholder`/`picsum`; textos de demonstração do tema; comentários HTML com `TODO` (não visíveis → `OPCIONAL`).
- **Como verificar:** `estatica` (busca em templates, conteúdo e componentes); `ativa-local` para páginas renderizadas.
- **Evidência esperada:** `file:line` + trecho.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`).
  - Sobe para `CRITICO` quando aparece na **home**, no `<title>`/H1, no contato ou em CTA de site **em preparação para publicação** (`pre-launch` ou declarado em README/config) — bloqueador de publicação **com evidência**.
  - Desce para `OPCIONAL` quando só existe em comentário não renderizado ou em rota claramente interna.
- **Correção:** conteúdo real do dono (nunca inventar texto institucional, depoimentos, números ou dados de contato). **Validação:** busca pelos padrões sem ocorrência nas páginas públicas.
- Conteúdo fraco/raso → `CONT-C05`.
- Fonte: —

### QA-C11 — URLs de staging, localhost e desenvolvimento no código  [FUNCIONAMENTO]
- **O que verificar:** `localhost`, `127.0.0.1`, `0.0.0.0`, `192.168.*`, `10.*`, `*.local`, `ngrok`, `staging.`, `dev.`, `test.`, `*.vercel.app`/`*.netlify.app`/`*.pages.dev` de **pré-visualização**, em `href`, `src`, `action`, canonical, `og:*`, sitemap, URLs de API/`fetch`/`axios`, e-mails de teste, `NEXT_PUBLIC_API_URL`/`VITE_*` apontando para ambiente local. URL de pré-visualização do host pode ser legítima **enquanto não existe domínio**: registrar como informação. Canonical/sitemap com host errado → `SEO-C05`/`SEO-C06`; **chaves de teste** (`pk_test_`, IDs de GA de teste) → `ANL`/`SEC`.
- **Como verificar:** `estatica` (busca por padrões; variáveis de ambiente de produção quando declaradas).
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) para referência visível/funcional ao ambiente de teste;
  - `CRITICO` quando **URL de API, destino de formulário ou recurso essencial** aponta para `localhost`/rede interna (quebra em produção).
  - `OPCIONAL` para ocorrência em arquivo de desenvolvimento, README ou testes.
- **Correção:** variável de ambiente por ambiente; domínio de produção. **Validação:** build de produção sem referências a hosts de desenvolvimento.
- Fonte: —

### QA-C12 — Build de produção e saída gerada  [FUNCIONAMENTO]
- **O que verificar:** o comando de build do projeto (`npm run build` etc., mostrado ao dono e **confirmado uma vez**, SPEC §8.2) conclui sem erro; artefatos esperados gerados (`dist/`, `.next/`, `build/`, `out/`); avisos relevantes (variáveis ausentes, módulos não encontrados, páginas que falham ao gerar); saída **sem** referências a `localhost` (QA-C11) nem placeholders (QA-C10). Não instalar dependências no alvo (SPEC §8.5): se faltam dependências, registrar e seguir só com `estatica`.
- **Como verificar:** `ativa-local` (saída do build em `raw/`, com comando, versão e horário); sem execução → `not_tested`.
- **Evidência esperada:** `raw_ref` com a mensagem de erro exata.
- **Severidade padrão:** `CRITICO` (`CONFIRMADO`) quando o build falha no estado atual do repositório e **impede a publicação**; `IMPORTANTE` para avisos que indicam páginas faltando; `MELHORIA` para avisos gerais.
- **Correção:** tratar o erro indicado. **Validação:** build limpo e artefatos gerados.
- **Atenção:** build falho por **falta de dependência instalada** não é defeito do projeto → `not_tested` com o motivo.
- Fonte: —

### QA-C13 — Codificação e caracteres  [FUNCIONAMENTO]
- **O que verificar:** `<meta charset="utf-8">` (ou cabeçalho equivalente) presente; sinais de *mojibake* no texto (`Ã§`, `Ã£`, `â€™`, `�`) em conteúdo renderizado ou arquivos; acentuação perdida em português; aspas/travessões quebrados.
- **Como verificar:** `estatica` (busca por padrões); `ativa-local`.
- **Evidência esperada:** `file:line` + trecho.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando visível ao público; `MELHORIA` para `meta charset` ausente sem corrupção observada.
- **Correção:** salvar arquivos em UTF-8 e declarar `charset`. **Validação:** caracteres corretos nas páginas.
- Fonte: —

### QA-C14 — Funcionamento ponta a ponta e responsividade real (verificação manual)  [manual]
- **O que verificar (só humano):** envio **real** de formulário em ambiente de teste e recebimento da mensagem; fluxo de compra/pagamento com sandbox; e-mails de confirmação; comportamento em **aparelhos reais** (iOS Safari, Android Chrome); navegação completa; impressão; modo escuro; conexão lenta.
- **Como verificar:** `manual` → `not_tested` (`QA-C14`), com a lista do que o plugin **não** testou.
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono executa e informa o resultado.
- Fonte: —

## 4. Falsos positivos e armadilhas

- `http://` em `xmlns`, em comentários e em links de **navegação externa** (`<a href="http://…">` para outro site) **não** é *mixed content* (só recurso carregado pela página).
- `localhost` em arquivo de teste, README, `.env.example`, scripts de desenvolvimento não é defeito de produção.
- `*.vercel.app`/`*.netlify.app` é legítimo enquanto o domínio final não existe.
- `href="#"` pode ser válido em botão que abre menu/modal com JS acessível; só reportar quando é link de navegação sem comportamento.
- Rolagem horizontal **dentro** de contêiner (tabela, carrossel) não é overflow da página.
- Erros de console de extensões do navegador ou de testes automatizados (Playwright) não pertencem ao site.
- Formulário que usa serviço externo (Formspree, Netlify Forms, Google Forms) pode não ter `action` no repositório: conferir ID/configuração; só reportar se for placeholder.
- Rotas dinâmicas e `getStaticPaths` geram URLs não visíveis no código: confirmar no build antes de marcar link como quebrado.
- **Nada aqui prova que o envio funciona.** "Ligação presente" ≠ "envia".

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Rotas por arquivo (`app/`, `pages/`); `not-found.tsx`/`error.tsx`; `NEXT_PUBLIC_*` expostos no cliente; `next build` falha em erros de tipo/ESLint conforme config. |
| Astro | Rotas por arquivo em `src/pages`; `getStaticPaths`; saída em `dist/`; links relativos dependem de `site`/`base`. |
| Vite/React (SPA) | Roteador no cliente: links não existem como arquivos; 404 depende de fallback do host; `VITE_*` embutido no build. |
| HTML estático | Links entre arquivos `.html` e caminhos relativos; sem build: `estatica` cobre quase tudo. |
| Outros (WordPress etc.) | Placeholders do tema/plugin; formulários por plugin; URLs absolutas gravadas no banco (staging → produção) — conferir configurações de URL do site. |

## 6. O que nunca afirmar

- "Site pronto", "sem problemas", "pronto para publicar" — usar "Bloqueadores conhecidos: SIM (n) / NÃO IDENTIFICADOS" e listar o que **não** foi testado.
- Que o formulário **envia** ou **entrega** a mensagem (o plugin não envia).
- Que o site "funciona em todos os dispositivos/navegadores".
- Que todos os links funcionam (só os rastreados, até o limite de páginas).
- Que o favicon/cartão social **será exibido** por buscadores/redes.
- Que build, console ou capturas ok quando a ferramenta falhou ou não rodou.
- Conteúdo, contatos ou textos de substituição inventados.

## 7. Fontes

- F1 — Google, Define a favicon to show in Search results — https://developers.google.com/search/docs/appearance/favicon-in-search — acessado em 2026-11-05
- F2 — The Open Graph protocol — https://ogp.me/ — 2026-11-05
- F5 — MDN, Client-side form validation (atributos nativos; validação no servidor; `aria-live`) — https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation — 2026-11-05
- F6 — MDN, Mixed content (bloqueáveis × atualizáveis; downloads; correção) — https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content — 2026-11-05
- F8 — Google, URL structure best practices (URLs diferenciam maiúsculas/minúsculas) — https://developers.google.com/search/docs/crawling-indexing/url-structure — 2026-11-05
- F9 — Google, HTTP status codes, and network and DNS errors — https://developers.google.com/search/docs/crawling-indexing/http-network-errors — 2026-11-05
- F10 — mesma página usada em A11Y (reflow 320 px, WCAG 1.4.10): https://www.w3.org/TR/WCAG22/ — 2026-11-05 (contexto; **viewports 360/768/1440 são definição do projeto**)
- Consultado sem cobrir o tema: Google, Website testing (cobre testes A/B; **não** cobre proteção de staging) — https://developers.google.com/search/docs/crawling-indexing/website-testing — 2026-11-05.
- Falha ao buscar: MDN, Viewport meta element (404 na URL tentada). Não consultados: Twitter/X Cards, Chrome DevTools (console/rede), Lighthouse (best practices).
- Itens sem fonte (`Fonte: —`) são verificações de **funcionamento** com evidência observável; a severidade vem do dano comprovado, não de norma.
