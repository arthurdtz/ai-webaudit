# 09 — Acessibilidade

Prefixo: `A11Y` · Subagente: `accessibility` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = critério normativo do W3C (WCAG 2.2) ou documentação oficial; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Referência técnica:** WCAG 2.2, nível **AA** (publicado em 05/10/2023, atualizado em 12/12/2024; WCAG 2.0 e 2.1 continuam válidos e 2.2 é compatível com eles; a nota 4.1.1 *Parsing* foi removida). **WCAG 3 é rascunho inicial; não usar.**

**Regra central — automação cobre só parte.** O axe-core declara encontrar "em média **57%** dos problemas de WCAG automaticamente" e devolve itens **"incomplete"** quando não tem certeza (exigem revisão humana). O W3C diz que "nenhuma ferramenta sozinha pode determinar se um site atende aos padrões" e que **avaliação humana qualificada é necessária**. Portanto: **nunca declarar conformidade, "site acessível" ou "WCAG AA atendido"**; todo relatório inclui a lista do que ficou para teste manual (seção "Não testado").

## 1. Escopo e fronteiras

- **Desta área:** critérios WCAG 2.2 A/AA verificáveis em código e em execução: alternativas textuais, idioma, estrutura e relações, rótulos e nomes, ARIA, teclado e foco, contraste, redimensionamento/reflow/espaçamento de texto, tamanho de alvos, arrastar, autenticação, ajuda consistente, entrada redundante, tempo e movimento.
- **De outras áreas (só referenciar via `related_ids`):**
  - título único e descritivo da página como SEO (`<title>`, duplicidade) → `SEO-C07`; o critério **2.4.2 Page Titled** é só citado
  - ordem de headings "para busca" → `SEO` (não afeta ranking); estrutura de headings para **leitor de tela** → aqui (`A11Y-C04`)
  - texto de âncora de links para SEO → `SEO-C11`; propósito do link para usuário (2.4.4) → aqui
  - `alt` com palavras-chave para SEO → `SEO`; função do `alt` → aqui
  - erros de console, links quebrados, formulário que falha → `QA`
  - fricção de formulário e CTA → `CRO`; banner de cookies (consentimento) → `PRIV`, mas **foco, teclado e contraste do banner** → aqui
  - deslocamento de layout, `prefers-reduced-motion` para CLS → `PERF-C08` (aqui apenas o critério de movimento/pausa)
- **Contexto brasileiro (apenas informativo, nunca "conformidade legal"):**
  - **Lei 13.146/2015 (LBI), art. 63:** "É obrigatória a acessibilidade nos sítios da internet mantidos por empresas com sede ou representação comercial no País ou por órgãos de governo, para uso da pessoa com deficiência, garantindo-lhe acesso às informações disponíveis, conforme as melhores práticas e diretrizes de acessibilidade adotadas internacionalmente." (Planalto, consultado em 2026-11-05). A lei **não** nomeia versão/nível de WCAG.
  - **eMAG 3.1** (abril/2014; baseado em WCAG 2.0): modelo do governo federal, obrigatório para sítios e portais do governo brasileiro (Portaria nº 3/2007); a página consultada **não** diz que vale para o setor privado.
  - A página gov.br consultada cita as normas **ABNT NBR 17225** (conteúdo e aplicações web) e **NBR 17060** (dispositivos móveis), sem detalhar; **não** foram lidas.
  - O plugin **não** emite parecer jurídico.

## 2. Quando acionar

- **Aplicável:** qualquer site com interface pública (HTML renderizado).
- **Reduzido:** sem servidor possível → só verificações `estatica`; resultados de axe e contraste vão para `not_tested`.
- **Ativa-local** (axe-core via Playwright + capturas em 360/768/1440, SPEC §8.2): sempre que o servidor local for aprovado.

## 3. Verificações

### A11Y-C01 — Execução do axe-core e tratamento dos resultados  [OFICIAL]
- **O que verificar:** relatório axe por página (versão registrada) com: violações; itens **incomplete** (revisão manual); regras `color-contrast` não confiáveis em JSDOM. Cada violação vira achado **apenas se tiver evidência** (seletor/HTML afetado em `raw/`); agrupar por regra e causa raiz, não um achado por nó. Itens "incomplete" **não são achados**: vão para `not_tested`.
- **Como verificar:** `ativa-local` (HTML renderizado).
- **Evidência esperada:** `raw_ref` do JSON do axe, versão, URL, viewport; seletores afetados.
- **Severidade padrão:** definida pelos checks específicos abaixo; este check só registra a execução e a cobertura (ferramenta em `tools`).
- **Correção/validação:** reexecutar o axe após as correções e confirmar que a regra não aparece.
- **Atenção:** nunca converter "0 violações no axe" em "acessível". Escrever "sem violações automáticas detectadas nas páginas X; testes manuais pendentes".
- Fonte: F5, F8.

### A11Y-C02 — Alternativas textuais para conteúdo não textual (1.1.1, A)  [OFICIAL]
- **O que verificar:** `<img>` com `alt` descritivo quando informativa; `alt=""` quando **decorativa**; imagem que é link/botão com `alt` que descreve o **destino/ação**; ícones-botão e SVG interativo com nome acessível (`aria-label`/texto oculto visualmente); texto em imagem; `<canvas>`/mapa com alternativa; `<input type="image">` com `alt`.
- **Como verificar:** `estatica` (templates); `ativa-local` (axe `image-alt` etc.).
- **Evidência esperada:** `file:line` do elemento ou nó do axe.
- **Severidade padrão:** `IMPORTANTE` para imagem informativa/linkada **sem** `alt` (`CONFIRMADO`); `MELHORIA` para `alt` pouco descritivo (qualidade é julgamento → `manual` quando duvidoso).
- **Correção:** `alt` adequado ao propósito; `alt=""` em decorativas. **Validação:** nenhuma imagem sem atributo `alt`; imagens-link com nome.
- `alt` com palavras-chave de SEO ≠ critério de acessibilidade.
- Fonte: F2.

### A11Y-C03 — Idioma da página (3.1.1, A)  [OFICIAL]
- **O que verificar:** `<html lang="…">` presente e válido (ex.: `pt-BR`), coerente com o conteúdo.
- **Como verificar:** `estatica`; `ativa-local`.
- **Evidência esperada:** `file:line` de `<html>`.
- **Severidade padrão:** `IMPORTANTE` quando ausente/inválido (`CONFIRMADO`).
- **Correção:** definir `lang` no documento raiz (Next.js `<html lang>`; Astro layout; HTML estático em cada página). **Validação:** `lang` válido em todas as páginas.
- Fonte: F2.

### A11Y-C04 — Estrutura semântica, relações e headings (1.3.1, A; 2.4.6, AA; 2.4.1, A)  [OFICIAL]
- **O que verificar:** informação, estrutura e relações transmitidas pela apresentação podem ser determinadas por programa ("ou disponíveis em texto"): títulos como `<h1>`–`<h6>` reais (não `<div>` estilizada), listas, tabelas de dados com `<th>`/`scope`, regiões (`<main>`, `<nav>`, `<header>`, `<footer>`); `<h1>` único e títulos que descrevem tema/propósito; mecanismo para **pular blocos repetidos** (link "Pular para o conteúdo" ou landmarks); campos agrupados (`<fieldset>/<legend>`). Ordem de headings é recomendação de leitura por leitor de tela, **não** critério de ranking.
- **Como verificar:** `estatica`; `ativa-local` (axe `heading-order`, `landmark-*`, `bypass`).
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `IMPORTANTE` para ausência total de landmark/`<main>` e de mecanismo de pular em site com navegação extensa (`CONFIRMADO`); `MELHORIA` para saltos de nível de heading.
- **Correção:** trocar por elementos semânticos; adicionar *skip link*. **Validação:** estrutura legível pela árvore de acessibilidade; sem regra de estrutura no axe.
- Fonte: F2.

### A11Y-C05 — Rótulos, instruções e erros em formulários (3.3.2, A; 3.3.1, A; 3.3.3, AA; 1.3.5, AA)  [OFICIAL]
- **O que verificar:** todo campo tem **rótulo programático** (`<label for>`/`aria-labelledby`), não só `placeholder`; instruções exibidas quando há formato específico; erro **identificado e descrito em texto** (não só cor) e associado ao campo; sugestão de correção quando conhecida; `autocomplete` com o valor adequado para dados do usuário (nome, e-mail, telefone, endereço); botões com nome acessível.
- **Como verificar:** `estatica`; `ativa-local` (axe `label`, `autocomplete-valid`). **Nunca enviar formulários** (SPEC §8.3); validação de mensagens de erro reais → `manual`.
- **Evidência esperada:** `file:line` do campo; nó do axe.
- **Severidade padrão:** `IMPORTANTE` para campo sem rótulo programático em formulário principal (contato/orçamento/compra) (`CONFIRMADO`); `CRITICO` **somente** quando o formulário de conversão principal é inutilizável por tecnologia assistiva, **com evidência de código e de execução**; `MELHORIA` para `autocomplete` ausente.
- **Correção:** associar `<label>`; mensagens de erro em texto; `autocomplete`. **Validação:** campo anunciado com nome; erro descrito e vinculado.
- Fricção do formulário → `CRO`; formulário que não envia → `QA`.
- Fonte: F2, F3, F9.

### A11Y-C06 — Nome, papel e valor; uso correto de ARIA (4.1.2, A)  [OFICIAL]
- **O que verificar:** componentes personalizados (menu, abas, acordeão, modal, dropdown) expõem **nome e papel** por programa e notificam mudanças de estado; **regras de uso de ARIA** (W3C): (1) se há elemento HTML nativo com a semântica e comportamento necessários, usá-lo; (2) não mudar semântica nativa sem necessidade; (3) todo controle ARIA interativo deve funcionar por teclado; (4) **não usar** `role="presentation"` nem `aria-hidden="true"` em elemento focável; "**um papel é uma promessa**" — `role="button"` em `<div>` exige também o JavaScript de teclado; **"nenhum ARIA é melhor que ARIA ruim"** (APG). Padrões de widgets conforme o ARIA Authoring Practices Guide.
- **Como verificar:** `estatica` (`div onClick`, `role=`, `aria-*`); `ativa-local` (axe `aria-*`, `button-name`, `link-name`); `manual` para comportamento com leitor de tela.
- **Evidência esperada:** `file:line` do componente; nó do axe.
- **Severidade padrão:** `IMPORTANTE` para controle interativo sem nome/papel acessível (`CONFIRMADO`); `MELHORIA` para ARIA redundante.
- **Correção:** usar `<button>`/`<a href>`/`<details>` nativos; seguir APG para widgets complexos. **Validação:** sem erros de ARIA no axe; teclado e leitor de tela confirmados manualmente.
- Fonte: F2, F6, F7.

### A11Y-C07 — Teclado, ordem e foco (2.1.1, A; 2.4.3, A; 2.4.7, AA; 2.4.11, AA)  [OFICIAL]
- **O que verificar:** **toda a funcionalidade operável por teclado** sem exigir temporização por tecla; elementos interativos focáveis (não `<div onClick>` sem `tabindex`/teclado); ordem de foco preserva significado; **indicador de foco visível** (sem `outline: none`/`outline: 0` sem substituto); **foco não totalmente oculto por conteúdo do autor** (2.4.11): cabeçalho fixo, banner de cookies, chat flutuante cobrindo o elemento focado; ausência de **armadilha de teclado**; `tabindex` positivo evitado.
- **Como verificar:** `estatica` (CSS `outline`, `tabindex`, `onClick` em não interativos); `ativa-local` (axe parcial; sequência de `Tab` e capturas); **`manual`** para navegação real completa.
- **Evidência esperada:** `file:line`; captura do foco oculto em `raw/`.
- **Severidade padrão:** `IMPORTANTE` para `outline` removido sem alternativa ou controle principal só por mouse (`CONFIRMADO`); `CRITICO` **somente** quando navegação principal ou fluxo de conversão é inoperável por teclado, com evidência de código **e** execução; `RISCO_POTENCIAL`/`manual` para ordem de foco e armadilhas não executadas.
- **Correção:** elementos nativos; `:focus-visible` com contraste; `scroll-padding`/`scroll-margin` para cabeçalhos fixos. **Validação:** percorrer a página só com teclado, foco sempre visível e alcançando todos os controles.
- Fonte: F2.

### A11Y-C08 — Contraste de texto e de componentes (1.4.3, AA; 1.4.11, AA; 1.4.1, A)  [OFICIAL]
- **O que verificar:** texto e imagem de texto com razão **≥ 4,5:1** (**≥ 3:1** para texto grande); componentes de interface e gráficos necessários com **≥ 3:1** contra as cores adjacentes; **cor não é o único meio** de transmitir informação (links em texto corrido, estados de erro, gráficos). Medir com axe `color-contrast` em página renderizada; **não calcular contraste "de cabeça" a partir de tokens CSS** (gradientes, imagens de fundo e estados dinâmicos invalidam o cálculo).
- **Como verificar:** `ativa-local` (axe); `estatica` só para apontar candidatos (tokens de cor); `manual` para fundos com imagem/gradiente e estados `:hover`/`:focus`/desabilitado.
- **Evidência esperada:** nó do axe com razão medida; capturas.
- **Severidade padrão:** `IMPORTANTE` para texto principal/CTA com razão medida abaixo de 4,5:1 (`CONFIRMADO`); `MELHORIA` para casos limite e componentes decorativos.
- **Correção:** ajustar cores até atingir a razão exigida. **Validação:** axe sem `color-contrast` nas páginas testadas + revisão manual dos estados.
- Fonte: F2, F5.

### A11Y-C09 — Redimensionamento, reflow e espaçamento de texto (1.4.4, AA; 1.4.10, AA; 1.4.12, AA)  [OFICIAL]
- **O que verificar:** texto redimensionável até **200%** sem perda de conteúdo/funcionalidade; **reflow**: sem rolagem em duas dimensões a **320 px CSS** de largura (conteúdo de rolagem vertical) e **256 px** de altura (rolagem horizontal), exceto conteúdo que exige disposição 2D (tabelas de dados, mapas); com espaçamento aplicado (linha ≥ 1,5×, parágrafo ≥ 2×, letra ≥ 0,12×, palavra ≥ 0,16× o tamanho da fonte) **sem perda** de conteúdo ou funcionalidade; `<meta viewport>` com `user-scalable=no`/`maximum-scale` baixo **impede zoom** e é indicador de risco para 1.4.4 (técnica/falha específica **não consultada** nesta revisão).
- **Como verificar:** `estatica` (viewport, `px` fixos em containers); `ativa-local` (captura em 360 px; rolagem horizontal); **`manual`** para 200% e espaçamento.
- **Evidência esperada:** `file:line` do viewport; captura com rolagem horizontal em `raw/`.
- **Severidade padrão:** `IMPORTANTE` para zoom bloqueado (`CONFIRMADO` por código) ou rolagem horizontal da página em 360 px; `MELHORIA` caso contrário.
- **Correção:** remover `user-scalable=no`/`maximum-scale`; layout fluido. **Validação:** zoom 200% e 320 px sem perda.
- Fonte: F2.

### A11Y-C10 — Tamanho de alvos de ponteiro (2.5.8, AA)  [OFICIAL]
- **O que verificar:** alvos de ponteiro com **≥ 24 × 24 px CSS**, **exceto**: (espaçamento) círculo de 24 px centrado no alvo não intersecta outro alvo; (equivalente) mesma função em outro controle conforme; (em linha) alvo dentro de frase ou limitado pela altura de linha; (controle do agente do usuário); (essencial/legal). Candidatos: ícones sociais, botão fechar de banner/modal, botão flutuante de WhatsApp/chat, links de rodapé, paginação.
- **Como verificar:** `ativa-local` (medir caixas dos elementos em `raw/`); `estatica` para candidatos.
- **Evidência esperada:** dimensões medidas e seletor.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando o CTA principal ou controle de fechar tem < 24 px **medido** e sem exceção aplicável.
- **Correção:** aumentar a área clicável (`min-width/min-height` ou padding). **Validação:** medida ≥ 24 px ou exceção documentada.
- Fonte: F2, F10.

### A11Y-C11 — Arrastar, autenticação e entrada redundante (2.5.7, AA; 3.3.8, AA; 3.3.7, A; 3.2.6, A)  [OFICIAL]
- **O que verificar (só se existirem os recursos):**
  - **2.5.7 Dragging:** funcionalidade por arrastar (carrossel, *slider*, reordenar) com alternativa de **ponteiro único sem arrastar** (botões, cliques).
  - **3.3.8 Autenticação:** nenhuma etapa exige **teste de função cognitiva** (lembrar/transcrever) sem alternativa, mecanismo de assistência ou as exceções (reconhecer objetos; conteúdo que o próprio usuário enviou); indicador prático: campo de senha que **bloqueia colar** ou `autocomplete="off"` impedindo gerenciador de senhas.
  - **3.3.7 Redundant Entry:** informação já fornecida **no mesmo processo** é preenchida automaticamente ou selecionável (exceto essencial/segurança/inválida).
  - **3.2.6 Consistent Help:** mecanismos de ajuda repetidos (contato humano, formulário/chat, autoatendimento) aparecem **na mesma ordem relativa** nas páginas.
- **Como verificar:** `estatica`; `manual` para fluxos.
- **Evidência esperada:** `file:line` (ex.: `onpaste` bloqueado); fluxo descrito em `not_tested` quando não verificável.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` para login que bloqueia colar senha **confirmado em código** (`CONFIRMADO`).
- **Correção:** permitir colar e gerenciadores; alternativas aos gestos de arrastar. **Validação:** fluxo concluído sem teste cognitivo nem arrasto obrigatório.
- Fonte: F2, F10.

### A11Y-C12 — Tempo, movimento, flashes e navegação consistente (2.2.1, 2.2.2, 2.3.1, A; 3.2.3, 3.2.4, AA)  [OFICIAL]
- **O que verificar:** limites de tempo definidos pelo conteúdo (sessão, carrossel) com opção de desligar/ajustar/estender; conteúdo que **inicia sozinho, dura > 5 s e se move/pisca/rola** em paralelo a outro conteúdo com mecanismo de **pausar/parar/ocultar**; nada que pisque mais de **3 vezes por segundo** (ou abaixo dos limiares); navegação repetida na **mesma ordem relativa** entre páginas; componentes com a mesma função identificados de forma consistente.
- **Como verificar:** `estatica` (carrosséis automáticos, `autoplay`, animações, timers); `ativa-local` para observar; `manual` para flashes.
- **Evidência esperada:** `file:line`; descrição do comportamento.
- **Severidade padrão:** `IMPORTANTE` para autoplay sem controle de pausa (`CONFIRMADO` por código); `MELHORIA` para consistência de navegação.
- **Correção:** botão pausar; `prefers-reduced-motion`; evitar autoplay. **Validação:** controle de pausa funcional; sem flashes.
- Fonte: F2.

### A11Y-C13 — Propósito dos links (2.4.4, A) e título da página (2.4.2, A)  [OFICIAL]
- **O que verificar:** propósito de cada link determinável **só pelo texto** ou pelo texto + contexto programático; evitar "clique aqui"/"saiba mais" repetidos sem contexto acessível (`aria-label`/`aria-describedby`/texto adicional); links de imagem com nome; `<title>` descreve o tema/propósito (qualidade de SEO do título → `SEO-C07`).
- **Como verificar:** `estatica`; `ativa-local` (axe `link-name`).
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `IMPORTANTE` para link **sem nome acessível** (`CONFIRMADO`); `MELHORIA` para texto genérico com contexto parcial.
- **Correção:** texto descritivo ou nome acessível complementar. **Validação:** lista de links do leitor de tela compreensível.
- Âncoras genéricas como SEO → `SEO-C11`.
- Fonte: F2.

### A11Y-C14 — Testes manuais obrigatórios (lista de não testado)  [OFICIAL; manual]
- **O que verificar (com ser humano):** (1) percorrer o site **só com teclado**; (2) testar com **leitor de tela** (NVDA/Windows, VoiceOver/macOS-iOS, TalkBack/Android) as jornadas principais; (3) zoom 200% e 320 px; (4) espaçamento de texto; (5) foco visível e não obscurecido; (6) contraste de estados (`hover`, `focus`, desabilitado) e sobre imagens; (7) qualidade do `alt`; (8) modais e menus (gerência de foco); (9) vídeo/áudio (legendas, audiodescrição — verificar se há mídia); (10) revisão com **pessoas com deficiência**. O W3C não recomenda explicitamente leitor de tela na página consultada; incluir como **prática** da área.
- **Como verificar:** `manual` → um item `not_tested` por teste não executado, com `check_id` `A11Y-C14`.
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono ou especialista executa e informa resultado.
- Fonte: F4, F1.

## 4. Falsos positivos e armadilhas

- **Zero violações no axe ≠ acessível.** Cobertura média declarada de 57%; "incomplete" exige revisão humana.
- `color-contrast` do axe não funciona em JSDOM; só medir em navegador real. Texto sobre imagem/gradiente é "incomplete" por natureza.
- `alt=""` em imagem decorativa é **correto**; não reportar como ausência.
- `outline: none` com substituto visível (`box-shadow`/`:focus-visible` contrastante) é aceitável.
- Elementos com função só visual (`aria-hidden="true"` em ícone dentro de botão com texto) são corretos; o problema é `aria-hidden` em elemento **focável**.
- Alvos menores que 24 px são aceitáveis nas exceções (espaçamento, em linha, equivalente, agente do usuário, essencial).
- `placeholder` pode complementar, **não substitui** rótulo programático.
- Conteúdo de teste com `lorem ipsum` → `QA`.
- Componente de biblioteca (Radix, Headless UI, Material) costuma implementar ARIA/teclado corretamente: verificar o uso antes de reportar.
- "Obrigatoriedade legal" depende de contexto jurídico (LBI art. 63 não fixa nível WCAG); o plugin **não** conclui sobre conformidade legal.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `<html lang>` em `app/layout.tsx`; `next/image` exige `alt`; componentes `use client` com `div onClick` são comuns; verificar anúncio de rota em SPA (foco/título ao navegar). |
| Astro | HTML estático por padrão; *islands* podem introduzir controles sem semântica; verificar `lang` no layout. |
| Vite/React (SPA) | Navegação sem recarga: foco e título precisam ser gerenciados; roteador deve anunciar mudança de página (verificação `manual`). |
| HTML estático | Verificar `lang`, `alt`, rótulos e landmarks página a página; fácil de corrigir direto. |
| Outros (WordPress etc.) | Temas/page builders geram `<div>` e ARIA ruim; plugins de "acessibilidade" (overlay) **não substituem** correção no código; `PRÁTICA`: não recomendar overlays. |

## 6. O que nunca afirmar

- "Site acessível", "conforme WCAG 2.2 AA", "atende à LBI/eMAG", "sem barreiras" — nem com axe limpo.
- Percentual de conformidade ou "nota de acessibilidade".
- Que overlays/widgets de acessibilidade resolvem a conformidade.
- Que o axe cobre todos os critérios (a documentação diz **57% em média**).
- Que a LBI exige WCAG AA especificamente (o texto cita "melhores práticas e diretrizes internacionais").
- Que a eMAG se aplica ao setor privado (a página consultada não diz isso).
- Contraste "calculado" sem medição; cores de fundo com imagem sem teste manual.
- Que um leitor de tela específico funcionará sem teste manual.

## 7. Fontes

- F1 — W3C WAI, WCAG 2 Overview / Status (WCAG 2.2: 05/10/2023, atualizado em 12/12/2024; compatibilidade; WCAG 3 rascunho) — https://www.w3.org/WAI/standards-guidelines/wcag/ — acessado em 2026-11-05
- F2 — W3C, Web Content Accessibility Guidelines (WCAG) 2.2 (SC 1.1.1, 1.3.1, 1.3.5, 1.4.1, 1.4.3, 1.4.4, 1.4.10, 1.4.11, 1.4.12, 2.1.1, 2.2.1, 2.2.2, 2.3.1, 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.4.6, 2.4.7, 2.4.11, 2.5.7, 2.5.8, 3.1.1, 3.2.3, 3.2.4, 3.2.6, 3.3.1, 3.3.2, 3.3.3, 3.3.7, 3.3.8, 4.1.2) — https://www.w3.org/TR/WCAG22/ — 2026-11-05 (lidos os primeiros ~200 mil dos ~270 mil caracteres da página)
- F3 — mesma URL de F2 (3.3.x).
- F4 — W3C WAI, Evaluating Web Accessibility Overview — https://www.w3.org/WAI/test-evaluate/ — 2026-11-05
- F5 — Deque, axe-core (cobertura média de 57%, itens "incomplete", limitações) — https://github.com/dequelabs/axe-core — 2026-11-05
- F6 — W3C WAI, ARIA Authoring Practices Guide — Read Me First ("nenhum ARIA é melhor que ARIA ruim"; "um papel é uma promessa") — https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/ — 2026-11-05
- F7 — W3C, Using ARIA (regras de uso; documento marcado como *Discontinued Draft*, o APG é a referência atual) — https://www.w3.org/TR/using-aria/ — 2026-11-05
- F8 — W3C WAI, What's New in WCAG 2.2 (9 novos critérios; 4.1.1 removido) — https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ — 2026-11-05
- F9 — mesma URL de F2 (3.3.2, 3.3.1).
- F10 — mesma URL de F8 (critérios novos 2.5.7, 2.5.8, 3.3.8) e F2 (texto normativo).
- Presidência da República, Lei nº 13.146/2015 (LBI), art. 63 — https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm — 2026-11-05 (leitura dos primeiros ~100 mil de ~123 mil caracteres) — **informativo**
- Governo Federal, eMAG — Modelo de Acessibilidade em Governo Eletrônico (v3.1, abril/2014) — https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/acessibilidade-digital/modelo-de-acessibilidade — 2026-11-05 — **informativo**
- Governo Federal, Acessibilidade Digital (cita ABNT NBR 17225 e NBR 17060, sem detalhar) — https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/acessibilidade-digital — 2026-11-05 — **informativo; normas ABNT não lidas**
- Não consultado nesta revisão: técnicas e falhas do WCAG (ex.: bloqueio de zoom, `outline: none`, bloqueio de colar), páginas "Understanding" de cada critério.
