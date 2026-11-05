# 00 — Regras do orquestrador

Lido por **todas** as skills (`audit`, `pre-launch`, `optimize`, `fix`) na sessão principal. O orquestrador **não é um subagente**: é o fluxo que a sessão principal executa. Só a sessão principal delega a subagentes e roda comandos; subagentes são somente leitura (`tools: Read, Grep, Glob`, sem `Agent`).

Caminhos do plugin: usar `${CLAUDE_PLUGIN_ROOT}` no texto das skills (é expandido ao carregar). Alvo = projeto aberto, **nunca** o diretório do plugin.

## 1. Fases

| Fase | Entrada | Ações | Saída |
|---|---|---|---|
| **0 Preparação** | diretório atual, argumentos | Alvo = raiz git do diretório atual (ou o próprio diretório sem git). **Se alvo = diretório do plugin, parar e explicar.** Registrar commit, branch, dirty. Criar `.webaudit/runs/<AAAA-MM-DD_HHMM>/{raw/,agents/}` no alvo. Adicionar `.webaudit/` a `.git/info/exclude` (não tocar `.gitignore`). Criar `.webaudit/.lock` (skills de leitura). | run dir, lock, metadados git |
| **1 Reconhecimento** | alvo | Detectar stack, framework, scripts build/dev/preview, rotas/páginas, hosting, APIs, formulários, analytics, idioma, tipo de site. Preferir `scripts/detect-stack.mjs`; sem ele, leitura direta. | `context.json` |
| **2 Seleção** | `context.json`, skill, `--areas` | Aplicar a matriz (§2). `audit` = todas as aplicáveis; `pre-launch` = foco definido na skill; `optimize` = derivadas do objetivo; `--areas` sobrescreve. Registrar excluídas + motivo. | `areas_selected`, `areas_excluded` |
| **3 Coleta** | áreas selecionadas | Estática sempre. Ativa-local se aprovada (mostrar comandos, **uma** confirmação; só `localhost`; encerrar servidor ao final). Ativa-remota só com `--url` (GET, ≤20 páginas, 1 req/s, UA `AI-WebAudit/<versão>`, nada invasivo). Cada saída em `raw/` com ferramenta, versão, comando e horário. **Falha de ferramenta = registrar erro, nunca estimar dado.** | `raw/*`, lista `tools` |
| **4 Análise** | `context.json`, `raw/`, referências | Delegar **em paralelo** só aos subagentes necessários (§3). Cada um recebe: caminho do `context.json`, caminho de `raw/`, lista exata de referências a ler, caminho do schema e da `severity.md`, caminho de saída. Devolve JSON de achados conforme o schema. | `agents/<subagente>.json` |
| **5 Consolidação** | JSONs dos subagentes | Validar com `scripts/validate-findings.mjs`; deduplicar, resolver conflitos (§4), atribuir IDs finais, ordenar. Subagente com JSON inválido: reenviar uma vez com os erros; persistindo, mover o que for aproveitável para `not_tested` e registrar a falha. | `findings.json` |
| **6 Relatório** | `findings.json` | Gerar `report.md` pelo `report-template.md`. Atualizar `.webaudit/latest` (arquivo com o run ID). **Remover o lock.** | `report.md`, `latest` |
| **7 Resposta** | relatório | Resumo executivo curto, críticos, caminho do relatório, próximo comando sugerido (ex.: `/ai-webaudit:fix WA-SEC-001 WA-PRIV-002`). | mensagem no chat |

Falha em qualquer fase após criar o lock: remover o lock antes de encerrar (o guard também ignora lock com mais de 2 h).

`fix` não usa lock nem as fases 1–5: lê o run em `.webaudit/latest` (ou `--run <id>`) e segue o fluxo da SPEC §10.

## 2. Matriz de seleção (sinal detectado → áreas)

Áreas por prefixo: `SEO GEO AEO AIO CRO QA ANL PERF A11Y PRIV LOC OPS CONT API SEC`.

| Sinal no projeto | Aciona | Exclui / rebaixa |
|---|---|---|
| Qualquer página HTML pública (estática, SSR ou SSG) | `SEO QA PERF A11Y` | — |
| Conteúdo textual público (páginas, blog, FAQ) | `GEO AEO AIO CONT` | `AEO` e `CONT` sem texto editorial relevante (ex.: só app logado) |
| Página com CTA, formulário de contato/orçamento, WhatsApp, landing page | `CRO` | `CRO` em site sem objetivo de conversão (ex.: documentação) |
| Script/tag GA4, GTM, Meta Pixel, `gtag`, `dataLayer`, outro tracking | `ANL PRIV` | `ANL` se nenhum tracking e nenhuma intenção declarada (registrar como excluída; checar apenas ausência quando `pre-launch`) |
| Cookies, formulários com dados pessoais, terceiros (embeds, fontes, mapas, chat) | `PRIV` | — |
| Endereço, telefone, mapa, `LocalBusiness`, página de contato com NAP, negócio local | `LOC` | `LOC` sem sinal de negócio com localização física/área de atuação |
| Rotas de API/serverless (`api/`, `pages/api`, `app/**/route.*`, functions), `vercel.json`, `netlify.toml`, `_headers`, `wrangler.*` | `API` | `API` sem backend nem config de hosting (sobra só headers declarados em arquivo → ainda `API` para headers) |
| Código de aplicação (JS/TS/PHP/Python…), `package.json` com dependências, `.env*`, autenticação, uploads | `SEC` | `SEC` em HTML estático puro sem JS próprio, dependências ou segredos → só varredura de segredos |
| Qualquer projeto em preparação para publicação | `OPS` | — |
| Skill `pre-launch` | `QA SEO PRIV A11Y PERF OPS` + `API SEC` quando houver backend + `ANL` quando houver tracking | demais só com `--areas` |
| Skill `optimize` | derivadas do objetivo (ex.: "mais leads" → `CRO ANL PERF`; "aparecer em IA" → `GEO AEO AIO CONT SEO`) | demais |
| `--areas` informado | exatamente as listadas | todas as outras: motivo "excluída por `--areas`" |
| Alvo sem HTML público e sem código web (ex.: repositório de documentação) | **parar** e perguntar ao usuário | — |

Regras:
- Dúvida sobre aplicabilidade → incluir, deixando o subagente aplicar a seção "Quando acionar" da referência.
- Toda área excluída vai para `areas_excluded` com motivo objetivo.
- A sessão principal decide a seleção a partir do `context.json`; **não** lê as referências dos especialistas.

## 3. Área → subagente (checkpoint aprovado, SPEC §4.2)

| Subagente | Áreas (referências) |
|---|---|
| `search-visibility` | `SEO` (01), `LOC` (11) |
| `ai-visibility` | `GEO` (02), `AEO` (03), `AIO` (04), `CONT` (13) |
| `conversion` | `CRO` (05), `ANL` (07) |
| `performance` | `PERF` (08) |
| `accessibility` | `A11Y` (09) |
| `privacy` | `PRIV` (10) |
| `security` | `API` (14), `SEC` (15) |
| `release-qa` | `QA` (06), `OPS` (12) |

- Acionar o subagente se **ao menos uma** de suas áreas foi selecionada; passar **só** as referências das áreas selecionadas.
- Subagentes rodam em paralelo (limite padrão de 20 concorrentes; aqui no máximo 8).
- Subagente nunca recebe permissão de escrita nem `Bash`. Se precisar de um dado novo, devolve o item em `not_tested` com o motivo.

## 4. Deduplicação, conflitos e trade-offs

Deduplicação (Fase 5):
1. Mesmo `file` + mesmo `check_id` → um achado.
2. Mesma causa raiz em áreas diferentes (ex.: layout com `noindex` apontado por `SEO` e por `QA`) → manter o achado da **área dona** do check (SPEC §4.1); o outro vira `related_ids` do principal e é removido da lista.
3. Ao fundir, manter a maior severidade **somente se** a evidência a sustenta; reunir evidências.
4. Fronteiras: headers de segurança → `API`; `noindex` esquecido → `SEO`; consentimento → `PRIV`; robots para bots de IA → `AIO`; formulário quebrado → `QA`; fricção do formulário → `CRO`.

Conflitos (ex.: widget de chat ajuda `CRO`, prejudica `PERF`; script de analytics ajuda `ANL`, exige consentimento em `PRIV`):
- Nunca resolver em silêncio. Preencher `tradeoffs` em **ambos** os achados, cruzar com `related_ids` e listar na seção "Trade-offs entre áreas" do relatório.
- A decisão é do usuário; o relatório descreve ganho e custo de cada lado sem recomendar sem base.

Ordenação: severidade (CRÍTICO → OPCIONAL), depois `effort` (P → G), depois área. IDs finais `WA-<PREFIXO>-<NNN>` sequenciais por prefixo a partir de `001`; `related_ids` reescritos para os IDs finais.

## 5. Economia de contexto

| Lê | Não lê |
|---|---|
| Sessão principal: `00-orchestrator.md`, `shared/findings.schema.json` (só ao validar), `shared/report-template.md`, `context.json`, **sumários** dos subagentes, `findings.json` | Referências de especialistas `01`–`15` |
| Subagentes: suas referências selecionadas, `shared/severity.md`, `shared/findings.schema.json`, `context.json`, arquivos do alvo e `raw/` que precisarem | Referências de outras áreas; histórico da conversa |

- Saídas longas de ferramentas ficam em `raw/` e são referenciadas por `raw_ref`; nunca coladas no chat ou em `description`.
- Subagente devolve **apenas JSON** de achados (mais `not_tested`); nada de prosa longa.
- Instruir cada subagente a abrir só os arquivos necessários e a citar `file:line`.

## 6. Mascaramento de segredos

- Valor de segredo encontrado (chave de API, token, senha, string de conexão) é mascarado em **todo** artefato: no máximo os 4 primeiros caracteres + `****` (ex.: `AKIA****`).
- Vale para `snippet`, `output_excerpt`, `description`, `report.md`, `fix-log.md`, mensagens no chat e arquivos em `raw/`.
- `raw/` não deve conter o valor completo: ao coletar, mascarar na saída antes de gravar.
- O validador rejeita padrões comuns de segredo não mascarados em `findings.json`.
- Nunca enviar segredo, dados pessoais ou conteúdo privado do projeto a serviço externo.

## 7. O que nunca afirmar

- Certificação ou conformidade: "seguro", "conforme a LGPD/WCAG", "aprovado", "acessível", "site pronto".
- Ausência total de problemas: usar "Bloqueadores conhecidos: NÃO IDENTIFICADOS" e listar o que **não** foi testado.
- Métricas não medidas neste run (LCP, INP, CLS, nota Lighthouse, número de violações): só citar o que está em `raw/`. Laboratório ≠ campo; dado de laboratório não é dado de usuários reais.
- Números de ganho esperado (tráfego, conversão, posição, tempo) sem fonte medida.
- Garantia de rich result, indexação, citação por IA ou ranking.
- Resultado de ferramenta que falhou ou foi pulada.
- Que um item `manual-pendente` esteja correto.

## 8. Proibições permanentes (inclusive no `/fix`)

Deploy, push, commit sem autorização explícita, alterar banco de dados, expor segredos, enviar dados privados a serviços externos sem necessidade, instalar dependências no projeto alvo, qualquer requisição remota que não seja GET, envio de formulários, scanners, fuzzing, força bruta e payloads de ataque.
