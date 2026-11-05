# Modelo do `report.md`

Estrutura obrigatória (SPEC §7.4). Texto em pt-BR; identificadores, comandos e nomes de campo em inglês. Substituir cada `{{placeholder}}`. Omitir seções vazias **não** é permitido: escrever "Nenhum." quando for o caso.

Regras de redação:
- Nunca escrever "site pronto", "sem problemas", "conforme", "seguro" ou equivalentes.
- Não citar métrica que não foi medida neste run. Laboratório ≠ campo.
- Segredos sempre mascarados (4 primeiros caracteres + `****`).

---

````markdown
# Relatório AI WebAudit — {{project_name}}

| Campo | Valor |
|---|---|
| Data | {{generated_at}} |
| Run | `{{run_id}}` |
| Skill | `/ai-webaudit:{{skill}}` {{arguments}} |
| Commit / branch | `{{commit}}` / `{{branch}}` {{dirty_note}} |
| Stack | {{stack_summary}} |
| Modos de coleta | {{collection_modes}} |

## 1. Resumo executivo

{{executive_summary_5_to_10_lines}}

| Severidade | Quantidade |
|---|---|
| CRÍTICO | {{n_critico}} |
| IMPORTANTE | {{n_importante}} |
| MELHORIA | {{n_melhoria}} |
| OPCIONAL | {{n_opcional}} |

{{only_in_pre_launch: **Bloqueadores conhecidos: SIM ({{n}}) / NÃO IDENTIFICADOS**. Este resultado não indica que o site esteja pronto: só reflete o que foi testado (seção 5).}}

## 2. Ordem prática de correção

1. `{{id}}` — {{title}} ({{effort}}) — {{reason_for_order}}
2. …

## 3. Achados

### 3.1 Críticos

| ID | Área | Título | Natureza | Verificação | Esforço |
|---|---|---|---|---|---|
| `{{id}}` | {{area}} | {{title}} | {{nature}} | {{verification}} | {{effort}} |

#### {{id}} — {{title}}

- **Descrição:** {{description}}
- **Evidência:** `{{file}}:{{line}}` — `{{snippet_masked}}` / `{{command}}` / `{{raw_ref}}`
- **Impacto:** {{impact}}
- **Recomendação:** {{recommendation}}
- **Critério de validação:** {{validation_criteria}}
- **Relacionados:** {{related_ids}}
- **Trade-offs:** {{tradeoffs}}

### 3.2 Importantes
(mesmo formato)

### 3.3 Melhorias
(mesmo formato)

### 3.4 Opcionais
(mesmo formato)

## 4. Trade-offs entre áreas

{{explicit_conflicts_or_"Nenhum."}}

## 5. O que foi testado e como

| Ferramenta | Versão | Status | Observação |
|---|---|---|---|
| {{tool}} | {{version}} | {{ok|failed|skipped|unavailable}} | {{note_or_error}} |

Áreas analisadas: {{areas_selected}}. Páginas/URLs avaliadas: {{pages}}.

## 6. Não testado / verificação manual pendente

- **{{area}}** {{check_id}} — {{description}}. Motivo: {{reason}}.

## 7. Áreas não acionadas

| Área | Motivo |
|---|---|
| {{area}} | {{reason}} |

## 8. Aviso

Este relatório não é certificação de segurança, acessibilidade ou conformidade legal. Ferramentas automáticas cobrem só parte dos critérios; itens da seção 6 exigem verificação humana. Resultados refletem o estado do projeto no commit indicado.
````
