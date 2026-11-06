# 05 — CRO e Landing Pages

Prefixo: `CRO` · Subagente: `conversion` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo provedor da plataforma (ex.: WhatsApp, Google); **[PRÁTICA]** = pesquisa de UX reconhecida (Nielsen Norman Group, Baymard) ou prática de mercado, **sem garantia de efeito** → severidade máxima `MELHORIA`.

**Natureza da área.** Quase não há fonte oficial de plataforma para conversão. As referências abaixo são pesquisa de usabilidade, **com datas** (várias de 2015–2019; a própria NN/g avisa sobre edições novas). Por isso:
- Toda verificação de CRO é **recomendação**, nunca fato de resultado. `nature` é **`RISCO_POTENCIAL`** ou **`PREVENTIVO`**; **nunca `CONFIRMADO`** sem dado medido do próprio site (dado de analytics, teste A/B ou gravação), que o plugin não tem.
- Severidade máxima `MELHORIA` (regra da SPEC §5 para prática sem garantia). A única exceção é o **formato do link de WhatsApp**, que tem documentação oficial (CRO-C08) — e mesmo assim sem prometer efeito em conversão.
- **Nunca prometer aumento de conversão**, nem citar % de ganho como esperado para este site.

## 1. Escopo e fronteiras

- **Desta área:** proposta de valor, hierarquia visual, CTAs, **fricção em formulários**, prova social, tratamento de objeções, **CTA de WhatsApp** (link `wa.me`, mensagem pré-preenchida, visibilidade no mobile), experiência mobile da conversão, pop-ups/overlays que interferem na conversão.
- **De outras áreas (só referenciar via `related_ids`):**
  - formulário **quebrado** (sem destino, erro) → `QA-C04`; link com número placeholder → `QA-C02`
  - rótulos programáticos, erros acessíveis, alvos de toque medidos → `A11Y-C05`, `A11Y-C10`
  - existência/instalação de eventos de conversão → `ANL-C04`; PII em eventos → `ANL-C08`
  - peso de widgets (chat, vídeo), CLS de banners → `PERF-C08`, `PERF-C12` (**trade-off** com CRO obrigatório)
  - banner de cookies/consentimento → `PRIV`; aqui só o efeito visual quando cobre o CTA
  - "sobre"/contato como confiança editorial → `CONT-C03`; NAP e horários → `LOC`
  - texto raso/duplicado → `CONT`
- **Desempate CRO × QA:** "o botão/formulário funciona?" → `QA`; "o botão/formulário converte bem para quem chega?" → `CRO`.
- **Trade-offs:** widget de chat/WhatsApp flutuante, pop-ups e vídeo de fundo ajudam conversão e prejudicam `PERF`/`A11Y`/`PRIV`. Sempre preencher `tradeoffs` e `related_ids` nos dois achados; **nunca resolver em silêncio**.

## 2. Quando acionar

- **Aplicável:** landing pages, páginas de serviço/produto, formulário de contato/orçamento, página inicial de negócio com objetivo comercial, e-commerce (checkout).
- **Não aplicável / reduzido:** documentação, blog sem oferta, app logado, site sem objetivo de conversão (registrar em `areas_excluded`).
- **Objetivo desconhecido:** se o objetivo de conversão do site não está claro no código/README, registrar em `not_tested` "objetivo de conversão não informado" e verificar só CRO-C01 e C08.

## 3. Verificações

### CRO-C01 — Proposta de valor visível na primeira tela  [PRÁTICA]
- **O que verificar:** o topo da página (primeira tela, H1 + subtítulo) diz **o que é**, **para quem** e **qual o benefício**, em linguagem do cliente (sem jargão interno nem frase vaga como "soluções inovadoras"). Base: a NN/g (2018) mediu **57%** do tempo de visualização **acima da dobra** (80% em 2010), **74%** nas duas primeiras telas, e orienta reservar o topo para os objetivos de negócio e do usuário de maior prioridade, com "o essencial antes dos detalhes" (NN/g, 2015).
- **Como verificar:** `estatica` (H1/subtítulo/hero); capturas 360/768/1440 em `ativa-local` para ver o que aparece sem rolar.
- **Evidência esperada:** `file:line` do H1/hero e descrição do que a primeira tela mostra.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`).
- **Correção:** reescrever hero com oferta clara **usando só informações reais do dono** (não inventar benefícios, números ou diferenciais); propor estrutura, não texto final inventado. **Validação:** em 5 segundos, alguém novo diz o que o site oferece (teste **manual** com pessoas; registrar em `not_tested`).
- **Atenção:** "acima da dobra" varia por dispositivo; o estudo é de 2018 e de sites em geral.
- Fonte: F1, F2.

### CRO-C02 — Hierarquia visual e foco em uma ação principal  [PRÁTICA]
- **O que verificar:** uma **ação principal** por página/tela (um CTA dominante), com ações secundárias visivelmente subordinadas; conteúdo secundário abaixo; sem excesso de elementos competindo no hero; sinal de que há mais conteúdo abaixo (evitar "falso fim de página"). A NN/g indica que cada elemento adicionado empurra outro para fora da primeira tela e recomenda alta proporção conteúdo/"chrome" em mobile.
- **Como verificar:** `estatica` (contagem de botões/links de destaque no hero); capturas em `ativa-local`.
- **Evidência esperada:** `file:line` + descrição dos CTAs concorrentes.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`); `OPCIONAL` para ajustes finos.
- **Correção:** definir a ação principal com o dono; reduzir ações concorrentes. **Validação:** teste de clareza com pessoas (manual).
- Fonte: F1, F2.

### CRO-C03 — CTA principal visível, específico e repetido onde decide  [PRÁTICA]
- **O que verificar:** CTA principal **na primeira tela** (a NN/g recomenda manter as principais chamadas para ação acima da dobra); rótulo que descreve a ação ou o resultado ("Pedir orçamento", "Falar no WhatsApp") em vez de genérico ("Enviar", "Clique aqui", "Saiba mais"); mesmo CTA repetido em pontos de decisão (após prova social, preços, fim da página) **sem competir** com outros; contraste e tamanho suficientes (valores → `A11Y-C08`, `A11Y-C10`). **Não há fonte consultada** para regras de redação de rótulos (a página da NN/g sobre botões de CTA retornou 404) → redação é prática de mercado, sem número.
- **Como verificar:** `estatica`; capturas.
- **Evidência esperada:** `file:line` dos CTAs e rótulos.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`); `OPCIONAL` para rótulo ligeiramente genérico.
- **Correção:** rótulo específico; repetir o CTA em pontos de decisão. **Validação:** CTA visível sem rolar em 360 e 1440 px.
- Fonte: F2 (posição); redação: sem fonte.

### CRO-C04 — Fricção em formulários  [PRÁTICA]
- **O que verificar:** número de campos (**cada campo removido tende a aumentar a conversão**, segundo a NN/g; Baymard: checkout médio de **11,3** campos em 2024 e "a maioria dos sites precisa de apenas **8**"); campos que podem ser derivados, coletados depois ou omitidos; **rótulos imediatamente acima dos campos** em mobile e formulários curtos; no máximo **1 ou 2 campos opcionais**, claramente marcados; instruções de formato **antes** do erro ("sem regras secretas"); mensagens de erro **visíveis e específicas**, sinalizadas por mais que cor, com **o que o usuário digitou preservado**; menos digitação em mobile (tipo de campo e `autocomplete` adequados, uso de recursos do aparelho); menos etapas.
- **Como verificar:** `estatica` (campos de cada `<form>`); formulário nunca enviado (SPEC §8.3).
- **Evidência esperada:** `file:line` do formulário, lista de campos e quais são questionáveis.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`); `OPCIONAL` para formulários curtos.
- **Correção:** cortar campos com o dono (ele decide o que é essencial para vender/atender); manter só o necessário. **Validação:** formulário só com campos necessários, rótulos e erros conforme acima (teste manual).
- Rótulos programáticos e erros acessíveis → `A11Y-C05`; formulário que não envia → `QA-C04`; campos que coletam dado pessoal sem necessidade → `PRIV`.
- **Atenção:** os números da Baymard são de **checkout de e-commerce**; não aplicar como meta de formulário de contato.
- Fonte: F3, F4.

### CRO-C05 — Prova social e sinais de confiança  [PRÁTICA]
- **O que verificar:** depoimentos, avaliações, casos, logos de clientes, certificações **reais e verificáveis**; a NN/g (2016) afirma que pessoas confiam mais em avaliações de **sites externos** do que nas listadas no próprio site, e que vincular a perfis externos mostra transparência; contato **visível** (NN/g: contato escondido gera desconfiança); políticas (devolução, garantia) fáceis de achar; **preço/custo antes de pedir dados pessoais** (ou faixa de preços); fotos **reais** do trabalho e das pessoas em vez de imagens genéricas "de enchimento"; **erros, typos e links quebrados reduzem credibilidade**.
- **Como verificar:** `estatica`.
- **Evidência esperada:** ausência de prova social/contato/política em páginas de oferta (`file`); depoimentos sem identificação.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`); `OPCIONAL` quando só falta um elemento.
- **Correção:** incluir apenas prova **real** fornecida pelo dono (nome, foto, link verificável); **nunca fabricar depoimentos, avaliações, números de clientes, selos ou logos**.
- **Validação:** cada item de prova social tem origem verificável e atual.
- **Atenção:** depoimentos genéricos sem autor ou dados inventados são risco de reputação/`CONT`; não recomendar "adicionar depoimento" sem fonte real.
- Contato/"sobre" → `CONT-C03`; NAP → `LOC-C01`.
- Fonte: F5.

### CRO-C06 — Objeções, preço e processo respondidos  [PRÁTICA]
- **O que verificar:** a página responde dúvidas que impedem a decisão: **quanto custa** (ou faixa/como se calcula), **como funciona** (passos), **prazos**, **garantia/devolução**, **o que acontece depois do contato**, quem atende; transparência de custos antes da coleta de dados (NN/g, 2016: sites que omitiram taxas básicas foram abandonados em testes). FAQ comercial pode ser seção de conteúdo (estrutura → `AEO-C04`).
- **Como verificar:** `estatica` (leitura da página).
- **Evidência esperada:** lista de objeções típicas sem resposta na página.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`).
- **Correção:** o dono fornece as respostas reais; o plugin só propõe **onde** e **que perguntas** responder (nunca inventar preços, prazos ou garantias). **Validação:** dúvidas principais respondidas na página.
- Fonte: F5.

### CRO-C07 — Experiência mobile da conversão  [PRÁTICA]
- **O que verificar:** em 360 px: o CTA e a proposta de valor aparecem sem rolagem excessiva; conteúdo priorizado (o resumo antes dos detalhes); alvos de toque **maiores e bem espaçados** (NN/g: alvo para toque é "consideravelmente maior" que para mouse; medida normativa mínima → `A11Y-C10`); **pouca digitação** e poucas etapas; página leve (NN/g: "projete páginas leves"; peso → `PERF`); barra/botão fixo (CTA, WhatsApp, cookies) **sem cobrir** conteúdo, campo ou outro CTA. Sessões móveis eram mais curtas (72 s vs. 150 s no desktop, **dado de 2015**) — usar como contexto, não como meta.
- **Como verificar:** `ativa-local` (capturas 360/768/1440); `estatica`.
- **Evidência esperada:** captura mostrando o problema (CTA fora da primeira tela, sobreposição).
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`); `OPCIONAL` para ajustes finos.
- **Correção:** simplificar a primeira tela mobile; reposicionar elementos fixos. **Validação:** em 360 px, CTA visível e utilizável sem sobreposição (teste manual em aparelho real, `not_tested`).
- Responsividade quebrada (overflow) → `QA-C05`.
- Fonte: F2.

### CRO-C08 — CTA de WhatsApp  [OFICIAL (formato do link) + PRÁTICA (posição e visibilidade)]
- **O que verificar:**
  1. **Formato do link [OFICIAL]:** `https://wa.me/<número>` com o número em **formato internacional completo**, **sem zeros à esquerda, parênteses ou travessões** (documentação do WhatsApp: `https://wa.me/55XXXXXXXXXXX` correto; `https://wa.me/+55-(XX)XXXXXXXXX` incorreto). Mensagem pré-preenchida: `?text=<mensagem codificada em URL>` (espaços como `%20`); link só com mensagem: `https://wa.me/?text=…` (abre lista de contatos). **Atenção:** os exemplos da própria página têm **barra dupla** (`wa.me//55…`) e um `%2s` malformado — **não copiar esses exemplos**; seguir a linha de formato (`wa.me/<número>?text=…`) e codificação válida.
  2. **Não placeholder [QA-C02]:** número real do dono, mensagem coerente com a página.
  3. **Visibilidade [PRÁTICA]:** botão visível em mobile (cabeçalho ou botão flutuante), **sem cobrir** o CTA principal, campos de formulário ou o texto (verificar em 360 px); alvo de toque ≥ 24 px (→ `A11Y-C10`); presente perto da oferta e do formulário; funcionamento sem JavaScript (um `<a href>` simples).
  4. **Marca [OFICIAL parcial]:** se usar o botão oficial "Chat on WhatsApp", a página orienta usá-lo **sem modificações** e informa que só existe em inglês.
  5. **Medição [ANL-C04]:** o clique gera evento (referenciar, não duplicar).
  6. **Trade-off:** widget flutuante de terceiros (script) pesa em `PERF-C12`; consentimento/privacidade do widget → `PRIV`.
- **Como verificar:** `estatica` (links `wa.me`/`api.whatsapp.com`); capturas em `ativa-local`.
- **Evidência esperada:** `file:line` do link; captura em 360 px.
- **Severidade padrão:** `MELHORIA` para posição/visibilidade; `IMPORTANTE` (`CONFIRMADO` por código) **apenas** para link `wa.me` com formato que **contradiz a documentação oficial** (ex.: `+`, parênteses, travessões, `wa.me//`), por risco de o link não abrir a conversa — recomendar teste manual pelo dono.
- **Correção:** `https://wa.me/<DDI><DDD><número>?text=<mensagem-codificada>`; mover botão flutuante para não cobrir conteúdo. **Validação:** o dono clica no link em celular e no WhatsApp Web e a conversa abre com a mensagem esperada (`not_tested`).
- **Nunca** inventar o número do cliente nem a mensagem institucional.
- Fonte: F6.

### CRO-C09 — Pop-ups, modais e overlays na conversão  [PRÁTICA]
- **O que verificar:** modal/overlay aberto **antes do conteúdo principal** (exceções citadas pela NN/g: consentimento de cookies exigido por lei e verificação de idade); pedido de e-mail logo na chegada; vários overlays em sequência; overlay que interrompe tarefa crítica (preenchimento de formulário, pagamento); modais de app para visitantes de uma única visita; botão de fechar difícil de achar/usar. A NN/g (2019) reporta rejeição e perda de confiança e sugere alternativas menos intrusivas (banner fino fácil de dispensar; pedir e-mail em momento relevante, com algo tangível em troca). O Google lista "evitar interstitials intrusivos" como **autoavaliação** de experiência de página, **sem** detalhar penalidade (a NN/g menciona penalização do Google a práticas que dificultam o acesso ao conteúdo, sobretudo em mobile — **não confirmada** na página do Google consultada).
- **Como verificar:** `estatica` (gatilhos de modais: `onload`, `setTimeout`, *exit-intent*); `ativa-local` com capturas na carga.
- **Evidência esperada:** `file:line` do gatilho; captura.
- **Severidade padrão:** `MELHORIA` (`RISCO_POTENCIAL`).
- **Correção:** adiar o overlay até o usuário interagir ou ler; um por vez; fácil de fechar (teclado e toque → `A11Y-C07`). **Validação:** nenhuma sobreposição bloqueando o conteúdo na carga, exceto exigência legal.
- Banner de cookies → `PRIV`; deslocamento de layout → `PERF-C08`.
- Fonte: F7, F8.

## 4. Falsos positivos e armadilhas

- **Sem dado, sem certeza:** "CTA fraco" ou "formulário longo" é hipótese; o plugin **não mede conversão**. Redigir como recomendação com `RISCO_POTENCIAL`/`PREVENTIVO`.
- Formulário longo pode ser necessário (cadastro regulado, orçamento complexo); perguntar ao dono antes de recomendar cortes.
- Páginas institucionais, de documentação ou de blog podem **não ter** CTA agressivo por escolha.
- Os estudos citados são de **datas diferentes e contextos específicos** (e-commerce, sites dos EUA); servem de orientação, não de meta.
- Prova social ausente não deve gerar sugestão de "inventar" prova.
- Botão flutuante de WhatsApp pode ser desejado; o problema é só cobrir conteúdo/CTA/campos ou pesar demais.
- `href` de WhatsApp via `api.whatsapp.com/send?phone=` é outra forma comum **não coberta** pela documentação consultada: não reportar como erro.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Hero/CTAs em componentes; botão flutuante geralmente em `layout.tsx`; conferir hidratação do CTA (`use client`). |
| Astro | Páginas estáticas com poucos *islands*; widgets de chat como `client:*` pesam em JS. |
| Vite/React (SPA) | Conteúdo no cliente (ver `AIO-C04`); CTAs dependem de JS. |
| HTML estático | CTA e `wa.me` em cada página: risco de número/mensagem divergentes entre páginas. |
| Outros (WordPress etc.) | Plugins de WhatsApp/pop-up injetam scripts e overlays; conferir o HTML final e o impacto em `PERF`. |

## 6. O que nunca afirmar

- Que uma mudança "vai aumentar a conversão" em X% — nenhum ganho pode ser prometido (estudos da NN/g e Baymard descrevem comportamento geral, não resultado deste site).
- Que o site "converte mal/bem" sem dados de analytics, teste A/B ou usuários reais.
- Que um problema de CRO é `CONFIRMADO`: sem dado medido, é `RISCO_POTENCIAL` ou `PREVENTIVO`.
- Depoimentos, avaliações, selos, números de clientes, preços ou garantias inventados.
- Que o link de WhatsApp "funciona" sem teste do dono em aparelho real.
- Que pop-ups são "penalizados pelo Google" sem citar a política atual consultada (a página consultada não detalha).
- Valores "ideais" de campos, de tamanho de botão ou de tempo de leitura como regra.

## 7. Fontes

- F1 — Nielsen Norman Group, "Scrolling and Attention" (T. Fessenden, 15/04/2018; 57% acima da dobra, 74% nas duas primeiras telas) — https://www.nngroup.com/articles/scrolling-and-attention/ — acessado em 2026-11-05
- F2 — Nielsen Norman Group, "Mobile UX" (19/04/2015; priorização de conteúdo, alvos de toque, digitação, 72 s × 150 s) — https://www.nngroup.com/articles/mobile-ux/ — 2026-11-05 — **dado antigo**
- F3 — Nielsen Norman Group, "Web Form Design Guidelines" (K. Whitenton, 01/05/2016) — https://www.nngroup.com/articles/web-form-design/ — 2026-11-05
- F4 — Baymard Institute, "Checkout Optimization: 5 Ways to Minimize Form Fields in Checkout" (E. Scott, 26/06/2024; média de 11,3 campos; "8" suficientes) — https://baymard.com/blog/checkout-flow-average-form-fields — 2026-11-05 — **checkout de e-commerce**
- F5 — Nielsen Norman Group, "Trustworthiness in Web Design" (08/05/2016; contato, políticas, preços, prova social externa, imagens) — https://www.nngroup.com/articles/trustworthy-design/ — 2026-11-05
- F6 — WhatsApp, "Como usar o clique para conversar" (formato `wa.me`, `?text=`) — https://faq.whatsapp.com/5913398998672934 — 2026-11-05
- F7 — Nielsen Norman Group, "Popups: 10 Problematic Trends and Alternatives" (A. Kaley, 30/06/2019) — https://www.nngroup.com/articles/popups/ — 2026-11-05
- F8 — Google, Understanding page experience in Google Search results (sem sinal único; interstitials como autoavaliação) — https://developers.google.com/search/docs/appearance/page-experience — 2026-11-05
- Falha ao buscar: NN/g "Call-to-Action Buttons" (404) — rótulos de CTA ficam sem fonte.
- Não consultado: estudos de Baymard sobre formulários fora do checkout; relatórios mais recentes da NN/g sobre mobile; testes A/B próprios do site.
