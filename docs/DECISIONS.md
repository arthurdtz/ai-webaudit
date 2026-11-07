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

## Etapa 7 — Coleta, doctor e proteção (2026-11-07)

### Proteção do modo leitura (SPEC §9; checkpoint c)
- **Implementada a estratégia aprovada: hook do plugin + lock.** `hooks/hooks.json` (`PreToolUse`, matcher `Write|Edit|MultiEdit|NotebookEdit|Bash`) chama `scripts/guard.mjs`. **O hook roda em toda sessão em que o plugin está carregado**, por isso o guard é barato e **não faz nada sem lock válido** (exit 0).
- **Lock** (`<alvo>/.webaudit/.lock`, JSON com `created_at`): válido por **2 h**, ilegível-recente = inválido. Criado/removido por `scripts/lock.mjs acquire|release|status` (Fase 0/6). `acquire` também grava `.webaudit/` em `.git/info/exclude` (sem tocar `.gitignore`) e **recusa** o diretório do plugin como alvo (exit 3).
- **Falha fechada com lock ativo:** erro interno, entrada ilegível ou lock corrompido → **exit 2** (bloqueia). Sem lock ou lock expirado → permite tudo. Bloqueio = exit 2 + motivo em stderr (a doc: outros códigos não bloqueiam).
- **`onFailure: "block"` NÃO é usado:** como o hook roda em todas as sessões com o plugin, um `node` ausente ou timeout bloquearia `Write`/`Bash` fora de qualquer auditoria. Limitação aceita e documentada: timeout/`node` ausente **não** bloqueia (fail-open nesses casos).
- **Regras com lock:** `Write/Edit/MultiEdit/NotebookEdit` só dentro de `.webaudit/` (caminhos relativos, `..`, links simbólicos e `.webaudit` simbólico para fora são tratados; **o próprio `.lock` não pode ser sobrescrito**). **Bash** é analisado por um *parser* de shell aproximado (aspas, `;`/`&&`/`||`/`|`, `$(…)`/crases, `bash -c`, `eval`, heredoc, redirecionamentos, `cd` rastreado, `xargs`, `env`/`timeout`/`nohup`…):
  - **git**: lista de PERMISSÃO só de leitura (`log`, `show`, `status`, `diff`, `rev-parse`, `ls-files`, `grep`, `blame`…; `branch`/`tag`/`config`/`remote` só em modo consulta); todo o resto bloqueado (`commit`, `push`, `reset`, `clean`, `checkout`, `stash`, `add`…).
  - **escrita/remoção** (`rm`, `mv`, `cp`, `mkdir`, `touch`, `tee`, `truncate`, `chmod`…) e **redirecionamentos**: só com destino dentro de `.webaudit/` (`cp`/`install`/`ln`: só o destino; fontes podem ser lidas); `sed -i`, `perl -i`, `awk -i inplace`, `dd of=`, `find -delete/-exec`, `tar`/`unzip`: bloqueados.
  - **pacotes**: `npm|pnpm|yarn|bun` `install|add|ci|update|remove|link|exec|publish…` e `audit fix`, `npx|pnpx|bunx`, `pip|gem|composer|cargo|go install`, gerenciadores de sistema: bloqueados. **Permitidos:** `npm run`, `npm test`, `npm start`, `npm ls`, `npm audit` (sem `fix`).
  - **deploy/infra/rede**: `vercel`, `netlify`, `firebase`, `wrangler`, `aws`, `gcloud`, `az`, `kubectl`, `docker`, `scp`, `rsync`, `ssh`, `nc`…; `curl` com método ≠ GET/HEAD ou com dados; `wget` sem `-O`; `gh` fora de consulta.
  - **código inline e scripts**: `node -e`, `python -c`, `bash -` etc. bloqueados; **`node`/`bash`/`python` só executam arquivos DENTRO do plugin** (`scripts/…`); scripts do projeto auditado só via `npm run` (com a confirmação da SPEC §8.2).
  - Comando dinâmico (`$CMD`, destino com `$VAR`) → bloqueia. **Comandos desconhecidos são permitidos** (camada de proteção, **não sandbox**).
- **Consequência para a Fase 3:** `npm run build`/`dev` do alvo é permitido (SPEC §8.2) e **grava a saída de build no alvo, fora de `.webaudit/`** (ex.: `dist/`). Registrar isso na confirmação ao usuário (Etapa 8).
- O hook dispara também dentro de subagentes (`agent_id` no payload); as mesmas regras valem.
- **Não verificado em sessão real do Claude Code:** `claude -p` falhou com *OAuth session expired* ao tentar o teste ponta a ponta (Write fora de `.webaudit/` sendo recusado de verdade). Verificado: o script com a entrada JSON do hook (14 testes), `claude plugin validate` e, na Etapa 1, que hook de `hooks/hooks.json` dispara em `-p`. **Pendência da Etapa 8:** teste real com lock ativo, inclusive tentando `Write`/`Bash` de dentro de um subagente.

### Dependências e ambiente
- Fixadas: `lighthouse` **13.6.0**, `playwright` **1.65.0**, `@axe-core/playwright` **4.14.0** (`ajv` 8.20.0, `ajv-formats` 3.0.1). **Lighthouse 13 exige Node ≥ 22.19** → `engines` em `scripts/package.json` e verificação no `doctor.sh`.
- **A página oficial de pontuação do Lighthouse documentava os pesos do Lighthouse 10** (referência 08). A versão instalada é a **13.6.0**; os pesos dela **não foram verificados**. Os JSON de `raw/` registram `lighthouse_version`; o subagente `performance` deve citar a nota como laboratório e não presumir pesos.
- `playwright install chromium` em headless usa o **`chrome-headless-shell`**: o `doctor.sh` faz **teste funcional** (iniciar o navegador), não só checa o executável (a primeira instalação foi interrompida e deixou só o Chromium completo; o teste funcional pegou isso).
- O download do Chromium é lento nesta rede (~125 MB do *headless shell*); `npm install` falhou uma vez por erro de rede e passou com `--fetch-retries`.
- WSL: o `doctor.sh` **não** roda `install-deps` sozinho; mostra o comando.

### Coletores
- **Todos** validam que o `<run>` está dentro de `<alvo>/.webaudit/` **antes** de criar qualquer diretório (bug corrigido nos testes: a primeira versão criava `/tmp/fora`). Saída: `{tool, version, command, started_at, finished_at, status, error?, data}`; falha = erro registrado, **nunca** dado estimado. Evidências de segredo e cookies **mascaradas**.
- **`collect-static`:** inventário, metadados por página (HTML no disco), robots/sitemap/`llms.txt`/`security.txt`, headers **declarados** (Vercel, Netlify, `_headers`, `.htaccess`, nginx, `next.config`), segredos (árvore + histórico git dos últimos 200 *commits*, só leitura, só valor mascarado), variáveis com prefixo público. Não replica buscas que os subagentes fazem com `Grep`.
- **`collect-local`:** só `localhost`/`127.0.0.1`/`::1`; crawl por GET (máx. 20 páginas), 3 viewports, axe (360 e 1440), console, requisições/cookies **antes de qualquer interação**, alvos < 24 px, comparação HTML bruto × renderizado, Lighthouse mobile e desktop em até 3 páginas (resumo enxuto rotulado como dado de laboratório).
- **`collect-remote`:** **só GET**, ≤ 20 páginas, **1 req/s** (medido: 5 requisições em 4,8 s), UA `AI-WebAudit/0.1.0`, redirecionamento **só dentro do mesmo site** (mesmo host, `www.` ou esquema), **recusa** `localhost` e redes privadas (inclusive por resolução DNS). **`robots.txt` não é imposto** (o dono optou com `--url`; páginas restritas são só marcadas `restricted_by_robots`). Inclui sonda de 404 (uma GET), `http`→`https` e **handshake TLS** (validade do certificado, para `OPS-C06`; não é requisição HTTP). **O Lighthouse remoto carrega os subrecursos da página e não obedece ao limite de 1 req/s** (documentado).
- **`serve-static.mjs`** (extra, não listado na SPEC §3.3): servidor **só em 127.0.0.1** para sites sem build; **nunca serve arquivos ocultos** (`.env`, `.git`, `.webaudit`), exceto `.well-known`; corrigido nos testes (a primeira versão servia `.env`).

### Teste rápido (cópia da fixture em `/tmp/webaudit-test-*`)
- `detect-stack`: HTML estático, `pt-BR`, **negócio local**, Vercel, API presente, 2 formulários, GA4 + Pixel, `.env`. `collect-static`: 6 saídas `ok` (segredo do `.env` como `marker_fake` rastreado e **não ignorado**; `X-XSS-Protection` e `nosniff` declarados; robots bloqueia os três agentes de busca de IA; sitemap lista URL `noindex`; `security.txt` vencido; canonical de staging e `lorem ipsum` detectados).
- `collect-local` (63 s): 5 páginas, 1 link quebrado (`sobre.html`), 15 capturas, 10 relatórios axe (`image-alt`, `meta-viewport`, `html-has-lang`), Lighthouse 13.6.0 mobile/desktop sem erro, overflow horizontal em 360 px, requisições a `connect.facebook.net` antes de interação.
- `collect-remote` contra `https://example.com/` (5 GETs): ok. Recusou `localhost` e `10.0.0.5`.

### Pendências
- Teste real do hook em sessão do Claude Code (acima). `tests/compare.mjs` e `tests/run-fixture.sh` ainda não existem (Etapas 8/10).
- `collect-local` não sobe o servidor do alvo nem roda o build: isso é do orquestrador (com confirmação única). `npm run dev` não pronto → usar `serve-static.mjs` para estáticos.
- Não coletados nesta etapa: INP (só campo), CrUX (manual), `npm audit` e histórico git completo além de 200 commits (a skill roda `npm audit` com confirmação).

## Etapa 8 — Skill `audit` e primeiro teste (2026-11-07)

### Resultado do teste real: NÃO EXECUTADO
- **`claude -p` falhou com `Failed to authenticate: OAuth session expired and could not be refreshed`** (testado antes e depois de escrever a skill). Sem autenticação não há execução headless de `/ai-webaudit:audit` nem do teste de hook em sessão real. Conforme o prompt da etapa, **não há números de recall/`must_not_flag` reais**; o teste fica **aguardando o usuário**: `tests/run-fixture.sh` (ou `--prepare-only`), depois colar o resultado.
- O checkpoint (Etapa 1) e o teste da Etapa 1 confirmam que `claude -p` executa skills de plugin via `--plugin-dir` (sem `--bare`).
- **Ainda não verificados em sessão real** (todos dependem da auditoria rodar): recusa da skill quando o diretório atual é o plugin (só o `lock.mjs acquire` foi testado: exit 3); `git status` limpo no alvo após a auditoria; o hook bloqueando `Write`/`Bash` de verdade (inclusive de dentro de um subagente); a fidelidade dos subagentes ao contrato JSON; `model: sonnet` × qualidade.

### O que foi testado SEM modelo (22 testes passando: 14 do guard + 8 do pipeline)
- `consolidate.mjs`: IDs `WA-<PREFIXO>-<NNN>` por prefixo, ordenação (severidade → esforço → área), schema por achado, regra do CRÍTICO, rejeição de achado inválido (vai para "não testado"), recuperação de JSON com ruído, JSON quebrado ignorado, deduplicação (mesmo `check_id` + arquivo), `related_ids` nos dois sentidos e relacionados órfãos, segredo não mascarado reprovando a validação, `report.md` com as 8 seções, `.webaudit/latest`.
- `compare.mjs`: gabarito perfeito → 28/28 e APROVADO; recall < 80% → REPROVADO (detecta `MISSING`, `LOW_SEVERITY`, `WRONG_FILE`); `must_not_flag` apontado → REPROVADO; `match` distingue o erro do acerto no mesmo arquivo.
- Verificado também com os `raw/` reais da cópia da fixture (Etapa 7): `consolidate` agregou ferramentas (`axe-core` 4.14.0, `lighthouse` 13.6.0, `collect-*`) e renderizou o relatório.

### Decisões
- **Fases 5 e 6 viraram script** (`scripts/consolidate.mjs` + `scripts/lib/report.mjs`), extra em relação à SPEC §3.3: deduplicação, numeração, validação e relatório são mecânicos e precisam ser **reprodutíveis e testáveis sem modelo**. O orquestrador só delega, grava as respostas dos subagentes e chama o script.
- **Dois arquivos de entrada gravados pelo orquestrador** na Fase 0/2: `run.json` (`run_id`, `skill`, `arguments`, `target_path`, `collection_modes`) e `areas.json` (`areas_selected`, `areas_excluded`, `subagents`).
- **Deduplicação mecânica** só por `check_id` + arquivo da primeira evidência; causa raiz entre áreas é via `related_check_ids` dos subagentes (julgamento deles). Severidade só sobe na fusão se a natureza for a mesma.
- **Achado inválido não é perdido em silêncio:** vai para `not_tested` com o motivo e para `consolidation.json` (`rejected`). **Sem coleta local**, as verificações que dependem dela (`PERF-C01`, `A11Y-C01`, `A11Y-C08`, `QA-C05`, `QA-C06`, `QA-C12`) entram em "não testado" e `lighthouse`/`axe-core`/`playwright` aparecem como `skipped` em `tools`.
- **Resumo executivo determinístico** (contagens, críticos, áreas, itens não testados, aviso) — sem prosa livre do modelo, para nunca afirmar "pronto/sem problemas/conforme".
- **Skill:** `disable-model-invocation: true` (só o usuário dispara); `allowed-tools` apenas pré-aprova `node`/`bash` dos scripts do plugin (a doc: `allowed-tools` **não restringe**). Não há `hooks` no frontmatter: a proteção é o hook do plugin + lock (checkpoint c).
- **`${CLAUDE_PLUGIN_ROOT}` só é expandido no corpo da skill/agente**, não em `references/00-orchestrator.md`: o orquestrador doc usa `<PLUGIN_ROOT>`/`<ALVO>`/`<RUN>` e a skill informa o caminho. As skills seguintes só repetem o que for específico.
- **Confirmação única da coleta local:** se não houver como perguntar (modo não interativo) ou a resposta for "não", a skill **trata como `--static-only`**. A confirmação lista: comandos de build/servidor, o **efeito colateral** do build (saída fora de `.webaudit/`), `npm audit` (envia dependências ao npm) e o `doctor.sh`.
- `tests/run-fixture.sh`: `--prepare-only` (copia a fixture, `git init`/commit e imprime os comandos manuais), `--compare <findings.json>`, e execução completa; checa `git status` limpo e HEAD inalterado; saída 3 = sem autenticação, 4 = sem `findings.json`. Respeita `WEBAUDIT_MAX_BUDGET` (`--max-budget-usd`).

### Para o teste manual (pendência do usuário)
```bash
cd /root/projects/ai-webaudit && tests/run-fixture.sh          # após `claude` autenticado
# ou: tests/run-fixture.sh --prepare-only   → imprime os comandos para rodar na mão
```
Cole a saída (principalmente o bloco "Gabarito") para registrar o resultado real e o que falhou — sem ajustar nada antes.

## Etapa 8 — RESULTADO REAL do teste na fixture (2026-11-07, executado pelo usuário)
Comando: `tests/run-fixture.sh` → `claude -p "/ai-webaudit:audit --static-only"` (sem `--bare`, `--permission-mode dontAsk`), modelo **claude-sonnet-5-5**. **Nada foi ajustado** nas referências, agentes, fixture ou gabarito; abaixo, só o registro. (Única alteração de código após o teste: o *harness* `run-fixture.sh`, ver "Falhas do harness".)

### Números
| Item | Resultado |
|---|---|
| Execução | 11 turnos, **3 min 42 s**, **US$ 2,67** (≈ 110 mil tokens de saída, 1,7 M de cache lido), `is_error: false` |
| Achados | **65** (5 críticos, 25 importantes, 35 melhorias, 0 opcionais) |
| `must_find` | **25/28 = 89,3%** (meta 80% ✔). Por área: SEO 3/3 · GEO 1/1 · AEO 1/1 · AIO 1/1 · CRO 1/1 · QA 2/2 · ANL 1/2 · PERF 0/1 · A11Y 4/4 · PRIV 2/2 · LOC 2/2 · CONT 1/1 · OPS 1/1 · API 2/3 · SEC 3/3 |
| `must_not_flag` | **1 apontado** (meta 0) → **REPROVADO** pelo critério da SPEC §11 |
| Fora do gabarito | 40 (amostra conferida: todos têm base no código da fixture — ver abaixo) |
| Não testado | 84 itens; `lighthouse`, `axe-core`, `playwright` como `skipped` (modo `--static-only`) |
| Consolidação | 0 achados rejeitados, 0 fusões, 0 saídas de subagente inválidas; 17 `related_check_id` órfãos |
| Alvo | `git status` sem alterações **do plugin** e HEAD inalterado (as únicas "alterações" eram os logs do harness) |
| Lock | liberado ao final (`latest` = `2026-11-07_1328`) |

### Os 4 pontos que reprovaram (causa, sem correção aplicada)
1. **`OK05` `CRO-C08` em `contato.html` (must_not_flag apontado)** — **falso positivo do comparador, não erro do agente.** O achado `WA-CRO-001` é sobre o link de `index.html`; a evidência de `contato.html` foi citada **como contraste** ("o link da página de contato usa o formato correto"). `compare.mjs` conta **qualquer** evidência que cite o arquivo. *Origem:* semântica do gabarito/comparador (evidência de contraste).
2. **`F11` `ANL-C08` veio `IMPORTANTE`/`RISCO_POTENCIAL` (esperado `CRITICO`)** — **o subagente tem razão.** O `js/analytics.js` da fixture define `gtag()` e `config`, mas **não carrega o `gtag.js`** (e o ID é placeholder): o evento com e-mail/telefone hoje não é transmitido. A referência `ANL-C08` só dá `CRITICO` quando o código "comprovadamente envia PII clara". *Origem:* **defeito do gabarito/fixture** (a fixture não materializa o envio).
3. **`F24` `API-C08` veio `IMPORTANTE` (esperado `CRITICO`)** — o agente marcou `CONFIRMADO` mas limitou a `IMPORTANTE` porque a lista `leads` é um **array em memória** e "o comportamento em produção não foi verificado". A referência permite `CRITICO` (`CONFIRMADO` por código) sem autenticação em todo o caminho lido. *Origem:* **conservadorismo do subagente** em relação à referência (discutível: o dado em memória é real em instância quente).
4. **`F12` `PERF-C04` MISSING** — **o defeito foi encontrado, com outro ID:** `WA-PERF-001` é `PERF-C03` (`IMPORTANTE`, `loading="lazy"` na imagem do herói). `PERF-C03` ("elemento de LCP descobrível e priorizado": "não usa `loading="lazy"`") e `PERF-C04` ("lazy loading correto") **cobrem o mesmo defeito**. O agente listou `PERF-C04` apenas em `related_check_ids` (órfão). *Origem:* **sobreposição entre duas verificações da referência 08** (viola "uma área dona" no nível do check) + gabarito que exige um `check_id` específico.

### Observações do teste real
- **O hook funcionou em sessão real:** `guard.log` registra **1 bloqueio legítimo** — `Bash: mkdir fora de .webaudit/ bloqueado… $RUN/raw` (o orquestrador usou **variável de shell**, que o guard trata como destino dinâmico). O orquestrador se adaptou e seguiu. **Não exercitado ainda:** `Write` fora de `.webaudit/` nem tentativa dentro de subagente. *Ação sugerida (não aplicada):* o §9 de `00-orchestrator.md` deve mandar usar **caminhos literais, sem variáveis de shell**.
- **Contrato JSON dos subagentes:** 8/8 válidos; nenhum rejeitado. Desvio menor: `release-qa` usou `errors[]` para listar observações que deixou a outros agentes (o campo é para falhas de leitura/ferramenta).
- **Fidelidade às regras:** sem "site pronto/seguro/conforme"; resposta final curta e correta (contagens, 5 críticos, "não testado", caminho do relatório, próximos comandos); **não** inventou métricas (marcou PERF/axe/contraste como não testados) e reconheceu que o efeito no LCP não foi medido.
- **`related_check_id` órfãos (17):** são referências a checks sem achado (esperado); o orquestrador os citou na resposta como "ponto de atenção", o que é ruído. *Ação sugerida:* tratar como informativo.
- **Extras (40) — amostra conferida, todos reais no código da fixture:** link `sobre.html` inexistente (`QA-C01`, `CRITICO`, menu principal), formulário de orçamento sem destino (`QA-C04`, `CRITICO`), sem 404/favicon/Open Graph, sem README, `.env` na pasta publicável (`API-C12`), CSP ausente com XSS comprovado (`API-C02` `IMPORTANTE`, coerente com a referência), `PRIV-C02/C06/C07/C08/C10`, `CONT-C01/C03/C04/C05`, `LOC-C01/C04`, etc. Nenhum item parece alucinado. Há **sobreposição de causa raiz entre áreas** em alguns (ex.: `SEO-C15` × `CONT-C02` na data futura; `GEO-C04/C06` × `LOC-C02`), ligadas por `related_ids`.
- **Relatório:** `report.md` com **102 KB** para 65 achados (todos detalhados). Legível, mas pesado; avaliar no resumo/versão compacta (Etapa 10).
- **Custo:** US$ 2,67 por auditoria estática da fixture (3 páginas). Com coleta local e sites maiores será maior; a skill não impõe teto.
- **Verificações da etapa:** (a) alvo não alterado ✔; (b) recusa quando o diretório atual é o plugin — **ainda não testada em sessão real**; (c) `claude plugin validate` ✔.

### Falhas do harness (corrigidas fora do critério "não ajustar")
- `tests/run-fixture.sh` gravava `claude-output.json` e `claude-stderr.txt` **dentro** da cópia e depois reportava "ALTERAÇÕES no alvo". Agora vão para `<cópia>.logs/`. Sem relação com o plugin.

### Opções para decidir (nenhuma aplicada)
- **A.** `compare.mjs` considerar só a **evidência primária** (primeira) no `must_not_flag` (ou ignorar evidência marcada como contraste) → elimina o falso positivo `OK05`.
- **B.** `F11`: fazer a fixture **carregar o `gtag.js`** (envio real) **ou** baixar o `min_severity` para `IMPORTANTE`.
- **C.** `F24`: manter `CRITICO` (e reforçar na referência `API-C08` que array em memória não rebaixa) **ou** aceitar `IMPORTANTE`.
- **D.** `F12`: tirar a sobreposição na referência 08 (`PERF-C03` = descoberta/prioridade; `PERF-C04` = só `lazy`) **ou** permitir `alt_check_ids` no gabarito.
- Aplicando A+B+D (sem tocar nos agentes) o teste chegaria a 27/28 ou 28/28 com 0 violações; **cada opção é decisão do usuário** para evitar *overfitting*.

## Etapa 8 — Ajustes A, B e D aplicados (2026-11-07, decisão do usuário)
- **A (comparador):** `tests/compare.mjs` — `must_not_flag` considera só a **evidência primária** (a primeira) do achado (e, com `match`, ela precisa conter o termo); evidência citada depois, como contraste, não conta. Semântica atualizada em `expected-findings.json` (`scoring.semantics`) e em `tests/fixtures/README.md`. Novo teste cobre os dois sentidos (contraste não conta; como primária conta) e o teste do `match` foi ajustado (o consolidador funde achados do mesmo `check_id` + arquivo, deixando a evidência do logo em 2º lugar).
- **B (fixture):** `js/analytics.js` agora **injeta o `gtag.js`** (`googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`), de modo que o `gtag('event','generate_lead',{email,telefone})` **envia** PII de fato. O ID continua placeholder (`ANL-C01`). `min_severity` de `F11` permanece `CRITICO`.
- **D (referência 08):** `PERF-C03` ficou com **descoberta e prioridade** do elemento LCP (HTML inicial, `fetchpriority`, `preload`); **`loading="lazy"` na imagem LCP passou a ser exclusivo do `PERF-C04`** (que agora cita a imagem LCP explicitamente), e o `PERF-C03` manda registrar só o `PERF-C04` com `related_check_ids`. Mudança geral (não específica da fixture): remove a sobreposição de dono do mesmo defeito. Gabarito `F12` mantido em `PERF-C04`.
- **C (`API-C08`) NÃO aplicada:** `F24` segue exigindo `CRITICO`; o agente deu `IMPORTANTE` (array em memória). Fica como possível falha da próxima execução.
- **Efeito já verificável sem modelo:** o comparador novo sobre o `findings.json` da execução real anterior dá **25/28 = 89,3% e 0 `must_not_flag` → APROVADO** (antes: REPROVADO por `OK05`). `F11`, `F12` e `F24` dependem de **nova execução** com a fixture e a referência alteradas; **ainda não rodada** (esta sessão está sem autenticação do `claude`). Testes: 23 passam (14 guard + 9 pipeline), `claude plugin validate` ✔.
- **Não aplicado (apenas sugerido):** o §9 do `00-orchestrator.md` ainda não proíbe variáveis de shell nos comandos; o guard bloqueou um `mkdir $RUN/raw` na execução real.
