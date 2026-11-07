---
name: fix
description: Aplica correções dos achados de uma auditoria anterior do AI WebAudit (por ID ou todos os críticos), com plano por achado, uma confirmação para o lote, mudança mínima, validação pelo critério do achado, atualização de fix_status e fix-log.md. Nunca faz commit sem pedido explícito e nunca faz deploy. Use depois de /ai-webaudit:audit, pre-launch ou optimize.
argument-hint: "<IDs…> | --all-critical [--run <id>] [--yes]"
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# /ai-webaudit:fix — corrigir achados (com autorização)

Argumentos recebidos: `$ARGUMENTS`

Você corrige **somente** os achados pedidos, do `findings.json` de uma auditoria anterior, com a **menor mudança que resolve**, preservando a arquitetura e o estilo do projeto. **`<PLUGIN_ROOT>` = `${CLAUDE_PLUGIN_ROOT}`**. Use **caminhos literais** nos comandos Bash (sem variáveis de shell, sem `$(…)`, sem `node -e`).

## Nunca (nem com autorização do lote)

- **commit, push, tag, reset, stash, deploy**, alterar banco de dados, publicar pacotes, enviar dados privados a serviços externos. O guard bloqueia isso durante o fix. **Commit só se o usuário pedir explicitamente depois**, em outra mensagem.
- Expor segredos: **nunca** escreva o valor de um segredo em arquivo, log, `fix-log.md` ou chat (mascare: 4 primeiros caracteres + `****`).
- Sair do escopo dos achados autorizados; refatorar; "aproveitar" para melhorar outra coisa.
- Inventar dados do dono (telefones, textos institucionais, preços, depoimentos, IDs de analytics). Quando a correção exige um dado que só o dono tem, **não aplique**: marque `aberto` com a pergunta.

## Argumentos

| Argumento | Efeito |
|---|---|
| `<IDs…>` | Um ou mais IDs (`WA-SEC-001 WA-QA-002`). |
| `--all-critical` | Todos os achados `CRITICO` do run ainda não corrigidos. |
| `--run <id>` | Run específico (`AAAA-MM-DD_HHMM`). Padrão: o de `<ALVO>/.webaudit/latest`. |
| `--yes` | **Autorização prévia do lote** (e de criar a branch). **Não** vale para risco alto: itens de risco alto continuam exigindo confirmação individual; sem como perguntar, são **pulados** e listados. |

Sem `--yes` e sem como perguntar (modo não interativo): **não aplique nada**; entregue só o plano e explique como autorizar (`--yes`).

## Roteiro

### 1. Localizar o run e selecionar os achados
- `ALVO` = saída de `git rev-parse --show-toplevel` (ou `pwd` se não houver git). **Recuse** se for o diretório do plugin.
- `node <PLUGIN_ROOT>/scripts/fix-status.mjs resolve <ALVO> [--run <id>]` → imprime o diretório do run (`<RUN>`). Sem auditoria anterior: pare e oriente a rodar `/ai-webaudit:audit`.
- `node <PLUGIN_ROOT>/scripts/fix-status.mjs select <RUN> <IDs…>` (ou `--all-critical`) → JSON com `selected` e `skipped` (leia o stdout; IDs inexistentes encerram com erro). Apresente os `skipped` e o motivo.
- **Lock esquecido:** `node <PLUGIN_ROOT>/scripts/lock.mjs status <ALVO>`. Se houver lock **de leitura** válido (auditoria interrompida), explique e libere com `lock.mjs release <ALVO>` (é arquivo do próprio plugin).

### 2. Plano por achado (leia os arquivos citados nas evidências)
Para cada achado, escreva e mostre: **arquivos** a alterar, **mudança** (resumo do diff), **risco** (baixo/médio/alto), **como validar** (o `validation_criteria` + comandos do projeto que serão rodados, se existirem: `npm run lint`/`test`/`build`).
- **Risco ALTO** (confirmação **individual**): autenticação/sessão/autorização, consultas a banco, mudança de dependência ou de versão, remoção de arquivos, mexer em configuração de hosting/DNS/CI, tocar mais de 3 arquivos, segredos/histórico git (o plugin **não** revoga chave: oriente **revogar → rotacionar → remover**), qualquer mudança difícil de desfazer.
- **Risco baixo/médio** entram no **lote** com **uma** confirmação.
- Mostre também os **trade-offs** do achado (`tradeoffs`) e achados relacionados: não resolva um aplicando dano em outra área sem avisar.

### 3. Estado do repositório e branch
- `git status --porcelain` e `git branch --show-current`. **Avise** se houver alterações não commitadas (liste-as): o fix mistura-se com elas.
- Sugira a branch **`webaudit/fix-<run_id>`** (se ainda não estiver nela) e **pergunte se deve criar**: `git switch -c webaudit/fix-<run_id>` (permitido). Com `--yes`: crie se o repositório existir e a árvore estiver **limpa**; senão, siga na branch atual e avise.

### 4. Confirmação (uma para o lote)
Use `AskUserQuestion` **uma vez** (até 4 perguntas na mesma chamada): (a) aplicar o lote (itens de risco baixo/médio) — "Aplicar lote" / "Escolher itens" / "Cancelar"; (b) criar a branch; (c)… uma pergunta **individual** para cada achado de risco alto (máx. 4 por chamada; se houver mais, nova chamada). Itens negados ou sem resposta: **não aplicar**.
Registre cada item autorizado: `node <PLUGIN_ROOT>/scripts/fix-status.mjs set <RUN> <ID> autorizado`.
Depois da confirmação: `node <PLUGIN_ROOT>/scripts/lock.mjs acquire <ALVO> --skill fix --mode fix --run <RUN_ID>` (confina as escritas ao projeto e mantém bloqueado o que é **sempre** proibido). **Libere sempre no fim** (`lock.mjs release`), inclusive em erro.

### 5. Aplicar (um achado por vez)
- Use `Edit`/`Write` com a **menor mudança**; siga o estilo e as convenções do arquivo. Guarde o trecho original para poder **reverter**.
- Nada de `git commit`, `git add`, `git stash`, `git checkout -- …` (o guard bloqueia). Para desfazer, restaure o trecho original com `Edit`.

### 6. Validar pelo `validation_criteria`
- Reexecute a verificação do achado (`Grep`/`Read` nos arquivos alterados; a busca que o critério descreve) e os comandos do projeto aprovados no plano (lint/test/build, se existirem). **Não estime** resultado de ferramenta que não rodou.
- **Passou** → `fix-status.mjs set <RUN> <ID> validado --files <a,b> --validation "<o que foi conferido>"`.
- **Aplicado, mas a validação exige algo que não rodou** (Lighthouse, axe, teste manual, produção) → `corrigido` com `--note "validar com /ai-webaudit:audit --… / manualmente"`.
- **Falhou** → tente **uma** correção adicional; se persistir, **reverta** a mudança desse achado e `set … falhou-validacao --note "<motivo>"`. Nunca deixe o projeto pior do que estava.
- O `fix-status.mjs set` valida o `findings.json` de novo, atualiza `fix_status` e **acrescenta ao `fix-log.md`** (data, arquivos, validação, resultado). Não edite o `findings.json` na mão.

### 7. Resposta no chat (curta)
Tabela `ID · título · fix_status` (e o motivo para `falhou-validacao`/não aplicados); arquivos alterados (`git diff --stat`); **"Nada foi commitado"** — revise o `git diff`; caminho do `fix-log.md` (`<RUN>/fix-log.md`); próximo passo: rodar `/ai-webaudit:audit` de novo para confirmar que os achados corrigidos deixaram de aparecer, e **pedir explicitamente** o commit, se quiser. Se houve item de risco alto pulado ou dado do dono faltando, diga exatamente o que falta. **Nunca** afirme "site seguro/pronto/sem problemas".
