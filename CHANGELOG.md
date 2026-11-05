# Changelog

## [Unreleased]

### Etapa 3 — Referências: busca e IA
- `references/01-seo.md` (16 verificações), `02-geo.md` (7), `03-aeo.md` (7), `04-aio.md` (8), `11-local-seo-gbp.md` (11), `13-content-authority.md` (11), todas no modelo de `shared/reference-template.md`, com fontes oficiais consultadas em 2026-11-05.

### Etapa 2 — Contrato
- `references/shared/findings.schema.json` (JSON Schema 2020-12), `severity.md`, `report-template.md`, `reference-template.md`.
- `references/00-orchestrator.md`: fases 0–7, matriz de seleção, mapeamento área → subagente, deduplicação e trade-offs, economia de contexto, mascaramento de segredos, o que nunca afirmar.
- `scripts/validate-findings.mjs` (ajv 8.20.0 + ajv-formats 3.0.1, instalados só em `scripts/`) e `tests/schema/{valid,invalid}.json`.

### Etapa 1 — Fundação
- Estrutura inicial, manifesto `plugin.json`, `.gitignore`, `docs/DECISIONS.md` com checkpoint de arquitetura aprovado.
- Repositório publicado no GitHub (público).
