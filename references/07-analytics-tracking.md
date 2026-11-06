# 07 — Analytics e Tracking

Prefixo: `ANL` · Subagente: `conversion` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo Google/Meta; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Regra central.** Esta área verifica o que está **no código e no HTML**. Configurações dentro das contas (GA4, GTM, Events Manager: eventos-chave, retenção, redação de dados, domínios, filtros) são **`manual`** → `not_tested`. **Consentimento é da área 10 (`PRIV`)**: aqui só se referencia; nunca julgar se o disparo antes do consentimento é permitido.

## 1. Escopo e fronteiras

- **Desta área:** instalação correta de GA4/Google tag, GTM e Meta Pixel; IDs; duplicação de tags e de contagem; eventos de conversão disparados no código; `dataLayer`; UTMs; `transaction_id`; deduplicação Pixel × Conversions API; **dados pessoais enviados em eventos, URLs, títulos ou parâmetros**.
- **De outras áreas (só referenciar via `related_ids`):**
  - consentimento, banner, bloqueio prévio, base legal, política de privacidade, **tags disparando antes do consentimento** → `PRIV`
  - peso/bloqueio de renderização dos scripts → `PERF-C12`
  - clique em WhatsApp/CTA como desenho de conversão → `CRO`; botão/formulário que não funciona → `QA`
  - segredos/chaves (ex.: token da Conversions API no front-end) → `SEC`/`API`
  - Search Console, monitoramento contínuo → `OPS`
- **Desempate ANL × PRIV:** "a tag está instalada, única e mede o certo?" → `ANL`; "a tag pode disparar e com base em quê?" → `PRIV`. Dado pessoal **enviado** a ferramenta de medição é `ANL` (política do Google/Meta de não receber PII); a base legal desse envio → `PRIV` (referenciar).

## 2. Quando acionar

- **Aplicável:** sites com qualquer tag GA4/Google tag, GTM, Meta Pixel, TikTok/LinkedIn/outros pixels, `dataLayer`, ou intenção declarada de medir conversão (landing page, e-commerce, formulários).
- **Não aplicável / reduzido:** site sem tracking e sem intenção de medir. Em `pre-launch`, registrar "nenhum tracking detectado" como **informação**, não como falha; perguntar ao dono se a ausência é intencional (`not_tested`).
- **Outras plataformas** (TikTok, LinkedIn, Hotjar etc.): **não há fonte consultada** nesta revisão; aplicar só ANL-C02, C08 e C09 de forma genérica.

## 3. Verificações

### ANL-C01 — Instalação e IDs corretos (GA4 / Google tag / GTM)  [OFICIAL]
- **O que verificar:** o snippet do Google tag (`gtag.js`) está **imediatamente após `<head>`** em **todas** as páginas (ou o campo de ID do CMS/framework está preenchido); o ID de medição tem formato `G-…` (a página de ajuda cita IDs que começam com `G-` ou `AW-`) e **não é placeholder** (`G-XXXXXXXXXX`, `G-TEST`, ID de outro projeto/staging); o contêiner GTM (`GTM-…`) está instalado com o snippet de `<head>` **"o mais alto possível"** (o `noscript` de `<body>` pertence ao snippet antigo e já instalado continua funcionando); comando `gtag('event', …)` só **depois** do snippet do Google tag na mesma página (senão os dados não são enviados); **um contêiner GTM por site/app**, não um por página.
- **Como verificar:** `estatica` (layouts, `_document`, `index.html`, plugins de CMS, variáveis de ambiente).
- **Evidência esperada:** `file:line` do snippet/ID; páginas sem a tag.
- **Severidade padrão:** `IMPORTANTE` para ID placeholder/ausente em páginas de conversão quando o projeto claramente pretende medir (`CONFIRMADO`); `MELHORIA` para posição subótima do snippet.
- **Correção:** colocar o ID real em variável de ambiente por ambiente; snippet no layout comum. **Validação:** o ID correto presente em todas as páginas de produção; nenhum ID de teste em produção.
- **Atenção:** o ID de medição é público por natureza (não é segredo); não tratar como vazamento.
- Fonte: F1, F2, F3.

### ANL-C02 — Tags duplicadas e dupla contagem  [OFICIAL (comportamento padrão) + inferência]
- **O que verificar:** o mesmo ID de medição configurado **duas vezes** (snippet `gtag.js` fixo no HTML **e** GTM, ou o GA4 configurado em dois contêineres/plugins); `gtag('config')` repetido; vários códigos-base do **Meta Pixel** na mesma página; `page_view` manual somado ao automático (ver C03). Base: o `config` padrão **envia** `page_view` e "se você enviar page views manuais sem desativar a medição de page views, pode haver duplicidade". Que **duas fontes de tag** dupliquem eventos é consequência do comportamento padrão; a documentação **primária consultada não afirma** "não use as duas"; a afirmação veio de resumo de busca (não verificada na fonte) → **tratar como `RISCO_POTENCIAL` até confirmação no DebugView (`manual`)**.
- **Como verificar:** `estatica` (inventário de snippets e IDs por página); `ativa-local` com requisições de rede (`g/collect`, `facebook.com/tr`) contadas por carga, em `raw/`.
- **Evidência esperada:** `file:line` dos dois snippets; contagem de requisições por carga.
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) para duas instalações do mesmo ID no código; `CONFIRMADO` quando a execução local mostra **duas** requisições `page_view` para o mesmo carregamento.
- **Correção:** manter **uma** fonte por ID (GTM **ou** `gtag.js`); remover a duplicata. **Validação:** uma única requisição `page_view` por carregamento no DebugView/rede.
- Fonte: F4, F5.

### ANL-C03 — `page_view` em SPA e medição por mudanças de histórico  [OFICIAL]
- **O que verificar:** em SPAs, o *Enhanced Measurement* ouve eventos de histórico e envia `page_view` mesmo com `send_page_view: false`; para evitar duplicidade ao enviar `page_view` manual é preciso **desativar** a opção "Page changes based on browser history events" **no fluxo de dados (interface da conta)** e o envio automático no código. Verificar se o código envia `page_view` manual em rotas (React Router, `usePathname`, `router.events`).
- **Como verificar:** `estatica`; configuração da conta → `manual` (`not_tested`).
- **Evidência esperada:** `file:line` do `gtag('event','page_view',…)`/`send_page_view`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO` por execução) quando a navegação interna gera duas requisições `page_view`.
- **Correção:** escolher um mecanismo (automático por histórico **ou** manual) e desativar o outro. **Validação:** uma `page_view` por navegação no DebugView.
- Fonte: F6.

### ANL-C04 — Eventos de conversão disparados no código  [PRÁTICA; base oficial parcial]
- **O que verificar:** os objetivos do site têm evento correspondente no código: envio de formulário **concluído**, clique em WhatsApp (`wa.me`), clique em telefone (`tel:`), clique em e-mail, início/fim de checkout, compra; nomes **consistentes** (sem variações como `Lead`/`lead`/`generate lead`); eventos disparados **no sucesso** (não no clique do botão "enviar" antes da validação); parâmetros úteis sem PII. O GA4 oferece **eventos recomendados** agrupados por caso de uso (vendas online, geração de leads, jogos) que não são enviados automaticamente; usar o nome recomendado quando existir (**lista de nomes não foi lida** nesta revisão — conferir na página oficial antes de sugerir). **Marcar um evento como evento-chave** é feito na interface do GA4 → `manual`.
- **Como verificar:** `estatica` (`gtag('event'`, `dataLayer.push`, `fbq(`); `ativa-local` para observar o disparo **sem enviar formulário real** (usar apenas eventos de clique que não executam ação irreversível; ver nota).
- **Evidência esperada:** `file:line` do disparo; conversões do site sem evento (lista).
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando o site tem objetivo comercial claro (formulário/WhatsApp/checkout) e **nenhum** evento de conversão no código **e** há tag de medição instalada (`CONFIRMADO` por ausência no código, ressalva: pode estar configurado no GTM → ver abaixo).
- **Correção:** disparar evento no callback de sucesso; padronizar nomes. **Validação:** evento aparece no DebugView/Realtime uma vez por conversão; marcado como evento-chave (manual).
- **Atenção:** eventos podem estar configurados **dentro do GTM** (fora do repositório): quando há contêiner GTM e nenhum evento no código, registrar `RISCO_POTENCIAL` e item `not_tested`, nunca "sem conversão medida".
- **Nota SPEC §8.3:** nunca enviar formulários, mesmo em testes remotos.
- Fonte: F7, F8.

### ANL-C05 — `transaction_id` em compras (e-commerce)  [OFICIAL]
- **O que verificar:** evento de compra com `transaction_id` **único por transação**, gerado no servidor (ex.: número do pedido); **não vazio** (um valor vazio faz o GA deduplicar todas as compras com ele); **não estático**; sem informação que identifique o cliente; não reutilizado entre usuários; o GA4 deduplica eventos `purchase` com o mesmo ID (apenas fluxos web via `gtag.js`; apps via Firebase SDK).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do evento `purchase`.
- **Severidade padrão:** `IMPORTANTE` para `transaction_id` ausente, vazio ou estático em e-commerce com compra online (`CONFIRMADO` por código); só aplicável a e-commerce.
- **Correção:** passar o ID do pedido real. **Validação:** compras repetidas no mesmo pedido contam uma vez.
- Fonte: F9.

### ANL-C06 — Meta Pixel: instalação e eventos  [OFICIAL]
- **O que verificar:** código-base do Pixel presente **em todas as páginas** em que há conversões a acompanhar; chamadas de evento padrão (`fbq('track', 'Purchase', {currency, value})`, `InitiateCheckout`, `CompleteRegistration`, `Search`…) dentro de `<body>`, na carga ou em ação do usuário; `fbq('trackCustom', …)` para eventos sem equivalente padrão, **nome ≤ 50 caracteres**; parâmetros predefinidos corretos (`value`, `currency`, `contents` com `id` e `quantity`, `content_ids`…); chaves de parâmetros usados em públicos **sem espaços**; **um** Pixel por finalidade (sem código-base duplicado); ID do Pixel não placeholder. A lista completa de eventos padrão (inclusive `Lead`) está em página de referência **não lida** nesta revisão.
- **Como verificar:** `estatica`; `ativa-local` para contar `facebook.com/tr`.
- **Evidência esperada:** `file:line` do `fbq`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` para Pixel instalado **sem** nenhum evento de conversão em site que anuncia, ou código-base duplicado confirmado (`CONFIRMADO`).
- **Correção:** instalar o código-base no layout; eventos no sucesso da ação. **Validação:** eventos aparecem uma vez no Events Manager (verificação **manual**, pois não há acesso à conta).
- Fonte: F10.

### ANL-C07 — Pixel + Conversions API: deduplicação  [OFICIAL]
- **O que verificar (só se houver envio servidor-a-servidor):** eventos enviados pelo Pixel **e** pela Conversions API usam o **mesmo** `event_name` e o **mesmo** `event_id` (no Pixel: `eventID`, 4º argumento do `fbq('track', …, {eventID})`); a Meta descarta o duplicado em **até 48 horas** da primeira ocorrência, com o mesmo Pixel ID; `eventID` único por evento. Sem ID, os dois eventos podem contar.
- **Como verificar:** `estatica` (código de servidor e front-end).
- **Evidência esperada:** `file:line` do envio no servidor e do `fbq`.
- **Severidade padrão:** `IMPORTANTE` quando ambos enviam o mesmo evento sem `event_id` coincidente (`CONFIRMADO` por código).
- **Correção:** gerar `event_id` no servidor/cliente e enviá-lo pelos dois canais. **Validação:** o Events Manager mostra deduplicação (manual).
- **Atenção:** token de acesso da Conversions API nunca no front-end (→ `SEC`).
- Fonte: F11.

### ANL-C08 — Dados pessoais enviados a ferramentas de medição  [OFICIAL]
- **O que verificar:** a política do Google determina que **nenhum dado** que o Google possa usar ou reconhecer como PII seja enviado. Exemplos de PII: e-mail, telefone pessoal, CPF/documentos, nomes, identificadores permanentes de dispositivo, localização muito precisa. **Onde costuma vazar:** URLs e caminhos (parâmetros `?email=`, `?nome=`, ids de pedido identificáveis), **títulos de página**, campos digitados (busca, formulários), parâmetros de campanha (`utm_*`), dimensões de busca interna, parâmetros de evento/dimensões personalizadas, *User ID* e importação de dados. Procurar no código: valores de formulário em `gtag('event'…)`/`dataLayer.push`/`fbq`; `user_id` = e-mail; URLs de agradecimento com dados na query; título com nome do cliente.
- **Como verificar:** `estatica`; `ativa-local` para inspecionar requisições (apenas com dados de teste).
- **Evidência esperada:** `file:line` + trecho **com valores mascarados**; requisição em `raw/` (mascarada).
- **Severidade padrão:** `IMPORTANTE` para padrão que pode vazar PII (ex.: URL de agradecimento com e-mail em query, sem redação);
  - **`CRITICO` (`CONFIRMADO`)** apenas quando o código **comprovadamente** envia PII clara (e-mail, telefone, CPF, nome) a analytics/pixel de anúncio.
- **Correção:** remover o dado do evento/URL/título; usar identificadores internos opacos; configurar **redação de dados** do GA4 (interface, fluxos web: remove e-mails em esforço máximo e parâmetros de URL especificados) — **configuração da conta é `manual`**. **Validação:** nenhuma requisição de medição contém PII em testes com dados de teste.
- **Relacionado:** base legal e consentimento → `PRIV` (`related_ids`). Em caso de dúvida se um dado é PII, a página do Google recomenda consultar advogado — o plugin **não** decide.
- Fonte: F12.

### ANL-C09 — UTMs e campanhas  [OFICIAL (parâmetros) + PRÁTICA]
- **O que verificar:** URLs de campanha no código (CTAs, e-mails, links de bio, anúncios) com **`utm_source`, `utm_medium` e `utm_campaign` sempre juntos**; `utm_id` e `utm_source_platform` recomendados; valores **minúsculos e padronizados** (`google` ≠ `Google`; `SpringSale` ≠ `Spring_Sale`); parâmetros ausentes resultam em `(not set)` nos relatórios. **UTMs em links internos do próprio site**: a prática costuma ser evitar (sobrescrevem a origem da sessão) — **não confirmado nas páginas oficiais consultadas** → `PRÁTICA`. UTMs **não** devem conter PII (ANL-C08).
- **Como verificar:** `estatica` (busca por `utm_`).
- **Evidência esperada:** `file:line` do link incompleto/inconsistente.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para ausência de `utm_id`/`utm_source_platform`.
- **Correção:** padronizar com guia de nomenclatura do dono (não inventar nomes de campanha). **Validação:** todos os links de campanha com os três parâmetros, valores em minúsculas.
- Fonte: F13.

### ANL-C10 — Verificações em conta e em tempo real  [OFICIAL; manual]
- **O que verificar (só o dono, nas contas):** dados chegando no **Realtime** (a coleta pode levar até ~30 minutos para iniciar; `DebugView` citado como ferramenta nos guias de eventos); **eventos-chave** marcados; *Enhanced Measurement* ligado/desligado conforme o caso; **redação de dados** ativa; fluxo de dados com a URL correta; retenção; acesso e usuários; **Events Manager** do Meta com eventos recebidos e correspondência/dedup; domínios verificados.
- **Como verificar:** `manual` → `not_tested` (`ANL-C10`).
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono confere cada item e informa o resultado.
- Fonte: F1, F7.

## 4. Falsos positivos e armadilhas

- ID de medição `G-…`/`GTM-…`/Pixel ID no HTML **não é segredo**; não reportar como vazamento (≠ token de API).
- Eventos de conversão podem estar **só no GTM**; ausência no código não prova ausência de medição (`RISCO_POTENCIAL`/`not_tested`).
- Dois snippets podem coexistir **intencionalmente** para propriedades **diferentes**; só duplica quando o **mesmo** ID é enviado duas vezes.
- `page_view` manual é válido se a medição automática correspondente foi desativada.
- Em desenvolvimento local, IDs de teste são esperados; só reportar quando chegam ao build de produção.
- UTM `utm_*` com valores em maiúsculas não "quebra" nada, só fragmenta relatórios.
- `purchase` sem `transaction_id` só importa onde há compra online.
- Redação do GA4 é **melhor esforço** e não substitui remover PII na origem.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `@next/third-parties/google` (`GoogleAnalytics`, `GoogleTagManager`) ou `<Script>`; navegação por App Router dispara `page_view` por histórico; conferir duplicidade entre componente e snippet manual. |
| Astro | Snippet no layout; *Partytown*/`is:inline` podem alterar execução; navegação com *View Transitions* exige tratar `page_view`. |
| Vite/React (SPA) | Rotas sem recarga: ver ANL-C03; `index.html` carrega o snippet uma vez. |
| HTML estático | Snippet copiado em cada página: risco de página sem tag ou com ID antigo. |
| Outros (WordPress etc.) | Plugins (Site Kit, GTM4WP, PixelYourSite) + tema podem duplicar tags; conferir o HTML final. |

## 6. O que nunca afirmar

- Que a medição "está correta" ou "dados confiáveis" sem confirmação em DebugView/Realtime (manual).
- Que conversões "não são medidas" porque o código não tem evento (podem estar no GTM).
- Que o site "cumpre LGPD" por usar ou não tags (→ `PRIV`).
- Números de tráfego, conversão, custo ou ROI.
- Que duas fontes de tag **sempre** duplicam (a fonte primária consultada não diz isso; é risco).
- Que a redação de dados do GA4 elimina PII.
- Nomes de eventos recomendados que não foram lidos na documentação.

## 7. Fontes

- F1 — Google Analytics Help, [GA4] Set up Analytics for a website (snippet, ID `G-`, posição, Realtime, 30 min) — https://support.google.com/analytics/answer/9304153 — acessado em 2026-11-05
- F2 — Google Tag Manager Help, Install a web container (snippet do `<head>` "o mais alto possível"; `noscript` do snippet antigo) — https://support.google.com/tagmanager/answer/14847097 — 2026-11-05
- F3 — Google Tag Manager Help, Create an account and container (um contêiner por site/app) — https://support.google.com/tagmanager/answer/14842164 — 2026-11-05
- F4 — Google for Developers, gtag.js reference (`config`, `event`, ordem do snippet) — https://developers.google.com/tag-platform/gtagjs/reference — 2026-11-05
- F5 — Google for Developers, Measure pageviews (duplicidade de `page_view`) — https://developers.google.com/analytics/devguides/collection/ga4/views — 2026-11-05
- F6 — mesma URL de F5 (eventos de histórico em SPA, `send_page_view`).
- F7 — Google Analytics Help, [GA4] Recommended events (eventos recomendados por caso de uso; DebugView/Realtime) — https://support.google.com/analytics/answer/9267735 — 2026-11-05
- F8 — Google Analytics Help, Enhanced measurement (`page_view` automático) — https://support.google.com/analytics/answer/9216061 — 2026-11-05
- F9 — Google Analytics Help, Minimize duplicate key events with transaction IDs — https://support.google.com/analytics/answer/12313109 — 2026-11-05
- F10 — Meta for Developers, Conversion tracking (Pixel, eventos padrão e personalizados) — https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking — 2026-11-05
- F11 — Meta for Developers, Handling duplicate Pixel and Conversions API events — https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events — 2026-11-05
- F12 — Google Analytics Help, Best practices to avoid sending PII — https://support.google.com/analytics/answer/6366371 — 2026-11-05
- F13 — Google Analytics Help, [GA4] Campaigns and traffic sources (UTM) — https://support.google.com/analytics/answer/10917952 — 2026-11-05
- Não consultado nesta revisão: lista de eventos recomendados do GA4 (nomes); referência de eventos padrão do Meta (inclui `Lead`); Consent Mode (→ `PRIV`); tags de TikTok, LinkedIn e outras; regra sobre UTMs em links internos.
- Afirmação de que "gtag.js e GTM juntos duplicam eventos" **veio de resumo de busca**, não de página primária; tratada como risco, não como fato.
