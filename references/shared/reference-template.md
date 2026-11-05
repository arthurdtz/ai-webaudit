# Modelo das referências de especialistas

Estrutura obrigatória de `references/NN-<area>.md` (SPEC §5.1). Texto denso e operacional, sem introdução genérica, pt-BR (identificadores em inglês).

Regras de autoria:
- Escrever **a partir de fontes oficiais consultadas no momento** (WebFetch/WebSearch), não de memória.
- Todo limiar numérico ou regra técnica relevante tem fonte (URL + data de acesso).
- Separar **[OFICIAL]** (documentado) de **[PRÁTICA]** (recomendação sem garantia → severidade máxima `MELHORIA`). Marcar cada verificação com uma das duas tags.
- Não recomendar recursos descontinuados; verificar o status atual de cada recurso citado.
- Cada verificação tem **uma única área dona**. Itens de outras áreas só entram como referência cruzada (`related_ids`).
- IDs de verificação são estáveis: `<PREFIXO>-C<NN>`; nunca reutilizar ou renumerar.
- Não incluir instruções específicas da fixture de testes (evitar overfitting).

---

````markdown
# {{NN}} — {{Nome da área}}

Prefixo: `{{PREFIXO}}` · Subagente: `{{subagente}}` · Revisado em: {{AAAA-MM-DD}}

## 1. Escopo e fronteiras

- **Desta área:** …
- **De outras áreas (apenas referenciar):** … → área {{NN}} (`{{PREFIXO}}`)

## 2. Quando acionar

- **Aplicável quando:** {{sinais no projeto}}
- **Não aplicável quando:** {{sinais}}

## 3. Verificações

### {{PREFIXO}}-C01 — {{título curto}}  [OFICIAL | PRÁTICA]

- **O que verificar:** {{descrição objetiva}}
- **Como verificar:** `estatica` | `ativa-local` | `ativa-remota` | `manual`
- **Evidência esperada:** {{arquivo+trecho, saída de comando, relatório}}
- **Severidade padrão:** {{CRITICO|IMPORTANTE|MELHORIA|OPCIONAL}}
  - Sobe para {{…}} quando {{condição}}.
  - Desce para {{…}} quando {{condição}}.
- **Correção recomendada:** {{texto}}
  - Next.js: …
  - Astro: …
  - Vite/React: …
  - HTML estático: …
- **Critério de validação:** {{como confirmar que foi corrigido}}

### {{PREFIXO}}-C02 — …

## 4. Falsos positivos e armadilhas

- {{situação que parece problema mas não é}}

## 5. Variações por stack

| Stack | O que muda |
|---|---|
| Next.js | … |
| Astro | … |
| Vite/React | … |
| HTML estático | … |
| Outros | … |

## 6. O que nunca afirmar

- {{afirmação que a ferramenta ou a análise não sustenta}}

## 7. Fontes

- {{título}} — {{URL}} — acessado em {{AAAA-MM-DD}}
````

---

## Exemplo de verificação preenchida (genérico, ilustrativo)

### SEO-C01 — `noindex` em páginas que deveriam ser indexáveis  [OFICIAL]

- **O que verificar:** meta `robots` ou cabeçalho `X-Robots-Tag` com `noindex` em páginas públicas que não são rascunho, admin ou agradecimento.
- **Como verificar:** `estatica` (templates, `<meta name="robots">`, configs de hosting com `headers`); `ativa-remota` para confirmar o cabeçalho real.
- **Evidência esperada:** `file:line` com a diretiva; ou cabeçalho de resposta em `raw/`.
- **Severidade padrão:** `IMPORTANTE`
  - Sobe para `CRITICO` quando a diretiva aparece no layout global e afeta o site inteiro em produção (`CONFIRMADO`).
  - Desce para `OPCIONAL` quando restrita a ambiente de staging comprovadamente separado.
- **Correção recomendada:** remover a diretiva do template ou condicioná-la ao ambiente.
  - Next.js: ajustar `metadata.robots` / `robots` no layout.
  - Astro: remover `<meta name="robots">` do layout compartilhado.
  - HTML estático: remover a meta das páginas afetadas.
- **Critério de validação:** o HTML final de cada página afetada não contém `noindex`; o cabeçalho da resposta não traz `X-Robots-Tag: noindex`.
