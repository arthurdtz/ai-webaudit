# 11 — SEO Local e Google Business Profile

Prefixo: `LOC` · Subagente: `search-visibility` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo Google/schema.org/Bing; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`. Itens do Perfil da Empresa no Google (GBP) são **`manual`**: o plugin não acessa a conta do dono; entram em `not_tested`, nunca como achado.

## 1. Escopo e fronteiras

- **Desta área:** NAP (nome, endereço, telefone) no site e coerência entre páginas e marcação; `LocalBusiness` (coerência semântica e completude de propriedades); conteúdo local da página de contato (horários, mapa, como chegar); sinais locais no conteúdo; sites com várias unidades; verificações **manuais** do Perfil da Empresa no Google e do Bing Places.
- **De outras áreas (só referenciar via `related_ids`):**
  - validade técnica do JSON-LD (sintaxe, propriedades obrigatórias, marcação vs. conteúdo visível, tipos descontinuados) → `SEO-C15`
  - existência e qualidade da página "sobre"/contato como sinal editorial e de confiança → `CONT`; **aqui só o conteúdo local da página de contato**
  - consistência de fatos não locais (preços, serviços, produtos) → `GEO-C06`
  - mapa/terceiros carregados antes do consentimento → `PRIV`; `title` do `<iframe>` do mapa → `A11Y`
  - links quebrados da página de contato → `QA`; CTA de WhatsApp e fricção → `CRO`
  - Search Console/monitoramento contínuo → `OPS`
- **Regra de desempate LOC × CONT:** "o endereço/telefone/horário está correto, visível e coerente?" → `LOC`; "a página de contato/sobre existe, identifica quem está por trás e inspira confiança?" → `CONT`.

## 2. Quando acionar

- **Aplicável:** negócio com **local físico que clientes visitam** ou que **atende clientes onde eles estão** (área de serviço); sinais no projeto: endereço, telefone, horários, mapa, `LocalBusiness`, nomes de cidades/bairros, "atendemos em…".
- **Não aplicável:** negócio 100% online sem local nem área de atuação; SaaS/e-commerce sem loja física. Registrar em `areas_excluded`.
- **Regra do Google:** escritório virtual e endereço de correspondência sem operação **não** qualificam para Perfil; o plugin não presume elegibilidade.

## 3. Verificações

### LOC-C01 — NAP visível em texto e rastreável  [PRÁTICA; base oficial parcial]
- **O que verificar:** nome do negócio, endereço completo e telefone em **texto HTML** (rodapé e página de contato), com telefone em `<a href="tel:+55…">`; não só em imagem, mapa embutido ou botão flutuante. Empresas de área de serviço sem endereço público: apresentar a área de atuação.
- **Como verificar:** `estatica`.
- **Evidência esperada:** ausência de NAP em texto (`file`), ou NAP só em imagem (`file:line`).
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando o site de um negócio local **não exibe nenhum** meio de contato/endereço em texto (cruzar `CONT`/`CRO`).
- **Correção:** NAP em texto no rodapé e na página de contato; `tel:` clicável. **Validação:** NAP presente no HTML bruto da home e da página de contato.
- Fonte: F1, F2.

### LOC-C02 — NAP consistente entre páginas e dados estruturados  [OFICIAL (nome real) + PRÁTICA (consistência)]
- **O que verificar:** o mesmo nome, endereço e telefone, **com a mesma grafia/formato**, em todas as páginas, no JSON-LD, nos `<meta>`/Open Graph e nos links `tel:`/mapa. O Google exige que o nome do perfil corresponda ao **nome real usado no site, fachada e materiais** (sem taglines, palavras-chave, horários, telefones ou localização no nome) — nome do site e do perfil devem bater.
- **Como verificar:** `estatica` (cruzar todas as ocorrências por busca).
- **Evidência esperada:** dois `file:line` com valores divergentes; tabela de ocorrências.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando telefone/endereço divergem em páginas ou marcação visíveis ao público (risco de cliente errar o contato).
- **Correção:** centralizar NAP em uma fonte única (constantes/CMS/layout). **Validação:** busca pelo telefone/endereço retorna um único formato.
- Fatos não locais → `GEO-C06`.
- Fonte: F1, F3.

### LOC-C03 — `LocalBusiness`: completude e coerência semântica  [OFICIAL]
- **O que verificar (se a marcação existe ou o negócio é local):** `name` e `address` (`PostalAddress`) presentes — **obrigatórias**; **subtipo mais específico** possível (ex.: `Dentist`, `Restaurant`, `HairSalon`) em vez de `LocalBusiness` genérico; `telephone` com código do país e da região; `url` completo e funcional **do local específico**; `geo` com **≥ 5 casas decimais**; `openingHoursSpecification` coerente com os horários visíveis (`dayOfWeek` por nome, `opens`/`closes`); `priceRange` com menos de 100 caracteres (senão o Google não mostra); `image` relevante e rastreável; valores coerentes com o texto da página. `aggregateRating`/`review` **só** para sites que coletam avaliações **de outros** negócios locais (não autoavaliar o próprio negócio). `additionalType` não é suportado; vários tipos → *array*. A marcação precisa estar na página que descreve o local.
- **Como verificar:** `estatica`; `manual` para o Rich Results Test.
- **Evidência esperada:** `file:line` do bloco e do texto visível divergente.
- **Severidade padrão:** `MELHORIA`.
  - Sobe para `IMPORTANTE` (`CONFIRMADO`) quando a marcação contradiz NAP/horários visíveis ou traz `aggregateRating` do próprio negócio (cruzar `SEO-C15`, risco de ação manual).
  - `OPCIONAL` quando a marcação não existe (ausência não é falha; **valid markup não garante rich result**).
- **Correção:** completar propriedades com dados reais; usar subtipo específico; remover avaliação própria autoatribuída. **Validação:** propriedades obrigatórias presentes e iguais ao texto visível.
- Fonte: F4, F5.

### LOC-C04 — Página de contato com conteúdo local completo  [PRÁTICA]
- **O que verificar:** existe página de contato (ou seção) acessível pelo menu, com endereço completo, telefone, **horário de funcionamento**, formas de contato (e-mail/WhatsApp), mapa ou link "como chegar", referência de acesso/estacionamento quando relevante; horários coerentes com a marcação. Qualidade como página de confiança → `CONT`.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file` da página e itens ausentes.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** completar a página com dados reais fornecidos pelo dono. **Validação:** página cobre NAP, horário e acesso.
- Fonte: F2.

### LOC-C05 — Mapa e link de rota  [PRÁTICA]
- **O que verificar:** mapa embutido (`<iframe>` do Google Maps) **ou** link para o local no mapa; endereço também em texto (o mapa não substitui o NAP em texto); `<iframe>` com `title` e carregamento sem prejudicar a página (→ `A11Y`, `PERF`, `PRIV` para consentimento).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do embed ou ausência.
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` se o endereço existe só dentro do mapa.
- **Correção:** manter texto + link "Abrir no mapa"; embed com `loading="lazy"` e `title` descritivo. **Validação:** endereço em texto e link funcional.
- Fonte: F2.

### LOC-C06 — Sinais locais naturais no conteúdo, sem páginas-satélite  [OFICIAL (spam) + PRÁTICA]
- **O que verificar:** cidade/região de atuação aparecem de forma natural em título, H1, texto e rodapé das páginas principais; área atendida descrita em texto. **Evitar** (políticas de spam do Google): páginas quase idênticas por cidade/bairro que só direcionam o usuário a uma página ("doorway abuse"), listas de cidades/regiões sem valor e **repetição não natural de palavras-chave** ("keyword stuffing", inclui blocos de cidades e listas de telefones). Páginas locais legítimas têm conteúdo próprio e útil (equipe, endereço, serviços reais naquela unidade).
- **Como verificar:** `estatica` (comparar páginas por cidade; lista de cidades em rodapé).
- **Evidência esperada:** `file` de páginas quase idênticas com só a cidade trocada; bloco de cidades com `file:line`.
- **Severidade padrão:** `MELHORIA` para falta de sinal local; `IMPORTANTE` (`CONFIRMADO`) para conjunto de páginas por cidade com conteúdo quase idêntico (risco de política de spam documentada).
- **Correção:** consolidar em página de área de atuação ou criar páginas com conteúdo único e útil. **Validação:** nenhuma página local é cópia com troca de cidade; sem blocos de palavras-chave.
- Conteúdo raso/duplicado em geral → `CONT`.
- Fonte: F3, F6.

### LOC-C07 — Várias unidades: uma página e dados por local  [OFICIAL parcial + PRÁTICA]
- **O que verificar (só se houver mais de um local):** cada unidade tem **página própria** com NAP, horário e mapa próprios, e `LocalBusiness` próprio (`url` do local específico); telefone e site do perfil devem representar o **local individual**, preferindo número local a central de atendimento (regra do Google para perfis).
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file` de lista única de unidades sem páginas; NAP genérico para todas.
- **Severidade padrão:** `MELHORIA`.
- **Correção:** uma página por unidade com dados reais. **Validação:** cada unidade tem URL, NAP e marcação próprios.
- Fonte: F1, F4.

### LOC-C08 — Perfil da Empresa no Google: identidade (nome, endereço, telefone, site)  [OFICIAL; manual]
- **O que verificar (só o dono, no painel):** o perfil existe e está **verificado**; o negócio é elegível (local visitável ou que atende no local do cliente; **escritório virtual não é elegível**); nome **igual ao real** (sem taglines, palavras-chave, símbolos de marca registrada, horário, telefone, URL, descrição de serviços ou "dentro de …"; nada em caixa-alta total); endereço real (**sem caixa postal**); empresa de área de serviço **oculta o endereço** e define a área (referência do Google: até cerca de 2 horas de deslocamento da base); telefone sob controle direto do negócio, preferindo número local; **URL do site** aponta para o site/página do local (não redireciona para rede social).
- **Como verificar:** `manual` → `not_tested` com `check_id` `LOC-C08`.
- **Evidência esperada:** nenhuma (item de checklist para o dono).
- **Severidade padrão:** não aplicável (não vira achado). Divergência entre perfil e site observada pelo dono → registrar via `LOC-C02`.
- **Correção/validação:** o dono confere cada item no painel e informa o resultado.
- Fonte: F1.

### LOC-C09 — Perfil da Empresa no Google: categorias, horários, descrição, fotos  [OFICIAL; manual]
- **O que verificar (só o dono):** **o menor número de categorias** que descreve o negócio, as mais específicas (categoria diz o que o negócio **é**, não o que vende ou oferece); horários regulares **iguais** aos do site e atualizados (incluindo feriados/temporada); descrição relevante, **sem links**, sem foco em promoções/preços; informações completas (endereço, horário, categoria, atributos) — o Google afirma que perfis completos e corretos têm mais chance de aparecer em resultados locais; fotos reais atualizadas.
- **Como verificar:** `manual` → `not_tested` (`LOC-C09`).
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono revisa e informa o resultado.
- Fonte: F1, F7.

### LOC-C10 — Perfil da Empresa no Google: avaliações e destaque local  [OFICIAL; manual]
- **O que verificar (só o dono):** o Google indica **relevância**, **distância** e **destaque (prominence)** como fatores de ranking local; destaque considera avaliações e quantos sites linkam para o negócio; "não há como pedir ou pagar por melhor posição local"; responder às avaliações ajuda o negócio a se destacar. Verificar processo de pedir avaliações a clientes reais e de responder todas. **Nunca** comprar, incentivar de forma enganosa ou fabricar avaliações (política de avaliações do Google **não foi consultada nesta revisão** — não detalhar regras além do citado).
- **Como verificar:** `manual` → `not_tested` (`LOC-C10`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono define rotina de resposta e de solicitação honesta de avaliações.
- Fonte: F7.

### LOC-C11 — Bing Places  [OFICIAL parcial; manual]
- **O que verificar (só o dono):** para negócios locais, a Microsoft recomenda registrar no **Bing Places for Business** para manter endereço, horários e contato atualizados nas experiências de IA/busca do Bing.
- **Como verificar:** `manual` → `not_tested` (`LOC-C11`).
- **Severidade padrão:** não aplicável (`OPCIONAL` se registrado como recomendação).
- **Correção/validação:** o dono confirma o cadastro e a coerência com o site.
- Fonte: F8.

## 4. Falsos positivos e armadilhas

- Empresa de área de serviço que **oculta** o endereço no perfil pode ter razões válidas; não exigir endereço público se o site declara área de atuação.
- Formatos diferentes de telefone entre texto e `tel:` são esperados (`tel:+55…` vs. `(11) 9…`); só reportar números **diferentes**.
- `LocalBusiness` ausente em site local não é falha (marcação não garante rich result).
- `aggregateRating` próprio é problema; `AggregateRating` de terceiros exibido no texto sem marcação não é.
- Mesma cidade repetida em título/H1/texto de forma natural é normal; o problema é a repetição artificial e blocos de cidades.
- Horário sazonal na marcação com `validFrom`/`validThrough` é válido.
- Não classificar o Perfil da Empresa como "ausente" ou "incorreto" sem evidência: é `manual`.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | NAP e JSON-LD em layout/rodapé compartilhado; `metadata` por página; centralizar dados em `lib/`/CMS. |
| Astro | Layout compartilhado para rodapé e JSON-LD; `Astro.site` para `url`. |
| Vite/React | JSON-LD injetado no cliente (conferir HTML bruto); NAP em componente de rodapé. |
| HTML estático | NAP copiado em cada página: maior risco de divergência (LOC-C02). |
| Outros (WordPress etc.) | Plugins de SEO local podem gerar `LocalBusiness` duplicado (tema + plugin): verificar duplicidade. |

## 6. O que nunca afirmar

- Que o Perfil da Empresa está correto, verificado ou otimizado sem confirmação do dono.
- Que `LocalBusiness` melhora posição no mapa ou gera rich result.
- Qualquer posição, volume de busca, número de avaliações ou nota (dados fora do alcance do plugin).
- Que o negócio é elegível para Perfil (elegibilidade é do Google e do dono).
- Que é possível "pagar ou pedir" melhor posição local.
- Regras de avaliações do Google além do que foi consultado.

## 7. Fontes

- F1 — Google, Guidelines for representing your business on Google (Business Profile) — https://support.google.com/business/answer/3038177 — acessado em 2026-11-05
- F2 — Google, Local Business structured data / páginas de contato: sem fonte oficial específica para texto de contato; item tratado como [PRÁTICA].
- F3 — Google, Spam policies for Google web search (doorway abuse, keyword stuffing) — https://developers.google.com/search/docs/essentials/spam-policies — 2026-11-05
- F4 — Google, Local Business (LocalBusiness) structured data — https://developers.google.com/search/docs/appearance/structured-data/local-business — 2026-11-05
- F5 — schema.org, LocalBusiness (versão de desenvolvimento V30.1, 16/09/2026) — https://schema.org/LocalBusiness — 2026-11-05
- F6 — mesma fonte de F3 (sinais locais, páginas por cidade).
- F7 — Google, How Google determines local ranking — https://support.google.com/business/answer/7091 — 2026-11-05
- F8 — Microsoft Bing, Introducing AI Performance in Bing Webmaster Tools Public Preview (10/02/2026; recomendação de Bing Places) — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview — 2026-11-05
- Não consultado com sucesso: https://support.google.com/business/answer/9801187 (404); política de avaliações do Google não verificada.
