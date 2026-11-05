# 02 — GEO (Generative Engine Optimization)

Prefixo: `GEO` · Subagente: `ai-visibility` · Revisado em: 2026-11-05

**Natureza da área.** Nenhum motor generativo garante citação. Google: "nenhuma otimização especial" além do SEO básico para AI Overviews/AI Mode. Microsoft (Bing): "não há método garantido de seleção, apenas práticas que melhoram a elegibilidade". Portanto, **todas as verificações abaixo são [PRÁTICA]** (recomendação, mesmo quando publicada por um provedor, sem garantia) → severidade máxima `MELHORIA`. Exceção: itens que repetem uma regra **[OFICIAL]** de outra área (referenciados, não duplicados).

## 1. Escopo e fronteiras

- **Desta área:** chance de ser **citado** por motores generativos (AI Overviews/AI Mode, ChatGPT search, Perplexity, Claude, Copilot): clareza de **entidades** (quem é a marca, o que oferece), **afirmações citáveis e atribuíveis** (nível da afirmação: número, fonte, data do dado), **dados originais**, **consistência da marca e dos fatos** entre páginas e formatos.
- **De outras áreas (só referenciar via `related_ids`):**
  - elegibilidade técnica (indexação, snippet, `noindex`, canonical) → `SEO`; validade de JSON-LD → `SEO-C15`
  - robots por agente de IA, HTML sem JS, `llms.txt`, conteúdo oculto em abas/PDF/imagem → `AIO`
  - estrutura de resposta direta, perguntas como títulos, listas/tabelas, FAQ como conteúdo → `AEO`
  - **autoria, datas de publicação/atualização, páginas "sobre"/contato, profundidade editorial, conteúdo duplicado, E-E-A-T** → `CONT` (nível da **página**; GEO só olha a **afirmação**)
  - NAP e dados do Perfil da Empresa → `LOC`
- **Regra de desempate GEO × CONT:** se o problema é "esta afirmação não tem fonte/número verificável", é `GEO`; se é "esta página não tem autor, data ou profundidade", é `CONT`.

## 2. Quando acionar

- **Aplicável:** sites com páginas de conteúdo, produto, serviço ou institucional que fazem afirmações factuais sobre a marca, produtos, preços, resultados, dados.
- **Não aplicável:** app atrás de login; página de agradecimento/utilitária; site declaradamente fora de busca generativa (ver `AIO-C02`).

## 3. Verificações

### GEO-C01 — Entidade principal claramente identificada  [PRÁTICA]
- **O que verificar:** o nome da marca/organização e o que ela faz aparecem em texto claro na página inicial e nas páginas-chave (frase de definição: "X é …"); título, H1 e meta description **alinhados** entre si (a Microsoft afirma que o alinhamento "melhora descoberta e confiança"); nome da marca escrito de forma igual em título, H1, rodapé, dados estruturados e redes.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` de título/H1/descrição divergentes; página-chave sem definição da entidade.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para variações pequenas de grafia.
- **Correção:** adicionar frase de definição objetiva no topo da home/sobre; padronizar a grafia. **Validação:** nome e descrição da entidade coerentes nas páginas-chave.
- Fonte: F2, F3.

### GEO-C02 — Coerência entre texto visível e dados de entidade (Organization / WebSite / sameAs)  [PRÁTICA]
- **O que verificar:** se há JSON-LD `Organization` (ou `LocalBusiness` → `LOC`): `name`, `url`, `logo`, `sameAs` (perfis oficiais) coerentes com o texto visível e com o domínio de produção; ausência de dados de outra marca/ambiente (staging, template copiado). **Validade técnica** do JSON-LD → `SEO-C15`; aqui só a **coerência semântica**. O Google lista `Organization` entre os dados estruturados disponíveis, **sem prometer efeito em IA**.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do bloco e do texto divergente.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` quando não existe a marcação (ausência não é falha).
- **Correção:** alinhar valores à fonte única de dados da marca. **Validação:** campos da marcação batem com o rodapé/página "sobre".
- Fonte: F1, F4.

### GEO-C03 — Afirmações específicas, autocontidas e verificáveis  [PRÁTICA]
- **O que verificar:** nas páginas principais, afirmações centrais com **dado concreto** (número com unidade, escopo, período) em vez de adjetivos vazios ("inovador", "de ponta", "líder", "eco") — a Microsoft recomenda evitar "alegações sem âncora" e descritores vagos sem especificidades mensuráveis; uma ideia por frase; frases que fazem sentido isoladas (podem ser extraídas do contexto).
- **Como verificar:** `estatica` (leitura de texto das páginas selecionadas).
- **Evidência esperada:** `file:line` + trecho com a afirmação vaga; contagem de ocorrências por página.
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para ocorrência isolada.
- **Correção:** substituir por fato verificável **que o dono possa comprovar** (não inventar números); se não houver dado, remover o superlativo. **Validação:** afirmações centrais com dado ou escopo explícito.
- **Atenção:** o subagente **nunca sugere números**; só aponta onde falta e pergunta ao dono.
- Fonte: F3, F5.

### GEO-C04 — Afirmações factuais com fonte atribuível  [PRÁTICA]
- **O que verificar:** estatísticas, estudos, normas ou dados de terceiros citados no texto vêm com **fonte nomeada e link** (preferir fonte primária); fatos próprios apontam para a página que os comprova (metodologia, política, tabela). O Google pergunta se a página tem "fontes claras" e se não apenas copia/reescreve; a Microsoft recomenda "exemplos, dados e fontes citadas". Pesquisa acadêmica (Aggarwal et al., KDD 2024) reporta, em benchmark próprio, ganhos de visibilidade "de até 40%" em respostas generativas com estratégias de otimização, variando por domínio — **evidência de pesquisa, não garantia, e não validada neste plugin**.
- **Como verificar:** `estatica`; `ativa-remota` opcional para links externos (apenas GET; links quebrados → `QA`).
- **Evidência esperada:** trechos com afirmação numérica sem fonte (`file:line`).
- **Severidade padrão:** `MELHORIA`.
- **Correção:** adicionar atribuição e link; remover dado que o dono não consegue comprovar. **Validação:** toda afirmação numérica de terceiros tem fonte.
- Fonte: F2, F3, F6.

### GEO-C05 — Dados e conteúdo originais  [OFICIAL (qualidade) + PRÁTICA (efeito em IA)]
- **O que verificar:** existe conteúdo que **só este site pode oferecer** (dados próprios, estudos de caso reais, metodologia, processo, preços, comparativos feitos pelo dono) em vez de reescritas de outras fontes. O Google lista "informação, relatório, pesquisa ou análise originais" entre as perguntas de qualidade; atribuição "não substitui esforço original".
- **Como verificar:** `estatica` + `manual` (só o dono sabe se o dado é original).
- **Evidência esperada:** páginas com conteúdo genérico sem elemento próprio (apontar `file`); lista em `not_tested` para confirmação do dono.
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` quando o site inteiro é genérico/reescrito (evidência: textos idênticos ou muito próximos de fontes citadas no próprio site).
- **Correção:** propor **tipos** de conteúdo original possíveis (sem inventar dados). **Validação:** ao menos uma página-chave com dado/experiência própria verificável.
- Duplicação interna e profundidade da página → `CONT`.
- Fonte: F2.

### GEO-C06 — Consistência de fatos e nomes entre páginas e formatos  [PRÁTICA]
- **O que verificar:** o mesmo fato (preço, plano, serviços, prazo, nome de produto, número de contato) igual em todas as páginas, no texto, em imagens e em dados estruturados; a Microsoft recomenda manter "texto, imagens e vídeo consistentes sobre as mesmas entidades". Fatos conflitantes levam o sistema a abster-se de citar ("pode ser uma saída válida quando o suporte é ausente, antigo ou conflitante" — Bing).
- **Como verificar:** `estatica` (cruzar valores repetidos entre arquivos).
- **Evidência esperada:** dois `file:line` com valores divergentes.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` **somente** se o conflito for um fato comercial crítico visível ao usuário (preço/condição divergente) — nesse caso é também `QA`/`CONT`: registrar uma vez, na área dona do conteúdo, e referenciar.
- **Correção:** centralizar dados repetidos em uma fonte única (constantes/CMS). **Validação:** busca pelo fato retorna valor único.
- NAP local → `LOC`.
- Fonte: F3, F7.

### GEO-C07 — Medição de citações em IA (verificação manual)  [manual]
- **O que verificar:** se existe processo para medir citações/visibilidade: relatório **AI Performance** do Bing Webmaster Tools (citações totais, páginas citadas, *grounding queries* amostrais; **não indica ranking ou importância**) e, no Google, tráfego de recursos de IA no Search Console, relatório de desempenho, tipo "Web". Verificação humana, fora do repositório.
- **Como verificar:** `manual`.
- **Evidência esperada:** item em `not_tested`.
- **Severidade padrão:** `OPCIONAL` (nunca como achado com evidência; registrar em "não testado").
- **Correção:** verificar propriedade do site nas duas ferramentas. **Validação:** acesso aos relatórios confirmado pelo dono.
- Configuração do Search Console e monitoramento contínuo → `OPS`.
- Fonte: F1, F8.

## 4. Falsos positivos e armadilhas

- Texto de marketing com adjetivos **é** problema só se a página não tiver nenhuma afirmação específica; frase isolada de efeito é normal.
- Página de contato/institucional curta pode não ter fonte externa: não exigir citação onde não há afirmação de terceiros.
- Dado de terceiros bem sabido (ex.: nome de lei) sem link: `OPCIONAL`.
- Ausência de `Organization` ou `sameAs` não é falha.
- Não tratar a abstenção do motor generativo como defeito do site.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Textos podem vir de componentes/CMS: conferir o conteúdo renderizado e `metadata`; dados repetidos em constantes facilitam GEO-C06. |
| Astro | Conteúdo em Markdown/MDX: checar frontmatter vs corpo; layouts compartilhados para JSON-LD. |
| Vite/React | Conteúdo no cliente: ver `AIO-C04`; ler os arquivos de componente/JSON de conteúdo. |
| HTML estático | Fatos repetidos manualmente em cada página: risco maior de inconsistência. |
| Outros | CMS: dados em banco não visíveis no repositório → `not_tested` para esses textos. |

## 6. O que nunca afirmar

- Que seguir estas práticas garante citação, tráfego ou "visibilidade em IA".
- Qualquer número de ganho (o "até 40%" do estudo vale no benchmark dos autores, não para este site).
- Que dados estruturados ou `llms.txt` fazem o site ser citado.
- Que a página "será citada pelo ChatGPT/Perplexity/Claude/Copilot/Google".
- Números, fontes ou estudos inventados para "completar" uma afirmação.
- Métricas de citação sem relatório real das ferramentas.

## 7. Fontes

- F1 — Google, AI features and your website — https://developers.google.com/search/docs/appearance/ai-features — acessado em 2026-11-05
- F2 — Google, Creating helpful, reliable, people-first content — https://developers.google.com/search/docs/fundamentals/creating-helpful-content — 2026-11-05
- F3 — Microsoft Bing (Krishna Madhavan), Optimizing Your Content for Inclusion in AI Search Answers, 08/10/2025 — https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers — 2026-11-05
- F4 — Google, Structured data search gallery (Organization listada) — https://developers.google.com/search/docs/appearance/structured-data/search-gallery — 2026-11-05
- F5 — mesma fonte de F3 (seção "O que não fazer": alegações sem âncora, descritores vagos).
- F6 — Aggarwal et al., "GEO: Generative Engine Optimization", KDD 2024 (arXiv:2311.09735; v3 de 28/06/2024) — https://arxiv.org/abs/2311.09735 — 2026-11-05 (apenas resumo/abstract; estratégias e limitações do artigo **não** foram lidas)
- F7 — Microsoft Bing, Evolving role of the index: From ranking pages to supporting answers (05/2026) — https://blogs.bing.com/search/May-2026/Evolving-role-of-the-index-From-ranking-pages-to-supporting-answers — 2026-11-05
- F8 — Microsoft Bing, Introducing AI Performance in Bing Webmaster Tools Public Preview, 10/02/2026 — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview — 2026-11-05
- Não consultado: páginas de ajuda do Bing Webmaster (Webmaster Guidelines, AI Performance, AI Preferences) — retornaram só o título ao serem buscadas; afirmações delas aparecem apenas via resumo de busca e **não** foram usadas como base de regra.
