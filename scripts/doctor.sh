#!/usr/bin/env bash
# Verifica (e, com --install, instala) as dependências DO PLUGIN. Nunca toca no projeto alvo.
# Uso: scripts/doctor.sh [--install] [--quiet]
#   --install  npm ci em scripts/ e instalação do Chromium do Playwright (baixa ~150 MB).
#              Bibliotecas de sistema (WSL/Linux): mostra o comando, não executa sozinho.
# Saída: ✔ ok · ✖ falha (obrigatório) · ! aviso (opcional). Exit 0 se nada obrigatório falhou, 1 caso contrário.
set -u
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
INSTALL=0; QUIET=0
for a in "$@"; do case "$a" in --install) INSTALL=1;; --quiet) QUIET=1;; -h|--help) sed -n '2,7p' "$0"; exit 0;; *) echo "Opção desconhecida: $a" >&2; exit 2;; esac; done

if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; N=$'\033[0m'; else G=""; R=""; Y=""; D=""; N=""; fi
FAIL=0; WARN=0
ok()   { [ "$QUIET" = 1 ] || printf '%s✔%s %s\n' "$G" "$N" "$1"; }
bad()  { printf '%s✖%s %s\n   → %s\n' "$R" "$N" "$1" "$2"; FAIL=$((FAIL+1)); }
warn() { printf '%s!%s %s\n   → %s\n' "$Y" "$N" "$1" "$2"; WARN=$((WARN+1)); }
note() { [ "$QUIET" = 1 ] || printf '%s  %s%s\n' "$D" "$1" "$N"; }
ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; } # $1 >= $2

echo "AI WebAudit — doctor (plugin: $PLUGIN_ROOT)"
NODE_MIN="22.19.0"

# ── node / npm / git / claude ──
if command -v node >/dev/null 2>&1; then
  NV="$(node -v | sed 's/^v//')"
  if ver_ge "$NV" "$NODE_MIN"; then ok "node $NV (mínimo $NODE_MIN, exigido pelo Lighthouse 13)"; else bad "node $NV é antigo (mínimo $NODE_MIN)" "instale Node ≥ $NODE_MIN (ex.: nvm install 22) e rode de novo"; fi
else bad "node não encontrado" "instale Node ≥ $NODE_MIN (https://nodejs.org ou nvm)"; fi
if command -v npm >/dev/null 2>&1; then ok "npm $(npm -v)"; else bad "npm não encontrado" "vem com o Node; reinstale o Node"; fi
if command -v git >/dev/null 2>&1; then ok "$(git --version)"; else bad "git não encontrado" "sudo apt-get install git"; fi
if command -v claude >/dev/null 2>&1; then ok "claude $(claude --version 2>/dev/null | head -n1)"; else warn "claude (CLI) não encontrado" "necessário para usar o plugin (https://code.claude.com/docs); não afeta os coletores"; fi
if command -v gh >/dev/null 2>&1; then note "gh $(gh --version | head -n1 | cut -d' ' -f3) (opcional)"; fi

# ── instalar dependências do plugin ──
if [ "$INSTALL" = 1 ]; then
  if ! command -v npm >/dev/null 2>&1; then bad "não é possível instalar sem npm" "instale Node/npm"; else
    echo "Instalando dependências do plugin em scripts/ (npm ci)…"
    if [ -f "$SCRIPTS_DIR/package-lock.json" ]; then (cd "$SCRIPTS_DIR" && npm ci --no-audit --no-fund) || bad "npm ci falhou" "verifique a rede e a versão do Node; tente de novo"; else bad "package-lock.json ausente em scripts/" "restaure o arquivo do repositório (git checkout -- scripts/package-lock.json)"; fi
  fi
fi

# ── dependências instaladas ──
DEPS_OK=1
if [ -d "$SCRIPTS_DIR/node_modules" ]; then
  for p in ajv ajv-formats lighthouse playwright @axe-core/playwright; do
    if [ -f "$SCRIPTS_DIR/node_modules/$p/package.json" ]; then
      PV="$(node -p "require('$SCRIPTS_DIR/node_modules/$p/package.json').version" 2>/dev/null)"; ok "$p $PV"
    else bad "dependência ausente: $p" "rode: scripts/doctor.sh --install"; DEPS_OK=0; fi
  done
else bad "scripts/node_modules não existe" "rode: scripts/doctor.sh --install"; DEPS_OK=0; fi

# ── Chromium do Playwright ──
# Teste FUNCIONAL: o Playwright em modo headless usa o "chrome-headless-shell"; só ter o executável do Chromium não basta.
launch_test() { (cd "$SCRIPTS_DIR" && timeout 60 node -e "import('playwright').then(async m=>{const b=await m.chromium.launch({headless:true});console.log(b.version());await b.close()}).catch(e=>{console.error(String(e.message).split('\n')[0]);process.exit(1)})" 2>&1); }
CHROMIUM=""
if [ "$DEPS_OK" = 1 ]; then
  CHROMIUM="$(cd "$SCRIPTS_DIR" && node -e "import('playwright').then(m=>console.log(m.chromium.executablePath())).catch(()=>{})" 2>/dev/null)"
  LT="$(launch_test)"; LT_RC=$?
  if [ "$LT_RC" -ne 0 ] && [ "$INSTALL" = 1 ]; then
    echo "Instalando o Chromium do Playwright (≈150–400 MB; PLAYWRIGHT_BROWSERS_PATH respeitado)…"
    (cd "$SCRIPTS_DIR" && npx --no-install playwright install chromium) || bad "playwright install chromium falhou" "verifique a rede; rode: cd scripts && npx playwright install chromium"
    LT="$(launch_test)"; LT_RC=$?
  fi
  if [ "$LT_RC" -eq 0 ]; then
    ok "Chromium do Playwright inicia em modo headless (versão $LT)"
    [ -n "$CHROMIUM" ] && note "executável: $CHROMIUM"
  else
    MISSING=""; [ -n "$CHROMIUM" ] && [ -x "$CHROMIUM" ] && MISSING="$(ldd "$CHROMIUM" 2>/dev/null | grep 'not found' | awk '{print $1}' | sort -u | tr '\n' ' ')"
    if [ -n "$MISSING" ]; then
      bad "faltam bibliotecas de sistema para o Chromium: $MISSING" "rode (com sudo, por sua conta): cd scripts && npx playwright install-deps chromium"
    else
      bad "o Chromium do Playwright não inicia (${LT:-sem detalhe})" "rode: scripts/doctor.sh --install  (ou: cd scripts && npx playwright install chromium); em WSL/Linux sem bibliotecas: npx playwright install-deps chromium"
    fi
  fi
fi

# ── resumo ──
echo
if [ "$FAIL" -eq 0 ]; then
  printf '%sTudo pronto%s' "$G" "$N"; [ "$WARN" -gt 0 ] && printf ' (com %s aviso(s))' "$WARN"; echo ". Coleta ativa-local e Lighthouse disponíveis."
  exit 0
else
  printf '%s%s problema(s) obrigatório(s).%s Sem eles a coleta ativa-local (Lighthouse, axe, capturas) não roda; a coleta estática e o guard continuam funcionando.\n' "$R" "$FAIL" "$N"
  exit 1
fi
