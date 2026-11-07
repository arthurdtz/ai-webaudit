# Fixture de testes — `sample-site`

Site estático **fictício** (Sorriso Bela Vista Odontologia, "Vila Exemplo/SP") usado para testar o plugin. Todos os nomes, domínios (`*.example`, `*.test`), telefones e IDs são inventados. **Nada nesta pasta é um dado real.**

- **Gabarito:** [`expected-findings.json`](expected-findings.json) (lido por `tests/compare.mjs`, Etapa 8/10).
- **Conferência do gabarito:** `node tests/check-expected-ids.mjs` (todo `check_id` existe nas referências, o prefixo bate com a área e os arquivos/trechos existem na fixture).
- **Meta da v0.1** (SPEC §11): ≥ 80% de `must_find` encontrados e **0** itens de `must_not_flag`.
- **Não ajustar as referências para "encaixar" a fixture** (evita *overfitting*): melhorias devem ser gerais.

## Como a fixture é usada

`tests/run-fixture.sh` (Etapa 8) copia `sample-site/` para `/tmp/webaudit-fixture-<timestamp>`, faz `git init`, roda a auditoria e compara o `findings.json` com o gabarito. **Nunca** rode a auditoria dentro desta pasta do repositório (o alvo recebe `.webaudit/`).

## Semântica do gabarito

- **`must_find`:** existe achado com o `check_id`, severidade ≥ `min_severity` e evidência que cite o arquivo (ou parte dele).
- **`must_not_flag`:** **não** existe achado com o `check_id` e severidade ≥ `MELHORIA` cuja evidência **primária** (a primeira) cite o arquivo; evidências seguintes (por exemplo, o trecho correto citado como contraste) não contam; com `match`, a evidência primária também precisa conter o termo; com `title_match`, o **título** do achado precisa conter o termo (o achado pode mostrar o trecho correto como evidência sem acusá-lo).
- Os `min_severity` seguem as **referências**. Em especial: o segredo do `.env` é um valor com marcador explícito de falso (`FAKE-…`), portanto **`MELHORIA`**, não `CRITICO` (SPEC §11: formato que não dispara o *secret scanning* do GitHub; decisão registrada em `docs/DECISIONS.md`).

## Problemas plantados (28) — as 15 áreas têm ao menos um

| ID | Check | Área | Arquivo | Sev. mín. | O que foi plantado |
|---|---|---|---|---|---|
| F01 | `SEO-C01` | SEO | `servicos.html` | IMPORTANTE | Meta `noindex` numa página de serviços que deve ser indexável. |
| F02 | `SEO-C06` | SEO | `index.html` | IMPORTANTE | Canonical da home aponta para o host de staging (`staging.belavistaodonto.example`). |
| F03 | `SEO-C07` | SEO | `servicos.html` | IMPORTANTE | `<title>Página</title>` genérico e idêntico em `servicos.html` e `contato.html`. |
| F04 | `GEO-C03` | GEO | `index.html` | MELHORIA | Hero com superlativos vagos ("líder", "inovadoras e de ponta", "o melhor") sem dado verificável. |
| F05 | `AEO-C01` | AEO | `index.html` | MELHORIA | Títulos de seção genéricos ("Saiba mais", "Detalhes") em conteúdo informativo. |
| F06 | `AIO-C01` | AIO | `robots.txt` | MELHORIA | Bloqueia `OAI-SearchBot`, `PerplexityBot` e `Claude-SearchBot` (agentes de busca de IA) sem política declarada. |
| F07 | `CRO-C08` | CRO | `index.html` | IMPORTANTE | Link de WhatsApp fora do formato oficial (`wa.me/+55-(11)-…` com `+`, parênteses e travessões). |
| F08 | `QA-C10` | QA | `servicos.html` | IMPORTANTE | Texto `lorem ipsum` visível na seção "Nossa equipe". |
| F09 | `QA-C11` | QA | `js/main.js` | CRITICO | Destino do formulário de contato aponta para `http://localhost:3000` (quebra em produção). |
| F10 | `ANL-C01` | ANL | `js/analytics.js` | IMPORTANTE | ID de medição GA4 placeholder (`G-XXXXXXXXXX`) e Pixel com ID de zeros. |
| F11 | `ANL-C08` | ANL | `js/main.js` | CRITICO | Evento `generate_lead` envia e-mail e telefone digitados ao analytics (PII clara). |
| F12 | `PERF-C04` | PERF | `index.html` | IMPORTANTE | `loading="lazy"` na imagem do hero (candidata a LCP, acima da dobra). |
| F13 | `A11Y-C03` | A11Y | `dicas.html` | IMPORTANTE | `<html>` sem atributo `lang`. |
| F14 | `A11Y-C02` | A11Y | `index.html` | IMPORTANTE | Imagem informativa do hero (`img/hero.svg`) sem atributo `alt`. |
| F15 | `A11Y-C05` | A11Y | `index.html` | IMPORTANTE | Formulário "Orçamento rápido" com campos só com `placeholder`, sem rótulo programático. |
| F16 | `A11Y-C09` | A11Y | `index.html` | IMPORTANTE | `<meta viewport>` com `user-scalable=no` e `maximum-scale=1` (bloqueia zoom). |
| F17 | `PRIV-C01` | PRIV | `js/analytics.js` | IMPORTANTE | GA4 e Meta Pixel carregam incondicionalmente, sem mecanismo de consentimento no site. |
| F18 | `PRIV-C04` | PRIV | `contato.html` | IMPORTANTE | Formulário coleta dados pessoais e o site não tem política de privacidade. |
| F19 | `LOC-C02` | LOC | `index.html` | MELHORIA | Telefone do rodapé (98765-4321) diverge do telefone da página de contato e do JSON-LD (91234-5678). |
| F20 | `LOC-C03` | LOC | `index.html` | IMPORTANTE | `Dentist` com `aggregateRating` do próprio negócio e endereço do JSON-LD (nº 321) diferente do rodapé (nº 123). |
| F21 | `CONT-C02` | CONT | `dicas.html` | IMPORTANTE | JSON-LD com `datePublished` no futuro (2027) contradiz a data visível (10/01/2025). |
| F22 | `OPS-C10` | OPS | `.well-known/security.txt` | MELHORIA | `security.txt` com `Expires` vencido (2022). |
| F23 | `API-C07` | API | `api/contato.js` | IMPORTANTE | CORS reflete qualquer `Origin` com `Access-Control-Allow-Credentials: true`. |
| F24 | `API-C08` | API | `api/contato.js` | CRITICO | `GET /api/contato` devolve a lista de leads sem nenhuma autenticação. |
| F25 | `API-C05` | API | `vercel.json` | MELHORIA | Cabeçalho `X-XSS-Protection: 1; mode=block` (desencorajado pelo OWASP). |
| F26 | `SEC-C03` | SEC | `js/main.js` | CRITICO | `innerHTML` recebe `location.hash` sem codificação (XSS baseado em DOM). |
| F27 | `SEC-C04` | SEC | `api/contato.js` | CRITICO | Consulta SQL montada por concatenação com dados da requisição. |
| F28 | `SEC-C01` | SEC | `.env` | MELHORIA | `.env` versionado com segredo de modelo (`FAKE-SECRET-FOR-TESTS-0000`): padrão de segredo versionado, não credencial utilizável. |

## Acertos que NÃO podem ser apontados (10)

| ID | Check | Arquivo | Por que NÃO pode ser apontado |
|---|---|---|---|
| OK01 | `A11Y-C03` | `index.html` | `<html lang="pt-BR">` correto (também em `servicos.html` e `contato.html`). |
| OK02 | `A11Y-C02` | `index.html` (trecho: `logo.svg`) | Logo decorativo com `alt=""` é correto; não é imagem sem texto alternativo. |
| OK03 | `SEO-C06` | `contato.html` | Canonical absoluta, no `<head>`, autorreferente e com o host de produção. |
| OK04 | `A11Y-C05` | `contato.html` | Todos os campos têm `<label for>`, `autocomplete` e tipos adequados. |
| OK05 | `CRO-C08` | `contato.html` | Link `wa.me/5511987654321?text=…` no formato oficial, com mensagem codificada. |
| OK06 | `PERF-C05` | `contato.html` (trecho: `contato.svg`) | Imagem do cabeçalho com `width` e `height`. |
| OK07 | `PERF-C04` | `index.html` (trecho: `g1.svg|g2.svg|g3.svg`) | `loading="lazy"` apenas na galeria abaixo da dobra, com dimensões declaradas. |
| OK08 | `API-C04` | `vercel.json` (título: `X-Content-Type-Options\|nosniff`) | `X-Content-Type-Options: nosniff` presente; só viola um achado cujo **título** acuse a falta dele (achado sobre outros cabeçalhos ausentes não viola). |
| OK09 | `SEO-C07` | `dicas.html` | Título único e descritivo (também em `index.html`). |
| OK10 | `SEC-C01` | `js/analytics.js` | IDs de medição são públicos por natureza; não são segredos. |

## Outros problemas reais presentes (não exigidos no gabarito)

A fixture contém defeitos adicionais **de propósito não cobrados**, porque a severidade/julgamento varia ou dependem de execução. Um bom resultado pode (e às vezes deve) apontá-los; **não contam** para a meta nem como falso positivo:

- `index.html`: link para `sobre.html` inexistente (`QA-C01`); script de CDN `@latest` sem `integrity` (`SEC-C11`); nenhum favicon (`QA-C08`) nem Open Graph (`QA-C09`) em nenhuma página; `<script src>` de terceiros.
- `dicas.html`: artigo sem autor (`CONT-C01`).
- `contato.html`: texto de consentimento genérico ("concorda com os nossos termos", sem finalidade nem link) (`PRIV-C07`); nenhum canal para direitos do titular (`PRIV-C10`); telefone divergente (já em `LOC-C02`).
- `sitemap.xml`: lista `servicos.html`, que está com `noindex` (`SEO-C05`).
- `vercel.json`: sem HSTS, CSP, `frame-ancestors`, `Referrer-Policy` (`API-C01`–`API-C04`); efeito real só com cabeçalhos coletados.
- `api/contato.js`: dispara e-mail sem *rate limit* ou CAPTCHA (`API-C09`); sem validação de entrada (`API-C10`).
- Sem cookies de sessão, login, upload, `package.json`, lockfile nem variáveis públicas (`NEXT_PUBLIC_`/`VITE_`): ver pendências abaixo.

## Pendências de cobertura (fixture × referências)

Nenhuma referência foi alterada. Itens **não exercitados** por esta fixture (precisariam de outra fixture ou de execução):

- **Exigem execução (`ativa-local`)**: métricas Lighthouse (`PERF-C01`), axe e contraste (`A11Y-C01`, `A11Y-C08`), console/rede (`QA-C06`), build (`QA-C12`), *cookies* antes do consentimento por execução (`PRIV-C01`, parte ativa).
- **Sem `package.json`/lockfile**: `SEC-C02` (dependências) e `OPS-C05` não se aplicam; `API-C11` (segredo em variável pública) e `SEC-C05`–`SEC-C08` (autenticação, sessão, CSRF, upload) não têm cenário.
- **`manual`** por definição: `LOC-C08`–`LOC-C11`, `GEO-C07`, `AEO-C06`, `OPS-C01`–`C04`, `C06`–`C09`, `C12`, `C13`, `A11Y-C14`, `QA-C14`, `ANL-C10`, `PERF-C02`, `PRIV-C11`, `API-C14`, `SEC-C12` — devem sair como `not_tested`.
