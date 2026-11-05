# AI WebAudit — Especificação (SPEC)

> **Fonte de verdade do projeto.** Todos os prompts de implementação seguem este documento.
> Se a documentação oficial atual do Claude Code contradisser algo aqui, siga a documentação oficial, registre a divergência em `docs/DECISIONS.md` e avise antes de prosseguir.

---

## 1. Visão

**AI WebAudit** — *AI-powered multi-agent website auditing, optimization and quality assurance.*

Plugin reutilizável do Claude Code que audita qualquer projeto web local (independente de framework), identifica problemas técnicos, funcionais e comerciais em 15 áreas, gera relatório com evidências e prioridades e, mediante autorização, implementa e valida correções.

Fora do escopo da v0.1: dashboard, interface web, SaaS, integração com CI, comparação entre execuções, exportação em PDF, deploy.

---

## 2. Ambiente

- Ubuntu via WSL, usuário `root`, projetos em `/root/projects/`.
- Plugin: `/root/projects/ai-webaudit` — repositório GitHub **privado** `ai-webaudit`.
- Uso em qualquer site, sem copiar arquivos para ele:

```bash
cd /root/projects/meu-site
claude --plugin-dir /root/projects/ai-webaudit
```

```text
/ai-webaudit:audit
```

- O alvo da auditoria é sempre o projeto aberto (diretório atual / raiz git do diretório atual), **nunca** o diretório do plugin.
- Caminhos internos do plugin sempre via `${CLAUDE_PLUGIN_ROOT}` (ou o mecanismo oficial equivalente).

---

## 3. Arquitetura

### 3.1 Papéis

| Componente | O que é | Onde |
|---|---|---|
| **Orquestrador** | **Não é um subagente.** É o fluxo que as skills executam na sessão principal do Claude Code. Suas regras ficam em `references/00-orchestrator.md`, lido por todas as skills. Motivo: subagentes não podem iniciar outros subagentes; só a sessão principal delega. | `references/00-orchestrator.md` + `skills/*` |
| **Skills** | Pontos de entrada (`/ai-webaudit:audit`, `pre-launch`, `optimize`, `fix`). Definem objetivo, argumentos e diferenças de fluxo. | `skills/<nome>/SKILL.md` |
| **Subagentes** | Analistas por grupo de áreas. **Somente leitura** (`Read`, `Grep`, `Glob`). Recebem contexto + evidências coletadas e devolvem achados em JSON. | `agents/*.md` |
| **References** | Conhecimento técnico por área, carregado sob demanda pelo subagente responsável. | `references/NN-*.md` |
| **Shared** | Contrato comum: schema dos achados, severidades, modelo de relatório, modelo de referência. | `references/shared/` |
| **Scripts** | Detecção de stack e coleta ativa (Lighthouse, axe, Playwright, headers). Dependências próprias do plugin, nunca instaladas no projeto alvo. | `scripts/` |
| **Hooks** | Camada de proteção do modo leitura. | `hooks/` ou frontmatter das skills |

### 3.2 Fluxo resumido

```
skill (sessão principal = orquestrador)
  ├─ 0. preparação (alvo, run dir, lock)
  ├─ 1. reconhecimento  → context.json
  ├─ 2. seleção de áreas → registra incluídas/excluídas
  ├─ 3. coleta (estática / ativa-local / ativa-remota) → raw/
  ├─ 4. delegação paralela aos subagentes selecionados → JSON por subagente
  ├─ 5. consolidação (schema, deduplicação, conflitos, IDs finais)
  ├─ 6. relatório → report.md + findings.json
  └─ 7. resposta curta no chat
```

### 3.3 Estrutura de diretórios (proposta; ajustar à documentação oficial)

```
ai-webaudit/
├── .claude-plugin/plugin.json
├── skills/
│   ├── audit/SKILL.md
│   ├── pre-launch/SKILL.md
│   ├── optimize/SKILL.md
│   └── fix/SKILL.md
├── agents/                      # 8 subagentes (§4.2)
├── references/
│   ├── 00-orchestrator.md
│   ├── 01-seo.md … 15-security-appsec.md
│   └── shared/
│       ├── findings.schema.json
│       ├── severity.md
│       ├── report-template.md
│       └── reference-template.md
├── scripts/
│   ├── package.json             # dependências do plugin
│   ├── doctor.sh
│   ├── detect-stack.mjs
│   ├── collect-static.mjs
│   ├── collect-local.mjs
│   ├── collect-remote.mjs
│   ├── validate-findings.mjs
│   └── guard.mjs                # hook de proteção
├── hooks/hooks.json             # se a estratégia escolhida usar hook do plugin
├── tests/
│   ├── fixtures/sample-site/
│   ├── fixtures/expected-findings.json
│   ├── schema/  guard/
│   ├── run-fixture.sh
│   └── compare.mjs
├── docs/
│   ├── SPEC.md  DECISIONS.md  USAGE.md  SPECIALISTS.md
├── README.md  ARCHITECTURE.md  ROADMAP.md  CONTRIBUTING.md  CHANGELOG.md
└── .gitignore
```

---

## 4. Especialistas

### 4.1 Áreas, arquivos e fronteiras

Cada verificação tem **uma única área dona**. Outras áreas apenas referenciam o ID (`related_ids`).

| ID | Área | Arquivo | Prefixo | Escopo (fronteira) |
|---|---|---|---|---|
| 00 | Orquestrador | `00-orchestrator.md` | — | Regras do fluxo. Não audita. |
| 01 | SEO | `01-seo.md` | `SEO` | Rastreamento e indexação em buscadores tradicionais: robots, sitemap, canonical, `noindex` esquecido, títulos/descrições, headings, URLs, links internos, redirects, hreflang, validade técnica de dados estruturados. |
| 02 | GEO | `02-geo.md` | `GEO` | Chance de ser citado por motores generativos (AI Overviews/AI Mode, ChatGPT search, Perplexity, Claude etc.): clareza de entidades, afirmações citáveis com fonte, dados originais, consistência da marca. |
| 03 | AEO | `03-aeo.md` | `AEO` | Estrutura de resposta direta: perguntas reais, resposta concisa no início das seções, listas/tabelas, trechos em destaque, FAQ como conteúdo (sem prometer rich result), busca por voz. |
| 04 | AIO | `04-aio.md` | `AIO` | Prontidão técnica para crawlers e agentes de IA: regras de robots por user-agent de IA (verificar nomes atuais nas docs oficiais de cada empresa), conteúdo disponível sem JavaScript (SSR/SSG), HTML semântico legível por máquina, `llms.txt` (proposta, não padrão → no máximo OPCIONAL). |
| 05 | CRO e Landing Pages | `05-cro-landing-pages.md` | `CRO` | Proposta de valor, hierarquia, CTAs, fricção em formulários, prova social, objeções, CTA de WhatsApp, experiência mobile. |
| 06 | QA e Pré-lançamento | `06-qa-pre-launch.md` | `QA` | Funcionamento: links quebrados, páginas 404/500, formulários, responsividade (360/768/1440), erros de console, favicon, Open Graph, conteúdo placeholder (lorem ipsum, "TODO"), URLs de staging no código. |
| 07 | Analytics e Tracking | `07-analytics-tracking.md` | `ANL` | GA4/GTM/Meta Pixel instalados corretamente, eventos de conversão, tags duplicadas, UTMs, dados pessoais enviados em eventos. Consentimento é da área 10 (aqui só referencia). |
| 08 | Performance e Core Web Vitals | `08-performance-cwv.md` | `PERF` | LCP, INP, CLS (INP substituiu FID), imagens, fontes, JS/CSS, cache, compressão, scripts de terceiros. Laboratório ≠ campo. |
| 09 | Acessibilidade | `09-accessibility.md` | `A11Y` | WCAG 2.2 nível AA como referência; contexto brasileiro (LBI, eMAG) apenas informativo. Ferramentas automáticas cobrem só parte dos critérios. |
| 10 | Privacidade, Cookies e LGPD | `10-privacy-lgpd.md` | `PRIV` | Banner e consentimento, cookies/tags disparados antes do consentimento, política de privacidade, coleta em formulários, terceiros, orientações da ANPD. |
| 11 | SEO Local e Google Business Profile | `11-local-seo-gbp.md` | `LOC` | NAP consistente, schema `LocalBusiness`, página de contato, mapa, sinais locais. Itens do Perfil da Empresa no Google = verificação manual. |
| 12 | Pós-lançamento e Manutenção | `12-post-launch-maintenance.md` | `OPS` | Monitoramento, Search Console/Bing Webmaster, backups, atualização de dependências, SSL/domínio, rotina de revisão. Maioria manual. |
| 13 | Conteúdo e Autoridade | `13-content-authority.md` | `CONT` | Qualidade editorial, E-E-A-T, autoria, datas, fontes, páginas "sobre" e contato, conteúdo raso ou duplicado. |
| 14 | Segurança de APIs e Edge | `14-security-api-edge.md` | `API` | Rotas de API/serverless, CORS, rate limit, autenticação, validação de entrada, headers de segurança (CSP, HSTS, etc.), configuração de hosting/CDN, segredos em variáveis públicas (`NEXT_PUBLIC_`, `VITE_`…). |
| 15 | Segurança de Aplicações Web | `15-security-appsec.md` | `SEC` | OWASP Top 10 no código: XSS, injeção, dependências vulneráveis, segredos no repositório, autenticação/sessão, uploads. |

Regras de fronteira já definidas: headers de segurança → 14; `noindex` esquecido → 01; consentimento → 10; robots para bots de IA → 04; formulário quebrado → 06, fricção do formulário → 05.

### 4.2 Agrupamento em subagentes (proposta inicial — confirmar no checkpoint da Etapa 1)

| Subagente | Referências |
|---|---|
| `search-visibility` | 01, 11 |
| `ai-visibility` | 02, 03, 04, 13 |
| `conversion` | 05, 07 |
| `performance` | 08 |
| `accessibility` | 09 |
| `privacy` | 10 |
| `security` | 14, 15 |
| `release-qa` | 06, 12 |

Critério: agrupar áreas que leem as mesmas evidências; separar áreas com raciocínio muito diferente. O subagente lê **apenas** as referências das áreas selecionadas para aquela execução.

---

## 5. Criação das referências (os especialistas são escritos do zero)

- Não existem arquivos prévios. Cada referência é escrita a partir de **fontes oficiais consultadas no momento** (WebFetch/WebSearch), não de memória.
- Fontes prioritárias: Google Search Central, web.dev, Chrome for Developers (Lighthouse), schema.org, Bing Webmaster, docs oficiais dos crawlers de IA, W3C (WCAG 2.2, WAI-ARIA APG), MDN, OWASP (Top 10, ASVS, API Security, Cheat Sheets), Planalto (LGPD — Lei 13.709/2018), ANPD (guias orientativos), docs oficiais de hosting (Vercel, Netlify, Cloudflare), Ajuda do Perfil da Empresa no Google. Para CRO, onde há pouca fonte oficial: pesquisa reconhecida (ex.: Nielsen Norman Group, Baymard), marcada como prática.
- Todo limiar numérico ou regra técnica relevante tem fonte (URL + data de acesso).
- Separar sempre **"documentado oficialmente"** de **"prática recomendada sem garantia"**. A segunda categoria tem severidade máxima MELHORIA.
- Não recomendar recursos descontinuados (verificar status atual de cada recurso citado).
- Texto denso e operacional, sem introduções genéricas.

### 5.1 Estrutura obrigatória de cada referência

1. **Escopo e fronteiras** (o que é desta área e o que pertence a outras)
2. **Quando acionar** (sinais no projeto que tornam a área aplicável ou não aplicável)
3. **Verificações** — cada item com:
   - ID estável (`SEO-C01`, `A11Y-C07`…)
   - o que verificar
   - como verificar: `estática` / `ativa-local` / `ativa-remota` / `manual`
   - evidência esperada
   - severidade padrão e quando sobe ou desce
   - correção recomendada (por stack quando fizer diferença)
   - critério de validação
4. **Falsos positivos e armadilhas**
5. **Variações por stack** (Next.js, Astro, Vite/React, HTML estático, outros)
6. **O que nunca afirmar**
7. **Fontes** (URL + data de acesso)

---

## 6. Fluxo do orquestrador (comum a todas as skills)

**Fase 0 — Preparação**
- Alvo = raiz git do diretório atual (ou o próprio diretório, se não houver git). Se o alvo for o diretório do plugin, **pare** e explique.
- Registrar commit atual, branch e se há alterações não commitadas.
- Criar `.webaudit/runs/<AAAA-MM-DD_HHMM>/` no alvo e adicionar `.webaudit/` ao `.git/info/exclude` do alvo (não altera `.gitignore` nem arquivos versionados).
- Ativar a proteção do modo leitura (§9).

**Fase 1 — Reconhecimento**: stack, framework, scripts de build/dev/preview, rotas/páginas, config de hosting, APIs, formulários, analytics, idioma, tipo de site (landing, institucional, blog, e-commerce, negócio local). Saída: `context.json`.

**Fase 2 — Seleção**: matriz área × sinais (em `00-orchestrator.md`). `audit` = todas as aplicáveis; `pre-launch` = foco definido na skill; `optimize` = derivadas do objetivo; `--areas` sobrescreve. Registrar áreas excluídas e o motivo.

**Fase 3 — Coleta**: estática sempre; ativa-local se aprovada; ativa-remota só com `--url` (§8). Saídas em `raw/`, cada uma com ferramenta, versão, comando e horário. Falha de ferramenta = registro do erro, nunca dado estimado.

**Fase 4 — Análise**: delegar em paralelo **somente** aos subagentes necessários. Cada um recebe caminho do `context.json`, de `raw/` e a lista exata de referências a ler. A sessão principal não lê referências de especialistas (economia de contexto).

**Fase 5 — Consolidação**: validar com `validate-findings.mjs`; deduplicar (mesmo arquivo + mesmo check, ou mesma causa raiz → um achado com `related_ids`); conflitos entre áreas (ex.: widget de chat ajuda CRO, prejudica performance) são apresentados como trade-off explícito, nunca resolvidos em silêncio; atribuir IDs finais; ordenar.

**Fase 6 — Relatório**: `report.md` + `findings.json` no run dir; atualizar `.webaudit/latest` (arquivo com o ID do run); desativar a proteção.

**Fase 7 — Resposta no chat**: resumo executivo curto, críticos, caminho do relatório e próximo comando sugerido (ex.: `/ai-webaudit:fix WA-SEC-001 WA-PRIV-002`).

---

## 7. Formato dos achados

### 7.1 Classificações

| Campo | Valores | Regra |
|---|---|---|
| `severity` | `CRITICO`, `IMPORTANTE`, `MELHORIA`, `OPCIONAL` | CRÍTICO: falha grave de segurança, funcionamento, privacidade ou publicação, com evidência concreta. |
| `nature` | `CONFIRMADO`, `RISCO_POTENCIAL`, `PREVENTIVO` | CRÍTICO exige CONFIRMADO, ou risco de segurança/privacidade com evidência concreta no código. |
| `verification` | `estatica`, `ativa-local`, `ativa-remota`, `manual-pendente` | — |
| `effort` | `P`, `M`, `G` | Estimativa qualitativa, sem horas. |
| `fix_status` | `aberto`, `autorizado`, `corrigido`, `validado`, `falhou-validacao`, `descartado` | Atualizado pelo `/fix`. |

Achado sem evidência verificável não entra na lista: vai para a seção "Não testado / verificar manualmente". Não criar problemas para preencher categorias.

### 7.2 IDs

- Achado: `WA-<PREFIXO>-<NNN>` (ex.: `WA-SEO-003`), único dentro do run. Prefixos da tabela §4.1.
- Verificação (na referência): `<PREFIXO>-C<NN>` (ex.: `SEO-C04`). Todo achado aponta seu `check_id`.
- `/fix` usa o run em `.webaudit/latest`, salvo `--run <id>`.

### 7.3 Campos de cada achado (`findings.json`)

`id`, `check_id`, `area`, `title`, `description`, `severity`, `nature`, `verification`, `evidence` (`type`, `file`, `line`, `snippet`, `command`, `output_excerpt`, `raw_ref`), `impact`, `recommendation`, `validation_criteria`, `effort`, `fix_status`, `related_ids`, `tradeoffs`.

Metadados do run: `run_id`, `skill`, `arguments`, `target_path`, `git` (commit, branch, dirty), `stack`, `collection_modes`, `areas_selected`, `areas_excluded` (com motivo), `tools` (nome, versão, status), `not_tested` (lista), `generated_at`.

**Segredos encontrados como evidência são mascarados** (no máximo os 4 primeiros caracteres + `****`).

### 7.4 Estrutura do `report.md`

1. Cabeçalho: projeto, data, commit, branch, stack, skill, modos de coleta
2. Resumo executivo (5–10 linhas) e contagem por severidade. Em `pre-launch`: **"Bloqueadores conhecidos: SIM (n) / NÃO IDENTIFICADOS"** — nunca "site pronto/sem problemas"
3. Ordem prática de correção
4. Achados por severidade (tabela-resumo + detalhe)
5. O que foi testado e como (ferramentas e versões)
6. Não testado / verificação manual pendente
7. Áreas não acionadas e motivo
8. Aviso: não é certificação de segurança, acessibilidade ou conformidade legal

Idioma: pt-BR. Identificadores, comandos e nomes de campo em inglês.

---

## 8. Coleta e argumentos

### 8.1 Estática (sempre)
Leitura de código, configs, build output existente, robots/sitemap locais, headers declarados em arquivos de hosting, busca de padrões de segredo.

### 8.2 Ativa-local (padrão quando possível)
- Antes de rodar build/servidor do alvo, mostrar os comandos e **pedir confirmação uma vez**.
- Servidor somente em `localhost`; encerrar ao final.
- Ferramentas (dependências do plugin em `scripts/`): Lighthouse (mobile e desktop, até 3 páginas principais), axe via Playwright, screenshots em 360/768/1440, erros de console, links internos quebrados.
- Se não for possível: seguir só com estática e marcar o que ficou sem teste.

### 8.3 Ativa-remota (opt-in com `--url`)
- Apenas requisições GET: headers, `robots.txt`, `sitemap.xml`, HTML das páginas, Lighthouse em até 3 URLs.
- Máximo de 20 páginas, 1 requisição por segundo, user-agent identificado (`AI-WebAudit/<versão>`).
- Proibido: envio de formulários, scanners, fuzzing, força bruta, payloads de ataque, qualquer teste invasivo.

### 8.4 Argumentos das skills

| Skill | Argumentos |
|---|---|
| `audit` | `[--url <url>] [--areas seo,a11y,…] [--static-only] [--no-build]` |
| `pre-launch` | mesmos de `audit` |
| `optimize` | `<objetivo em texto livre> [--url <url>] [--static-only]` |
| `fix` | `<IDs…> \| --all-critical` `[--run <id>]` |

### 8.5 Dependências
- Ficam em `scripts/package.json` do plugin (versões fixadas), instaladas uma vez por `scripts/doctor.sh --install`.
- **Nunca** instalar nada no projeto alvo durante auditorias.

---

## 9. Proteções do modo leitura

Camadas (nenhuma sozinha é garantia absoluta; as permissões normais do Claude Code continuam valendo):

1. **Subagentes**: `tools: Read, Grep, Glob` — sem Bash, sem escrita. Toda execução de comando acontece na sessão principal, na fase de coleta.
2. **Skills de leitura** (`audit`, `pre-launch`, `optimize`): escrevem apenas em `.webaudit/` do alvo.
3. **Hook `PreToolUse`** (`scripts/guard.mjs`), durante skills de leitura:
   - bloqueia `Write`/`Edit`/`MultiEdit`/`NotebookEdit` fora de `.webaudit/`;
   - bloqueia Bash com padrões de risco: `git commit|push|reset|checkout --|clean`, `rm -rf`, `sed -i`, instalação de pacotes no alvo (`npm|pnpm|yarn|bun add/install`), redirecionamento para fora de `.webaudit/`, CLIs de deploy (`vercel`, `netlify deploy`, `firebase deploy`, `wrangler deploy`…).
   - **Estratégia preferida**: hooks declarados no frontmatter da skill, se a documentação oficial suportar (ativos só durante a skill).
   - **Alternativa**: hook do plugin ativo apenas enquanto existir `.webaudit/.lock` (criado na Fase 0, removido na Fase 6, expira em 2 h).
   - **Não usar `allowed-tools` como mecanismo de restrição** sem confirmar na documentação o que ele faz.
4. **Sempre proibido**, inclusive no `/fix`: deploy, push, commit sem autorização explícita, alterar banco de dados, expor segredos, enviar dados privados a serviços externos sem necessidade.

---

## 10. `/ai-webaudit:fix`

1. Ler os achados pedidos no `findings.json` do run.
2. Para cada um, apresentar plano: arquivos, mudança, risco, como validar. Pedir **uma confirmação para o lote** (confirmação individual para mudanças de risco alto).
3. Verificar `git status`; se houver alterações não commitadas, avisar. Sugerir branch `webaudit/fix-<run_id>` e perguntar se deve criar.
4. Aplicar a menor mudança que resolve, preservando arquitetura e estilo do projeto, sem sair do escopo.
5. Validar pelo `validation_criteria` (reexecutar a verificação, build, testes, lint existentes).
6. Atualizar `fix_status` no `findings.json` e registrar em `fix-log.md` (o que mudou, como foi validado, resultado).
7. Não fazer commit sem pedido explícito. Nunca fazer deploy.

---

## 11. Testes do próprio plugin

- **Fixture** `tests/fixtures/sample-site/`: site estático pequeno (HTML/CSS/JS, sem dependências), ~3 páginas, formulário, endpoint exemplo em `api/`, `vercel.json`, `.env` com segredo **obviamente falso** (`FAKE-SECRET-FOR-TESTS-0000`, formato que não dispare secret scanning do GitHub; exceção no `.gitignore`).
- ~25 problemas plantados cobrindo as 15 áreas (pelo menos 1 por área quando verificável no código) e ~8 acertos que **não** podem ser apontados.
- `tests/fixtures/expected-findings.json`: `must_find` (check_id, área, arquivo, severidade mínima) e `must_not_flag`.
- `tests/run-fixture.sh`: copia a fixture para `/tmp/webaudit-fixture-<timestamp>`, faz `git init`, executa a auditoria (headless se suportado; senão, instruções manuais) e roda `tests/compare.mjs`.
- Meta da v0.1: ≥ 80% de `must_find` encontrados e 0 itens de `must_not_flag`.
- **Não ajustar referências com instruções específicas da fixture** (evitar overfitting): melhorias devem ser gerais.

---

## 12. Convenções

- Documentação e relatórios em pt-BR; identificadores técnicos e comandos em inglês.
- Commits **no repositório do plugin** estão autorizados: Conventional Commits (tipo em inglês, descrição em pt-BR). Nos projetos auditados, nada de commit/push sem autorização.
- Versionamento semântico; `CHANGELOG.md` atualizado a cada etapa.
- Nenhum recurso é declarado funcional sem ter sido validado. Limitações vão para `docs/DECISIONS.md` e para o resumo da etapa.

---

## 13. Plano de etapas

| Etapa | Conteúdo |
|---|---|
| 1 | Fundação, documentação oficial, estrutura, GitHub, **checkpoint de arquitetura** |
| 2 | Contrato: schema, severidades, modelos, regras do orquestrador |
| 3 | Referências: busca e IA (01, 02, 03, 04, 11, 13) |
| 4 | Referências: experiência e produto (05, 06, 07, 08, 09, 12) |
| 5 | Referências: privacidade e segurança (10, 14, 15) |
| 6 | Subagentes + fixture com gabarito |
| 7 | Scripts de coleta, doctor e proteção (guard) |
| 8 | Skill `audit` + primeiro teste na fixture |
| 9 | Skills `pre-launch`, `optimize`, `fix` |
| 10 | Validação final, documentação e release v0.1.0 |
