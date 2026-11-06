# DECISIONS — AI WebAudit

Registro de decisões, divergências SPEC × documentação oficial e limitações. Atualizado a cada etapa.

## Ambiente (acessado em 2026-11-05)

| Item | Valor |
|---|---|
| Usuário | `root` |
| SO | Linux 6.18 (WSL2, Ubuntu) |
| node | v24.20.0 |
| npm | 11.19.0 |
| git | 2.43.0 |
| gh | 2.45.0, autenticado como `arthurdtz` (protocolo ssh; escopos `repo`, `read:org`, `gist`, `admin:public_key`) |
| claude | 2.1.296 |
| `/root/projects` | permissão 755, gravável |

## Documentação oficial consultada (acesso em 2026-11-05)

| # | Tema | URL | Resultado vs SPEC |
|---|---|---|---|
| D1 | Manifesto e layout do plugin | https://code.claude.com/docs/en/plugins-reference | **Confirma.** Só `name` é obrigatório. `.claude-plugin/plugin.json`; `skills/`, `agents/`, `hooks/hooks.json` na raiz do plugin. Pré-requisito: caminhos de componentes no manifesto começam com `./`. |
| D2 | `${CLAUDE_PLUGIN_ROOT}` | idem | **Confirma.** Expandido em comandos de hook, MCP/LSP e **no corpo Markdown de skills, commands e agents**. Não existe no ambiente de comandos Bash do Claude. Em Bash usar o caminho substituído no texto (ou exportar via script). |
| D3 | `claude plugin validate` | idem | **Confirma.** Existe (`claude plugin validate <dir>`, `--strict`). Resultado atual: `Validation passed`. |
| D4 | Namespace de skills | https://code.claude.com/docs/en/skills | **Confirma.** `skills/audit/SKILL.md` → `/ai-webaudit:audit`. `/ai-webaudit:pre-launch` vale (a SPEC usa `pre-launch`; o prompt da Etapa 9 diz `prelaunch` — **seguir a SPEC**). |
| D5 | `allowed-tools` | idem | **Contradiz a premissa implícita.** Só **pré-aprova** ferramentas durante o turno; **não restringe**. Existe `disallowed-tools` (remove ferramentas enquanto a skill está ativa; limpa no próximo prompt). A SPEC §9 já proíbe usar `allowed-tools` como restrição: correto. |
| D6 | Hooks no frontmatter de skill | idem + https://code.claude.com/docs/en/hooks | **Suportado, mas com escopo diferente do esperado.** Registram ao invocar a skill e **permanecem ativos pelo resto da sessão** (não terminam com a skill). `once: true` remove após a primeira execução. |
| D7 | Subagentes — frontmatter | https://code.claude.com/docs/en/sub-agents | **Confirma** `tools` (allowlist) e `model` (`sonnet`/`opus`/`haiku`/`fable`/ID/`inherit`). **Agentes de plugin ignoram `hooks`, `mcpServers` e `permissionMode`.** |
| D8 | Aninhamento de subagentes | idem | **Contradiz a SPEC §3.1.** Subagentes **podem** criar subagentes (até 3 níveis; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; omitir `Agent` de `tools` impede). Conclusão de projeto mantida (orquestrador na sessão principal), mas o motivo muda: controle, contexto e previsibilidade, não impossibilidade. |
| D9 | Hook `PreToolUse` | https://code.claude.com/docs/en/hooks | **Confirma.** Stdin JSON com `tool_name`, `tool_input`, `cwd`, `agent_id`/`agent_type` (quando em subagente). Bloqueio: exit code 2 (stderr = motivo) ou exit 0 com `hookSpecificOutput.permissionDecision: "deny"`. Exit ≠ 0/2 **não bloqueia**; timeout não bloqueia (a menos que `"onFailure": "block"`, v2.1.295+). |
| D10 | Matcher de hooks | idem | `Edit\|Write\|NotebookEdit\|Bash` (nomes exatos separados por `\|`) ou regex. `MultiEdit` não consta como ferramenta atual; manter no matcher é inofensivo. |
| D11 | Modo headless | https://code.claude.com/docs/en/headless | **Confirma + teste empírico (abaixo).** Skills invocadas pelo usuário funcionam em `-p` com `/skill-name`. `--bare` **desativa** hooks (inclusive `hooks/hooks.json` de plugin via flag) — **não usar `--bare` nos testes do guard**. `claude -p` desde 2.1.302 inicia em modo Manual (chamadas que pedem aprovação são negadas) → testes precisam de `--allowedTools` ou `--permission-mode`. |

### Teste empírico (2026-11-05, claude 2.1.296)
Plugin descartável fora do repo, carregado com `--plugin-dir`:
- `claude -p "/tp:ping abc" --plugin-dir …` executou a skill do plugin; `$ARGUMENTS` e `${CLAUDE_PLUGIN_ROOT}` foram expandidos no corpo.
- Hook `PreToolUse` declarado em `hooks/hooks.json` do plugin **disparou** em `claude -p` (sem `--bare`) numa chamada Bash.
- Pendente (Etapa 8): confirmar que hook em **frontmatter de skill de plugin** dispara em `-p`, e que um `exit 2` realmente bloqueia a chamada.

## Checkpoint de arquitetura

### a) Divergências SPEC × documentação e correções propostas

1. **SPEC §3.1 — "subagentes não podem iniciar outros subagentes"** é falso na doc atual (D8). *Correção:* manter o orquestrador na sessão principal, reescrever a justificativa; subagentes de leitura **sem** `Agent` em `tools` (já é o caso: `Read, Grep, Glob`).
2. **SPEC §9 — hook "ativo só durante a skill"** via frontmatter não é verdade (D6): fica ativo até o fim da sessão. *Correção:* o guard sempre verifica `.webaudit/.lock` (e expiração de 2 h) antes de bloquear; sem lock, deixa passar. Assim `/fix` na mesma sessão não é bloqueado.
3. **SPEC §3.1/§9 — `${CLAUDE_PLUGIN_ROOT}`**: funciona no corpo de skills e agents, **não** em comandos Bash (D2). *Correção:* skills escrevem o caminho expandido nos comandos que a sessão principal roda (`node ${CLAUDE_PLUGIN_ROOT}/scripts/…` no texto da skill já vira caminho absoluto).
4. **Prompt Etapa 9 usa `prelaunch`**, SPEC usa `pre-launch`. *Correção:* seguir a SPEC (`skills/pre-launch/`). Ajustar o prompt na hora da Etapa 9.
5. **SPEC §3.3 — `MultiEdit`** no guard: ferramenta não consta mais; manter no matcher por segurança, sem depender dela.
6. **SPEC §9.3 — agentes de plugin não aceitam `hooks`/`permissionMode`** (D7). A proteção dos subagentes depende só de `tools: Read, Grep, Glob`; hooks de proteção ficam em `hooks/hooks.json`/skill.

### b) Agrupamento dos subagentes (SPEC §4.2)
**Confirmado sem alterações:** `search-visibility` (01, 11), `ai-visibility` (02, 03, 04, 13), `conversion` (05, 07), `performance` (08), `accessibility` (09), `privacy` (10), `security` (14, 15), `release-qa` (06, 12).
Justificativa: cada grupo lê as mesmas evidências (HTML/head, conteúdo, scripts, headers/config, código). 8 subagentes cabem folgadamente no limite de 20 concorrentes (D7). Modelo: `model: sonnet` por padrão; `inherit` seria alternativa se quiser controlar custo pelo modelo da sessão — **decidir na Etapa 6**.

### c) Estratégia de proteção do modo leitura (SPEC §9)
**Proposta: lock + hook do plugin (`hooks/hooks.json`) como camada principal, com os mesmos hooks também no frontmatter das skills de leitura como redundância opcional.**
- Hook `PreToolUse` com matcher `Write|Edit|MultiEdit|NotebookEdit|Bash` chamando `node "${CLAUDE_PLUGIN_ROOT}/scripts/guard.mjs"` (exec form com `args`).
- `guard.mjs`: lê stdin; sem `.webaudit/.lock` válido no `cwd`/raiz git → exit 0. Com lock → aplica regras da SPEC §9.3; bloqueia via exit 2 + stderr claro.
- Motivo de não depender só do frontmatter: escopo é "resto da sessão" (D6), e hook de plugin dispara também dentro de subagentes (`agent_id` no payload).
- Fail-open vs fail-closed: exit ≠ 0/2 e timeout **não bloqueiam** (D9). O guard deve capturar exceções e, **quando há lock válido, sair com 2** (fail-closed durante a auditoria); `"onFailure": "block"` só se a versão mínima for aceitável (v2.1.295+, hoje 2.1.296).
- `allowed-tools` **não** é usado como restrição (D5). `disallowed-tools` pode complementar nas skills de leitura (ex.: remover ferramentas de escrita) — avaliar na Etapa 8.

### d) `claude -p` executa skills de plugin?
**Sim** (doc D11 + teste empírico): `claude -p "/ai-webaudit:audit …" --plugin-dir /root/projects/ai-webaudit` com `--allowedTools`/`--permission-mode` adequados, **sem `--bare`**. Os testes das Etapas 8 e 10 podem ser automatizados via `tests/run-fixture.sh`. Ressalvas: (1) modo Manual nega ações que pedem aprovação, então o script de teste precisa pré-aprovar o necessário; (2) a confirmação "uma vez" de build/servidor (SPEC §8.2) precisa de um argumento/flag de aprovação prévia para o modo headless — **propor `--yes-local` ou usar `--static-only` nos testes**.

### e) Riscos e dúvidas
1. **Hook em frontmatter de skill de plugin em `-p`**: não testado ainda (Etapa 8).
2. **Fail-open do hook** (D9): bug no `guard.mjs` = sem proteção. Mitigar com testes em `tests/guard/` e fail-closed com lock.
3. **Nome `pre-launch` vs `prelaunch`** (item a.4): confirmar que fica `pre-launch`.
4. **Dependências do plugin** (Lighthouse, Playwright, axe) em `scripts/node_modules`: `${CLAUDE_PLUGIN_ROOT}` muda a cada atualização do plugin; para `--plugin-dir` local é estável. Para instalação via marketplace, usar `${CLAUDE_PLUGIN_DATA}` — **fora do escopo da v0.1**, registrar no ROADMAP.
5. **Chromium do Playwright** em WSL pode exigir libs de sistema; `doctor.sh` deve detectar (Etapa 7).
6. **Custo/contexto** das Etapas 3–5 (pesquisa extensa): fazer uma referência por vez se necessário.
7. **Nome do plugin**: `ai-webaudit` passou na validação (não colide com nomes reservados).

## Etapa 1 — GitHub
- `gh repo view arthurdtz/ai-webaudit`: **não existe** (verificado em 2026-11-05).

- Repositório criado como privado e, por decisão do usuário (2026-11-05), **tornado público** (contribuição à comunidade). URL: https://github.com/arthurdtz/ai-webaudit (branch `main`).
- Arquivos de prompt das etapas (`01`–`10-*.md`, `LEIA-ME.md`) ficaram **fora do commit** (não rastreados) por não serem parte do plugin; decidir se vão para `docs/prompts/`.

## Checkpoint da Etapa 1 — APROVADO (2026-11-05)
Aprovado sem ajustes. Decisões a.1–a.6, b (agrupamento SPEC §4.2), c (lock + hook do plugin, fail-closed com lock) e d (`claude -p` sem `--bare`) valem para as próximas etapas. Skill = `pre-launch`.

## Etapa 2 — Decisões de contrato (2026-11-05)
- Enums de `evidence.type` (não definidos na SPEC): `codigo`, `configuracao`, `comando`, `http`, `ferramenta`, `captura`, `ausencia`. Evidência exige `type` + ao menos um de `file`, `command`, `raw_ref`.
- Schema: campos de metadados do run ficam no topo do `findings.json`, ao lado de `findings[]`; `additionalProperties: false` em todos os objetos (exceto `stack`).
- Regra CRÍTICO (SPEC §7.1) está no schema (`allOf`) e repetida em `validate-findings.mjs` com mensagem legível.
- Regras semânticas só no validador: id único, prefixo do id e do `check_id` = área, área achada ∈ `areas_selected`, `related_ids` existentes, auditorias só gravam `fix_status: aberto`, área não pode estar em selecionadas e excluídas, **segredos não mascarados** (heurística por padrões comuns; não substitui revisão).
- O validador sai com 0 (válido), 1 (inválido) ou 2 (uso/leitura).
- `ajv` fixado em 8.20.0 e `ajv-formats` em 3.0.1; `scripts/package-lock.json` versionado, `node_modules/` ignorado.
- `PREVENTIVO` **não** tem teto de severidade no schema (a SPEC não define); o teto de MELHORIA vale para "prática sem garantia" e é responsabilidade da referência/subagente.

## Etapa 3 — Referências de busca e IA (2026-11-05)

### Fronteiras resolvidas (cada verificação tem uma área dona)
- **GEO × CONT:** claim-level (afirmação sem fonte/número) = `GEO`; page-level (autor, data, profundidade) = `CONT`.
- **LOC × CONT:** NAP/horário/mapa corretos = `LOC`; "sobre"/contato como identificação de quem opera o site = `CONT`.
- **AEO × AIO:** resposta existe mas mal estruturada = `AEO`; resposta escondida (abas, PDF, imagem) ou fora do HTML = `AIO`.
- **SEO-C15** é dono da validade técnica de JSON-LD; `GEO-C02`, `LOC-C03`, `CONT-C01/C02` só tratam coerência semântica e referenciam `SEO-C15`.
- **AIO-C04 × SEO-C16:** mesma causa raiz (conteúdo só via JS): `SEO-C16` pode ser `IMPORTANTE` (base oficial do Google); `AIO-C04` no máximo `MELHORIA`, com `related_ids`.

### Fatos que mudaram desde o conhecimento prévio (verificados na fonte)
- **FAQ rich result** deixou de aparecer na Pesquisa Google em **07/05/2026**; documentação removida em 15/06/2026 (leitura parcial da página `search/updates`). **HowTo** removido em 09/2023. Outros descontinuados: Sitelinks search box, Practice problem, Special announcement, Course info, Estimated salary, Learning video, Vehicle listing.
- **`Google-Extended`** é só um token de robots (sem user-agent próprio): controla treino/*grounding* de Gemini; **não** afeta Pesquisa nem AI Overviews.
- **OpenAI** agora documenta `OAI-SearchBot`, `GPTBot`, `ChatGPT-User` e `OAI-AdsBot` em `developers.openai.com/api/docs/bots`. **Anthropic:** `ClaudeBot`, `Claude-User`, `Claude-SearchBot` (`anthropic-ai` não consta). **Perplexity:** `PerplexityBot`, `Perplexity-User`.
- `llms.txt` segue como proposta (llmstxt.org, v2 de 10/08/2026); o Google diz que não são necessários arquivos/marcação para IA.
- Google: **não há limite oficial** de tamanho de `<title>`/meta description nem contagem ideal de palavras; **E-E-A-T não é fator de ranking**.

### Lacunas e limites de fonte (honestidade de evidência)
- Páginas de ajuda do **Bing Webmaster** (Webmaster Guidelines, AI Performance, AI Preferences) retornaram só o título; **nenhuma regra foi baseada nelas**. Usadas apenas as postagens do blog Bing/Microsoft Advertising (08/10/2025 e 10/02/2026, 05/2026).
- **Diretrizes de Avaliadores de Qualidade:** só via resumo de busca (PDF não lido); usadas como contexto, não como regra.
- **Política de avaliações do GBP** (`support.google.com/business/answer/9801187`, 404): não consultada; `LOC-C10` não detalha regras de avaliações.
- **Artigo GEO (KDD 2024):** só o abstract foi lido; o "até 40%" aparece como evidência de pesquisa, nunca como promessa.
- `google-special-case-crawlers` não lista `Google-Extended`; a fonte usada é `google-common-crawlers`.
- Páginas muito longas (`search/updates`, `sub-agents`, `hooks`) foram lidas só nos primeiros ~100 mil caracteres.

### Para as Etapas 6 e 10
- `ai-visibility` cobre 4 referências (02, 03, 04, 13 = 33 verificações): é o subagente mais pesado; considerar `model` e instruções de leitura seletiva na Etapa 6.
- Checks `manual` (LOC-C08…C11, GEO-C07, AEO-C06, CONT-C11, AIO-C02) devem sair como `not_tested`, não como achados.

## Etapa 4 — Referências de experiência e produto (2026-11-05)

### Decisões de método
- **Nova tag `[FUNCIONAMENTO]` na referência de QA (06).** `[PRÁTICA]` (teto `MELHORIA`) não serve para defeitos observáveis (link quebrado, build que falha, placeholder). Em QA, a severidade vem do **dano comprovado por evidência**; sugestões sem defeito observável continuam com teto `MELHORIA`. Aplica-se só ao 06; o `reference-template.md` não mudou.
- **CRO (05):** tudo `RISCO_POTENCIAL`/`PREVENTIVO`, teto `MELHORIA` (prática sem garantia). **Única exceção:** formato do link `wa.me` (documentação oficial do WhatsApp), que pode ser `IMPORTANTE` com evidência de código. Sem `CONFIRMADO` e portanto sem `CRITICO` em CRO.
- **PERF (08):** nenhum achado chega a `CRITICO`; teto `IMPORTANTE`. Sem relatório de medição, métricas vão para `not_tested`; INP só existe em campo.
- **A11Y (09):** axe-core cobre ~57% (média declarada); lista de testes manuais obrigatórios em `A11Y-C14`; nunca declarar conformidade. `CRITICO` só para fluxo principal inoperável por tecnologia assistiva, com evidência de código **e** execução.
- **ANL (07):** `CRITICO` só quando o código comprovadamente envia PII clara a analytics/pixel (`ANL-C08`). Consentimento fica em `PRIV` (referenciado).
- **OPS (12):** maioria `manual` → `not_tested`; teto `MELHORIA`.
- Viewports **360/768/1440** são definição do projeto (SPEC), não de norma.

### Fronteiras resolvidas
- **ANL × PRIV:** "a tag está instalada, única, mede o certo?" = `ANL`; "pode disparar e com base em quê?" = `PRIV`.
- **OPS × SEC:** rotina de atualização/renovação = `OPS`; vulnerabilidade concreta = `SEC`.
- **CRO × QA:** "funciona?" = `QA`; "converte bem?" = `CRO`. Link com número placeholder = `QA-C02`; formato `wa.me` = `CRO-C08`.
- **A11Y × SEO:** título da página como SEO = `SEO-C07`; critério 2.4.2 só citado. Headings: busca = `SEO`, leitor de tela = `A11Y-C04`.
- **PERF × ANL/CRO/PRIV:** custo de performance de scripts = `PERF-C12`, com `tradeoffs` obrigatórios.

### Lacunas e limites de fonte
- **Performance:** página do Lighthouse documenta os pesos do **Lighthouse 10**; a versão instalada pelo plugin (Etapa 7) deve ser conferida. AVIF/WebP, bfcache e limiar de TBT **não** foram confirmados em fonte.
- **A11Y:** leitura de ~200 mil dos ~270 mil caracteres do WCAG 2.2; técnicas/falhas e páginas "Understanding" não lidas; normas ABNT NBR 17225/17060 só citadas por página do gov.br.
- **ANL:** nomes de eventos recomendados do GA4, lista de eventos padrão do Meta (inclui `Lead`), Consent Mode e outras plataformas **não** lidos. "gtag.js + GTM duplicam" veio de resumo de busca → tratado como `RISCO_POTENCIAL`. Regra sobre UTM em links internos **sem fonte**.
- **QA:** página MDN de viewport 404; Twitter/X Cards, Chrome DevTools e Lighthouse best-practices não consultados.
- **CRO:** várias fontes NN/g são de 2015–2019; NN/g "CTA buttons" 404 → rótulos de CTA sem fonte; Baymard cobre **checkout**.
- **OPS:** CISA, NCSC e ICANN indisponíveis/não lidos → backups, domínio e monitoramento **sem fonte** (prática). Páginas de ajuda do Bing Webmaster seguem ilegíveis.

### Para as Etapas 6 e 10
- Subagente `conversion` = CRO + ANL (19 verificações); `release-qa` = QA + OPS (27); `performance` = 13; `accessibility` = 14.
- Verificações que exigem `ativa-local`: A11Y (axe + capturas), PERF (Lighthouse), QA-C05/C06/C12, CRO capturas. A fixture deve cobrir esses modos.
- Checks `manual` sempre saem como `not_tested`: OPS-C01…C04, C06…C09, C12, C13; A11Y-C14; QA-C14; ANL-C10; PERF-C02.

## Etapa 5 — Referências de privacidade e segurança (2026-11-05)

### Decisões de método
- **PRIV (10):** cada verificação traz `[LEI art. X]`, `[ANPD]` ou `[PRÁTICA]`. O **Guia da ANPD de cookies** (v1.0, out/2022) é **orientativo/boas práticas**, não norma vinculante; foi lido **na íntegra** (PDF baixado para o scratchpad e extraído localmente com `pypdf` em venv descartável). Pontos centrais: consentimento para cookies **não necessários**; legítimo interesse possível para **necessários** e, **em certos contextos, medição de audiência**; **dificilmente** para publicidade. Logo, **analytics antes do consentimento não é irregular por definição**; pixels de publicidade/perfilamento são o indício forte.
- **A LGPD não cita "banner de cookies"**; o banner é instrumento de transparência segundo o guia. O texto da lei foi lido em `planalto.gov.br` (arts. 5–9, 14, 18, 33, 37, 41, 46, 48).
- **CRITICO em PRIV** só com ação observada **e** ausência total de mecanismo de consentimento com pixels de publicidade/terceiros (PRIV-C01). O relatório nunca diz "viola a LGPD".
- **API (14) e SEC (15):** só detecção segura; **nenhuma sondagem** de rotas, `Origin` forjado, autenticação ou carga contra o site publicado. Remoto = apenas as GET já previstas e seus cabeçalhos. Sem *payloads* nem instruções de exploração.
- **CRITICO em API/SEC** sempre com `file`+`snippet` (e `CONFIRMADO`, ou `RISCO_POTENCIAL` só nos casos permitidos pelo schema: áreas SEC/API/PRIV). Cabeçalho ausente nunca é `CRITICO`.
- **Segredos:** credenciais viram evidência mascarada. Ordem de resposta a vazamento (OWASP): **revogar → rotacionar → remover**; limpar histórico não é correção suficiente. O plugin **nunca** revoga chaves nem reescreve histórico.
- **Segredos com marcador explícito de falso** (`FAKE`, `EXAMPLE`, `CHANGEME`) → `MELHORIA` (padrão de segredo versionado). **Consequência para a Etapa 6:** o `.env` da fixture (`FAKE-SECRET-FOR-TESTS-0000`) deve entrar em `must_find` com severidade mínima **`MELHORIA`**, não `CRITICO`; para testar `CRITICO` seria preciso um valor com forma de credencial real, o que conflita com a regra da SPEC (não disparar *secret scanning* do GitHub). Decidir na Etapa 6.
- **`npm audit` (SEC-C02)** envia a lista de dependências ao registro do npm: exige **confirmação** do usuário e **nunca** `install`/`audit fix` no alvo.

### Fronteiras resolvidas
- **API × SEC (segredos):** repositório/histórico = `SEC-C01`; variável pública/cliente = `API-C11`.
- **API × SEC (autenticação):** autorização por endpoint/BOLA = `API-C08`; login/sessão/senha/CSRF = `SEC`.
- **SEC × OPS (dependências):** vulnerabilidade concreta = `SEC-C02`; rotina = `OPS-C05`.
- **PRIV × ANL:** disparo e base legal = `PRIV`; instalação e PII em eventos = `ANL`.
- **Headers de segurança** são sempre `API`; `Cache-Control` de desempenho = `PERF-C10`.

### Fatos que mudaram desde o conhecimento prévio (verificados na fonte)
- **OWASP Top 10:2025** é a edição atual (A01 Broken Access Control — **SSRF incorporado**; A02 Security Misconfiguration; A03 Software Supply Chain Failures; A04 Cryptographic Failures; A05 Injection; A06 Insecure Design; A07 Authentication Failures; A08 Software or Data Integrity Failures; A09 Security Logging & Alerting Failures; A10 **Mishandling of Exceptional Conditions** — novo). Páginas individuais **não lidas**.
- **OWASP API Security Top 10:2023** (API1 BOLA … API10 Unsafe Consumption of APIs); apenas API1, API2, API4 e API8 foram lidas por página.
- `X-XSS-Protection` está **desencorajado** pelo OWASP; **a documentação da Vercel ainda o usa em exemplo** (`1; mode=block`) — armadilha registrada em `API-C05`. `Expect-CT` e HPKP **removidos**. `X-Frame-Options` **superado** por `frame-ancestors`.
- Headers de hosting: **Netlify e Cloudflare Pages não aplicam `_headers` a respostas de Functions**; Cloudflare: 100 regras/2.000 caracteres por linha.
- Resolução **CD/ANPD nº 15/2024**: três dias úteis para comunicar incidente; Resolução **18/2024**: encarregado.

### Lacunas e limites de fonte
- **Resolução CD/ANPD nº 18/2024 (detalhes da divulgação do encarregado)** e **nº 15/2024 (prazos em dobro, 20 dias úteis, registro de 5 anos)** vieram de **resumo de busca**; as páginas oficiais da ANPD confirmam só o essencial (publicação do ato; três dias úteis; critérios de risco relevante). Texto integral **não lido** → `PRIV-C06` e `PRIV-C11` com aviso.
- **Dispensa do encarregado para agentes de pequeno porte** (Res. CD/ANPD 2/2022) **não verificada**.
- **Artigo 11 e 16 da LGPD** só via citação do guia da ANPD.
- **Não consultados:** OWASP ASVS; Cheat Sheets de comando/NoSQL/DOM XSS; MDN SRI, `Set-Cookie`, `Referrer-Policy`, `Permissions-Policy`; OSV e auditores de outros ecossistemas; WAF/rate limit de Vercel/Cloudflare/Netlify; convenções `REACT_APP_`/`NUXT_PUBLIC_`/`GATSBY_`; SSL/TLS.
- A página do OWASP de XSS **não lista** `v-html`/`{{{ }}}`/`|safe`: tratados "por analogia" com aviso.
- Material auxiliar baixado (PDF da ANPD) ficou no scratchpad da sessão, **fora do repositório**.

### Para as Etapas 6 e 10
- `security` agrega **26 verificações** (14 + 12): subagente mais pesado depois de `ai-visibility` (33); considerar `model` e leitura seletiva por área. `privacy` = 11.
- Checks `manual` → `not_tested`: PRIV-C11, API-C14, SEC-C12 (e parte de PRIV-C04/C06).
- Todas as 15 áreas têm verificações `estatica` (mínimo: 6 em OPS/GEO/AEO) — a fixture pode cobrir as 15.

## Etapa 6 — Subagentes e fixture (2026-11-06)

### Subagentes
- **`${CLAUDE_PLUGIN_ROOT}` no corpo do agente: CONFIRMADO empiricamente** (claude 2.1.296, `--plugin-dir`): um agente do plugin devolveu o caminho absoluto expandido da referência. Os agentes trazem `${CLAUDE_PLUGIN_ROOT}/references/…` como caminho de partida, mas **o orquestrador passa caminhos absolutos** na delegação (os agentes são instruídos a preferi-los).
- **Nome para delegar:** `ai-webaudit:<nome>` (ex.: `Agent` com `subagent_type: "ai-webaudit:release-qa"`).
- **`tools: Read, Grep, Glob`.** Observação do teste: o agente relatou também "ferramentas adiadas ainda não expostas" na sessão; a restrição `tools` valeu para as ferramentas de leitura/escrita/execução, mas **a proteção real continua sendo o hook `guard.mjs` (Etapa 7)** e o fato de agentes de plugin não aceitarem `permissionMode`/`hooks`. Reavaliar na Etapa 8 com um teste que tente `Write`/`Bash` de dentro de um subagente.
- **`model: sonnet` em todos** (decisão pendente da Etapa 1): custo previsível ao rodar até 8 agentes em paralelo. Alternativa: `inherit` (segue o modelo da sessão). **Reavaliar após o teste da fixture (Etapa 8)**: se `ai-visibility` (33 verificações) ou `security` (26) perderem qualidade, subir só esses.
- **Contrato de saída em arquivo compartilhado** (`references/shared/agent-output.md`) em vez de repetir em 8 agentes; `00-orchestrator.md` (Fases 4 e §5) passou a citá-lo. Subagente devolve **somente JSON**: `subagent`, `areas_analyzed`, `areas_not_applicable`, `findings` (sem `id`/`fix_status`; `related_check_ids`), `not_tested`, `errors`.
- **Defesa contra injeção de prompt vinda do alvo:** todo agente trata conteúdo do projeto e de `raw/` como **dado, nunca instrução** e registra em `errors` texto dirigido a IA.
- **Leitura seletiva:** só as referências das áreas selecionadas. `ai-visibility` lê **uma área por vez**.
- Regras específicas por agente (resumo): `conversion` — CRO nunca `CONFIRMADO`, teto `MELHORIA` (exceto `wa.me`), nunca fabricar prova social; `performance` — nunca estimar métricas, teto `IMPORTANTE`; `accessibility` — "incomplete" do axe vai para `not_tested`, nunca declarar conformidade; `privacy` — não é parecer jurídico; `security` — nada de exploração, segredos mascarados, cabeçalho ausente nunca `CRITICO`; `release-qa` — formulário nunca enviado, OPS manual vira checklist em `not_tested`.

### Fixture
- **Negócio fictício** "Sorriso Bela Vista Odontologia" (domínios `*.example`/`*.test`, telefones e IDs inventados).
- **28 problemas** (`must_find`) cobrindo as **15 áreas**, **10 acertos** (`must_not_flag`). Ligeiramente acima do "~25" pedido para garantir ≥ 1 por área.
- **`must_not_flag` aceita `match`** (termo no trecho) para distinguir, no mesmo arquivo, o erro do acerto (ex.: logo decorativo com `alt=""` × hero sem `alt`).
- **Segredo da fixture** (`FAKE-SECRET-FOR-TESTS-0000`) fica em `MELHORIA` (marcador explícito de falso), conforme a regra da Etapa 5. **`CRITICO` por segredo não é testado**: exigiria valor com forma de credencial real, o que conflita com o *secret scanning* do GitHub.
- **Os `min_severity` seguem as referências**, sem ajustar nenhuma referência (SPEC §11). Cenários que a fixture **não** cobre (sem `package.json`, sessão, upload, variáveis públicas, execução Lighthouse/axe) estão listados em `tests/fixtures/README.md` como pendência.
- `tests/check-expected-ids.mjs` valida o gabarito (IDs existentes, prefixo × área, arquivos e `match` presentes); testado com entrada inválida (3 erros detectados, saída ≠ 0).
- O `.env` da fixture é versionado de propósito (exceção no `.gitignore` da raiz).

### Pendências
- `tests/compare.mjs` e `tests/run-fixture.sh` (Etapas 8/10) ainda não existem; a semântica do gabarito está descrita em `expected-findings.json` (`scoring.semantics`).
- A fixture usa uma landing page; **WordPress/Next/Astro/Vite** não são exercitados.
