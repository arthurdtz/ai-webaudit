# 10 — Privacidade, Cookies e LGPD

Prefixo: `PRIV` · Subagente: `privacy` · Revisado em: 2026-11-05

**Este relatório não é parecer jurídico, nem certifica conformidade com a LGPD.** Ele aponta **indícios técnicos** no código e na execução local e os compara com o texto da lei e com orientação da ANPD. Quem decide base legal, texto da política e risco é o controlador, com assessoria jurídica.

Tags (cada verificação traz uma delas):
- **[LEI art. X]** — exigência do texto da Lei 13.709/2018 (LGPD), com artigo.
- **[ANPD]** — orientação da ANPD. O **Guia Orientativo "Cookies e proteção de dados pessoais" (versão 1.0, out/2022)** se declara "guia de boas práticas", de **viés educativo**, que **não isenta** os agentes de tratamento dos demais preceitos da LGPD e "poderá adequar-se a futuras regulamentações". **Não é norma vinculante por si**; tratar como orientação da autoridade.
- **[PRÁTICA]** — boa prática sem fonte normativa → severidade máxima `MELHORIA`.

**Pontos que definem a severidade (CRÍTICO só com evidência concreta, SPEC §7.1).**
- A **LGPD não tem artigo que exija "banner de cookies"**. A obrigação vem dos princípios (art. 6º), da base legal (art. 7º), do consentimento (arts. 5º XII e 8º) e da transparência (art. 9º). O guia da ANPD é que descreve o banner como instrumento de transparência.
- **Consentimento não é a única base.** O guia da ANPD diz: consentimento é mais apropriado para cookies **não necessários**; **legítimo interesse** pode ser adequado para **cookies estritamente necessários** e, **em certos contextos**, para **medição de audiência** (dados agregados, sem cruzar com outros rastreadores nem formar perfis); **dificilmente** é adequado para **publicidade**, sobretudo cookies de terceiros e perfis comportamentais. Logo, **analytics antes do consentimento não é automaticamente irregular**; **pixels de publicidade e perfilamento, sim, indicam problema**.
- `CRITICO` em PRIV exige: dado/ação **observados** (código `file`+`snippet` e, quando possível, execução) **e** impacto grave à privacidade, sem depender de interpretação jurídica duvidosa (ver PRIV-C01).

## 1. Escopo e fronteiras

- **Desta área:** consentimento e banner; tags/cookies que disparam antes de escolha; mecanismo de revogação; política de privacidade e de cookies (existência, acesso, conteúdo mínimo do art. 9º); canal para direitos do titular; encarregado; coleta de dados em formulários (finalidade, minimização); terceiros e compartilhamento; retenção de cookies; dados sensíveis e de crianças; documentação de governança (manual).
- **De outras áreas (só referenciar via `related_ids`):**
  - existência/instalação de tags, eventos, duplicação, **PII enviada a analytics/pixel** → `ANL` (ANL-C08); aqui só a **base legal e o consentimento** do disparo
  - flags de cookie (`Secure`, `HttpOnly`, `SameSite`), sessão, autenticação → `SEC`/`API`; segurança dos dados (art. 46) → `API`/`SEC`
  - headers de segurança → `API`; segredos → `SEC`
  - banner que cobre CTA, deslocamento de layout, foco e contraste do banner → `CRO`, `PERF-C08`, `A11Y`
  - formulário quebrado → `QA`; fricção → `CRO`
  - "sobre"/contato institucional → `CONT-C03`; NAP → `LOC`
- **Desempate PRIV × ANL:** "a tag pode disparar e com base em quê?" → `PRIV`; "a tag está instalada, única e sem PII?" → `ANL`.

## 2. Quando acionar

- **Aplicável:** qualquer site que (a) usa cookies/armazenamento ou scripts de terceiros, (b) tem formulário, login, chat, newsletter, WhatsApp com coleta, (c) usa analytics/pixels/embeds.
- **Reduzido:** site 100% estático **sem** cookies, scripts de terceiros nem formulários: só PRIV-C04 (se houver contato por e-mail/telefone, sem aviso) e PRIV-C06; demais viram "não aplicável" em `areas_excluded` com motivo.
- **Ativa-local:** carregar a página em contexto limpo (sem interação) e registrar requisições e cookies **antes de qualquer clique**; nunca clicar em "aceitar" para "ver o que muda" sem registrar os dois estados separadamente.

## 3. Verificações

### PRIV-C01 — Tags e cookies não necessários antes de qualquer escolha  [ANPD + LEI art. 6º, 7º, 8º]
- **O que verificar:** scripts de rastreamento carregados **incondicionalmente** (no HTML, `<script src>` no layout, GTM sem *consent mode*/gatilho de consentimento) e cookies/requisições a terceiros **antes** de qualquer interação do usuário. **Classificar por finalidade** (guia ANPD): **necessários** (autenticação, carrinho, segurança), **analíticos**, de **funcionalidade**, de **publicidade** (Meta Pixel, Google Ads, TikTok, LinkedIn Insight etc.). Interpretação do guia: publicidade/perfilamento e cookies de terceiros dependem, em regra, de consentimento prévio; analytics pode se apoiar em legítimo interesse **em certos contextos** (agregado, sem cruzamento, informado, com oposição); necessários dispensam consentimento.
- **Como verificar:** `estatica` (inventário de scripts/tags e lógica de gating no código); `ativa-local` (requisições de rede e `document.cookie` ao carregar sem interação, em `raw/`).
- **Evidência esperada:** `file:line` do carregamento incondicional + lista de requisições/cookies observados antes da escolha.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO` quanto ao disparo; a conclusão jurídica é do controlador).
  - Sobe para `CRITICO` quando **pixels/cookies de publicidade ou perfilamento de terceiros disparam sem qualquer escolha, não existe mecanismo de consentimento/recusa no site, e a execução local comprova** cookies/requisições antes da interação (evidência concreta de privacidade).
  - Desce para `MELHORIA` quando só há **medição de audiência** e a política informa finalidade, retenção e possibilidade de oposição (legítimo interesse plausível, conforme o guia).
- **Correção:** carregar tags não necessárias só **após** a escolha (gerenciador de consentimento/GTM com gatilho de consentimento; componentes `Script` carregados condicionalmente); manter o inventário atualizado. **Validação:** em contexto limpo, nenhuma requisição ou cookie não necessário antes da escolha; após **recusar**, continuam ausentes.
- **Atenção:** só afirmar o que foi observado. Não declarar "viola a LGPD".
- Relacionado: `ANL-C02`, `ANL-C08`.
- Fonte: F1, F2, F3.

### PRIV-C02 — Banner de cookies: forma e opção real de recusa  [ANPD]
- **O que verificar (quando o site usa consentimento):** conforme o guia da ANPD (**boas práticas**):
  1. **primeiro nível** com botão de **rejeitar todos os cookies não necessários**, de **fácil visualização**, ao lado de "aceitar todos" e "selecionar/gerenciar cookies";
  2. **evitar**: **botão único** ("concordo", "aceito", "ciente"); **mais destaque só ao "aceitar"**; **dificultar a rejeição**; cookies **não necessários ativados por padrão**; **ausência de segundo nível**; **consentimento tácito** (continuar navegando = aceitar); lista **excessivamente granular** (fadiga); informação **só em idioma estrangeiro**; condicionar o acesso ao "aceitar tudo" ("cookie wall" sem alternativa real);
  3. **segundo nível**: categorias descritas com usos e finalidades, consentimento **por finalidade**, cookies baseados em consentimento **desativados por padrão**, informação sobre bloqueio pelo navegador.
- **Como verificar:** `estatica` (componente do banner/CMP, valores padrão dos *toggles*); `ativa-local` (captura do primeiro nível em 360/1440 px; estado dos *toggles* no segundo nível).
- **Evidência esperada:** `file:line` do banner/CMP; captura em `raw/`.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando há **só botão de aceitar** e tags que dependem de consentimento; `MELHORIA` para destaque desigual, falta de categorias ou idioma.
- **Correção:** três opções no primeiro nível com mesmo formato; segundo nível por categoria desativado por padrão. **Validação:** é possível recusar em **um clique** no primeiro nível; "rejeitar" mantém não necessários desativados.
- **Atenção:** o guia é **boa prática**; o banner **não** é exigência literal da lei. Redigir como "diverge da orientação da ANPD", nunca como "ilegal".
- Foco/teclado/contraste do banner → `A11Y`; banner que cobre CTA → `CRO-C09`.
- Fonte: F2.

### PRIV-C03 — Revogação e gerenciamento do consentimento depois da escolha  [LEI art. 8º §5º + ANPD]
- **O que verificar:** existe **mecanismo permanente** (link "Preferências de cookies"/"Gerenciar cookies" no rodapé ou ícone) para **rever e revogar** o consentimento a qualquer momento, **simples e gratuito, de forma similar ao procedimento usado para obtê-lo**. Art. 8º §5º: "o consentimento pode ser revogado a qualquer momento mediante manifestação expressa do titular, por procedimento gratuito e facilitado". O guia lista como prática desaconselhada **não oferecer mecanismo próprio** além do bloqueio no navegador; o bloqueio pelo navegador é **complementar**.
- **Como verificar:** `estatica` (rodapé, componente de preferências); `ativa-local` (captura do rodapé).
- **Evidência esperada:** ausência do link/componente (`file`), ou captura.
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando o consentimento é usado como base e **não há** como revogar; `OPCIONAL` quando o site só usa cookies necessários.
- **Correção:** link persistente que reabre o segundo nível. **Validação:** a revogação interrompe a coleta não necessária e persiste a escolha.
- Fonte: F1 (art. 8º §5º citado no guia), F2.

### PRIV-C04 — Política de privacidade / aviso de privacidade acessível e com o conteúdo do art. 9º  [LEI art. 9º, 6º IV e VI]
- **O que verificar:** o site **coleta dados pessoais** (formulários, e-mail, telefone, login, analytics, cookies) **e** tem política acessível: link **no rodapé de todas as páginas**, perto dos formulários e no banner; conteúdo mínimo do **art. 9º** — (I) **finalidade específica**; (II) **forma e duração** do tratamento; (III) **identificação do controlador**; (IV) **informações de contato**; (V) **uso compartilhado** e sua finalidade; (VI) **responsabilidades** dos agentes; (VII) **direitos do titular**, com menção explícita aos do **art. 18**. Linguagem clara e acessível (art. 6º VI). O plugin **verifica presença de cada item**, **não a correção jurídica**.
- **Como verificar:** `estatica` (rotas/páginas de política, links, texto); `manual` para validar o texto com o jurídico.
- **Evidência esperada:** `file` ausente; lista de itens do art. 9º ausentes (por item).
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando há coleta de dados pessoais **e** nenhuma política acessível; `MELHORIA` para itens do art. 9º ausentes numa política existente; `PREVENTIVO`/`OPCIONAL` para site sem coleta.
- **Correção:** política com os sete itens, em linguagem simples, com data de atualização; o dono fornece os dados reais (controlador, contato, finalidades, terceiros). **Nunca** gerar texto com dados inventados. **Validação:** link no rodapé de todas as páginas e cada item do art. 9º localizável.
- **Atenção:** texto copiado de modelo genérico não descreve o tratamento real: sinalizar apenas incoerências **observáveis** (ex.: política diz que não usa cookies, mas o código carrega GA).
- Fonte: F1.

### PRIV-C05 — Política de cookies: finalidades, retenção e compartilhamento  [ANPD]
- **O que verificar:** o guia **recomenda** uma Política de Cookies (ou equivalente) que informe **finalidades específicas**, **período de retenção**, **compartilhamento com terceiros** e demais aspectos do art. 9º; pode ser (i) seção do aviso de privacidade, (ii) página própria, ou (iii) no próprio banner — desde que **informações claras, precisas e facilmente acessíveis**. Para a Política dentro da Política de Privacidade, o guia recomenda facilitar o acesso à seção (guia/sumário) e **não** depender só dela: usar também segundo nível do banner. Verificar coerência entre a lista de cookies/terceiros **observados** e a descrição.
- **Como verificar:** `estatica`; `ativa-local` (cookies e domínios observados em `raw/`).
- **Evidência esperada:** cookies/terceiros observados que não constam na política.
- **Severidade padrão:** `MELHORIA` (orientação, não exigência literal); `IMPORTANTE` apenas quando a política **contradiz** o observado (ex.: afirma "não usamos cookies de publicidade" e há Meta Pixel no código) — `CONFIRMADO` por código.
- **Correção:** tabela de cookies/categorias/finalidade/retenção/terceiros fornecida pelo dono. **Validação:** a lista bate com o inventário observado.
- Fonte: F2.

### PRIV-C06 — Encarregado (DPO): identidade e contato públicos  [LEI art. 41 §1º + Resolução CD/ANPD 18/2024]
- **O que verificar:** o controlador deve **indicar encarregado** (art. 41); a **identidade e as informações de contato** devem ser divulgadas **publicamente, de forma clara e objetiva, preferencialmente no sítio eletrônico** (art. 41 §1º). A Resolução CD/ANPD nº 18/2024 (publicada em 17/07/2024) trata dessa divulgação; segundo resumo de busca do texto: **identidade** = nome completo (pessoa natural) ou nome empresarial/título do estabelecimento + nome completo do responsável (pessoa jurídica); o **e-mail é contato, não identidade**; local de **destaque e fácil acesso** no site. **O texto integral da resolução e eventuais dispensas (ex.: agentes de pequeno porte) não foram lidos** → não afirmar obrigatoriedade para o caso concreto.
- **Como verificar:** `estatica` (política, rodapé, página de contato); `manual` para confirmar a indicação formal.
- **Evidência esperada:** ausência de identidade/contato do encarregado onde há política de privacidade.
- **Severidade padrão:** `MELHORIA` (`PREVENTIVO`); `IMPORTANTE` **somente** quando o site declara ter encarregado e **não** o identifica/contata de forma localizável (incoerência observável).
- **Correção:** o dono informa nome e canal do encarregado (ou confirma dispensa com o jurídico). **Validação:** identidade e contato visíveis a partir do rodapé/política.
- Fonte: F1, F4, F5.

### PRIV-C07 — Formulários: finalidade informada, minimização e consentimento  [LEI art. 6º I e III, 8º §4º, 9º; art. 11, 14]
- **O que verificar:** em cada formulário que coleta dado pessoal: (a) **finalidade informada** perto do formulário (art. 6º I: "propósitos legítimos, específicos, explícitos e informados"; art. 9º I) e **link para a política**; (b) **necessidade**: só os campos pertinentes e proporcionais (art. 6º III; ex.: CPF, data de nascimento, endereço completo num simples contato); (c) se usa **consentimento** como base: caixa de aceite **não pré-marcada**, **finalidade determinada** — "autorizações genéricas" são vedadas (art. 8º §4º), consentimento **separado** quando em contrato escrito (art. 8º §1º: cláusula destacada); (d) **dados sensíveis** (art. 5º II: origem racial/étnica, convicção religiosa, opinião política, saúde, vida sexual, dados genéticos/biométricos…) exigem tratamento específico (art. 11; o guia da ANPD fala em consentimento "específico e destacado"); (e) **crianças e adolescentes**: tratamento no **melhor interesse** e, para crianças, consentimento **específico e em destaque** de ao menos um dos pais/responsável (art. 14 §1º) — se o público do site inclui menores. **Consentimento não é obrigatório em todo formulário**: pode haver outra base (ex.: art. 7º V, execução de contrato); o plugin **não escolhe a base**.
- **Como verificar:** `estatica` (campos, `required`, textos, `checked` padrão); formulário **nunca enviado** (SPEC §8.3).
- **Evidência esperada:** `file:line` do `<form>`/campo/caixa pré-marcada.
- **Severidade padrão:** `MELHORIA` (campos além do necessário, sem link à política); `IMPORTANTE` (`CONFIRMADO` por código) para **caixa de consentimento pré-marcada**, coleta de **dado sensível** sem destaque/finalidade, ou formulário voltado a menores sem mecanismo de consentimento parental.
- **Correção:** reduzir campos com o dono; texto de finalidade + link da política; caixa desmarcada quando usar consentimento. **Validação:** cada formulário informa finalidade e coleta só o necessário.
- Fricção do formulário → `CRO-C04`; PII em eventos → `ANL-C08`.
- Fonte: F1.

### PRIV-C08 — Terceiros, embeds e compartilhamento declarados  [LEI art. 9º V + ANPD]
- **O que verificar:** inventário de **terceiros** que recebem dados do visitante (IP, identificadores, comportamento): analytics, pixels, **vídeo incorporado**, **mapas**, **fontes** hospedadas por terceiros, chat/WhatsApp widget, CAPTCHA, CDNs, redes sociais, ferramentas de mapa de calor. Verificar se (a) estão **declarados na política** (compartilhamento, art. 9º V); (b) **cookies de terceiros** são tratados como não necessários (guia ANPD) e **passam pelo consentimento**; (c) há **transferência internacional** provável (provedores no exterior): o **art. 33** permite apenas nas hipóteses listadas (nível adequado de proteção, garantias como cláusulas-padrão, consentimento específico e destacado etc.) — **só informar o risco; a análise é jurídica**.
- **Como verificar:** `estatica` (`<script src>`, `<iframe>`, `<link>` externos); `ativa-local` (domínios de terceiros contactados ao carregar, em `raw/`).
- **Evidência esperada:** lista de domínios + `file:line`; trechos da política (ou ausência).
- **Severidade padrão:** `MELHORIA`; `IMPORTANTE` (`CONFIRMADO`) quando um terceiro de **rastreamento/publicidade** recebe dados antes da escolha (cruzar `PRIV-C01`) ou a política **omite** terceiro observado que recebe dados do visitante.
- **Correção:** declarar terceiros; carregar embeds sob consentimento (versão "clique para carregar"); opções que reduzam coleta (vídeo em modo de privacidade, quando o provedor oferecer). **Validação:** inventário observado = declarado.
- Peso de scripts → `PERF-C12`; trade-offs com `CRO`.
- Fonte: F1, F2.

### PRIV-C09 — Retenção e duração dos cookies de rastreamento  [ANPD]
- **O que verificar:** cookies **persistentes** não necessários com validade **muito longa ou indeterminada** (guia: avaliar se persistente é necessário, preferir **sessão**, **limitar a duração** quanto possível; períodos "indeterminados, excessivos ou desproporcionais" não são compatíveis com a LGPD, art. 16); coerência entre a duração observada e a declarada na política.
- **Como verificar:** `ativa-local` (atributos `Expires`/`Max-Age` dos cookies observados, em `raw/`); `estatica` para cookies definidos no código.
- **Evidência esperada:** nome, domínio, duração (**sem valores de identificadores**: mascarar).
- **Severidade padrão:** `MELHORIA`.
- **Correção:** reduzir validade ou usar sessão; ajustar a política. **Validação:** durações compatíveis com a finalidade informada.
- Flags `Secure`/`HttpOnly`/`SameSite` → `SEC`/`API`.
- Fonte: F2.

### PRIV-C10 — Canal para exercício dos direitos do titular  [LEI art. 18, 9º VII]
- **O que verificar:** a política e o site informam **como o titular exerce os direitos do art. 18** (confirmação de tratamento, acesso, correção, anonimização/bloqueio/eliminação, portabilidade, eliminação de dados tratados com consentimento, informação sobre compartilhamento, informação sobre a possibilidade de não consentir e as consequências, **revogação do consentimento**) por **canal real** (e-mail/formulário monitorado), **gratuito e facilitado**; mecanismo próprio de revogação e de oposição (cruza `PRIV-C03`).
- **Como verificar:** `estatica`.
- **Evidência esperada:** ausência de canal ou de menção aos direitos (`file`).
- **Severidade padrão:** `IMPORTANTE` (`CONFIRMADO`) quando há coleta de dados pessoais e **nenhum canal** é indicado; `MELHORIA` quando só faltam os direitos listados.
- **Correção:** indicar canal e prazo de resposta definidos pelo dono. **Validação:** canal visível e testado pelo dono (manual).
- Fonte: F1.

### PRIV-C11 — Governança e resposta a incidentes (verificação manual)  [LEI + Resolução CD/ANPD 15/2024; manual]
- **O que verificar (só o dono/jurídico):** (a) **base legal definida por finalidade** (art. 7º); (b) **registro das operações** de tratamento (art. 37); (c) contratos/cláusulas com **operadores** e fornecedores (analytics, e-mail, hospedagem); (d) **plano de resposta a incidentes**: o **art. 48** exige comunicar a ANPD e o titular em caso de incidente com risco ou dano relevante; a ANPD (página oficial e Res. CD/ANPD nº 15/2024) indica **três dias úteis** para comunicar a ANPD e os titulares, **ressalvado prazo de legislação específica**, com prazos **em dobro** para agentes de pequeno porte, **complementação em vinte dias úteis** e **registro do incidente por no mínimo cinco anos**; (e) avaliação de risco para **legítimo interesse** (quando usado).
- **Como verificar:** `manual` → `not_tested` (`PRIV-C11`).
- **Severidade padrão:** não aplicável (não vira achado).
- **Correção/validação:** o dono confirma cada item com o jurídico/DPO e registra a data.
- **Atenção:** os prazos e critérios vêm de **resumo de página oficial e busca**; o texto integral da Resolução 15/2024 **não foi lido** — confirmar antes de repassar ao cliente.
- Fonte: F1, F6.

## 4. Falsos positivos e armadilhas

- **Analytics sem consentimento ≠ irregular por definição** (legítimo interesse possível em medição agregada, segundo o guia). Reportar o fato e a condição, não a conclusão.
- **Cookies necessários** (sessão, carrinho, autenticação, segurança) não exigem consentimento; o guia diz que consentimento **não é apropriado** para eles.
- Site que **só usa cookies necessários** não precisa de banner de consentimento (mas precisa de transparência).
- Sites sem tags de terceiros e sem formulários: a maior parte de PRIV não se aplica.
- **Frameworks de consentimento (CMP)** podem estar configurados fora do repositório (GTM, painel do provedor): ausência no código não prova ausência de CMP → `RISCO_POTENCIAL` + `not_tested`.
- O IP do visitante chega a qualquer servidor/CDN: não classificar a simples hospedagem como "compartilhamento" sem outros indícios.
- Fontes e CDNs de terceiros: verificar se há alternativa local (relevante também para `PERF`), mas não tratar como infração por si.
- O guia da ANPD está na **versão 1.0 (out/2022)**; pode ter sido ampliado ou ter sido superado por regulamentação: conferir a página da ANPD antes de repassar.
- **Marco Civil da Internet** (guarda de registros de acesso) é outro regime; não coberto aqui.

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | `Script` com `strategy`; `GoogleAnalytics`/`GoogleTagManager` de `@next/third-parties` carregam por padrão — conferir gating por consentimento; middleware pode definir cookies. |
| Astro | Scripts em layout com `is:inline`; embeds de terceiros em componentes; poucos cookies próprios. |
| Vite/React (SPA) | Tags no `index.html` carregam em toda visita; CMPs como componente cliente; HTML bruto não mostra o banner (ver `AIO-C04`). |
| HTML estático | Tags coladas em cada página; fácil esquecer o gating em uma delas. |
| Outros (WordPress etc.) | Plugins de cookies (CMP) e de analytics: verificar se o plugin **realmente** bloqueia scripts até a escolha e se há tags no tema fora do plugin. |

## 6. O que nunca afirmar

- "Em conformidade com a LGPD", "adequado à LGPD", "ilegal", "viola a lei", "sem risco jurídico".
- Que determinado banner "é obrigatório por lei" (o texto da lei não cita banner) ou que o guia da ANPD é "norma vinculante".
- Que **analytics antes do consentimento é irregular** (depende da base e do contexto) ou que está **regular** (depende de informação e oposição).
- Que a base legal correta é X: a escolha é do controlador.
- Que o encarregado é obrigatório para este site (dispensas **não** verificadas).
- Prazos de incidente como "garantidos" sem checar o texto integral da Resolução 15/2024.
- Qualquer texto de política com dados da empresa **inventados**.
- Que o site "não coleta dados pessoais" apenas porque não há formulário (IP, cookies, terceiros também são dados).

## 7. Fontes

- F1 — Presidência da República, **Lei nº 13.709/2018 (LGPD)** — https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm — acessado em 2026-11-05 (lidos os ~120 mil primeiros dos ~125 mil caracteres; trechos: arts. 5º, 6º, 7º, 8º, 9º, 14, 18, 33, 37, 41, 46, 48; art. 11 e 16 citados via F2)
- F2 — ANPD, **Guia Orientativo "Cookies e proteção de dados pessoais"**, versão 1.0, out/2022 (página oficial indica modificação em 23/01/2025) — https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf — 2026-11-05 — texto lido integralmente (40 páginas, extraído localmente); páginas citadas: categorias (p. 9–12), consentimento (p. 17–20), legítimo interesse (p. 23–27), política de cookies (p. 28–29), banners (p. 30–36)
- F3 — ANPD, notícia "ANPD lança guia orientativo 'Cookies e Proteção de Dados Pessoais'" (18/10/2022; "viés educativo", "não isenta os agentes de tratamento…") — https://www.gov.br/anpd/pt-br/assuntos/noticias-periodo-eleitoral/anpd-lanca-guia-orientativo-201ccookies-e-protecao-de-dados-pessoais201d — 2026-11-05
- F4 — ANPD, notícia "ANPD aprova norma sobre a atuação do Encarregado pelo Tratamento de Dados Pessoais" (Resolução CD/ANPD nº 18/2024, publicada em 17/07/2024) — https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-norma-sobre-a-atuacao-do-encarregado-pelo-tratamento-de-dados-pessoais — 2026-11-05 (a notícia menciona divulgação de identidade e contato, **sem** detalhar o local)
- F5 — Resolução CD/ANPD nº 18/2024 (detalhes sobre identidade e divulgação no sítio eletrônico) — **lidos apenas via resumo de resultado de busca** (texto do Diário Oficial e guia da ANPD sobre o encarregado; páginas não abertas) — 2026-11-05 — **a confirmar na fonte antes de usar como regra**
- F6 — ANPD, Comunicação de incidente de segurança (Resolução CD/ANPD nº 15/2024: três dias úteis; critérios de risco relevante; aplica-se a controladores) — https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis — 2026-11-05; prazos em dobro, complementação em 20 dias úteis e registro por 5 anos: **resumo de busca do texto da Resolução** (não lido na íntegra)
- Não consultados: Guia Orientativo para Agentes de Tratamento e Encarregado (ANPD); Resolução CD/ANPD nº 2/2022 (agentes de pequeno porte); art. 11 (dados sensíveis) e art. 16 no texto da lei (citados pelo guia); regulamentação sobre crianças e adolescentes (inclusive normas posteriores a 2024); Marco Civil da Internet; regras de consentimento de provedores (Google Consent Mode, IAB TCF).
