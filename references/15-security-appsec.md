# 15 — Segurança de Aplicações Web (AppSec)

Prefixo: `SEC` · Subagente: `security` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado pelo OWASP (Top 10:2025, Cheat Sheet Series) ou documentação oficial do fornecedor; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Regras de segurança desta referência (SPEC §8.3, §9).**
- **Só detecção segura e não invasiva:** leitura de código e configuração; busca estática de padrões; histórico git **somente leitura**. Nenhuma verificação pede execução de código do alvo, ataque, *payload*, *fuzzing*, força bruta ou teste contra site publicado. Esta referência descreve **como detectar no código e como corrigir**, **nunca** como explorar. Os exemplos de padrão abaixo servem para **reconhecer** o risco.
- **Isto não é teste de intrusão, revisão de código completa nem certificação de segurança.** Ausência de achados **não** significa ausência de vulnerabilidades (o plugin lê parte do código e não executa o app).
- **Segredos** viram evidência **mascarada** (≤ 4 primeiros caracteres + `****`, SPEC §7.3), em `snippet`, relatório, `raw/` e chat. **Nunca** copiar o valor inteiro.
- **CRITICO** exige evidência concreta (`file` + `snippet`) de falha grave **ou** `CONFIRMADO` (SPEC §7.1). Padrão "suspeito" sem evidência de fluxo vai para `IMPORTANTE`/`RISCO_POTENCIAL` ou `not_tested`.
- **O plugin nunca altera credenciais, nunca revoga chaves e nunca reescreve o histórico git**: orienta o dono.

## 1. Escopo e fronteiras

- **Desta área (OWASP Top 10 no código):** segredos no repositório e no histórico; dependências vulneráveis e cadeia de suprimentos; XSS; injeção (SQL e demais); autenticação (senhas, política, proteção) e **sessão/cookies**; CSRF; uploads; tratamento de exceções que "falha aberto"; registro de eventos com dados sensíveis.
- **Mapa do OWASP Top 10:2025** (edição atual; SSRF foi **incorporado** ao A01; texto das categorias **não** foi lido na íntegra, só os títulos): A01 Broken Access Control · A02 Security Misconfiguration · A03 Software Supply Chain Failures · A04 Cryptographic Failures · A05 Injection · A06 Insecure Design · A07 Authentication Failures · A08 Software or Data Integrity Failures · A09 Security Logging & Alerting Failures · A10 Mishandling of Exceptional Conditions.
  - A01 → `API-C08` (autorização por endpoint), `API-C13` (SSRF), `SEC-C07` (CSRF) · A02 → `API` (headers/config) · A03 → `SEC-C02`, `SEC-C11` · A04 → `SEC-C05` · A05 → `SEC-C03`, `SEC-C04` · A06 → não coberto por verificação automática · A07 → `SEC-C05`, `SEC-C06` · A08 → `SEC-C11` · A09 → `SEC-C10` · A10 → `SEC-C09`.
- **De outras áreas (só referenciar via `related_ids`):**
  - **headers de segurança** (HSTS, CSP, `nosniff`, `frame-ancestors`…), CORS, autorização por endpoint/BOLA, *rate limit*, erros genéricos em API, **segredos em variáveis públicas** (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`), SSRF → `API`
  - consentimento, dados pessoais, base legal → `PRIV`; PII em analytics → `ANL-C08`
  - renovação de certificado, rotina de atualização, backups → `OPS`
  - `lorem ipsum`/placeholders, build, console → `QA`
- **Desempates:**
  - **SEC × API (segredos):** segredo **no repositório ou no histórico git** = `SEC-C01`; segredo **no código/variável que vai ao navegador** = `API-C11`.
  - **SEC × API (autenticação):** fluxo de login, senha, sessão, cookie, MFA, CSRF = `SEC`; autorização/autenticação **por endpoint** e acesso a objetos por ID = `API-C08`.
  - **SEC × OPS (dependências):** vulnerabilidade **concreta** = `SEC-C02`; **rotina** de atualizar/vigiar = `OPS-C05`.

## 2. Quando acionar

- **Aplicável:** qualquer projeto com código além de HTML estático (JS/TS, PHP, Python, Ruby…), `package.json` ou arquivos de dependência, `.env*`, autenticação, banco de dados, formulários que gravam, uploads, funções serverless.
- **Reduzido:** HTML estático puro sem JS próprio, dependências ou segredos → só `SEC-C01` (varredura de segredos) e `SEC-C11` (cadeia de suprimentos em *scripts* de terceiros); demais em `areas_excluded` com motivo.
- **Coleta:** `estatica` sempre. `npm audit` (`SEC-C02`) é **ativa-local** e **envia ao registro do npm a lista de dependências** (nomes/versões): pedir **confirmação** antes (SPEC §9.4: não enviar dados do projeto a serviços externos sem necessidade) e **não** executar `npm install`/`audit fix` no alvo. Varredura do histórico git: somente comandos de leitura.

## 3. Verificações

### SEC-C01 — Segredos no repositório e no histórico git  [OFICIAL]
- **O que verificar:** chaves de API, tokens, senhas, strings de conexão, chaves privadas (`-----BEGIN … PRIVATE KEY-----`), segredos de *webhook* e arquivos **`.env*` versionados** (fora de `.env.example` com valores vazios); credenciais **no histórico** (`git log --all` apenas leitura, `git grep` em *commits* antigos). **Prioridade da resposta a vazamento (OWASP Secrets Management, §9.2): 1) revogar imediatamente; 2) rotacionar e implantar novo; 3) remover do sistema exposto.** O OWASP **não** declara a limpeza do histórico como correção suficiente e avisa que reescrever o histórico "pode introduzir outros problemas e quebra links para *commits*"; o GitHub afirma que remover do histórico "é demorado e muitas vezes desnecessário **depois** da credencial revogada". Recomenda ainda detecção de segredos **antes do commit** (*pre-commit*) e **varredura de segredos** do GitHub (examina todo o histórico e todas as *branches*; **grátis em repositórios públicos**; em privados exige GitHub Secret Protection em planos Team/Enterprise; *push protection* **não foi confirmado** nas fontes lidas).
- **Como verificar:** `estatica` (padrões de alta confiança: prefixos conhecidos de provedores, blocos de chave privada, `password=`/`secret=`/`token=` com valor longo; `.gitignore` sem `.env*`); histórico por leitura do git.
- **Evidência esperada:** `file:line` + trecho **mascarado**; *commit* (hash curto) onde apareceu; **nunca o valor**.
- **Severidade padrão:**
  - **`CRITICO` (`CONFIRMADO`)**: valor com **forma inequívoca de credencial real** (prefixo de provedor, chave privada) em arquivo **versionado na árvore atual**, com `file` + trecho mascarado;
  - `IMPORTANTE` (`RISCO_POTENCIAL`): segredo **apenas no histórico** (pode já estar revogado — o plugin não sabe) ou formato duvidoso; `.env` com valores **versionado**;
  - `MELHORIA`: valores com **marcador explícito de falso/modelo** (`FAKE`, `EXAMPLE`, `CHANGEME`, `xxxx`, `YOUR_KEY`) ou chaves **de teste** de provedor — registrar como **padrão de segredo versionado**, não como credencial utilizável; `.env` não ignorado no `.gitignore` sem segredo.
- **Correção:** **revogar e rotacionar primeiro**; depois mover para variável de ambiente/cofre de segredos; adicionar `.env*` ao `.gitignore`; habilitar detecção pré-commit e varredura de segredos; **limpar histórico só se necessário** e ciente dos efeitos. **Validação:** nenhuma ocorrência na árvore e (se limpo) no histórico; chave antiga **confirmadamente revogada pelo dono**.
- **Atenção:** o plugin **não testa** se a credencial funciona e **não** a revoga. Um repositório **público** torna qualquer segredo versionado imediatamente exposto — tratar como urgente.
- Relacionado: `API-C11`, `API-C12`.
- Fonte: F1, F2.

### SEC-C02 — Dependências com vulnerabilidades conhecidas  [OFICIAL]
- **O que verificar:** resultado do `npm audit` (requer `package-lock.json`/`npm-shrinkwrap.json`; sem lockfile os resultados variam entre execuções); `audit` envia ao registro a descrição das dependências e retorna **vulnerabilidades conhecidas** e remediações; limitações: dados vêm do registro, pacotes sem `version` são ignorados, tipos omitidos (`--omit`) não são auditados, algumas vulnerabilidades **exigem intervenção manual**. Classificar por **gravidade do aviso** (`info`…`critical`), **tipo da dependência** (execução × desenvolvimento) e se o **código afetado é usado** pelo projeto. Outros ecossistemas (`pip-audit`, `composer audit`, `bundler-audit`, OSV): **não consultados** nesta revisão → `not_tested` com o motivo.
- **Como verificar:** `ativa-local` (`npm audit --json`, saída em `raw/`, com **aprovação**, sem `fix`); `estatica` para lockfile e versões. Sem lockfile → apontar e registrar `not_tested`.
- **Evidência esperada:** `raw_ref` com pacote, versão, identificador do aviso, gravidade, caminho de dependência, versão corrigida.
- **Severidade padrão:** `IMPORTANTE` para aviso **alto/crítico** em dependência **de execução** sem correção aplicada (`CONFIRMADO` quanto à versão afetada; exploração **não** comprovada);
  - `CRITICO` **somente** com aviso **crítico**, dependência **de execução** e **evidência no código** de que o recurso vulnerável é usado (`file` + `snippet`);
  - `MELHORIA` para avisos baixos/moderados ou dependência **só de desenvolvimento**.
- **Correção:** atualizar para a versão corrigida com testes; `npm audit fix` pode aplicar correções dentro dos intervalos declarados, e **`--force` (mudanças *major*) deve ser evitado sem revisão**; considerar substituir pacotes sem manutenção. **Validação:** nova auditoria sem os avisos tratados; testes do projeto passando.
- **Nunca** rodar `npm install`/`audit fix` no projeto auditado (SPEC §8.5); correções cabem ao `/fix` com autorização.
- Rotina de atualização → `OPS-C05`.
- Fonte: F3, F4.

### SEC-C03 — XSS: saídas e *sinks* perigosos  [OFICIAL]
- **O que verificar:** dado **não confiável** (parâmetros de URL, corpo de formulário, conteúdo de usuário, dados de API de terceiros, `location.hash`/`search`) chegando a um ***sink*** que interpreta HTML/JS:
  - `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`; `eval()`, `new Function`, `setTimeout`/`setInterval` com **string** dinâmica;
  - "saídas de escape" de *frameworks* (o OWASP lista React `dangerouslySetInnerHTML`, Angular `bypassSecurityTrustAs*`, Lit `unsafeHTML`, Polymer `inner-h-t-m-l`, e *template injection*); `v-html` (Vue), `{{{ }}}`/`|safe`/`{!! !!}` de motores de *template* e equivalentes: **tratar por analogia; a página do OWASP não os lista — conferir a documentação do framework**;
  - atributos `href`/`src` com valor do usuário aceitando `javascript:`;
  - dado não confiável dentro de `<script>`, comentário HTML ou CSS.
  **Preferir** sinks de texto (`textContent`, `createTextNode`, `setAttribute` com nome fixo); **codificação por contexto** (corpo HTML, atributo, JS, URL, CSS); se o usuário precisa enviar HTML, **sanitizar com DOMPurify** antes de inserir e **não modificar** o resultado depois; manter a biblioteca atualizada. **WAF, filtros e CSP são defesa em profundidade, não substitutos** de codificação contextual; cookies `HttpOnly` limitam dano mas **não** impedem a execução de script.
- **Como verificar:** `estatica` (busca por *sinks* + rastreio do valor até a origem dentro do código lido).
- **Evidência esperada:** `file:line` do sink e da origem do dado (trecho mascarado se contiver segredo).
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) para *sink* perigoso com dado de origem **desconhecida**;
  - `CRITICO` (`CONFIRMADO` por código) quando o **mesmo código lido** mostra dado vindo diretamente da requisição/URL/conteúdo de usuário **sem codificação ou sanitização** atingindo o *sink* numa página pública;
  - `MELHORIA` para *sink* alimentado só por constante/conteúdo do próprio projeto.
- **Correção:** usar a renderização padrão do framework (escape automático); `textContent`; DOMPurify quando HTML for inevitável; CSP estrita (→ `API-C02`) como camada extra. **Validação:** nenhum sink perigoso com dado não confiável; revisão de código **pelo dono** e testes do projeto.
- **Atenção:** `dangerouslySetInnerHTML` com HTML **estático do próprio projeto** (ex.: JSON-LD serializado) é comum e, em geral, seguro; verificar a origem do valor.
- Fonte: F5.

### SEC-C04 — Injeção (SQL e demais interpretadores)  [OFICIAL (SQL) + PRÁTICA (demais)]
- **O que verificar:** consultas SQL montadas por **concatenação/interpolação** de dados da requisição (inclusive em ORM com `raw`/`$queryRawUnsafe`/`query("... " + x)`); **ordem de defesas (OWASP SQLi)**: 1) **consultas parametrizadas** (*prepared statements*) — estrutura SQL separada dos valores, vinculados pela API do banco; 2) procedimentos armazenados **seguros** (SQL dinâmico dentro deles precisa da mesma proteção); 3) **validação por lista de permissão** para elementos estruturais que **não** aceitam parâmetro (nomes de tabela/coluna, `ASC`/`DESC`); 4) *escaping* **fortemente desencorajado**. **Não suficientes:** vincular parâmetros **não** substitui autorização; validar **não** torna seguro concatenar; privilégio mínimo limita dano mas **não** previne injeção. Mesma classe (**A05 Injection**) para **comandos do sistema** (`exec`, `spawn` com `shell`, `child_process`, `os.system`), **NoSQL** (operadores vindos do corpo), **LDAP/XPath/template**: as **páginas específicas** do OWASP para esses casos **não foram consultadas** — reportar o padrão (entrada → interpretador) e a correção geral (APIs sem *shell*, listas de permissão, parametrização), sem inventar regras.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` com a montagem da consulta/comando e a origem do dado.
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) quando a origem do dado é incerta;
  - **`CRITICO` (`CONFIRMADO` por código)** quando dado da requisição é **concatenado/interpolado** em consulta SQL ou comando do sistema no **mesmo caminho lido**, sem parametrização nem lista de permissão.
- **Correção:** parametrizar; lista de permissão para ordenação/colunas; evitar *shell*; privilégio mínimo no usuário do banco. **Validação:** nenhuma consulta com concatenação de dado externo; testes do projeto.
- Fonte: F6.

### SEC-C05 — Autenticação: senhas, política e proteção de login  [OFICIAL]
- **O que verificar (apenas se o app tem login próprio):**
  - **armazenamento de senha** (OWASP Password Storage): preferir **Argon2id** (mínimo 19 MiB, 2 iterações, paralelismo 1, ou equivalentes listados); alternativas por ordem: **scrypt** (N=2^17, r=8, p=1), **bcrypt** (fator ≥ 10, limite de 72 bytes — só em legado), **PBKDF2** (HMAC-SHA-256 com 600.000 iterações; só quando FIPS-140 for exigido); *hash* rápido (**MD5, SHA-1, SHA-256 simples**) **não** é adequado; **sal único e aleatório** por senha (bibliotecas maduras gerenciam); *pepper* é camada extra;
  - **política** (OWASP Authentication): senhas com menos de 8 caracteres são fracas com MFA e menos de **15** sem MFA; permitir **pelo menos 64** caracteres; **sem truncar** em silêncio; **sem regras de composição** (maiúscula/número/símbolo); checar contra listas de senhas vazadas/comuns; evitar troca periódica forçada;
  - **mensagens genéricas** ("login ou senha inválidos") e **mesmo status/tempo** para conta inexistente, bloqueada ou senha errada; recuperação de senha com mensagem neutra ("se o e-mail existir…");
  - **proteção contra força bruta**: limitar tentativas (contadores **por conta**, não só por IP), bloqueio/atraso exponencial sem permitir DoS por bloqueio, CAPTCHA só como defesa em profundidade, **MFA** como "de longe a melhor defesa"; **re-autenticar** antes de ações sensíveis; *log* de falhas;
  - login e páginas autenticadas **só por TLS**; **credenciais fixas/padrão** (`admin/admin`) no código.
- **Como verificar:** `estatica` (código de cadastro/login/recuperação; dependências de autenticação).
- **Evidência esperada:** `file:line` do armazenamento/comparação de senha; mensagens de erro diferentes por caso.
- **Severidade padrão:** `MELHORIA` para política/mensagens; `IMPORTANTE` (`CONFIRMADO`) para *hash* rápido/sem sal de senhas de usuários; **`CRITICO` (`CONFIRMADO`)** para senha **em texto puro** (ou criptografia reversível com chave no código) armazenada ou credencial de administrador fixa **no código**.
- **Correção:** usar a biblioteca/serviço de autenticação do framework (preferir soluções maduras a código próprio); Argon2id/scrypt/bcrypt; MFA quando possível. **Validação:** senhas armazenadas só como *hash* lento com sal; mensagens uniformes; testes do projeto.
- **Atenção:** o plugin **não testa** o login. Limite de tentativas no endpoint → `API-C09`.
- Fonte: F7, F8.

### SEC-C06 — Sessão e cookies  [OFICIAL]
- **O que verificar (cookies de sessão/autenticação definidos no código ou na config):** **`Secure`** (só HTTPS); **`HttpOnly`** (bloqueia leitura por script; **não** protege contra CSRF); **`SameSite=Strict`** (preferido) ou `Lax` **definido explicitamente** (defesa em profundidade, **não** substitui token CSRF); prefixo **`__Host-`** (exige `Secure`, **sem** `Domain`, `Path=/`); **sem `Domain`** e `Path` o mais restrito possível; ID de sessão com **≥ 64 bits de entropia** (≥ 16 caracteres hex; gerado por **CSPRNG**; ≥ 128 bits se próprio), sem informação sensível/PII; **regenerar** o ID após login/mudança de privilégio; **tempo ocioso** (referência: ~2–5 min para alto valor, 15–30 min para baixo risco) e **absoluto**, **aplicados no servidor**; **logout invalida a sessão no servidor** (apagar o cookie não basta); **ID de sessão nunca na URL**. **Não** implementar gerador de sessão próprio quando o framework oferece.
- **Como verificar:** `estatica` (`Set-Cookie`, `cookies.set`, opções de `express-session`/`next-auth`/framework); atributos reais por `ativa-local`/`ativa-remota` quando o cabeçalho é emitido na página pública.
- **Evidência esperada:** `file:line` da definição; `Set-Cookie` observado **com valor mascarado**.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) para cookie de **sessão/autenticação** sem `Secure` ou sem `HttpOnly`, ou ID de sessão em URL; `MELHORIA` para `SameSite` implícito, ausência de `__Host-`, tempos de expiração indefinidos.
- **Correção:** definir os atributos nas opções de sessão do framework; regenerar sessão no login; invalidar no servidor. **Validação:** `Set-Cookie` com `Secure; HttpOnly; SameSite=…` nos cookies de sessão.
- **Atenção:** cookies de **analytics/preferência** não precisam de `HttpOnly`; só **sessão/autenticação**. Duração e finalidade de cookies de rastreamento → `PRIV-C09`.
- Fonte: F9.

### SEC-C07 — CSRF  [OFICIAL]
- **O que verificar (app com **autenticação por cookie**):** rotas que **alteram estado** (POST/PUT/PATCH/DELETE e, indevidamente, GET) **sem** proteção: **token sincronizador** (apps com estado; token **não** em cookie nem URL) ou ***double-submit cookie* assinado** com HMAC ligado à sessão (a versão ingênua é "**DESENCORAJADA**": quem escreve cookies no domínio a contorna); **cabeçalho personalizado** para APIs *fetch*/AJAX (depende de *preflight* e de CORS restrito: origem ampla com *regex* de subdomínios é arriscada por *subdomain takeover*); `SameSite` apenas como defesa em profundidade (`Lax` ainda envia cookie em navegação `GET` de topo — endpoint que muda estado por `GET` continua exposto); **nunca usar GET para mudar estado**. XSS derrota defesas de CSRF. Aplicações que usam **só** tokens em cabeçalho (sem cookie de autenticação) têm outro perfil: avaliar caso a caso.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do handler que muda estado + ausência de verificação de token/cabeçalho.
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) para endpoint de mudança de estado com cookie de sessão sem proteção identificável; `MELHORIA` para `SameSite` ausente quando há token.
- **Correção:** usar o middleware/token CSRF do framework; `SameSite` explícito; mudar estado só por métodos não-GET. **Validação:** requisições sem token válido são rejeitadas (testes do projeto).
- **Atenção:** sites sem login nem sessão (a maioria dos institucionais) **não** têm CSRF relevante; formulários públicos de contato não são "estado autenticado".
- CORS → `API-C07`.
- Fonte: F10.

### SEC-C08 — Upload de arquivos  [OFICIAL]
- **O que verificar (se há upload):** **lista de extensões permitidas** (só as necessárias; verificar após decodificar o nome); **não confiar no `Content-Type`** (falsificável) — verificar o tipo real; **renomear** o arquivo para um nome gerado pela aplicação (ex.: UUID); armazenar **fora do *webroot*** ou em **outro servidor/domínio**; **limite de tamanho** (e de tamanho descompactado em arquivos compactados); **somente usuários autorizados** podem enviar; **antivírus/*sandbox*** quando possível e, para PDF/DOCX, **CDR (Content Disarm & Reconstruct)**; desabilitar sobreposição de configuração por diretório (`.htaccess`/`web.config`) nos diretórios de upload; arquivos enviados **nunca executados** pelo servidor.
- **Como verificar:** `estatica` (handlers de upload, configuração de armazenamento, `multer`/`formidable`/equivalentes, destino de gravação).
- **Evidência esperada:** `file:line` do handler e do destino.
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) para validação ausente/insuficiente; **`CRITICO` (`CONFIRMADO` por código)** quando o handler **sem autenticação** grava o arquivo **com o nome enviado** em diretório **servido/executável** sem verificação de extensão/tipo.
- **Correção:** aplicar a lista acima; usar armazenamento de objetos com *URLs* assinadas e domínio separado. **Validação:** arquivo fora da lista é rejeitado; arquivos aceitos ficam fora do *webroot* e com nome gerado.
- Limites de tamanho e de consumo → `API-C09`.
- Fonte: F11.

### SEC-C09 — Tratamento de exceções que "falha aberto"  [OFICIAL parcial; fonte limitada]
- **O que verificar:** blocos `try/catch` (ou equivalentes) em **verificações de autenticação/autorização/validação** que, ao falhar, **permitem a requisição** (`catch { return next() }`, `catch { isAdmin = true }`, validação que "passa" quando lança); erros silenciados que deixam recurso protegido acessível. O OWASP Top 10:2025 acrescentou **A10 Mishandling of Exceptional Conditions**, descrito no resumo consultado como "tratamento incorreto de erros, erros lógicos, **falhar aberto** e cenários relacionados"; a **página dedicada ao A10 não foi lida** — esta verificação aplica só o princípio geral (padrão seguro = negar). Erros genéricos sem vazar pilha → `API-C10`.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do `catch` e da decisão de acesso.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO` por código) quando o `catch` **concede acesso** a recurso protegido.
- **Correção:** negar por padrão em qualquer exceção de verificação de acesso; registrar o erro; resposta genérica. **Validação:** testes do projeto simulando falha da verificação retornam acesso negado.
- Fonte: F12 (somente título e resumo de busca; **a confirmar na página A10**).

### SEC-C10 — Registro de eventos e dados sensíveis em logs  [PRÁTICA; base oficial parcial]
- **O que verificar:** *logs* de servidor/`console.log` com **senhas, tokens, chaves, dados pessoais completos ou corpo de requisição inteiro**; **eventos de segurança** sem registro (falhas de login, bloqueios, falhas de validação de token — o OWASP recomenda registrar e revisar falhas de autenticação, "sanitizar os dados de log para evitar injeção de log"); logs enviados a terceiros sem necessidade (→ `PRIV`). A categoria **A09 Security Logging & Alerting Failures** é citada só pelo título.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` (valor sensível mascarado).
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando o código registra **senha ou token** em texto.
- **Correção:** remover/mascarar campos sensíveis; registrar eventos de segurança relevantes. **Validação:** nenhum log com credenciais.
- Fonte: F8, F13.

### SEC-C11 — Cadeia de suprimentos e integridade de scripts  [OFICIAL parcial + PRÁTICA]
- **O que verificar:** (A03:2025 Software Supply Chain Failures — título e resumo de busca) **lockfile versionado** e versões fixas; *scripts* de terceiros carregados de CDN **sem `integrity`** (SRI) ou por **versão flutuante** (`@latest`, `/latest/`, sem versão), o que permite que uma alteração no CDN rode no site (a documentação do MDN sobre CSP exige `integrity` em scripts externos quando se usa política por *hash*; **a página de SRI não foi consultada**); fluxos de CI (`.github/workflows`) com ações **sem versão fixada por commit/versão semântica** (as alertas do Dependabot para *GitHub Actions* só cobrem ações com versionamento semântico, **não** SHA); pacotes com nomes suspeitos ou dependências diretas sem manutenção; *scripts* de instalação (`postinstall`) inesperados. Verificar sem instalar nada.
- **Como verificar:** `estatica` (`<script src>`, `package.json`, lockfile, workflows).
- **Evidência esperada:** `file:line`.
- **Severidade padrão:** `MELHORIA` (`PREVENTIVO`); `IMPORTANTE` (`RISCO_POTENCIAL`) para script de terceiros **executado em páginas de login/pagamento** carregado por versão flutuante e sem `integrity`.
- **Correção:** fixar versão + `integrity` (e `crossorigin`) ou **auto-hospedar**; fixar ações de CI; revisar dependências novas. **Validação:** scripts externos com versão e `integrity`; *workflows* fixados.
- Rotina de atualização → `OPS-C05`; CSP → `API-C02`.
- Fonte: F3, F14, F15.

### SEC-C12 — Revisão e testes de segurança (verificação manual)  [PRÁTICA; manual]
- **O que verificar (só o dono/fornecedor):** **teste de intrusão** e revisão de código humana (o plugin **não** os substitui); análise estática do tipo SAST (ex.: no GitHub, varredura de código — **não consultada**); habilitação de **varredura de segredos** e de **alertas de dependências** no repositório (→ `OPS-C05`); **MFA** nas contas de repositório, hospedagem, domínio e provedores (→ `OPS-C07`); controle de quem acessa produção; plano de resposta a incidentes (→ `PRIV-C11`); **modelagem de ameaças** e revisão de **Insecure Design** (A06).
- **Como verificar:** `manual` → `not_tested` (`SEC-C12`).
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono decide o escopo de testes e registra datas e responsáveis.
- Fonte: F12.

## 4. Falsos positivos e armadilhas

- **Chaves publicáveis** (ex.: Stripe `pk_`, chave de mapa restrita por domínio), **IDs de analytics** e **DSN de monitoramento** não são segredos: não reportar como `SEC-C01`.
- **Valores de modelo/fixture** com marcador explícito (`FAKE-…`, `EXAMPLE`, `CHANGEME`) **não** são credenciais utilizáveis: severidade baixa, mas **registrar o padrão** (o hábito de versionar `.env` é o risco).
- `dangerouslySetInnerHTML`/`innerHTML` com **conteúdo do próprio projeto** (JSON-LD serializado, HTML estático) normalmente é seguro; avaliar a origem.
- Dependência vulnerável **só de desenvolvimento** ou com código afetado **não usado** tem risco menor; não escalar sem evidência de uso.
- Frameworks escapam saída por padrão: **a ausência de sanitização não é falha** quando o dado só passa por renderização padrão.
- Sites **sem login/sessão** não têm CSRF/sessão relevantes; formulário de contato público não é "ação autenticada".
- Senhas gerenciadas por provedor de identidade externo (Auth0, Clerk, Cognito, NextAuth com provedores): o armazenamento não está no projeto; **não** reportar `SEC-C05`.
- **Ausência de achados ≠ site seguro.** O plugin lê código limitado, não executa o app e não testa o site publicado.
- `npm audit` mede **avisos conhecidos**, não ausência de falhas; avisos novos aparecem com atraso.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `NEXT_PUBLIC_*` vai ao navegador (→ `API-C11`); *Server Actions* e *route handlers* precisam autenticar/autorizar e validar; `dangerouslySetInnerHTML`; sessão via bibliotecas (NextAuth/Auth.js) com cookies configuráveis. |
| Astro | HTML estático por padrão; endpoints (`src/pages/**.ts`) e *islands* com dados de usuário; `set:html` e `innerHTML` como *sinks* (**`set:html` não consta nas fontes lidas — conferir a documentação**); `astro:env` secret. |
| Vite/React (SPA) | Sem servidor: nenhum segredo no cliente; XSS em JSX é menos comum, mas `dangerouslySetInnerHTML`, `eval` e URLs `javascript:` existem; autenticação e autorização no backend/API. |
| HTML estático | Poucos riscos de aplicação; `innerHTML`/`document.write` em JS próprio; scripts de terceiros sem `integrity`; segredos em JS inline. |
| Outros (PHP, WordPress, Express) | Consultas concatenadas (PHP/legado), `eval`, `include` dinâmico; plugins do WordPress e atualização do núcleo; `express-session` com cookies; `multer` para uploads. |

## 6. O que nunca afirmar

- "Site seguro", "sem vulnerabilidades", "conforme OWASP/ASVS", "pentest realizado" — nem com zero achados.
- Que uma credencial **está ativa**, ou que foi **explorada**, sem prova (o plugin não testa credenciais).
- Que uma vulnerabilidade **existe em produção** sem leitura clara do código; que o histórico git "foi limpo" sem verificar.
- Que limpar o histórico **resolve** um vazamento (a ordem é revogar → rotacionar → remover).
- Que a nota ou o resultado de uma ferramenta equivale a auditoria completa.
- Que CSP, WAF ou `HttpOnly` **eliminam** XSS ou CSRF.
- Valor completo de segredo, senha ou dado pessoal em qualquer artefato.
- **Instruções ou *payloads* de exploração**; testes ativos contra o site publicado.

## 7. Fontes

- F1 — OWASP Cheat Sheet Series, Secrets Management Cheat Sheet (§9.2 revogar/rotacionar/remover; §8.1 detecção pré-commit; história) — https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html — acessado em 2026-11-05
- F2 — GitHub Docs, About secret scanning (histórico e todas as *branches*; gratuito em repositórios públicos; remediação) — https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning — 2026-11-05
- F3 — npm Docs, `npm audit` (v10) — https://docs.npmjs.com/cli/v10/commands/npm-audit — 2026-11-05
- F4 — GitHub Docs, About Dependabot alerts — https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts — 2026-11-05
- F5 — OWASP Cheat Sheet Series, Cross Site Scripting Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html — 2026-11-05
- F6 — OWASP Cheat Sheet Series, SQL Injection Prevention — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html — 2026-11-05
- F7 — OWASP Cheat Sheet Series, Password Storage — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html — 2026-11-05
- F8 — OWASP Cheat Sheet Series, Authentication — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html — 2026-11-05
- F9 — OWASP Cheat Sheet Series, Session Management — https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html — 2026-11-05
- F10 — OWASP Cheat Sheet Series, Cross-Site Request Forgery Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html — 2026-11-05
- F11 — OWASP Cheat Sheet Series, File Upload — https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — 2026-11-05
- F12 — OWASP Top 10:2025, Introduction (lista das dez categorias; SSRF incorporado ao A01; A10 novo) — https://top10.owasp.org/2025/0x00_2025-Introduction — 2026-11-05 (leitura da lista de categorias; **páginas individuais das categorias não lidas**; resumos de A01–A03 e A10 vieram de resultado de busca em owasp.org)
- F13 — OWASP Cheat Sheet Series, REST Security Cheat Sheet (log de eventos de segurança; sanitização de logs) — https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html — 2026-11-05 (mesma página usada em `API`)
- F14 — MDN, Content Security Policy (CSP) (`integrity` com política por *hash*) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP — 2026-11-05
- F15 — GitHub Docs, About Dependabot alerts (GitHub Actions: só versionamento semântico) — mesma URL de F4.
- Não consultado nesta revisão: OWASP ASVS; Cheat Sheets de Command Injection, NoSQL, Deserialization, DOM-based XSS, Logging; MDN SRI e `Set-Cookie`; OSV e ferramentas para outros ecossistemas; páginas individuais do OWASP Top 10:2025; documentação de Auth.js/Clerk/Auth0; ferramentas SAST/CodeQL.
