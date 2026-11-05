# Classificações dos achados

Contrato comum a todos os subagentes e ao orquestrador (SPEC §7.1). Valores em português sem acento nos enums; texto do relatório em pt-BR.

## Princípio

Achado só entra na lista com **evidência verificável** (arquivo + trecho, saída de comando, resposta HTTP ou relatório de ferramenta). Sem evidência → vai para `not_tested` ("Não testado / verificar manualmente"). Nunca criar achado para preencher categoria. Nunca inventar número, versão ou métrica.

## `severity`

| Valor | Quando usar | Regra |
|---|---|---|
| `CRITICO` | Falha grave de segurança, funcionamento, privacidade ou publicação, **com evidência concreta**. | Exige `nature = CONFIRMADO`, **ou** `RISCO_POTENCIAL` de segurança/privacidade (áreas `SEC`, `API`, `PRIV`) com evidência concreta no código (`file` + `snippet`). Sem isso, rebaixar. |
| `IMPORTANTE` | Problema real que prejudica resultado, usuário ou conformidade, sem ser bloqueador. | Evidência concreta. Pode ser `CONFIRMADO` ou `RISCO_POTENCIAL`. |
| `MELHORIA` | Ganho claro, sem falha atual. Inclui **toda prática recomendada sem garantia oficial**. | Teto de severidade para qualquer item baseado em prática (não documentada oficialmente). |
| `OPCIONAL` | Ideia de baixo impacto ou proposta ainda não padronizada (ex.: `llms.txt`). | Nunca bloqueia nada. |

Regras de uso:
- **Documentado oficialmente** pode chegar a `CRITICO`/`IMPORTANTE`, conforme impacto e evidência.
- **Prática recomendada sem garantia** → no máximo `MELHORIA`.
- Severidade padrão vem da referência da área; o subagente só sobe ou desce nas condições listadas no check.
- Em dúvida entre duas severidades, escolher a menor e explicar a incerteza em `description`.

Exemplos genéricos (sem números):
- `CRITICO`: chave secreta de serviço em arquivo versionado; `noindex` em todas as páginas do site em produção; formulário de contato que falha ao enviar; script de rastreamento disparando antes de qualquer consentimento, evidenciado no código.
- `IMPORTANTE`: imagens do topo da página sem dimensões declaradas, causando deslocamento visível; ausência de política de privacidade acessível em site que coleta dados; links internos quebrados.
- `MELHORIA`: ajustar a ordem de títulos para facilitar leitura por máquina; adicionar resposta direta no início de uma seção FAQ.
- `OPCIONAL`: publicar `llms.txt`; adicionar dados estruturados sem rich result garantido.

## `nature`

| Valor | Significado |
|---|---|
| `CONFIRMADO` | Problema observado diretamente (código, resposta, relatório). |
| `RISCO_POTENCIAL` | Condição que pode causar problema dependendo de contexto não verificado (ex.: configuração de produção). Deixar a dependência explícita em `description`. |
| `PREVENTIVO` | Nenhuma falha atual; reduz risco ou melhora robustez. |

## `verification`

| Valor | Significado |
|---|---|
| `estatica` | Leitura de código/config/arquivos locais. |
| `ativa-local` | Executado contra servidor `localhost` (build, Lighthouse, axe, screenshots). |
| `ativa-remota` | Requisições GET à URL informada em `--url`. |
| `manual-pendente` | Depende de verificação humana (ex.: Perfil da Empresa no Google). Normalmente entra em `not_tested`, não como achado; usar como achado só quando há evidência parcial concreta. |

## `effort`

Estimativa **qualitativa**, sem horas: `P` (mudança pontual, poucos arquivos), `M` (várias mudanças ou decisão de design), `G` (refatoração, nova funcionalidade ou dependência externa).

## `fix_status`

`aberto` (padrão) → `autorizado` (usuário aprovou no `/fix`) → `corrigido` (mudança aplicada) → `validado` (critério de validação passou) ou `falhou-validacao`. `descartado`: usuário decidiu não corrigir. Só o `/fix` altera este campo; auditorias gravam sempre `aberto`.

## Evidência

- `evidence` é uma lista; cada item exige `type` e ao menos um de `file`, `command`, `raw_ref`.
- **Segredos mascarados**: no máximo os 4 primeiros caracteres + `****` (ex.: `AKIA****`). Vale para `snippet`, `output_excerpt` e relatório. Nunca copiar valor completo.
- `snippet` curto (poucas linhas). Referenciar `raw/` em vez de colar saídas longas.

## Relacionamentos

- Um achado por causa raiz. Mesmo arquivo + mesmo check, ou mesma causa raiz → um achado, com `related_ids` apontando para os demais.
- Cada verificação tem **uma área dona**; outras áreas só referenciam o ID em `related_ids`.
- Conflito entre áreas (ex.: widget de chat ajuda CRO, prejudica performance) → preencher `tradeoffs` nos dois achados. Nunca resolver em silêncio.
