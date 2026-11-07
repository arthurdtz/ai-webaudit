#!/usr/bin/env bash
# Teste das skills pre-launch, optimize e fix (Etapa 9) em UMA cópia nova da fixture, em modo headless (claude -p, sem --bare).
# Passos: (1) pre-launch --static-only; (2) optimize "aumentar conversão" --static-only; (3) fix de 3 achados de áreas diferentes
# (QA-C11 crítico, A11Y-C03, SEO-C06) com --yes; (4) audit --static-only de novo e confere que os 3 sumiram.
# Uso: tests/run-skills.sh [--prepare-only]       (WEBAUDIT_MAX_BUDGET=<USD> limita o gasto de cada chamada)
# Saída: 0 se todas as verificações passaram; 1 se alguma falhou; 3 sem autenticação.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d-%H%M%S)-$$"; WORK="/tmp/webaudit-skills-$TS"; LOGS="$WORK.logs"
mkdir -p "$WORK" "$LOGS" || exit 2
cp -R "$ROOT/tests/fixtures/sample-site/." "$WORK/"
git -C "$WORK" init -q -b main && git -C "$WORK" add -A
git -C "$WORK" -c user.name="webaudit-test" -c user.email="test@example.invalid" commit -q -m "fixture: estado inicial"
BASE="$(git -C "$WORK" rev-parse HEAD)"; echo "Cópia: $WORK (commit $BASE) · logs: $LOGS"

claude_run() { # $1 = nome, $2 = prompt
  local cmd=(claude -p "$2" --plugin-dir "$ROOT" --permission-mode dontAsk --allowedTools "Read,Grep,Glob,Write,Edit,Bash,Agent" --output-format json)
  [ -n "${WEBAUDIT_MAX_BUDGET:-}" ] && cmd+=(--max-budget-usd "$WEBAUDIT_MAX_BUDGET")
  if [ "${PREPARE:-0}" = 1 ]; then echo "  cd $WORK && $(printf '%q ' "${cmd[@]}")< /dev/null"; return 0; fi
  echo; echo "══ $1: $2"
  ( cd "$WORK" && "${cmd[@]}" < /dev/null > "$LOGS/$1.json" 2> "$LOGS/$1.err" ); local rc=$?
  if grep -qiE "Failed to authenticate|OAuth session expired|not logged in" "$LOGS/$1.json" "$LOGS/$1.err" 2>/dev/null; then echo "ERRO: claude sem autenticação (faça login em 'claude')." >&2; exit 3; fi
  node -e "const o=JSON.parse(require('fs').readFileSync('$LOGS/$1.json','utf8'));console.log('  custo US\$',(o.total_cost_usd??0).toFixed(2),'· turnos',o.num_turns,'· erro',o.is_error)" 2>/dev/null
  echo "  (claude saiu com código $rc)"
}
latest_run() { local id; id="$(tr -d '\n' < "$WORK/.webaudit/latest" 2>/dev/null)"; [ -n "$id" ] && echo "$WORK/.webaudit/runs/$id"; }

if [ "${1:-}" = "--prepare-only" ]; then
  PREPARE=1
  echo; echo "Rode, em ordem (cada chamada usa subagentes e gasta tokens):"
  claude_run pre-launch "/ai-webaudit:pre-launch --static-only"
  claude_run optimize "/ai-webaudit:optimize aumentar conversão --static-only"
  echo "  # descubra os IDs: node $ROOT/tests/check-skills.mjs pick <RUN do pre-launch>"
  claude_run fix "/ai-webaudit:fix <3 IDs> --yes"
  claude_run audit2 "/ai-webaudit:audit --static-only"
  exit 0
fi
FAIL=0
claude_run pre-launch "/ai-webaudit:pre-launch --static-only"; R1="$(latest_run)"
[ -n "$R1" ] || { echo "ERRO: pre-launch não gerou run"; exit 1; }
echo "── Verificação 1: pre-launch ($R1)"; node "$ROOT/tests/check-skills.mjs" prelaunch "$R1" || FAIL=1

claude_run optimize "/ai-webaudit:optimize aumentar conversão --static-only"; R2="$(latest_run)"
echo "── Verificação 2: optimize ($R2)"; [ "$R2" != "$R1" ] && { node "$ROOT/tests/check-skills.mjs" optimize "$R2" || FAIL=1; } || { echo "✖ optimize não gerou um run novo"; FAIL=1; }

IDS="$(node "$ROOT/tests/check-skills.mjs" pick "$R1")" || { echo "✖ não foi possível escolher os IDs"; exit 1; }
echo; echo "IDs escolhidos (QA-C11, A11Y-C03, SEO-C06): $IDS"
claude_run fix "/ai-webaudit:fix $IDS --run $(basename "$R1") --yes"
echo "── Verificação 3: fix"
node "$ROOT/tests/check-skills.mjs" fixed "$R1" $IDS || FAIL=1
echo "  alterações no projeto (esperado: só arquivos dos achados; nenhum commit):"; git -C "$WORK" status --short | grep -v '^??' | sed 's/^/    /'
[ "$(git -C "$WORK" rev-parse HEAD)" = "$BASE" ] && echo "✔ nenhum commit novo" || { echo "✖ HEAD mudou"; FAIL=1; }
echo "  branch atual: $(git -C "$WORK" branch --show-current)"
[ -f "$WORK/.webaudit/.lock" ] && { echo "✖ lock ainda existe (deveria ter sido liberado)"; FAIL=1; } || echo "✔ lock liberado"
echo "  git diff --stat:"; git -C "$WORK" diff --stat | sed 's/^/    /'

claude_run audit2 "/ai-webaudit:audit --static-only"; R4="$(latest_run)"
echo "── Verificação 4: audit de novo ($R4)"; [ "$R4" != "$R2" ] && { node "$ROOT/tests/check-skills.mjs" gone "$R4" "$R1" $IDS || FAIL=1; } || { echo "✖ audit não gerou um run novo"; FAIL=1; }
echo; [ "$FAIL" = 0 ] && echo "RESULTADO: APROVADO" || echo "RESULTADO: REPROVADO (veja ✖ acima)"
exit "$FAIL"
