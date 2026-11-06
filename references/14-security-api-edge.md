# 14 — Segurança de APIs e Edge

Prefixo: `API` · Subagente: `security` · Revisado em: 2026-11-05

Tags: **[OFICIAL]** = documentado por MDN, OWASP (API Security Top 10 2023, Cheat Sheet Series) ou pela documentação do framework/host; **[PRÁTICA]** = recomendação sem garantia → severidade máxima `MELHORIA`.

**Regras de segurança desta referência (SPEC §8.3, §9).**
- **Só detecção segura e não invasiva:** leitura de código e de configuração; em coleta remota, apenas as `GET` já previstas (HTML das páginas, `robots.txt`, `sitemap.xml`) **e os cabeçalhos dessas respostas**. **Nunca** sondar rotas de API, enviar `Origin` forjado, testar autenticação, enviar *payloads*, fazer *fuzzing*, força bruta ou carga. CORS, autenticação, autorização e limites são avaliados **no código/config**, não por tentativa contra o site publicado.
- **Esta referência descreve como detectar e corrigir, não como explorar.** Nenhuma verificação traz instrução de ataque.
- **Segredos** encontrados como evidência são **mascarados** (no máximo 4 primeiros caracteres + `****`, SPEC §7.3).
- **CRITICO** exige evidência concreta no código (`file` + `snippet`) de falha grave **ou** `CONFIRMADO` (SPEC §7.1). Cabeçalho ausente, sozinho, **nunca** é `CRITICO`.

## 1. Escopo e fronteiras

- **Desta área:** rotas de API/serverless/edge; autenticação e **autorização por endpoint** (inclusive acesso a objetos por ID); CORS; limites e *rate limit*; validação de entrada nas bordas; **headers de segurança** (HSTS, CSP, `frame-ancestors`/`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, isolamento de origem cruzada, `Cache-Control` de respostas sensíveis, divulgação de versão); **configuração de hosting/CDN/WAF** (Vercel, Netlify, Cloudflare, `.htaccess`, `nginx`); **segredos em variáveis públicas** (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`…); endpoints e arquivos expostos por engano.
- **De outras áreas (só referenciar via `related_ids`):**
  - XSS, injeção (SQL/NoSQL/comando), dependências vulneráveis, **segredos no repositório e no histórico git**, **sessão/cookies/login/senhas**, uploads, CSRF no app → `SEC`
  - HTTP→HTTPS e redirects, `X-Robots-Tag` → `SEO-C12`/`SEO-C01`; *mixed content* → `QA-C07`
  - banner de cookies, dados pessoais em terceiros → `PRIV`; PII em eventos de analytics → `ANL-C08`
  - renovação de certificado/domínio, *backups* → `OPS`
  - cache de ativos estáticos (`Cache-Control` de desempenho) → `PERF-C10`; aqui só `Cache-Control` de **respostas sensíveis**
- **Desempates:**
  - **API × SEC (autenticação):** autorização/autenticação **do endpoint** (quem pode chamar esta rota, quais objetos) = `API`; fluxo de login, sessão, cookie, senha, MFA, CSRF do app = `SEC`.
  - **API × SEC (segredos):** segredo **exposto ao navegador por prefixo público ou código cliente** = `API-C11`; segredo **versionado no repositório/histórico** = `SEC-C01`.
  - **Headers de segurança** são **sempre** `API` (SEC só referencia).

## 2. Quando acionar

- **Aplicável:** qualquer site com página pública (headers e `API-C11`); projetos com `api/`, `pages/api`, `app/**/route.*`, funções serverless/edge, `vercel.json`, `netlify.toml`, `_headers`, `wrangler.*`, `.htaccess`, `nginx.conf`.
- **Reduzido:** site estático sem backend, sem funções e sem variáveis de ambiente públicas: só os checks de headers (`C01`–`C06`) e `C12`; `C07`–`C11`, `C13` viram "não aplicável" em `areas_excluded` com motivo.
- **Medição remota:** cabeçalhos reais só existem com `--url` (`ativa-remota`) ou servidor local aprovado (`ativa-local`); sem isso, a configuração no repositório é a única evidência e o **cabeçalho efetivo** vai para `not_tested`.

## 3. Verificações

### API-C01 — HSTS (`Strict-Transport-Security`)  [OFICIAL]
- **O que verificar:** em site servido por HTTPS, o cabeçalho `Strict-Transport-Security` presente **só em respostas HTTPS** (ignorado por navegadores em HTTP). Valores citados nas fontes: `max-age=31536000; includeSubDomains` (1 ano, mínimo para *preload*) ou `max-age=63072000; includeSubDomains; preload` (2 anos; valor do OWASP e do exemplo do Next.js). `preload` exige `max-age ≥ 31536000`, `includeSubDomains` e `preload`, e submissão ao serviço hstspreload.org (lista **não** faz parte da especificação). **Riscos citados:** `max-age` longo pode **bloquear usuários** se o certificado vencer (sem opção de seguir adiante em erro TLS); `includeSubDomains` afeta **todos** os subdomínios (inclusive os só-HTTP); cada subdomínio deve enviar o próprio cabeçalho; a primeira visita fica exposta até a política ser recebida.
- **Como verificar:** `estatica` (config de hosting/framework); `ativa-remota`/`ativa-local` (cabeçalho real em `raw/`).
- **Evidência esperada:** regra com `file:line` ou cabeçalho de resposta; ausência.
- **Severidade padrão:** `MELHORIA` (ausência em site HTTPS). Sobe para `IMPORTANTE` apenas quando há páginas de login/pagamento/dados pessoais e nenhum mecanismo de HTTPS forçado (cruzar `SEO-C12`).
- **Correção:** `max-age` inicial curto para testar, depois 1–2 anos; `includeSubDomains` só se todos os subdomínios têm HTTPS; `preload` é decisão deliberada. Next.js `headers()`; Vercel `vercel.json` `headers`; Netlify `_headers`; Cloudflare Pages `_headers`. **Validação:** cabeçalho presente em respostas HTTPS com o valor definido.
- **Nunca** recomendar `preload` sem avisar do custo de reversão e do efeito em subdomínios.
- Fonte: F1, F2.

### API-C02 — Content-Security-Policy  [OFICIAL]
- **O que verificar:** existência de CSP entregue **no cabeçalho** (`Content-Security-Policy`, "em todas as respostas", não só no documento principal; a `<meta http-equiv>` não suporta todas as funcionalidades nem o modo *report-only*); **política estrita** baseada em *nonce* ou *hash* (recomendação do MDN) em vez de listas de domínios permitidos ("difíceis de acertar"); evitar **`'unsafe-inline'`** ("anula grande parte do propósito do CSP") e **`'unsafe-eval'`**; `object-src 'none'` e `base-uri 'none'` no exemplo estrito; `frame-ancestors` (ver C03); *nonce* gerado **por resposta**, imprevisível (HTML estático não suporta *nonce*: usar *hash* + `integrity`); `Content-Security-Policy-Report-Only` para implantar gradualmente, com `Reporting-Endpoints`/`report-to`. **CSP não substitui sanitização de entrada**: é defesa em profundidade (MDN).
- **Como verificar:** `estatica` (config de headers, `middleware`, `<meta>`); `ativa-remota`/`ativa-local` para o cabeçalho real.
- **Evidência esperada:** `file:line` da política ou ausência; diretivas inseguras presentes.
- **Severidade padrão:** `MELHORIA` (ausência ou política com `unsafe-inline`).
  - Sobe para `IMPORTANTE` **somente** quando há evidência de ponto de XSS no código (`SEC`) e não existe CSP — registrar com `related_ids`, o risco principal está no achado de `SEC`.
- **Correção:** começar em *report-only*; migrar *scripts* inline para arquivos ou usar *nonce*/*hash*; evitar `eval`; Next.js/outros frameworks têm guias de CSP com *nonce*. **Validação:** a página funciona sob a política e relatórios não mostram violações legítimas.
- **Atenção:** CSP quebra *tags* de terceiros (analytics, chat, mapas): preencher `tradeoffs` com `ANL`/`CRO`/`PERF`.
- Fonte: F3.

### API-C03 — Proteção contra *clickjacking*  [OFICIAL]
- **O que verificar:** `Content-Security-Policy: frame-ancestors 'none'` (ou `'self'`/origens específicas se o site **precisa** ser embutido); `X-Frame-Options` está **superado** pelo `frame-ancestors` (OWASP/MDN); o MDN orienta `frame-ancestors 'none'` a menos que o site precise ser incorporável. `X-Frame-Options: DENY`/`SAMEORIGIN` aceitável como compatibilidade.
- **Como verificar:** `estatica`; `ativa-remota`/`ativa-local` (cabeçalho).
- **Evidência esperada:** ausência de ambos em páginas com login/pagamento/ações sensíveis.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` quando páginas de login, pagamento ou painel podem ser enquadradas por qualquer origem (`CONFIRMADO` por ausência de `frame-ancestors`/`X-Frame-Options` no cabeçalho **observado**).
- **Correção:** `frame-ancestors 'none'` no CSP e, opcionalmente, `X-Frame-Options: DENY`. **Validação:** cabeçalho presente nas páginas sensíveis.
- Fonte: F2, F3.

### API-C04 — `nosniff`, `Referrer-Policy`, `Permissions-Policy` e isolamento de origem cruzada  [OFICIAL]
- **O que verificar:**
  - `X-Content-Type-Options: nosniff` (único valor válido) **com `Content-Type` correto** (inclusive `charset=UTF-8` em HTML);
  - `Referrer-Policy`: valor **explícito** (OWASP recomenda `strict-origin-when-cross-origin`; o exemplo do Next.js usa `origin-when-cross-origin`) em vez de depender do padrão do navegador;
  - `Permissions-Policy` desabilitando recursos não usados (ex.: `geolocation=(), camera=(), microphone=()`);
  - `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`/`Cross-Origin-Resource-Policy`: valores do OWASP (`same-origin`, `require-corp`, `same-site`) são **para sites que precisam de isolamento**; `require-corp` **bloqueia** recursos de terceiros sem permissão — **não aplicar em bloco** sem testar (podem quebrar embeds, mapas, anúncios).
- **Como verificar:** `estatica`; `ativa-remota`/`ativa-local`.
- **Evidência esperada:** ausência/valores (`file:line` ou cabeçalho em `raw/`).
- **Severidade padrão:** `MELHORIA`; `OPCIONAL` para COOP/COEP/CORP (só quando houver necessidade de isolamento).
- **Correção:** adicionar os cabeçalhos pela config do host/framework. **Validação:** cabeçalhos presentes e sem quebra de funcionalidades (testar embeds e formulários).
- Fonte: F2.

### API-C05 — Cabeçalhos obsoletos e divulgação de versão  [OFICIAL]
- **O que verificar:** (a) `X-XSS-Protection`: **desencorajado** pelo OWASP (pode criar vulnerabilidades em sites seguros; usar CSP) — a própria documentação de exemplo da Vercel mostra `X-XSS-Protection: 1; mode=block`; **não copiar esse exemplo**; valor seguro quando presente: `0`/omitido; (b) `Expect-CT` (**removido**) e `Public-Key-Pins` (HPKP, **removido** dos navegadores em 2018): remover; (c) `Server`, `X-Powered-By`, `X-AspNet-Version`/`X-AspNetMvc-Version`: remover ou neutralizar (OWASP: *hardening*). Frameworks Node/Express enviam `X-Powered-By` por padrão (confirmar pelo cabeçalho efetivo).
- **Como verificar:** `estatica`; `ativa-remota`/`ativa-local`.
- **Evidência esperada:** `file:line` ou cabeçalho em `raw/`.
- **Severidade padrão:** `OPCIONAL`; `MELHORIA` para `X-XSS-Protection: 1; mode=block`.
- **Correção:** remover os cabeçalhos; desativar `X-Powered-By` na configuração do framework/servidor. **Validação:** cabeçalhos ausentes da resposta.
- Fonte: F2, F6.

### API-C06 — Cabeçalhos configurados no lugar certo e com efeito real  [OFICIAL]
- **O que verificar:** a configuração de headers **realmente se aplica** às respostas:
  - **Netlify:** `_headers` precisa estar na **pasta de publicação** (geradores podem não copiá-lo); headers **não** valem para conteúdo proxied nem para respostas de **Functions/Edge Functions/SSR** (essas devem emitir os próprios); alguns cabeçalhos são ignorados (`Server`, `Content-Encoding`, `Content-Length`…); `Set-Cookie` pode ser sobrescrito; a documentação consultada **não** define precedência entre `_headers` e `netlify.toml`.
  - **Cloudflare Pages:** `_headers` em `public/`/saída de build; **não** se aplica a respostas de **Pages Functions**; até **100 regras** e **2.000 caracteres por linha**; `! Header` remove um cabeçalho; redirects têm prioridade sobre headers.
  - **Vercel:** `vercel.json` `headers` (`source` + `headers: [{key, value}]`; um único arquivo de configuração por projeto: `vercel.json`, `vercel.toml` **ou** `vercel.ts`).
  - **Next.js:** `headers()` em `next.config.js`; se duas regras casam e definem a mesma chave, **a última sobrescreve**; `Cache-Control` de ativos imutáveis **não** pode ser alterado.
  - **Respostas de funções/API/SSR:** definir headers no próprio código.
- **Como verificar:** `estatica` (config + estrutura de pastas); cabeçalho efetivo por `ativa-remota`/`ativa-local`.
- **Evidência esperada:** config com `file:line` + cabeçalho observado (ou a divergência entre eles).
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando há regra declarada de CSP/HSTS que **não aparece** na resposta observada (falsa sensação de proteção).
- **Correção:** mover o arquivo para a pasta correta; definir headers também em funções. **Validação:** cabeçalho efetivo = declarado, inclusive nas rotas dinâmicas.
- Fonte: F4, F5, F7, F8.

### API-C07 — CORS  [OFICIAL]
- **O que verificar (no código/config, **sem sondar o site**):** `Access-Control-Allow-Origin: *` em rotas que devolvem **dados privados ou do usuário**; **refletir o `Origin` recebido** sem *allowlist* (a documentação do MDN descreve só *allowlist* dinâmica; o risco de refletir qualquer origem — sobretudo com `Access-Control-Allow-Credentials: true` — vem de **prática geral**, não da página consultada); `*` **com credenciais** (o navegador bloqueia; indica configuração errada); origem **`null`** aceita; `Vary: Origin` ausente quando a origem permitida muda por requisição (risco de cache servir resposta de uma origem a outra); `Access-Control-Allow-Methods/Headers` excessivos (`*`); `Access-Control-Max-Age` (padrão do navegador 5 s; cada navegador tem teto). **OWASP:** "desativar cabeçalhos CORS quando chamadas entre origens não são esperadas" e restringir origens ao necessário. O exemplo da documentação do Next.js usa `*` como **ilustração** (comentário "set your origin"): não copiar para rotas com dados do usuário. Proteção contra CSRF **não** é substituída por CORS (requisições simples cruzam origens sem *preflight*; MDN) → `SEC`.
- **Como verificar:** `estatica` (middleware, `headers()`, config do host, handlers).
- **Evidência esperada:** `file:line` da regra.
- **Severidade padrão:** `MELHORIA` (CORS aberto em API **pública sem dados privados**: esperado → `OPCIONAL`);
  - `IMPORTANTE` (`RISCO_POTENCIAL`) para `*` ou origem refletida em rotas que usam cookies/tokens e devolvem dados do usuário;
  - `CRITICO` (`RISCO_POTENCIAL`, área API) **somente** quando o código **reflete qualquer `Origin` junto com `Allow-Credentials: true`** em rota autenticada que devolve dados privados, com `file` + `snippet`.
- **Correção:** *allowlist* explícita de origens; `Vary: Origin`; não combinar com credenciais sem necessidade. **Validação:** apenas origens previstas recebem os cabeçalhos CORS.
- Fonte: F9, F10.

### API-C08 — Autenticação e autorização por endpoint  [OFICIAL]
- **O que verificar (leitura de handlers/rotas):** rotas **não públicas** sem verificação de autenticação ("serviços REST não públicos devem fazer controle de acesso **em cada endpoint**", OWASP); **BOLA** (API1:2023): endpoint que recebe um ID de objeto (caminho, query, corpo, cabeçalho) e lê/altera/apaga **sem verificar se o usuário autenticado pode agir sobre aquele objeto** — a página do OWASP diz que **comparar o ID da sessão com o parâmetro "não é solução suficiente"**; IDs imprevisíveis (UUID) são medida preventiva, **não substituem** a checagem; **BFLA** (API5): funções administrativas acessíveis a usuários comuns; **propriedades** (API3): resposta que devolve campos sensíveis ou aceita campos que o usuário não deve alterar (*mass assignment*); **chaves de API** não servem para autenticar usuários (API2) e "não devem ser a única proteção" de recursos de alto valor (REST); **JWT**: assinatura obrigatória (rejeitar `alg: none`/tokens não assinados), algoritmo definido pela configuração do servidor (não pelo cabeçalho do token), validação de `iss`, `aud` e `exp`; **endpoints de gerenciamento** fora da internet pública. Autorização por **método** (permitir só os métodos necessários, 405 para os demais).
- **Como verificar:** `estatica` (rotas, *middleware*, funções; buscar acesso a dados por ID sem checagem de dono; rotas sem *guard*).
- **Evidência esperada:** `file:line` do handler + trecho que acessa dados por ID sem checagem (dados mascarados).
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) quando a checagem pode existir em camada não lida (middleware externo, regra do banco);
  - **`CRITICO` (`CONFIRMADO` por código)** quando o handler devolve ou modifica dados de usuário/administração com ID vindo da requisição **sem nenhuma checagem de autenticação ou propriedade em todo o caminho de código lido**, com `file` + `snippet`.
- **Correção:** verificação de autorização **por objeto e por função** no servidor (política baseada em usuário/papel), testes de autorização; remover rotas de teste. **Validação:** testes automatizados do projeto cobrindo acesso negado entre usuários (executados pelo dono; o plugin **não** testa contra o site publicado).
- **Atenção:** o plugin lê o código; **não** executa chamadas para provar a falha. Registrar "comportamento em produção não verificado" em `not_tested`.
- Login, sessão e cookies → `SEC`.
- Fonte: F11, F12, F13.

### API-C09 — Limites de uso e *rate limit*  [OFICIAL]
- **O que verificar:** (API4:2023) ausência de limites para: **tamanho máximo de upload e de corpo/parâmetros** (comprimento de *string*, número de itens de *array*), **registros por página** validados no servidor, **tempo de execução**, memória, operações por requisição (ex.: lotes em GraphQL), **limites de gasto** com provedores pagos (e-mail, SMS, IA, mapas) ou, no mínimo, **alertas de cobrança**; ***rate limit*** por cliente/tempo (resposta `429`), **mais rígido** em operações sensíveis (login, recuperação de senha, validação de OTP, envio de e-mail/SMS) e **proteção anti-força-bruta** em autenticação (API2: "mais rígida que o *rate limit* comum"; bloqueio de conta/CAPTCHA); funções serverless/containers com limites de memória/CPU.
- **Como verificar:** `estatica` (handlers sem limite de corpo/paginação; ausência de limitador; config de WAF/rate limit em `vercel.json`/`wrangler`/`netlify.toml`); limites no painel do host → `manual`.
- **Evidência esperada:** `file:line` do endpoint público que dispara serviço pago/e-mail sem limite; paginação sem teto.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`RISCO_POTENCIAL`) para endpoint **público** que dispara **envio de e-mail/SMS/IA/serviço pago** (ex.: formulário de contato) sem *rate limit*, CAPTCHA ou limite de gasto; sobe com evidência de custo ou abuso real (não disponível ao plugin).
- **Correção:** *rate limit* no edge (WAF/CDN) ou na função; limites de payload; teto de paginação; CAPTCHA/honeypot em formulários públicos; limite de gasto no provedor. **Validação:** o dono confirma limites ativos no painel e testa em ambiente próprio.
- **Nunca** testar com carga ou repetição contra o site publicado (SPEC §8.3).
- Fonte: F12, F14, F11.

### API-C10 — Validação de entrada, métodos, tipos de conteúdo e erros  [OFICIAL]
- **O que verificar:** nos handlers, validação **no servidor** de tipo, tamanho, formato e intervalo ("não confie em parâmetros/objetos de entrada", OWASP); **lista de métodos permitidos** (405 para os demais); **tipos de conteúdo** aceitos (415 para tipos não suportados; 406 quando não há resposta aceitável; não repetir o `Accept` recebido); **erros genéricos** — "não repassar detalhes técnicos (*stack traces* ou pistas internas) ao cliente" (REST; API8: esquemas de resposta, inclusive de erro, evitam vazar exceções); registro de falhas de validação sem dados sensíveis; credenciais e chaves **fora da URL** (logs capturam URLs). Validação no cliente **não** substitui a do servidor (MDN: "nunca confie em dados vindos do cliente").
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` de handler que usa `req.body`/`query` sem validação, devolve `error.stack`/`err.message` ou aceita qualquer método.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO` por código) quando o handler **devolve rastro de pilha/erro interno** ao cliente ou usa entrada sem qualquer validação em ação com efeito (envio de e-mail, gravação, chamada a serviço externo).
- **Correção:** esquema de validação (ex.: biblioteca de esquemas do projeto), `405/415`, mensagens genéricas com ID de correlação. **Validação:** entradas inválidas rejeitadas com mensagem genérica (testes do projeto).
- Injeção e uso inseguro da entrada em consultas/comandos → `SEC`.
- Fonte: F11, F12, F15.

### API-C11 — Segredos expostos ao navegador por variável pública  [OFICIAL]
- **O que verificar:** variáveis com prefixo que **entra no *bundle* do cliente** contendo **segredo**:
  - **Next.js:** `NEXT_PUBLIC_*` é **substituído no código enviado ao navegador em tempo de build** (valor "congelado"); sem o prefixo, só existe no servidor;
  - **Vite:** `VITE_*` é exposto no código cliente; a documentação diz que **não devem conter informação sensível, como chaves de API**; segredos ficam em *backend*/funções;
  - **Astro:** só `PUBLIC_*` vai ao cliente; `astro:env` não permite `context: "client"` com `access: "secret"` ("não há forma segura de enviar esse dado ao cliente");
  - **Outros:** `REACT_APP_*`, `GATSBY_*`, `NUXT_PUBLIC_*` etc. (**convenções não consultadas nesta revisão**: verificar a documentação do framework antes de afirmar).
  Procurar nesses nomes (e em constantes do código cliente) valores com forma de **chave secreta**: `sk_live_`/`sk_test_` (Stripe, **secreta**; `pk_` é publicável), `service_role`, chaves privadas, tokens de API de provedores, strings de conexão com senha, segredo de *webhook*, token da API de Conversões. **Falsos positivos esperados:** IDs de medição, chaves **publicáveis** projetadas para o cliente (restritas por domínio), DSN de monitoramento. Segredo no **repositório** → `SEC-C01`.
- **Como verificar:** `estatica` (`.env*`, `next.config`, `vite.config`, `astro.config`, código cliente).
- **Evidência esperada:** `file:line` + trecho **mascarado** (≤ 4 caracteres + `****`).
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`) quando o nome sugere segredo mas o valor não é conhecido;
  - **`CRITICO` (`CONFIRMADO`)** quando o valor presente no código/`.env` versionado **tem a forma de credencial secreta** e está num prefixo público ou código cliente (evidência de arquivo + trecho mascarado).
- **Correção:** **revogar/rotacionar** a chave; mover para variável **sem prefixo público** usada só no servidor/função; para chamadas autenticadas, criar uma rota de servidor intermediária. **Validação:** o *bundle* de produção não contém o valor; a chave antiga está revogada (confirmação do dono).
- **Atenção:** remover do código **não basta**: o valor pode estar no histórico e em *builds* publicados → `SEC-C01`.
- Fonte: F16, F17, F18.

### API-C12 — Endpoints, rotas de teste e arquivos sensíveis expostos  [OFICIAL parcial + PRÁTICA]
- **O que verificar:** rotas de depuração/teste/administração herdadas de *templates* (`/api/debug`, `/api/test`, `/api/seed`, `/api/hello`, `phpinfo`, painéis padrão) em produção; **inventário de endpoints** (API9: versões antigas e rotas esquecidas) — o OWASP cita "gerenciamento de inventário" como risco; **endpoints de gerenciamento** fora da internet pública (REST); **arquivos sensíveis na pasta pública ou na saída de build** (`public/`, `dist/`, `out/`, raiz publicada): `.env*`, `.git/`, `*.sql`/dumps, backups, chaves; funcionalidades desnecessárias ativas (métodos HTTP extras, logs verbosos — API8).
- **Como verificar:** `estatica` (rotas, pastas públicas, `.gitignore`, saída de build existente).
- **Evidência esperada:** `file` de rota/arquivo; segredos mascarados.
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) para rota de teste/admin sem proteção publicada; `CRITICO` (`CONFIRMADO`) quando arquivo na **pasta publicada** contém credencial ou dados pessoais (`file` + trecho mascarado).
- **Correção:** remover do *build*/pasta pública; proteger ou desligar a rota; ajustar `.gitignore`. **Validação:** o artefato de produção não contém os arquivos; a rota não existe/exige autenticação.
- Segredos no repositório → `SEC-C01`.
- Fonte: F11, F12, F13.

### API-C13 — Requisições do servidor com URL vinda do usuário (SSRF) e consumo de APIs externas  [OFICIAL]
- **O que verificar:** handlers que fazem `fetch`/`axios`/`http.get` para uma **URL recebida do cliente** (proxy de imagem, *webhook*, importação por URL, pré-visualização de links) **sem *allowlist*** de destinos nem validação de esquema/host (API7:2023, SSRF); **consumo inseguro de APIs de terceiros** (API10): confiar nos dados de terceiros sem validar, seguir redirects, sem *timeouts* nem limites. **Não** incluir testes de exploração: a detecção é só por leitura do código.
- **Como verificar:** `estatica`.
- **Evidência esperada:** `file:line` do `fetch` com URL derivada de entrada.
- **Severidade padrão:** `IMPORTANTE` (`RISCO_POTENCIAL`); `CRITICO` (`RISCO_POTENCIAL`, área API) **somente** com `file` + `snippet` em que a URL do usuário é buscada pelo servidor **sem nenhuma restrição** e o ambiente de execução tem acesso a rede interna/metadados (evidência no código/config).
- **Correção:** *allowlist* de hosts/esquemas, resolução e verificação do IP de destino, *timeouts*, bloqueio de redes internas, sem seguir redirects arbitrários. **Validação:** URLs fora da *allowlist* são rejeitadas (testes do projeto).
- Fonte: F11, F12.

### API-C14 — Configurações fora do repositório (verificação manual)  [OFICIAL parcial; manual]
- **O que verificar (só o dono, nos painéis):** regras de **WAF/CDN/*rate limit*** (Vercel Firewall, Cloudflare, Netlify); proteção de bots; **versões e suítes TLS** e registro **CAA** de DNS (**não consultados** nesta revisão); limites de gasto/alertas nos provedores de API; proteção de *preview deployments*; permissões de funções e variáveis de ambiente por ambiente; quem pode alterar a configuração de hosting; logs de acesso e alertas. O plugin **não** acessa esses painéis.
- **Como verificar:** `manual` → `not_tested` (`API-C14`).
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono confirma cada item e informa o resultado.
- Fonte: F12.

## 4. Falsos positivos e armadilhas

- **Cabeçalho ausente no repositório não prova ausência na produção:** CDN/hosting/WAF podem injetá-lo. Sem coleta, é `not_tested`.
- **Cabeçalho declarado no repositório pode não ser aplicado** (Netlify/Cloudflare não aplicam `_headers` a funções; `_headers` fora da pasta publicada). Comparar config × resposta.
- **CORS `*` em API pública sem dados privados** (CDN de fontes, API aberta) é legítimo.
- IDs de medição, chaves **publicáveis** (ex.: Stripe `pk_`, chaves de mapa restritas por domínio) e DSN de monitoramento são **públicos por projeto**.
- `X-Frame-Options` presente **e** `frame-ancestors` presente: não é conflito; `frame-ancestors` prevalece em navegadores modernos.
- `unsafe-inline` em `style-src` é menos grave que em `script-src`; não escalar sem analisar a diretiva.
- COOP/COEP/CORP "ausentes" **não** são falha na maioria dos sites; só importam com necessidade de isolamento e quebram terceiros.
- Rotas de exemplo de *templates* (`/api/hello`) sem dados sensíveis: `MELHORIA`, não `IMPORTANTE`.
- Variáveis `NEXT_PUBLIC_*` com valor **público de verdade** (URL do site, ID de analytics) são esperadas.
- Resultados de ferramentas de nota de cabeçalhos (A+) **não** são certificação.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `headers()` em `next.config.js` (regras seguintes sobrescrevem a mesma chave); `middleware` para CSP com *nonce*; rotas em `app/**/route.ts`/`pages/api`; `NEXT_PUBLIC_*` inlined no *build*; `Cache-Control` de ativos imutáveis não editável. |
| Astro | HTML estático por padrão: headers pelo host; endpoints em `src/pages/**.ts`; `PUBLIC_*` e `astro:env` (`secret`/`public`). |
| Vite/React (SPA) | Sem servidor: segredos nunca no cliente (`VITE_*` público); headers só no host; APIs em funções do provedor. |
| HTML estático | Só headers do host (`_headers`, `vercel.json`, `.htaccess`); `api/` serverless eventual. |
| Outros (Express, PHP, WordPress) | Express: `x-powered-by`, middlewares de segurança, `cors`; WordPress: REST API e `xmlrpc.php`, plugins; `.htaccess`/`nginx.conf` para headers. |

## 6. O que nunca afirmar

- "Site seguro", "conforme OWASP", "protegido", "nota A+" ou qualquer certificação de segurança.
- Que um cabeçalho "está ausente" **na produção** sem tê-lo observado (config ≠ resposta).
- Que uma vulnerabilidade de autorização/IDOR **existe em produção** sem leitura clara do código; o plugin **não testou** o site.
- Que CSP/HSTS/COEP "resolvem" XSS ou outros problemas (CSP é defesa em profundidade).
- Que `X-XSS-Protection` ou `Expect-CT`/HPKP "melhoram a segurança" (estão desencorajados/removidos).
- Que `preload` é seguro de aplicar sem avaliação dos subdomínios.
- Instruções ou *payloads* de ataque; testes ativos contra o site publicado.
- Valor completo de segredo (sempre mascarado).

## 7. Fontes

- F1 — MDN, `Strict-Transport-Security` — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security — acessado em 2026-11-05
- F2 — OWASP Cheat Sheet Series, HTTP Headers Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html — 2026-11-05
- F3 — MDN, Content Security Policy (CSP) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP — 2026-11-05
- F4 — Netlify Docs, Headers (`_headers`, `[[headers]]`, limitações) — https://docs.netlify.com/manage/routing/headers/ — 2026-11-05
- F5 — Cloudflare Pages Docs, Headers — https://developers.cloudflare.com/pages/configuration/headers/ — 2026-11-05
- F6 — OWASP HTTP Headers Cheat Sheet (seção de divulgação de informação) — mesma URL de F2.
- F7 — Vercel Docs, `vercel.json` (`headers`) e Project Configuration — https://vercel.com/docs/project-configuration/vercel-json — 2026-11-05 (exemplo da documentação usa `X-XSS-Protection: 1; mode=block`)
- F8 — Next.js Docs, `headers` — https://nextjs.org/docs/app/api-reference/config/next-config-js/headers — 2026-11-05
- F9 — MDN, Cross-Origin Resource Sharing (CORS) — https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS — 2026-11-05
- F10 — mesma URL de F8 (exemplo de CORS com `*` no Next.js) e F9.
- F11 — OWASP API Security Top 10 — 2023 — https://api-security.owasp.org/editions/2023/en/0x11-t10 — 2026-11-05 (API1 BOLA, API2, API4, API8 lidos em suas páginas; **API3, API5, API6, API7, API9 e API10 citados só pelo título** na lista, sem leitura das páginas individuais)
- F12 — OWASP Cheat Sheet Series, REST Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html — 2026-11-05
- F13 — OWASP API Security 2023: API1 (BOLA) — https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/ — 2026-11-05
- F14 — OWASP API Security 2023: API4 (Unrestricted Resource Consumption) — https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/ — 2026-11-05 (também API2: https://api-security.owasp.org/editions/2023/en/0xa2-broken-authentication/; API8: https://api-security.owasp.org/editions/2023/en/0xa8-security-misconfiguration/)
- F15 — MDN, Client-side form validation (validação no servidor) — https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation — 2026-11-05
- F16 — Next.js Docs, Environment Variables — https://nextjs.org/docs/app/guides/environment-variables — 2026-11-05
- F17 — Vite, Env Variables and Modes — https://vite.dev/guide/env-and-mode — 2026-11-05
- F18 — Astro Docs, Environment Variables — https://docs.astro.build/en/guides/environment-variables/ — 2026-11-05
- Não consultado: Next.js guia de CSP com *nonce*; documentação de WAF/rate limit da Vercel, Cloudflare e Netlify; MDN `Referrer-Policy`, `Permissions-Policy` e `Set-Cookie`; OWASP ASVS; SSL/TLS (Mozilla SSL Configuration); convenções `REACT_APP_`/`NUXT_PUBLIC_`/`GATSBY_`.
