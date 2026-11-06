# 12 — Pós-lançamento e Manutenção

Prefixo: `OPS` · Subagente: `release-qa` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado (Google Search Console, Let's Encrypt, GitHub, npm, RFC); **[PRÁTICA]** = rotina de operação sem fonte normativa consultada → severidade máxima `MELHORIA`.

**Natureza da área.** A **maior parte é `manual`**: depende de contas, painéis e rotinas que o plugin não acessa. Cada item `manual` vira **linha de checklist em `not_tested`** (nunca achado) com ação clara para o dono. Só **poucos itens** têm evidência em código/arquivo (lockfile, configuração de atualização automática, `security.txt`, README operacional). Nenhum achado de OPS chega a `CRITICO` ou `IMPORTANTE` por ausência de rotina; o teto é `MELHORIA`.

## 1. Escopo e fronteiras

- **Desta área:** o que mantém o site saudável **depois** de publicado: propriedades de busca (Search Console, Bing Webmaster), revisão de indexação e de problemas de segurança reportados, **rotina de atualização de dependências**, **renovação de SSL e de domínio**, backups e restauração, monitoramento, `security.txt`, documentação operacional, calendário de revisão.
- **De outras áreas (só referenciar via `related_ids`):**
  - **vulnerabilidades concretas em dependências** (CVE, `npm audit` com resultados) → `SEC`; aqui só o **processo** de manter atualizado
  - headers de segurança (HSTS, CSP), configuração de edge/CDN → `API`
  - `noindex`/`robots`/sitemap/canonical corretos → `SEO`; checks de qualidade pré-publicação → `QA`
  - eventos de analytics, redação de PII → `ANL`; consentimento → `PRIV`
  - dados de campo de performance (CrUX) → `PERF-C02`; atualidade do conteúdo → `CONT-C09`
  - link/formulário quebrado → `QA`
- **Desempate OPS × SEC:** "há **rotina** para atualizar e vigiar dependências, certificados e domínio?" → `OPS`; "há **falha de segurança** comprovada agora?" → `SEC`/`API`.

## 2. Quando acionar

- **Aplicável:** todo projeto que será (ou já foi) publicado; **sempre** no `pre-launch` e no `audit`.
- **Reduzido:** site de teste/portfólio descartável: apenas OPS-C01, C06 e C08 como checklist.
- **Sem repositório remoto/CI:** itens estáticos (OPS-C05, C10, C11) viram observação.

## 3. Verificações

### OPS-C01 — Propriedade verificada no Google Search Console  [OFICIAL; manual]
- **O que verificar (só o dono):** o site está cadastrado e **verificado**. **Propriedade de domínio** cobre todos os protocolos (`http`/`https`) e subdomínios, e **só** verifica por **registro DNS** (TXT/CNAME); **propriedade de prefixo de URL** pode usar arquivo HTML, meta tag, GA ou GTM. **Manter a verificação**: o Search Console rechecha o token periodicamente; se falhar e não for corrigido, as permissões **expiram** após um prazo; remover o arquivo HTML ou o registro DNS **faz perder a verificação**. Se todos os proprietários verificados perderem acesso, todos os usuários perdem o acesso à propriedade.
- **Como verificar:** `manual` → `not_tested` (`OPS-C01`). Evidência estática opcional: presença de meta tag `google-site-verification` ou arquivo `google*.html` no repositório (informar que **não** deve ser removido).
- **Severidade padrão:** não aplicável (checklist). Remoção do token no código (ex.: meta de verificação apagada no layout) → `MELHORIA` (`RISCO_POTENCIAL`).
- **Correção/validação:** o dono verifica a propriedade (preferir domínio por DNS), adiciona mais de um proprietário e confirma acesso.
- Fonte: F1.

### OPS-C02 — Sitemap enviado e relatório de indexação revisado  [OFICIAL; manual]
- **O que verificar (só o dono):** sitemap enviado no Search Console (relatório "Sitemaps") ou referenciado no `robots.txt`; relatório **Indexação de páginas**: contagem de páginas indexadas crescendo de forma coerente; motivos de "Não indexada" (5xx, bloqueada por `robots.txt`, `noindex`, soft 404, 401/403/4xx, "Rastreada – atualmente não indexada", "Descoberta – atualmente não indexada", duplicada com canônica indexada, redirecionamento); colunas **Origem** (somente problemas de origem "Website" são corrigíveis pelo dono). Fluxo de **validar correção**: o Search Console testa amostras e, se persistir o problema, interrompe; a validação costuma levar **cerca de duas semanas**, às vezes mais. O Google sugere aguardar **de alguns dias a uma semana** para novas páginas serem rastreadas e só pedir novo rastreio se uma mudança importante não for notada após **uma semana ou mais**; não há cadência oficial de revisão.
- **Como verificar:** `manual` → `not_tested` (`OPS-C02`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono revisa os relatórios e informa os motivos de não indexação; causas técnicas viram achados em `SEO`.
- **Nunca** afirmar que o site "está indexado" sem esse relatório.
- Fonte: F2.

### OPS-C03 — Problemas de segurança e ações manuais no Search Console  [OFICIAL; manual]
- **O que verificar (só o dono):** relatório **Problemas de segurança** (conteúdo invadido, *malware*/software indesejado, engenharia social, com exemplos de URLs afetados; revisão por **e-mail**; corrigir **em todo o site** e **todos** os problemas antes de "Solicitar revisão"; **não reenviar** antes da decisão, revisões levam de **alguns dias a algumas semanas**) e **Ações manuais** (tentativas de manipulação do índice; notificação no relatório e na central de mensagens). Checar também e-mails do Search Console.
- **Como verificar:** `manual` → `not_tested` (`OPS-C03`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono confirma "nenhum problema" ou executa o fluxo de correção e revisão; achados técnicos (injeção, código malicioso) → `SEC`.
- Fonte: F3, F4.

### OPS-C04 — Bing Webmaster Tools  [OFICIAL parcial; manual]
- **O que verificar (só o dono):** site cadastrado, sitemap enviado e relatório **AI Performance** (citações totais, páginas citadas, *grounding queries* por amostragem; **não indica ranking nem importância da página**; pré-visualização pública desde 10/02/2026); para negócio local, perfil no **Bing Places**. As páginas de ajuda do Bing Webmaster **não puderam ser lidas** nesta revisão: não detalhar procedimentos além dos acima.
- **Como verificar:** `manual` → `not_tested` (`OPS-C04`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono confirma cadastro e acesso aos relatórios.
- Fonte: F5.

### OPS-C05 — Rotina de atualização de dependências  [OFICIAL parcial + PRÁTICA]
- **O que verificar (estático):** `package-lock.json`/`pnpm-lock.yaml`/`yarn.lock` **versionado** (o `npm audit` exige lockfile por padrão; sem ele os resultados variam a cada execução); automação de atualização configurada (`.github/dependabot.yml` ou `renovate.json`); **Dependabot alerts** habilitado no repositório (varre a branch padrão e gera alerta quando uma nova vulnerabilidade entra no GitHub Advisory Database **ou** o grafo de dependências muda; **só advisories revisados pelo GitHub geram alerta**; novos podem demorar a aparecer; mantenha *manifest* e *lockfile* atualizados para detecção correta; ações do GitHub só geram alerta com versionamento semântico, não com SHA); versões fixadas sem processo de revisão. **`npm audit fix --force` não deve ser aplicado sem revisão** (pode causar mudanças *major*).
- **Como verificar:** `estatica` (arquivos de lock e de configuração); habilitação de alertas no GitHub → `manual`.
- **Evidência esperada:** ausência de lockfile; ausência de configuração de atualização automática (`file`).
- **Severidade padrão:** `MELHORIA` (`PREVENTIVO`); `OPCIONAL` quando o projeto é estático sem dependências.
- **Correção:** versionar o lockfile; ativar Dependabot/Renovate; revisar PRs de atualização com testes. **Validação:** PRs de atualização chegando e build passando.
- **Vulnerabilidades reais** (resultado de auditoria) → `SEC`; **nunca** instalar ou atualizar dependências do alvo durante a auditoria (SPEC §8.5).
- Fonte: F6, F7.

### OPS-C06 — Renovação de certificado SSL/TLS  [OFICIAL parcial; manual]
- **O que verificar:** o certificado se renova **automaticamente**. Let's Encrypt: certificados padrão valem **90 dias** (opção de seis dias); renovar a cada **cerca de 60 dias** (ou ~3 dias para seis dias), com **cliente ACME** automático (Certbot recomendado) e **horário aleatório**. Em hospedagens gerenciadas (Vercel, Netlify, Cloudflare Pages etc.), a renovação costuma ser da plataforma — **a documentação desses provedores não foi consultada**; confirmar no painel. Procurar no repositório scripts/cron de renovação (`certbot renew`) e domínios customizados sem certificado.
- **Como verificar:** `manual` → `not_tested` (`OPS-C06`); `estatica` para scripts de renovação; leitura da data de validade do certificado só se a coleta remota (Etapa 7) a registrar em `raw/`.
- **Severidade padrão:** `MELHORIA` (`PREVENTIVO`) para renovação manual comprovada no código; caso contrário, apenas checklist.
- **Correção/validação:** ativar renovação automática e alerta antes do vencimento. **Validação:** data de expiração futura e renovação recente confirmadas pelo dono.
- HSTS/headers → `API`; HTTP→HTTPS → `SEO-C12`.
- Fonte: F8.

### OPS-C07 — Domínio, DNS e contas  [PRÁTICA; manual]
- **O que verificar (só o dono):** data de **vencimento do domínio**, **renovação automática** ativa, forma de pagamento válida, e-mail do registrante/contato **acessível** (avisos de vencimento chegam nele), acesso ao provedor de DNS e ao registro, **autenticação em dois fatores** em registrador, DNS, hospedagem, repositório, Search Console e analytics; lista de quem tem acesso (remover ex-colaboradores/fornecedores). **Nenhuma fonte oficial foi obtida** nesta revisão (página do ICANN indisponível) — tratar como prática.
- **Como verificar:** `manual` → `not_tested` (`OPS-C07`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono registra datas de vencimento num calendário e confirma o 2FA.
- Fonte: —

### OPS-C08 — Backups e teste de restauração  [PRÁTICA; manual]
- **O que verificar (só o dono):** o que **não** está no repositório e precisa de backup — banco de dados, uploads/mídia, configurações, variáveis de ambiente e segredos (em cofre), conteúdo de CMS, DNS; frequência compatível com a taxa de mudança; cópia **fora** do ambiente de produção; **teste de restauração** realizado (backup sem restauração testada não é garantia); responsável definido. O código no repositório remoto privado é uma cópia, mas **não** substitui o backup de dados. **Fontes consultadas (CISA, NCSC) não puderam ser lidas** (404/página parcial): sem regra numérica citada.
- **Como verificar:** `manual` → `not_tested` (`OPS-C08`); `estatica` apenas para detectar banco/uploads no projeto (ex.: SQLite, pasta de uploads, `docker-compose` com volume) e avisar.
- **Evidência esperada:** `file` que indica dados fora do Git sem política de backup visível.
- **Severidade padrão:** `MELHORIA` (`PREVENTIVO`) quando o projeto armazena dados persistentes sem menção a backup; caso contrário, checklist.
- **Correção/validação:** o dono define rotina e executa uma restauração de teste; registra data. **Nunca** executar backup/restauração pelo plugin.
- Fonte: —

### OPS-C09 — Monitoramento e alertas  [PRÁTICA; manual]
- **O que verificar (só o dono):** monitor de **disponibilidade** (uptime) com alerta para uma pessoa real; captura de **erros** de front-end e back-end; alerta de falha de formulário/e-mail; revisão das mensagens do Search Console; dashboard de analytics com alerta de queda abrupta; teste periódico do fluxo principal (compra/contato). Nenhuma fonte oficial neutra consultada; escolha de ferramenta é do dono.
- **Como verificar:** `manual` → `not_tested` (`OPS-C09`); `estatica` para detectar SDK de monitoramento no código (informativo).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono configura e testa o alerta (simulando uma falha).
- Fonte: —

### OPS-C10 — `security.txt`  [OFICIAL (RFC informativa)]
- **O que verificar:** `/.well-known/security.txt` (opcionalmente cópia/redirecionamento em `/security.txt`; o de `/.well-known/` prevalece), servido por **HTTPS**, `text/plain; charset=utf-8`, com **`Contact`** (URI: `mailto:`, `tel:` ou `https://`) e **`Expires`** (data-hora RFC 3339, **menos de um ano** à frente) — ambos obrigatórios, `Expires` uma única vez; campos opcionais (`Policy`, `Encryption`, `Canonical`, `Acknowledgments`, `Preferred-Languages`). **A RFC 9116 é informativa**, não é padrão da Internet. **Arquivo expirado/desatualizado pode ser pior que não ter** (a própria RFC). **Ausência não é falha.**
- **Como verificar:** `estatica` (pasta `public/.well-known/`); `ativa-remota` para o servido.
- **Evidência esperada:** `file:line` do campo `Expires` vencido ou `Contact` ausente.
- **Severidade padrão:** `OPCIONAL` (ausência); `MELHORIA` quando existe, mas **expirado** ou sem `Contact`/`Expires`.
- **Correção:** manter só se houver quem monitore o contato; renovar `Expires`. **Validação:** campos obrigatórios presentes e `Expires` futuro.
- Fonte: F9.

### OPS-C11 — Documentação operacional (runbook)  [PRÁTICA]
- **O que verificar:** README ou documento com: como publicar e **reverter** (rollback), variáveis de ambiente necessárias (sem valores), onde estão DNS/hospedagem/analytics, **quem tem acesso**, contatos de emergência, datas de vencimento (domínio, certificado), como rodar testes/build. Segredos **nunca** no documento.
- **Como verificar:** `estatica` (README, `docs/`).
- **Evidência esperada:** ausência de seção de operação; segredos no README (→ `SEC`).
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` se há várias integrações (e-mail, pagamento, CMS) sem nenhuma documentação.
- **Correção:** criar seção "Operação" com os itens acima, preenchida pelo dono. **Validação:** uma pessoa nova consegue publicar e reverter seguindo o documento.
- Fonte: —

### OPS-C12 — Checklist pós-publicação imediato (primeiras 24–72 h)  [OFICIAL parcial + PRÁTICA; manual]
- **O que verificar (só humano, com `not_tested` por item):**
  1. `robots.txt` e `noindex` **corretos em produção** (sem restos de staging) → `SEO-C01`/`SEO-C02`;
  2. sitemap enviado e acessível → `OPS-C02`/`SEO-C05`;
  3. HTTPS válido e redirecionamento `http`→`https`/`www` → `OPS-C06`/`SEO-C12`;
  4. envio **real** de formulário e recebimento da mensagem → `QA-C14`;
  5. eventos de conversão chegando (Realtime/DebugView, Events Manager) → `ANL-C10`;
  6. canonical e Open Graph com o domínio de produção → `SEO-C06`/`QA-C09`;
  7. 404 personalizada e redirects antigos → `QA-C03`/`SEO-C12`;
  8. nenhum erro de console/rede em produção → `QA-C06`;
  9. verificação do Search Console feita → `OPS-C01`;
  10. alertas de monitoramento ativos → `OPS-C09`.
- **Como verificar:** `manual` → `not_tested` (`OPS-C12`), cada item citando o check dono.
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono marca cada item com data e responsável.
- Fonte: F1, F2 (partes); demais sem fonte.

### OPS-C13 — Calendário de revisão recorrente  [PRÁTICA; manual]
- **O que verificar (só o dono):** existe rotina com responsável. **Sugestão de pauta** (periodicidade é decisão do dono; **não há cadência oficial**): relatório de Indexação e Problemas de segurança (`OPS-C02/C03`); disponibilidade e erros (`OPS-C09`); teste do formulário e do WhatsApp (`QA-C14`, `CRO-C08`); eventos de conversão (`ANL-C10`); dependências e alertas (`OPS-C05`); vencimento de domínio e certificado (`OPS-C06/C07`); backup e **teste de restauração** (`OPS-C08`); links quebrados (`QA-C01`); conteúdo desatualizado (`CONT-C09`); dados de campo de performance (`PERF-C02`).
- **Como verificar:** `manual` → `not_tested` (`OPS-C13`).
- **Severidade padrão:** não aplicável.
- **Correção/validação:** o dono cria lembretes recorrentes e registra a data da última revisão.
- Fonte: —

## 4. Falsos positivos e armadilhas

- Ausência de lockfile em site estático **sem dependências** não é falha.
- Plataformas gerenciadas renovam certificado e fazem *deploy* atômico: a falta de `certbot` no repositório é esperada.
- `security.txt` ausente é comum e válido; não pressionar.
- Meta tag/arquivo de verificação do Search Console no código é **intencional**; só alertar quando for removido.
- **Nenhum item de OPS vira achado sem evidência**: a falta de rotina que o plugin não consegue observar é `not_tested`, nunca "não existe".
- Alertas do Dependabot ausentes **não** significam "sem vulnerabilidades" (só advisories revisados; atraso na base).

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | Hospedagem típica (Vercel/Node): certificado e deploy pela plataforma; `package.json` com dependências → OPS-C05; variáveis de ambiente por ambiente. |
| Astro | Geralmente estático: poucas dependências; adaptadores SSR exigem monitoramento. |
| Vite/React (SPA) | Hospedagem estática; fallback de SPA e 404; dependências de build → OPS-C05. |
| HTML estático | Menos manutenção de código; foco em domínio, certificado, formulário externo e backup do conteúdo. |
| Outros (WordPress etc.) | Atualização de núcleo/plugins/tema é rotina crítica; backups de banco e uploads obrigatórios (OPS-C08); `wp-admin` com 2FA. |

## 6. O que nunca afirmar

- "Site monitorado", "backup ok", "certificado renovado", "domínio protegido" ou "dependências seguras" sem confirmação do dono ou evidência registrada.
- Que o site "está indexado"/"sem problemas de segurança no Google" sem os relatórios do Search Console.
- Que ausência de alertas do Dependabot = ausência de vulnerabilidades.
- Prazos de recrawl ou de revisão como garantia (o Google dá faixas aproximadas).
- Cadências ("revisar toda semana") como exigência oficial.
- Procedimentos do Bing Webmaster ou de hospedagens cujas páginas não foram lidas.
- Que o plugin executou ou testou backup, restauração, renovação de certificado ou monitoramento.

## 7. Fontes

- F1 — Google Search Console Help, Verify your site ownership — https://support.google.com/webmasters/answer/9008080 — acessado em 2026-11-05
- F2 — Google Search Console Help, Page indexing report — https://support.google.com/webmasters/answer/7440203 — 2026-11-05
- F3 — Google Search Console Help, Security Issues report — https://support.google.com/webmasters/answer/9044101 — 2026-11-05
- F4 — Google Search Console Help, Manual actions report (referência ao Security Issues report) — https://support.google.com/webmasters/answer/9044175 — 2026-11-05
- F5 — Microsoft Bing, Introducing AI Performance in Bing Webmaster Tools Public Preview (10/02/2026) — https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview — 2026-11-05
- F6 — GitHub Docs, About Dependabot alerts — https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts — 2026-11-05
- F7 — npm Docs, `npm audit` (v10) — https://docs.npmjs.com/cli/v10/commands/npm-audit — 2026-11-05
- F8 — Let's Encrypt, FAQ (validade de 90 dias, renovação ~60 dias, cliente ACME) — https://letsencrypt.org/docs/faq/ — 2026-11-05
- F9 — IETF, RFC 9116, A File Format to Aid in Security Vulnerability Disclosure (`security.txt`; Informational, 2022) — https://www.rfc-editor.org/rfc/rfc9116 — 2026-11-05
- Falha ao buscar/ler: CISA — Data Backup Options (404); NCSC UK — backups (404; página inicial sem o conteúdo); ICANN — expiração de domínio (redirecionou para arquivo, **não lido**); páginas de ajuda do Bing Webmaster (retornaram só o título). Itens de backup, domínio e monitoramento ficam **sem fonte** e como prática.
- Não consultado: documentação de renovação de certificado de Vercel/Netlify/Cloudflare; ferramentas de uptime/erros; Renovate.
