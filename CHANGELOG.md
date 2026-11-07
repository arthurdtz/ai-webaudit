# Changelog

## [Unreleased]

### Etapa 8 — Skill `audit` e teste da fixture
- `skills/audit/SKILL.md` (só o específico do `audit`); fluxo comum e comandos de cada fase em `references/00-orchestrator.md` §9.
- `scripts/consolidate.mjs` + `scripts/lib/report.mjs`: Fases 5 e 6 mecânicas (valida cada achado, deduplica, numera IDs, liga `related_ids`, valida `findings.json`, gera `report.md` e `.webaudit/latest`).
- `tests/compare.mjs` (recall de `must_find`, `must_not_flag` apontados, achados fora do gabarito), `tests/run-fixture.sh` (`--prepare-only`, `--compare`) e `tests/pipeline.test.mjs` (8 testes sem modelo).
- **Teste real executado pelo usuário** (`tests/run-fixture.sh`): 65 achados, recall de `must_find` **25/28 = 89,3%** (meta 80%), 1 `must_not_flag` apontado (falso positivo do comparador), 5 críticos, 84 itens não testados, US$ 2,67 e 3 min 42 s. Detalhes e causas em `docs/DECISIONS.md`.
- **Opções A, B e D aplicadas após o teste real (decisão do usuário):** `compare.mjs` passou a usar só a evidência **primária** no `must_not_flag`; a fixture agora **carrega o `gtag.js`** (envio real da PII em `ANL-C08`); a referência `08-performance-cwv.md` deixou de sobrepor `PERF-C03` e `PERF-C04` (lazy na imagem LCP é só `PERF-C04`). Opção C (`API-C08`) **não** aplicada.
- `tests/run-fixture.sh`: logs do harness movidos para fora da cópia (apareciam como "alteração no alvo").

### Etapa 7 — Coleta, doctor e proteção
- `scripts/guard.mjs` + `hooks/hooks.json` (hook `PreToolUse`) e `scripts/lock.mjs` (`acquire`/`release`/`status`): proteção do modo leitura por lock (`.webaudit/.lock`, expira em 2 h), falha fechada com lock ativo. Testes em `tests/guard/guard.test.mjs` (14 casos).
- `scripts/doctor.sh` (`--install`), `scripts/detect-stack.mjs` (gera `context.json`), `scripts/collect-static.mjs`, `scripts/collect-local.mjs` (Lighthouse, axe, capturas 360/768/1440, console, links), `scripts/collect-remote.mjs` (GET, ≤ 20 páginas, 1 req/s) e auxiliar `scripts/serve-static.mjs`.
- Bibliotecas em `scripts/lib/` (lock, varredura de arquivos, segredos com mascaramento, extração de HTML, Lighthouse).
- Dependências fixadas em `scripts/package.json`: `lighthouse` 13.6.0, `playwright` 1.65.0, `@axe-core/playwright` 4.14.0 (Node ≥ 22.19).

### Etapa 6 — Subagentes e fixture
- `agents/` com os 8 subagentes (`search-visibility`, `ai-visibility`, `conversion`, `performance`, `accessibility`, `privacy`, `security`, `release-qa`): `tools: Read, Grep, Glob`, `model: sonnet`.
- `references/shared/agent-output.md`: contrato de saída JSON dos subagentes (sem `id`/`fix_status`; `related_check_ids`; `not_tested`; `areas_not_applicable`; `errors`).
- Fixture `tests/fixtures/sample-site/` (negócio fictício), `expected-findings.json` (28 `must_find`, 10 `must_not_flag`, 15 áreas), `tests/fixtures/README.md` e `tests/check-expected-ids.mjs`.

### Etapa 5 — Referências: privacidade e segurança
- `references/10-privacy-lgpd.md` (11 verificações), `14-security-api-edge.md` (14), `15-security-appsec.md` (12). Total das referências 01–15: 170 verificações.

### Etapa 4 — Referências: experiência e produto
- `references/05-cro-landing-pages.md` (9 verificações), `06-qa-pre-launch.md` (14), `07-analytics-tracking.md` (10), `08-performance-cwv.md` (13), `09-accessibility.md` (14), `12-post-launch-maintenance.md` (13), no modelo de `shared/reference-template.md`, com fontes consultadas em 2026-11-05.

### Etapa 3 — Referências: busca e IA
- `references/01-seo.md` (16 verificações), `02-geo.md` (7), `03-aeo.md` (7), `04-aio.md` (8), `11-local-seo-gbp.md` (11), `13-content-authority.md` (11), todas no modelo de `shared/reference-template.md`, com fontes oficiais consultadas em 2026-11-05.

### Etapa 2 — Contrato
- `references/shared/findings.schema.json` (JSON Schema 2020-12), `severity.md`, `report-template.md`, `reference-template.md`.
- `references/00-orchestrator.md`: fases 0–7, matriz de seleção, mapeamento área → subagente, deduplicação e trade-offs, economia de contexto, mascaramento de segredos, o que nunca afirmar.
- `scripts/validate-findings.mjs` (ajv 8.20.0 + ajv-formats 3.0.1, instalados só em `scripts/`) e `tests/schema/{valid,invalid}.json`.

### Etapa 1 — Fundação
- Estrutura inicial, manifesto `plugin.json`, `.gitignore`, `docs/DECISIONS.md` com checkpoint de arquitetura aprovado.
- Repositório publicado no GitHub (público).
