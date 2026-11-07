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
| **4 Análise** | `context.json`, `raw/`, referências | Delegar **em paralelo** só aos subagentes necessários (§3). Cada um recebe: caminho do `context.json`, caminho de `raw/`, lista exata de referências a ler, caminhos de `shared/severity.md`, `shared/agent-output.md` e `shared/findings.schema.json`, `skill` e objetivo. Devolve **somente** o JSON do contrato `shared/agent-output.md` (a sessão principal grava em `agents/<subagente>.json`). | `agents/<subagente>.json` |
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
| Subagentes: suas referências selecionadas, `shared/severity.md`, `shared/agent-output.md`, `shared/findings.schema.json`, `context.json`, arquivos do alvo e `raw/` que precisarem | Referências de outras áreas; histórico da conversa |

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

## 9. Procedimento operacional (comandos de cada fase)

Comum a `audit`, `pre-launch` e `optimize`. A skill informa `<PLUGIN_ROOT>` (caminho absoluto do plugin, já expandido no texto da skill). **Este arquivo não expande variáveis**: substitua `<PLUGIN_ROOT>`, `<ALVO>`, `<RUN>` (= `<ALVO>/.webaudit/runs/<RUN_ID>`) e `<RUN_ID>` pelos valores reais. Nunca leia as referências `01`–`15` na sessão principal.

**Regra de ouro:** qualquer que seja o resultado, **termine sempre com `node <PLUGIN_ROOT>/scripts/lock.mjs release <ALVO>`** (Fase 6, inclusive em falha ou cancelamento). Sem o `release`, o modo leitura fica ativo até expirar (2 h).

### Fase 0 — Preparação
1. `ALVO` = saída de `git rev-parse --show-toplevel` no diretório atual; sem git, o próprio diretório (`pwd`).
2. `RUN_ID` = `date +%Y-%m-%d_%H%M`.
3. `node <PLUGIN_ROOT>/scripts/lock.mjs acquire <ALVO> --skill <skill> --run <RUN_ID>`
   - exit **3**: o alvo é o diretório do plugin → **pare**, explique ("a auditoria roda no projeto aberto; abra o Claude Code na pasta do site com `claude --plugin-dir <PLUGIN_ROOT>`") e **não crie nada**;
   - exit **4**: já existe lock válido (outra auditoria?) → pergunte ao usuário; não use `--force` sem pedido explícito;
   - exit 0: lock criado (modo leitura ativo), `.webaudit/` no `.git/info/exclude`.
4. `mkdir -p <RUN>/raw <RUN>/agents`
5. Grave `<RUN>/run.json` (Write): `{"run_id":"<RUN_ID>","skill":"<skill>","arguments":"<argumentos como digitados>","target_path":"<ALVO>","collection_modes":["estatica"],"started_at":"<ISO>"}`

### Fase 1 — Reconhecimento
`node <PLUGIN_ROOT>/scripts/detect-stack.mjs <ALVO> --out <RUN>/context.json`. Leia o `context.json` (sinais em `signals`, `commands`, `site_type`, `pages`, `api`, `analytics`).

### Fase 2 — Seleção
Aplique a matriz (§2) aos `signals` e grave `<RUN>/areas.json`: `{"areas_selected":["SEO",…],"areas_excluded":[{"area":"LOC","reason":"…"}],"subagents":["search-visibility",…]}`. Toda área fora de `areas_selected` precisa estar em `areas_excluded` com motivo objetivo.

### Fase 3 — Coleta
- **Sempre:** `node <PLUGIN_ROOT>/scripts/collect-static.mjs <ALVO> <RUN>`.
- **Ativa-local** (omitida com `--static-only`; `--no-build` impede só o build): prepare **uma única confirmação** (pergunte uma vez, listando tudo): (a) comandos de build/servidor que serão executados (`context.commands.build`/`dev`/`preview`, ou `serve-static.mjs` para site estático sem build); (b) o **efeito colateral**: o build do projeto grava a saída (ex.: `dist/`) **fora de `.webaudit/`**; (c) `npm audit` (envia a lista de dependências ao registro do npm), se houver `package-lock.json`; (d) `doctor.sh` precisa estar ok (Lighthouse/axe/capturas). **Sem como perguntar (modo não interativo) ou resposta "não": trate como `--static-only`** e siga.
  1. Se não houver servidor pronto: site estático → `node <PLUGIN_ROOT>/scripts/serve-static.mjs <ALVO> 0 > <RUN>/raw/server.log 2>&1 &` (guarde o PID com `echo $! > <RUN>/raw/server.pid`; leia `LISTENING http://127.0.0.1:<porta>` do log); com `package.json`: `<gerenciador> run build` (se aprovado e sem `--no-build`) e depois `<gerenciador> run preview`/`start` em segundo plano; descubra a URL no log.
  2. Espere o servidor responder (até 60 s). **Se não subir:** registre o motivo e siga só com a coleta estática.
  3. `node <PLUGIN_ROOT>/scripts/collect-local.mjs <URL-localhost> <RUN>`.
  4. **Encerre o servidor** pelo PID salvo (`kill $(cat <RUN>/raw/server.pid)`); nunca `pkill -f`.
  5. Se aprovado e há `package-lock.json`: `npm audit --json > <RUN>/raw/npm-audit.json || true` (**nunca** `npm install`/`audit fix`).
  6. Atualize `collection_modes` em `run.json` (acrescente `ativa-local`).
- **Ativa-remota** (só com `--url`): `node <PLUGIN_ROOT>/scripts/collect-remote.mjs <URL> <RUN>` (só GET, ≤ 20 páginas, 1 req/s). Acrescente `ativa-remota` em `collection_modes`. Informe os limites ao usuário; não é necessária nova confirmação (o `--url` é o opt-in).
- Falha de ferramenta: o coletor registra o erro em `raw/`; **nunca** estime o dado. Continue.

### Fase 4 — Análise (subagentes)
Para cada subagente necessário (§3), **em uma única mensagem e em paralelo**, chame a ferramenta `Agent` com `subagent_type: "ai-webaudit:<subagente>"` e este texto (preenchido):
```
Auditoria <skill>. Siga o contrato do seu agente.
target_path: <ALVO>
context_path: <RUN>/context.json
raw_dir: <RUN>/raw
areas: <prefixos selecionados deste subagente>
references: <caminhos ABSOLUTOS de <PLUGIN_ROOT>/references/NN-*.md, só das áreas selecionadas>
shared: <PLUGIN_ROOT>/references/shared/severity.md, <PLUGIN_ROOT>/references/shared/agent-output.md, <PLUGIN_ROOT>/references/shared/findings.schema.json
skill: <skill>
objective: <objetivo do usuário, se optimize>
modos de coleta executados: <collection_modes>; ferramentas que falharam ou foram puladas: <lista>
Responda somente com o JSON do contrato.
```
Grave **a resposta literal** de cada subagente em `<RUN>/agents/<subagente>.json` (Write). Resposta que não seja JSON: grave mesmo assim (o consolidador tenta recuperar) e, se estiver vazia, reenvie **uma vez**.

### Fases 5 e 6 — Consolidação e relatório
`node <PLUGIN_ROOT>/scripts/consolidate.mjs <RUN>` valida cada achado contra o schema, deduplica, resolve `related_check_ids`, numera os IDs finais, ordena, valida o `findings.json` (`validate-findings.mjs`), gera `report.md` e atualiza `<ALVO>/.webaudit/latest`. Leia a saída (contagens, `rejected`, `errors`, `orphan_related`). **Se a validação falhar**, não declare sucesso: mostre os erros ao usuário. Depois **sempre**: `node <PLUGIN_ROOT>/scripts/lock.mjs release <ALVO>`.
Você pode acrescentar ao `report.md` (Write em `<RUN>/`) observações de **trade-offs** que o consolidador não detecta, sem alterar os achados.

### Fase 7 — Resposta no chat (curta)
Em pt-BR: (1) uma linha com o projeto, os modos de coleta e a contagem por severidade; (2) os achados **CRÍTICOS** (ID + título), no máximo 6; (3) o que **não** foi testado (contagem + principais motivos, ex.: coleta local não executada); (4) caminho do relatório: `<RUN>/report.md`; (5) próximo comando sugerido, ex.: `/ai-webaudit:fix WA-SEC-001 WA-PRIV-002`. **Nunca** diga "site pronto", "sem problemas", "seguro" ou "conforme".
