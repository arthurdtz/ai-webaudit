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
