# 03 — AEO (Answer Engine Optimization)

Prefixo: `AEO` · Subagente: `ai-visibility` · Revisado em: 2026-11-05

**Natureza da área.** O Google afirma que **não é possível** designar uma página como *featured snippet* e não descreve marcação especial para isso; a Microsoft publica recomendações de estrutura "sem garantia". Logo, as verificações de estrutura de resposta são **[PRÁTICA]** (recomendação, às vezes publicada por provedor, sem garantia) → severidade máxima `MELHORIA`. A parte **[OFICIAL]** aqui é o *status* de recursos (FAQ, HowTo, speakable).

## 1. Escopo e fronteiras

- **Desta área:** **estrutura de resposta direta** — perguntas reais como títulos, resposta concisa no início da seção, listas/tabelas de verdade, FAQ **como conteúdo**, frases curtas e autocontidas, adequação à busca por voz.
- **De outras áreas (só referenciar via `related_ids`):**
  - conteúdo oculto em abas/acordeões, informação só em imagem/PDF, HTML sem JS → `AIO-C04/C05/C06`
  - elegibilidade a snippet e controles `nosnippet`/`max-snippet` → `SEO-C09`; `noindex` → `SEO-C01`
  - validade de JSON-LD (inclusive `FAQPage`, `speakable` presentes) → `SEO-C15`
  - afirmações com fonte, dados originais, entidades → `GEO`
  - qualidade editorial, autoria, datas, profundidade → `CONT`
  - estrutura de headings para leitor de tela → `A11Y`; fricção de formulário → `CRO`
- **Regra de desempate AEO × AIO:** se o problema é "a resposta existe mas está mal estruturada/redigida", é `AEO`; se é "a resposta não chega ao HTML ou está escondida/ilegível por máquina", é `AIO`.

## 2. Quando acionar

- **Aplicável:** páginas informativas que respondem perguntas de usuários (blog, FAQ, páginas de serviço/produto com dúvidas comuns, guias).
- **Não aplicável / reduzido:** landing de conversão pura sem conteúdo informativo (usar `CRO`); app logado; página utilitária. Registrar em `areas_excluded` o motivo.
- **Nunca inventar perguntas.** Perguntas devem vir do próprio conteúdo ou de fonte real do dono (suporte, WhatsApp, Search Console); sem fonte → `manual` (AEO-C06).

## 3. Verificações

### AEO-C01 — Títulos de seção formulados como pergunta ou intenção específica  [PRÁTICA]
- **O que verificar:** H2/H3 de páginas informativas descrevem a dúvida ou o tema de forma específica ("Como funciona o processo de X?") em vez de rótulos vagos ("Saiba mais", "Detalhes", "Mais informações"). A Microsoft recomenda substituir títulos vagos por perguntas ou afirmações descritivas.
- **Como verificar:** `estatica` (HTML/MDX/componentes).
- **Evidência esperada:** `file:line` dos headings genéricos e contagem por página.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para ocorrência isolada.
- **Correção:** reescrever o heading com a pergunta/intenção real da seção. **Validação:** headings de seção sem rótulos genéricos.
- Hierarquia de headings para leitor de tela → `A11Y`.
- Fonte: F1.

### AEO-C02 — Resposta direta no início da seção  [PRÁTICA]
- **O que verificar:** logo após o heading que faz uma pergunta, existe resposta de **uma a duas frases** que responde diretamente e faz sentido isolada; detalhes e nuances vêm depois. Evitar abrir com contexto longo antes da resposta.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do heading + primeiro parágrafo que não responde.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** mover a resposta curta para o início; manter o detalhamento abaixo. **Validação:** primeira frase após cada heading-pergunta responde a pergunta.
- **Atenção:** não reescrever com fatos inventados; manter apenas o que o conteúdo já afirma.
- Fonte: F1, F2.

### AEO-C03 — Listas e tabelas reais para passos e comparações  [PRÁTICA]
- **O que verificar:** conteúdo sequencial ou comparativo está em `<ol>`/`<ul>`/`<table>` (com `<th>`), **não** em `<div>` estilizadas, texto corrido longo ou **imagem**; listas usadas onde fazem sentido (passos, itens comparáveis), sem excesso. A Microsoft indica listas/tabelas como "especialmente eficazes para consultas how-to e comparações", mas pede para não usar para cada linha.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do bloco mal estruturado.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** converter para elementos semânticos. **Validação:** passos/comparações em elementos de lista/tabela.
- Tabela como imagem → `AIO-C05`.
- Fonte: F1.

### AEO-C04 — FAQ como conteúdo (sem prometer rich result)  [OFICIAL (status) + PRÁTICA]
- **O que verificar:** (a) se há seção de perguntas frequentes, as perguntas são **reais**, a resposta é curta e visível na página; (b) **não recomendar `FAQPage` para obter rich result**: o rich result de FAQ deixou de aparecer na Pesquisa Google a partir de **07/05/2026** (documentação removida em 15/06/2026); antes disso já era restrito a sites governamentais/de saúde conhecidos (2023). HowTo: rich results removidos em 2023. (c) Se `FAQPage` já existe, **não é erro nem deve ser tratado como dano**; apenas garantir que reflete o conteúdo visível (validade → `SEO-C15`). A Microsoft cita FAQ/Q&A como formato legível por assistentes e suporte a marcação FAQ via schema, sem garantia.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` da seção FAQ ou da marcação.
- **Severidade padrão:** `OPCIONAL` (FAQ ausente em página que tem dúvidas recorrentes: `MELHORIA`).
- **Correção:** manter FAQ como conteúdo útil; não adicionar `FAQPage` com expectativa de destaque na Pesquisa. **Validação:** perguntas visíveis, respondidas, sem promessa de rich result no relatório.
- Fonte: F3, F4, F5.

### AEO-C05 — Frases curtas, autocontidas e sem ruído de formatação  [PRÁTICA]
- **O que verificar:** blocos de texto longos sem divisão; várias afirmações na mesma frase; pontuação excessiva ou símbolos decorativos (setas, estrelas, `!!!`); frases que dependem do parágrafo anterior para fazer sentido. A Microsoft recomenda frases autocontidas, uma ideia por frase, pontuação simples e consistente, e evitar paredes de texto.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do trecho.
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` quando a página principal é um bloco único de texto longo.
- **Correção:** dividir parágrafos e frases; remover símbolos decorativos do texto (não do design). **Validação:** parágrafos curtos, uma ideia por frase.
- Qualidade editorial geral → `CONT`.
- Fonte: F1.

### AEO-C06 — Cobertura das perguntas reais do público  [manual]
- **O que verificar:** se as dúvidas mais frequentes dos clientes (suporte, WhatsApp, e-mail, pesquisas internas, consultas do Search Console) estão respondidas no site. Só o dono tem esses dados.
- **Como verificar:** `manual`.
- **Evidência esperada:** item em `not_tested`.
- **Severidade padrão:** `OPCIONAL` (sem evidência = não é achado).
- **Correção:** o dono levanta a lista; propor **onde** cada resposta caberia. **Validação:** lista de perguntas reais mapeada para páginas.
- Monitoramento contínuo → `OPS`.

### AEO-C07 — Busca por voz e `speakable`  [OFICIAL (status) + PRÁTICA]
- **O que verificar:** respostas curtas e naturais (AEO-C02) servem a assistentes de voz em geral [PRÁTICA]. **`speakable`** está em **beta**, restrito a **notícias**, usuários nos EUA com Google Home em inglês e conteúdo em inglês: **não recomendar** para sites fora desse perfil. Se já existir, validade → `SEO-C15`.
- **Como verificar:** `estatica`.
- **Evidência esperada:** presença de `speakable` com `file:line`, ou ausência (não reportar ausência).
- **Severidade padrão:** `OPCIONAL` (máximo).
- **Correção:** nenhuma recomendação de adicionar `speakable` fora do perfil. **Validação:** n/a.
- Fonte: F6.

## 4. Falsos positivos e armadilhas

- Landing de conversão curta e direta não precisa de formato Q&A.
- FAQ criada só para "ganhar espaço" na busca (perguntas inventadas, respostas promocionais): problema de qualidade (`CONT`), não de estrutura.
- Títulos criativos de marca podem ser intencionais; só apontar quando a seção é informativa e o título não revela o tema.
- Não existe tamanho "ideal" de resposta oficial: "1–2 frases" é orientação da Microsoft, sem garantia, não limite.
- Listas em excesso prejudicam: não pedir lista para tudo.
- Marcação `FAQPage` existente não deve ser removida só por causa da descontinuação do rich result.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Conteúdo em componentes/MDX; checar o texto renderizado; evitar acordeões que só carregam ao clicar (→ `AIO`). |
| Astro | MDX/Markdown facilita headings/listas semânticas; verificar componentes de acordeão. |
| Vite/React | Conteúdo em JSX; ver `AIO-C04`. |
| HTML estático | Estrutura direta no HTML; atenção a `<div>` estilizadas no lugar de listas/tabelas. |
| Outros | Page builders geram muitas `<div>`: checar o HTML final, não o editor. |

## 6. O que nunca afirmar

- Que a página "vai aparecer como featured snippet" ou "resposta em destaque" (o Google diz que o dono não pode designar).
- Que `FAQPage` ou `HowTo` geram rich result hoje.
- Que seguir a estrutura sugerida garante citação por qualquer assistente.
- Que existe tamanho/formato oficial ideal para a resposta.
- Perguntas ou respostas inventadas; números ou fatos novos no texto sugerido.
- Que `speakable` serve a qualquer site.

## 7. Fontes

- F1 — Microsoft Bing (Krishna Madhavan), Optimizing Your Content for Inclusion in AI Search Answers, 08/10/2025 — https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers — acessado em 2026-11-05
- F2 — Google, Featured snippets and your website — https://developers.google.com/search/docs/appearance/featured-snippets — 2026-11-05
- F3 — Google, Search documentation updates (FAQ: aviso em 08/05/2026, fim em 07/05/2026, documentação removida em 15/06/2026) — https://developers.google.com/search/updates — 2026-11-05 (leitura parcial da página)
- F4 — Google Search Central Blog, Changes to HowTo and FAQ rich results (14/09/2023) — https://developers.google.com/search/blog/2023/08/howto-faq-changes — 2026-11-05
- F5 — Microsoft Bing, mesma fonte de F1 (menção a Q&A e marcação FAQ).
- F6 — Google, Speakable structured data (beta) — https://developers.google.com/search/docs/appearance/structured-data/speakable — 2026-11-05
