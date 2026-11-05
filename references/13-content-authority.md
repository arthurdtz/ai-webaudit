# 13 — Conteúdo e Autoridade

Prefixo: `CONT` · Subagente: `ai-visibility` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo Google; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Ponto crítico.** O Google afirma que **E-E-A-T não é um fator de ranking específico** e que a **confiança** é o aspecto mais importante; as perguntas de autoria, fontes e originalidade são **autoavaliação de qualidade**, não regras de pontuação. Por isso, a maior parte das verificações aqui tem teto `MELHORIA`, e só sobe quando há **violação documentada** (política de spam) ou **informação enganosa** com evidência. As Diretrizes para Avaliadores de Qualidade (PDF de 11/09/2025) orientam avaliadores humanos; **não** são lista de regras de ranking — foram consultadas só via resultado de busca (não lidas na íntegra).

## 1. Escopo e fronteiras

- **Desta área:** qualidade editorial **no nível da página/site**: autoria visível, datas, páginas "sobre" e contato como sinal de **quem está por trás**, fontes em conteúdo de orientação, profundidade (conteúdo raso), duplicação de **conteúdo**, conteúdo gerado em escala sem valor, repetição artificial de palavras-chave, atualidade, redação e revisão, divulgação de automação/IA.
- **De outras áreas (só referenciar via `related_ids`):**
  - claim-level: afirmação numérica sem fonte, dados originais, consistência de fatos → `GEO` (GEO-C03…C06)
  - validade técnica de `Article`/`Person`/JSON-LD → `SEO-C15`; canonical/redirect para consolidar duplicatas → `SEO-C06`/`SEO-C12`; atributos `rel` de links → `SEO-C11`
  - NAP, horário, mapa na página de contato → `LOC`; formulário de contato quebrado → `QA`; fricção do formulário/CTA → `CRO`
  - texto placeholder (`lorem ipsum`, `TODO`) → `QA`
  - consentimento e política de privacidade → `PRIV`
  - estrutura de resposta e FAQ → `AEO`
- **Regras de desempate:** "esta afirmação não tem fonte/número verificável" → `GEO`; "esta página não tem autor, data ou profundidade" → `CONT`. "A página de contato tem endereço/horário corretos" → `LOC`; "existe e identifica quem está por trás" → `CONT`.

## 2. Quando acionar

- **Aplicável:** qualquer site com conteúdo editorial: blog, guias, páginas institucionais, páginas de serviço/produto com texto explicativo.
- **Não aplicável / reduzido:** app logado; landing de conversão de uma tela (checar apenas CONT-C03 e CONT-C10); páginas utilitárias.
- **Tema YMYL** (saúde, finanças, segurança, direito, bem-estar social): aplicar CONT-C01, C03 e C04 com mais rigor na recomendação; **severidade continua limitada às regras abaixo**.

## 3. Verificações

### CONT-C01 — Autoria visível e identificável  [OFICIAL (autoavaliação)]
- **O que verificar:** em conteúdo editorial (artigos, guias, análises), é "evidente para os visitantes **quem** escreveu?" — *byline* onde o leitor esperaria; autor com página/bio ou link que o identifique; se há marcação `Article`: `author` como `Person`/`Organization`, **um registro por autor**, `name` **só com o nome** (cargo em `jobTitle`; sem "por…"), `url` ou `sameAs` para página que identifica o autor. Autoria falsa, inventada ou atribuída a pessoa que não escreveu = informação enganosa (→ `IMPORTANTE`).
- **Como verificar:** `estatica`; `manual` para confirmar que o autor existe e escreveu.
- **Evidência esperada:** `file:line` de páginas editoriais sem autor; JSON-LD de autor incoerente com o texto visível.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` em páginas não editoriais (institucional, serviço).
  - Sobe para `IMPORTANTE` (`CONFIRMADO`) quando a autoria exibida é comprovadamente falsa/genérica enganosa (ex.: credencial inventada identificável no código ou contradição entre páginas) — **só com evidência**; caso contrário, `manual`.
- **Correção:** adicionar byline e página de autor com informações reais fornecidas pelo dono. **Validação:** cada artigo identifica o autor e este tem página/identificador; marcação coerente com o texto.
- **Atenção:** o subagente **nunca inventa** nome, credencial ou bio.
- Fonte: F1, F2.

### CONT-C02 — Datas de publicação/atualização visíveis, coerentes e honestas  [OFICIAL]
- **O que verificar:** conteúdo com relevância temporal exibe data **visível e rotulada** ("Publicado em", "Atualizado em"); se há `datePublished`/`dateModified` (Article/BlogPosting), são **ISO 8601 com fuso horário** e **iguais** às datas visíveis; sem **datas futuras** ou datas de eventos descritos na página no lugar da data da página; `dateModified` **não** alterada sem mudança real de conteúdo (atualizar só o ano de copyright não é atualização do conteúdo — na doc de sitemap/lastmod, "mudança significativa"). O Google estima a data (byline date) a partir de vários fatores e **não garante** exibi-la.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` da data visível e da marcação divergentes; datas fixas no código sem relação com conteúdo (ex.: `dateModified` = data de build).
- **Severidade padrão:** `MELHORIA`.
  - Sobe para `IMPORTANTE` (`CONFIRMADO`) quando a marcação **contradiz** a data visível ou usa data futura/artificial em escala (risco de marcação enganosa; cruzar `SEO-C15`).
- **Correção:** gerar ambas as datas da mesma fonte de dados. **Validação:** visível = marcação, com fuso.
- Fonte: F3, F2.

### CONT-C03 — Páginas "sobre" e contato: quem está por trás do site  [PRÁTICA; base oficial parcial]
- **O que verificar:** o site informa **quem é responsável** (pessoa, empresa, razão social/CNPJ quando aplicável, localização ou formas de contato) e como falar com a empresa; links para essas páginas no menu/rodapé. A pergunta oficial "Quem" ("é evidente quem criou o conteúdo?") sustenta isso; as Diretrizes de Avaliadores (consultadas só via busca) tratam a **ausência total** de informação sobre quem opera o site como sinal ruim em páginas onde a confiança importa — sem efeito direto de ranking garantido. O guia SEO Starter do Google **não** cita páginas "sobre"/contato.
- **Como verificar:** `estatica`.
- **Evidência esperada:** ausência de páginas/links (`file`/menu), ou página "sobre" genérica sem identificação.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para site pessoal/portfólio simples.
- **Correção:** criar/ampliar "Sobre" e "Contato" com dados reais do dono. **Validação:** identidade do responsável e meio de contato acessíveis a partir da home.
- Conteúdo local (NAP/horário/mapa) → `LOC-C04`; privacidade/DPO → `PRIV`.
- Fonte: F1, F4.

### CONT-C04 — Fontes e referências em conteúdo de orientação (YMYL ou técnico)  [OFICIAL (autoavaliação)]
- **O que verificar:** em páginas que **orientam decisões** (saúde, finanças, jurídico, segurança, instruções técnicas), o conteúdo mostra **fontes claras**, evidência da expertise e referências a fontes confiáveis; links externos a fontes que o dono **não** endossa levam `nofollow` ou equivalente (Google). Para afirmação numérica específica sem fonte → `GEO-C04` (não duplicar).
- **Como verificar:** `estatica`.
- **Evidência esperada:** páginas de orientação sem **nenhuma** referência (lista de `file`).
- **Severidade padrão:** `MELHORIA`.
- **Correção:** adicionar referências a fontes primárias/oficiais; **nunca inventar fontes**. **Validação:** páginas de orientação citam fontes verificáveis.
- Fonte: F1, F5.

### CONT-C05 — Conteúdo raso nas páginas indexáveis  [OFICIAL parcial (sem limite de palavras)]
- **O que verificar:** páginas indexáveis cujo conteúdo principal é quase só *template*/rótulos/"em breve"/uma frase, sem informação própria; páginas de serviço/produto sem descrição que ajude a decidir. **Não existe número mínimo ou máximo de palavras** (o Google diz que não há "meta mágica de contagem") — **nunca reportar por contagem de palavras**; usar a pergunta "descreve o tema de forma substancial/completa?". Texto placeholder (`lorem ipsum`) é `QA`, não `CONT`.
- **Como verificar:** `estatica` (comparar conteúdo principal vs. boilerplate por página).
- **Evidência esperada:** `file` + trecho mostrando o conteúdo principal; proporção de páginas afetadas.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando **várias** páginas indexáveis (e listadas no sitemap) estão praticamente vazias, diluindo o site.
- **Correção:** completar com conteúdo real do dono, ou marcar `noindex`/remover as páginas sem utilidade (cruzar `SEO-C01`). **Validação:** cada página indexável responde à necessidade de quem a acessa.
- Fonte: F1, F6.

### CONT-C06 — Duplicação de conteúdo entre páginas  [OFICIAL (duplicação não é violação de spam)]
- **O que verificar:** blocos de texto extensos repetidos em várias páginas distintas (ex.: mesma descrição em dezenas de páginas de serviço/produto). O Google afirma que **conteúdo duplicado não viola as políticas de spam**, mas prejudica a experiência e desperdiça rastreamento; o ideal é um conteúdo acessível por uma só URL. **Consolidação técnica** (canonical, redirect) → `SEO-C06`/`SEO-C12`. **Cópia de outros sites** não é verificável pelo plugin → `manual` (`not_tested`); copiar conteúdo alheio é problema de spam (Google).
- **Como verificar:** `estatica` (comparar textos entre arquivos).
- **Evidência esperada:** dois ou mais `file` com o mesmo bloco; percentual aproximado só se calculado em `raw/`.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` apenas quando a duplicação é massiva e indexável (`CONFIRMADO`) e há `related_ids` para o achado de SEO.
- **Correção:** consolidar páginas ou diferenciar o conteúdo com informação real de cada uma. **Validação:** cada página indexável tem conteúdo principal próprio.
- Fonte: F6, F7.

### CONT-C07 — Conteúdo gerado em escala sem valor  [OFICIAL (política de spam)]
- **O que verificar:** muitas páginas geradas por *template*/automação/IA **sem acrescentar valor** ("scaled content abuse": páginas geradas com o propósito principal de manipular ranking, inclusive com IA sem valor para o usuário); páginas que apenas juntam/raspam conteúdo de feeds ou resultados de busca. **Distinção:** usar automação/IA não é violação por si só; **a política mira o uso para manipulação e a produção sem curadoria**. O plugin **não detecta IA**: só padrões observáveis (centenas de páginas com frases-molde, só variáveis trocadas).
- **Como verificar:** `estatica` (rotas dinâmicas, geradores, páginas programáticas, similaridade textual).
- **Evidência esperada:** gerador/rota com `file:line` + amostra de páginas quase idênticas em `raw/`.
- **Severidade padrão:** `IMPORTANTE` quando o padrão é claro e em volume (`CONFIRMADO` pela repetição); `MELHORIA` quando há risco sem volume; nunca `CRITICO` (não há falha de segurança/funcionamento).
- **Correção:** reduzir às páginas com valor próprio; acrescentar informação única por página. **Validação:** cada página gerada traz informação útil que as outras não têm.
- Relacionado: páginas por cidade → `LOC-C06`.
- Fonte: F8.

### CONT-C08 — Repetição artificial de palavras-chave  [OFICIAL (política de spam)]
- **O que verificar:** texto que repete as mesmas palavras/frases de forma antinatural, blocos de listas de cidades/regiões ou de telefones sem valor, **texto oculto** (cor igual ao fundo, fora da tela, tamanho/opacidade 0, links escondidos). **Acordeões, abas e tooltips não são violação** (Google).
- **Como verificar:** `estatica` (CSS e HTML).
- **Evidência esperada:** `file:line` do bloco; CSS que oculta texto.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) para texto oculto ou blocos de palavras-chave claros; `MELHORIA` para repetição leve.
- **Correção:** remover o bloco; reescrever naturalmente. **Validação:** nenhuma página com blocos de palavras-chave ou texto oculto com fim de ranking.
- Fonte: F8.

### CONT-C09 — Atualidade do conteúdo sensível ao tempo  [OFICIAL (revisão periódica) + PRÁTICA]
- **O que verificar:** o Google recomenda revisar o conteúdo publicado e **atualizar ou remover** páginas desatualizadas. Procurar, com evidência **no próprio conteúdo**: eventos/promoções com data **já passada** apresentados como atuais, "© 20XX" antigo, menções a "este ano" com ano passado, preços/prazos datados. **Idade da página isolada não é falha** (conteúdo perene é válido).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` com a data/menção vencida.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando promoção/preço/prazo vencido é apresentado como vigente a clientes (também `QA`/`CRO`: registrar uma vez e referenciar).
- **Correção:** atualizar ou remover; usar data de atualização honesta (CONT-C02). **Validação:** nenhuma data passada tratada como vigente.
- Fonte: F6, F3.

### CONT-C10 — Redação e revisão  [OFICIAL (autoavaliação)]
- **O que verificar:** erros ortográficos e gramaticais evidentes (idioma da página), texto aparentando pressa, quebras sem estrutura; o Google pergunta se o conteúdo é "bem produzido" ou parece apressado, com erros de ortografia/estilo.
- **Como verificar:** `estatica` (leitura do texto visível).
- **Evidência esperada:** lista de `file:line` + trecho + correção sugerida (amostra, não exaustiva se muito longa).
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` quando os erros estão em título, H1, CTA ou páginas principais.
- **Correção:** revisar o texto com o dono. **Validação:** páginas principais sem erros evidentes.
- Placeholder (`lorem ipsum`/`TODO`) → `QA`.
- Fonte: F1.

### CONT-C11 — Divulgação do uso de automação/IA quando o leitor poderia perguntar "como foi criado?"  [OFICIAL (autoavaliação)]
- **O que verificar:** o Google recomenda **divulgação** quando o uso de IA/automação for relevante para o leitor ("onde alguém pode pensar: como isso foi criado?") e explicar por que ajudou. Não é obrigação legal nem exigência de ranking. Só verificar se o dono declarou usar IA para conteúdo editorial.
- **Como verificar:** `manual` (só o dono sabe) + `estatica` (declaração no site).
- **Evidência esperada:** item em `not_tested`.
- **Severidade padrão:** `OPCIONAL`.
- **Correção:** nota de transparência no conteúdo afetado. **Validação:** divulgação visível quando aplicável.
- Fonte: F1.

## 4. Falsos positivos e armadilhas

- **E-E-A-T não é nota nem fator de ranking.** Nunca reportar "E-E-A-T baixo" nem atribuir pontuação.
- Contagem de palavras **não** define qualidade; páginas curtas e úteis são válidas.
- Conteúdo perene sem data recente não está "desatualizado".
- Site pessoal/portfólio pode ter autoria implícita (o nome do site é o autor); `OPCIONAL`.
- Uso de IA/automação **não** é violação por si só (a política mira manipulação em escala sem valor).
- Duplicação técnica (versão com/sem `www`, parâmetros) é `SEO`, não `CONT`.
- Acordeões/abas e texto "oculto" por UI não são *hidden text* (Google); só reportar ocultação com fim de manipulação.
- Páginas de produto com descrição do fabricante repetida: duplicação comum; `MELHORIA` no máximo.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Conteúdo em MDX/CMS: autor e datas costumam vir de frontmatter — verificar se estão sendo renderizados e na marcação. |
| Astro | Collections com `pubDate`/`updatedDate`; verificar uso no layout e no JSON-LD. |
| Vite/React | Conteúdo em componentes/JSON; datas/autor podem existir só no cliente (ver `AIO-C04`). |
| HTML estático | Autor e datas manuais por página: maior risco de inconsistência; "Atualizado em" fixo é comum. |
| Outros (WordPress etc.) | Temas exibem autor/data por padrão; verificar se o plugin de SEO duplica ou contradiz a marcação. |

## 6. O que nunca afirmar

- Que o site "tem E-E-A-T", "boa/má autoridade" ou "nota de qualidade".
- Que autoria, datas ou fontes **melhoram ranking** ou são pré-requisito de indexação.
- Que um texto foi escrito por IA (o plugin não detecta).
- Que a página é "plágio/cópia" sem fonte verificada.
- Número ideal de palavras, de links ou de fontes.
- Credenciais, bios, nomes ou fontes inventados.
- Que o site "cumpre as Diretrizes de Avaliadores" (não são regras de ranking).

## 7. Fontes

- F1 — Google, Creating helpful, reliable, people-first content — https://developers.google.com/search/docs/fundamentals/creating-helpful-content — acessado em 2026-11-05
- F2 — Google, Article structured data (propriedades de autor e datas) — https://developers.google.com/search/docs/appearance/structured-data/article — 2026-11-05
- F3 — Google, Influence your byline dates in Google Search — https://developers.google.com/search/docs/appearance/publication-dates — 2026-11-05
- F4 — Google, Search Quality Rater Guidelines (General Guidelines, 11/09/2025) — https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf — 2026-11-05 — **apenas via resumo de resultado de busca; PDF não lido**; usado só para contexto, nunca como regra
- F5 — mesma fonte de F1 (fontes claras, expertise) e Google, SEO Starter Guide (links confiáveis, `nofollow`) — https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- F6 — Google, SEO Starter Guide (conteúdo, duplicação, atualização) — https://developers.google.com/search/docs/fundamentals/seo-starter-guide — 2026-11-05
- F7 — Google, Consolidate duplicate URLs — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls — 2026-11-05
- F8 — Google, Spam policies for Google web search (scaled content abuse, hidden text, keyword stuffing, doorway) — https://developers.google.com/search/docs/essentials/spam-policies — 2026-11-05
