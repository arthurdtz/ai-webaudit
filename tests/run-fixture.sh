#!/usr/bin/env bash
# Teste da fixture (SPEC §11): copia tests/fixtures/sample-site para /tmp/webaudit-fixture-<timestamp>, faz git init,
# executa /ai-webaudit:audit --static-only em modo headless (claude -p, sem --bare: hooks precisam rodar) e compara
# o findings.json com o gabarito (tests/compare.mjs).
#
# Uso:
#   tests/run-fixture.sh                    # roda tudo (exige `claude` autenticado)
#   tests/run-fixture.sh --prepare-only     # só prepara a cópia e imprime os comandos manuais
#   tests/run-fixture.sh --compare <findings.json>   # só compara um findings.json existente
#   WEBAUDIT_MAX_BUDGET=5 tests/run-fixture.sh       # limite de gasto em USD (--max-budget-usd)
#   WEBAUDIT_AUDIT_ARGS="--static-only" ...          # argumentos da skill (padrão: --static-only)
# Saída: código 0 se recall >= 80% e 0 must_not_flag apontados; 1 se reprovado; 2 erro de uso; 3 sem autenticação; 4 auditoria não gerou findings.json.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARGS_AUDIT="${WEBAUDIT_AUDIT_ARGS:---static-only}"

if [ "${1:-}" = "--compare" ]; then
  [ -n "${2:-}" ] || { echo "Uso: tests/run-fixture.sh --compare <findings.json>" >&2; exit 2; }
  exec node "$ROOT/tests/compare.mjs" "$2"
fi

TS="$(date +%Y%m%d-%H%M%S)-$$"
WORK="/tmp/webaudit-fixture-$TS"
LOGS="$WORK.logs"   # logs do harness FORA da cópia (senão aparecem como "alteração no alvo")
mkdir -p "$WORK" "$LOGS" || exit 2
cp -R "$ROOT/tests/fixtures/sample-site/." "$WORK/"
git -C "$WORK" init -q -b main
git -C "$WORK" add -A
git -C "$WORK" -c user.name="webaudit-test" -c user.email="test@example.invalid" commit -q -m "fixture: estado inicial"
BASE="$(git -C "$WORK" rev-parse HEAD)"
echo "Cópia da fixture: $WORK (commit $BASE)"

CMD=(claude -p "/ai-webaudit:audit $ARGS_AUDIT" --plugin-dir "$ROOT" --permission-mode dontAsk --allowedTools "Read,Grep,Glob,Write,Bash,Agent" --output-format json)
[ -n "${WEBAUDIT_MAX_BUDGET:-}" ] && CMD+=(--max-budget-usd "$WEBAUDIT_MAX_BUDGET")

if [ "${1:-}" = "--prepare-only" ]; then
  cat <<MSG

Rode manualmente (a auditoria usa subagentes e consome tokens):

  cd $WORK
  $(printf "%q " "${CMD[@]}")< /dev/null | tee $LOGS/claude-output.json

Ou, de forma interativa:

  cd $WORK && claude --plugin-dir $ROOT
  # dentro do Claude Code:
  /ai-webaudit:audit $ARGS_AUDIT

Depois compare:

  node $ROOT/tests/compare.mjs \$(ls -d $WORK/.webaudit/runs/*/ | tail -1)findings.json
  git -C $WORK status --porcelain        # deve estar vazio (nada fora de .webaudit/)
MSG
  exit 0
fi

echo "Executando: ${CMD[*]}"
( cd "$WORK" && "${CMD[@]}" < /dev/null > "$LOGS/claude-output.json" 2> "$LOGS/claude-stderr.txt" ); RC=$?
if grep -qiE "Failed to authenticate|OAuth session expired|not logged in" "$LOGS/claude-output.json" "$LOGS/claude-stderr.txt" 2>/dev/null; then
  echo "ERRO: o claude não está autenticado (rode 'claude' e faça login) — a auditoria não rodou." >&2
  echo "Para rodar manualmente: tests/run-fixture.sh --prepare-only" >&2
  exit 3
fi
echo "claude saiu com código $RC (saída em $LOGS/claude-output.json)"

LATEST="$(cat "$WORK/.webaudit/latest" 2>/dev/null | tr -d '\n')"
FINDINGS="$WORK/.webaudit/runs/$LATEST/findings.json"
if [ -z "$LATEST" ] || [ ! -f "$FINDINGS" ]; then
  echo "ERRO: a auditoria não gerou findings.json (veja $LOGS/claude-output.json e $WORK/.webaudit/)." >&2
  exit 4
fi
echo "findings.json: $FINDINGS"

echo; echo "── Verificação: nada alterado fora de .webaudit/ ──"
DIRTY="$(git -C "$WORK" status --porcelain)"; HEAD_NOW="$(git -C "$WORK" rev-parse HEAD)"
if [ -z "$DIRTY" ] && [ "$HEAD_NOW" = "$BASE" ]; then echo "✔ git status limpo e nenhum commit novo"; else echo "✖ ALTERAÇÕES no alvo:"; echo "$DIRTY"; [ "$HEAD_NOW" != "$BASE" ] && echo "✖ HEAD mudou ($BASE → $HEAD_NOW)"; fi
echo; echo "── Gabarito ──"
node "$ROOT/tests/compare.mjs" "$FINDINGS"
