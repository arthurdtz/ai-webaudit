#!/usr/bin/env node
// Hook PreToolUse do AI WebAudit (SPEC §9.3): proteção do MODO LEITURA.
//
// - Só atua enquanto existir <alvo>/.webaudit/.lock VÁLIDO (criado na Fase 0 por scripts/lock.mjs,
//   removido na Fase 6, expira em 2 h). Sem lock válido: exit 0 (permite tudo).
// - Com lock: bloqueia Write/Edit/MultiEdit/NotebookEdit fora de .webaudit/ e Bash com padrões de risco.
// - Bloqueio = exit 2 + motivo em stderr (a doc: "exit 2 bloqueia"; qualquer outro código NÃO bloqueia).
// - FALHA FECHADA com lock válido: erro interno, entrada ilegível ou lock ilegível => exit 2.
// - Lock com `"mode": "fix"` (criado pelo /ai-webaudit:fix): NÃO é modo leitura. Só aplica o que é SEMPRE proibido (SPEC §9.4): commit/push/tag/reset, deploy,
//   infraestrutura, clientes de banco de dados, publicação de pacotes, envio de dados a terceiros; e confina escritas ao projeto (nunca .git/, nunca o próprio lock).
// - Não é um sandbox: é uma camada de proteção (SPEC §9). Ver docs/DECISIONS.md.
import { readFileSync, existsSync, realpathSync, appendFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { findLock, WEBAUDIT_DIR, LOCK_NAME } from "./lib/lock.mjs";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class Deny extends Error {}
const deny = (msg) => { throw new Deny(msg); };

// ───────────────────────── caminhos ─────────────────────────
function expandHome(p) {
  if (p === "~" || p.startsWith("~/")) return join(process.env.HOME ?? "/root", p.slice(1));
  return p;
}
/** Resolve symlinks no trecho existente do caminho e acrescenta o resto. */
function realish(abs) {
  let cur = abs;
  const rest = [];
  for (let i = 0; i < 64; i++) {
    if (existsSync(cur)) {
      try { return join(realpathSync(cur), ...rest.reverse()); } catch { return abs; }
    }
    const parent = dirname(cur);
    if (parent === cur) return abs;
    rest.push(basename(cur));
    cur = parent;
  }
  return abs;
}
function makeCtx(targetRoot, mode = "read") {
  const wa = join(targetRoot, WEBAUDIT_DIR);
  const waReal = realish(wa);
  const rootReal = realish(targetRoot);
  // .webaudit não pode ser um link simbólico que escapa do alvo
  const waSafe = waReal === join(rootReal, WEBAUDIT_DIR);
  return { targetRoot, rootReal, waReal, waSafe, mode };
}
function insideWebaudit(ctx, p, cwd) {
  if (!ctx.waSafe) return false;
  if (typeof p !== "string" || p === "" || p.includes("$") || p.includes("`")) return false;
  const abs = resolve(cwd, expandHome(p));
  const real = realish(abs);
  return real === ctx.waReal || real.startsWith(ctx.waReal + sep);
}
function isLockPath(ctx, p, cwd) {
  if (typeof p !== "string") return false;
  const real = realish(resolve(cwd, expandHome(p)));
  return real === join(ctx.waReal, LOCK_NAME);
}
function checkWritePathFix(ctx, p, cwd, what) {
  if (typeof p !== "string" || p === "" || p.includes("$") || p.includes("`")) deny(`${what} com destino dinâmico bloqueado: ${p}`);
  const real = realish(resolve(cwd, expandHome(p)));
  if (real === ctx.rootReal) deny(`${what} na raiz do projeto bloqueado: ${p}`);
  if (!real.startsWith(ctx.rootReal + sep)) deny(`${what} fora do projeto bloqueado no modo correção: ${p}`);
  const rel = real.slice(ctx.rootReal.length + 1).split(sep);
  if (rel[0] === ".git") deny(`${what} dentro de .git/ bloqueado: ${p}`);
  if (rel[0] === WEBAUDIT_DIR && rel[1] === LOCK_NAME && rel.length === 2) deny(`${what} no lock bloqueado (use scripts/lock.mjs): ${p}`);
}
function inTarget(ctx, script, st) {
  if (/\$/.test(script)) return false;
  const real = realish(resolve(st.dir, expandHome(script)));
  return real.startsWith(ctx.rootReal + sep);
}
function checkWritePath(ctx, p, cwd, what) {
  if (p === "-" ) return;
  if (ctx.mode === "fix") return checkWritePathFix(ctx, p, cwd, what);
  if (!insideWebaudit(ctx, p, cwd)) deny(`${what} fora de ${WEBAUDIT_DIR}/ bloqueado no modo leitura: ${p}`);
  if (isLockPath(ctx, p, cwd)) deny(`${what} no lock do modo leitura bloqueado (use scripts/lock.mjs): ${p}`);
}

// ───────────────────────── parser de shell (aproximado) ─────────────────────────
const SEP_WORDS = new Set(["then", "do", "else", "elif", "if", "while", "until", "!", "{", "}", "time"]);

/** Divide uma linha de comando em comandos simples. Não executa nada. */
function parseShell(input) {
  const commands = [];
  let words = [];
  let redirects = [];
  let cur = "";
  let inWord = false;
  let dyn = false; // palavra contém expansão ($VAR, $(...), `...`)
  let quote = null;
  const pendingHeredocs = [];
  const nested = [];
  const n = input.length;

  const endWord = () => {
    if (inWord) { words.push({ text: cur, dyn }); }
    cur = ""; inWord = false; dyn = false;
  };
  const endCmd = () => {
    endWord();
    if (words.length || redirects.length) commands.push({ words, redirects });
    words = []; redirects = [];
  };
  const skipToMatch = (i, open, close) => {
    // i aponta para o primeiro caractere após a abertura
    let depth = 1; let j = i; let q = null;
    while (j < n && depth > 0) {
      const c = input[j];
      if (q) { if (c === "\\" && q === '"') j++; else if (c === q) q = null; }
      else if (c === "'" || c === '"') q = c;
      else if (c === "\\") j++;
      else if (c === open) depth++;
      else if (c === close) depth--;
      j++;
    }
    return { inner: input.slice(i, Math.max(i, j - 1)), next: j };
  };
  const readRedirTarget = (i) => {
    // lê a próxima palavra (com aspas simples) a partir de i
    let j = i;
    while (j < n && (input[j] === " " || input[j] === "\t")) j++;
    let t = ""; let q = null; let d = false;
    while (j < n) {
      const c = input[j];
      if (q) { if (c === q) { q = null; j++; continue; } if (c === "\\" && q === '"') { t += input[j + 1] ?? ""; j += 2; continue; } if (c === "$" || c === "`") d = true; t += c; j++; continue; }
      if (c === "'" || c === '"') { q = c; j++; continue; }
      if (c === "\\") { t += input[j + 1] ?? ""; j += 2; continue; }
      if (/\s/.test(c) || ";&|()<>".includes(c)) break;
      if (c === "$" || c === "`") d = true;
      t += c; j++;
    }
    return { text: t, dyn: d, next: j };
  };

  let i = 0;
  while (i < n) {
    const c = input[i];
    if (quote === "'") { if (c === "'") quote = null; else cur += c; i++; continue; }
    if (quote === '"') {
      if (c === '"') { quote = null; i++; continue; }
      if (c === "\\") { cur += input[i + 1] ?? ""; i += 2; continue; }
      if (c === "$" && input[i + 1] === "(") { const m = skipToMatch(i + 2, "(", ")"); nested.push(m.inner); dyn = true; cur += "$SUBST"; i = m.next; continue; }
      if (c === "`") { const m = skipToMatch(i + 1, "`", "`"); nested.push(m.inner); dyn = true; cur += "$SUBST"; i = m.next; continue; }
      if (c === "$") dyn = true;
      cur += c; i++; continue;
    }
    // fora de aspas
    if (c === "'" ) { quote = "'"; inWord = true; i++; continue; }
    if (c === '"') { quote = '"'; inWord = true; i++; continue; }
    if (c === "\\") {
      if (input[i + 1] === "\n") { i += 2; continue; }
      cur += input[i + 1] ?? ""; inWord = true; i += 2; continue;
    }
    if (c === "#" && !inWord) { while (i < n && input[i] !== "\n") i++; continue; }
    if (c === "$" && input[i + 1] === "(") { const m = skipToMatch(i + 2, "(", ")"); nested.push(m.inner); inWord = true; dyn = true; cur += "$SUBST"; i = m.next; continue; }
    if (c === "`") { const m = skipToMatch(i + 1, "`", "`"); nested.push(m.inner); inWord = true; dyn = true; cur += "$SUBST"; i = m.next; continue; }
    if (c === "$") { inWord = true; dyn = true; cur += c; i++; continue; }
    if (c === "\n") {
      endCmd();
      i++;
      while (pendingHeredocs.length) {
        const h = pendingHeredocs.shift();
        while (i < n) {
          let e = input.indexOf("\n", i); if (e === -1) e = n;
          const line = input.slice(i, e); i = Math.min(n, e + 1);
          if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) break;
        }
      }
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") { endWord(); i++; continue; }
    if (c === ";" || c === "(" || c === ")") { endCmd(); i++; continue; }
    if (c === "&" || c === "|") {
      if (c === "&" && input[i + 1] === ">") {
        // &> e &>> : redireciona stdout/stderr para arquivo
        endWord();
        let j = i + 2; if (input[j] === ">") j++;
        const t = readRedirTarget(j);
        redirects.push({ op: "&>", target: t.text, dyn: t.dyn });
        i = t.next; continue;
      }
      endCmd();
      i += (input[i + 1] === c || (c === "|" && input[i + 1] === "&")) ? 2 : 1;
      continue;
    }
    if (c === ">") {
      let fd = "";
      if (inWord && /^\d+$/.test(cur)) { fd = cur; cur = ""; inWord = false; dyn = false; } else endWord();
      let j = i + 1; let op = ">";
      if (input[j] === ">") { op = ">>"; j++; } else if (input[j] === "|") { op = ">|"; j++; }
      if (input[j] === "&") {
        const t = readRedirTarget(j + 1);
        if (/^(\d+|-)$/.test(t.text)) { i = t.next; continue; } // duplicação de descritor
        redirects.push({ op: ">&", target: t.text, dyn: t.dyn }); i = t.next; continue;
      }
      if (input[j] === "(") { // >( ... ) substituição de processo de escrita
        const m = skipToMatch(j + 1, "(", ")"); nested.push(m.inner);
        redirects.push({ op: ">(", target: "$SUBST", dyn: true }); i = m.next; continue;
      }
      const t = readRedirTarget(j);
      redirects.push({ op, target: t.text, dyn: t.dyn, fd });
      i = t.next; continue;
    }
    if (c === "<") {
      endWord();
      if (input[i + 1] === "<" && input[i + 2] === "<") { const t = readRedirTarget(i + 3); i = t.next; continue; } // <<< here-string
      if (input[i + 1] === "<") {
        let j = i + 2; let strip = false; if (input[j] === "-") { strip = true; j++; }
        const t = readRedirTarget(j);
        pendingHeredocs.push({ delim: t.text, strip });
        i = t.next; continue;
      }
      if (input[i + 1] === "(") { const m = skipToMatch(i + 2, "(", ")"); nested.push(m.inner); i = m.next; continue; }
      const t = readRedirTarget(i + 1); i = t.next; continue;
    }
    cur += c; inWord = true; i++;
  }
  endCmd();
  return { commands, nested };
}

// ───────────────────────── regras de comando ─────────────────────────
const GIT_ALLOW = new Set([
  "log", "show", "status", "diff", "rev-parse", "rev-list", "ls-files", "ls-tree", "cat-file", "grep", "blame",
  "shortlog", "describe", "for-each-ref", "check-ignore", "name-rev", "merge-base", "diff-tree", "show-ref",
  "count-objects", "version", "help", "whatchanged", "reflog", "ls-remote", "var", "diff-index", "diff-files",
]);
const GIT_GLOBAL_WITH_ARG = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--super-prefix"]);
const FS_MUTATORS = new Set(["rm", "rmdir", "unlink", "mv", "cp", "ln", "touch", "mkdir", "tee", "truncate", "chmod", "chown", "chgrp", "install", "shred", "mkfifo", "mknod"]);
const NETWORK_TOOLS = new Set(["rsync", "scp", "sftp", "ssh", "ftp", "nc", "ncat", "netcat", "socat", "telnet"]);
const DEPLOY_TOOLS = new Set(["vercel", "netlify", "ntl", "firebase", "wrangler", "flyctl", "fly", "surge", "gh-pages", "serverless", "sls", "amplify", "railway", "heroku", "doctl", "aws", "gcloud", "az", "kubectl", "terraform", "pulumi", "helm", "docker", "podman", "docker-compose", "supabase", "turso", "pscale"]);
const DB_CLIENTS = new Set(["psql", "mysql", "mariadb", "mongosh", "mongo", "redis-cli", "sqlite3", "prisma", "drizzle-kit", "knex", "sequelize", "sequelize-cli", "typeorm", "mysqldump", "pg_restore"]);
const FIX_NPM_BLOCK = new Set(["publish", "unpublish", "deprecate", "login", "logout", "adduser", "owner", "access", "team", "token", "exec", "x", "dlx", "create", "init", "version", "config", "set", "star", "unstar", "hook"]);
const EDITORS = new Set(["ed", "ex", "vi", "vim", "nvim", "nano", "emacs", "pico"]);
const ARCHIVERS = new Set(["unzip", "zip", "7z", "7za", "gunzip", "gzip", "bzip2", "xz", "unxz", "cpio"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish"]);
const NPM_BLOCK = new Set(["install", "i", "add", "ci", "update", "up", "upgrade", "remove", "rm", "uninstall", "un", "unlink", "link", "ln", "dedupe", "prune", "rebuild", "publish", "unpublish", "deprecate", "version", "init", "create", "exec", "x", "dlx", "patch", "set", "config", "cache", "login", "logout", "adduser", "owner", "access", "team", "token", "star", "unstar", "hook", "fund", "outdated-fix"]);
const PKG_OTHER = new Map([
  ["pip", ["install", "uninstall", "download", "wheel", "cache"]], ["pip3", ["install", "uninstall", "download", "wheel", "cache"]],
  ["pipx", ["install", "uninstall", "run", "inject", "upgrade", "upgrade-all", "reinstall"]], ["poetry", ["add", "install", "remove", "update", "lock", "publish", "build"]],
  ["uv", ["add", "pip", "sync", "tool", "run", "remove", "lock", "publish"]], ["gem", ["install", "uninstall", "update", "push"]],
  ["bundle", ["install", "update", "add", "remove", "exec"]], ["composer", ["install", "update", "require", "remove", "create-project", "global"]],
  ["cargo", ["install", "add", "remove", "publish", "update", "uninstall"]], ["go", ["install", "get", "mod"]],
]);
const SYSTEM_PKG = new Set(["apt", "apt-get", "aptitude", "dpkg", "brew", "snap", "yum", "dnf", "apk", "pacman", "zypper", "choco", "winget", "scoop"]);
const NPM_LIKE = new Set(["npm", "pnpm", "yarn", "bun"]);
const WRAPPERS = new Set(["nohup", "command", "builtin", "exec", "nice", "setsid", "stdbuf", "ionice", "chronic", "unbuffer"]);

function words(cmd) { return cmd.words.map((w) => w.text); }

function checkFsMutator(ctx, name, args, cwdState, viaXargs) {
  if (viaXargs) deny(`${name} via xargs bloqueado no modo leitura (alvos não auditáveis)`);
  const files = [];
  let endOpts = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!endOpts && a === "--") { endOpts = true; continue; }
    if (!endOpts && a.startsWith("-") && a.length > 1) {
      if (name === "chmod" || name === "chown" || name === "chgrp") continue;
      if ((name === "install" && ["-m", "-o", "-g", "-t"].includes(a)) || (name === "truncate" && (a === "-s" || a === "-r")) || ((name === "cp" || name === "ln") && (a === "-t" || a === "--target-directory"))) { i++; }
      continue;
    }
    files.push(a);
  }
  if ((name === "chmod" || name === "chown" || name === "chgrp") && files.length) files.shift(); // modo/dono
  if (name === "truncate") { /* -s N já consumido */ }
  if (!files.length) deny(`${name} sem alvos explícitos bloqueado no modo leitura`);
  // cp/install/ln: as FONTES só são lidas; só o destino (último argumento ou -t) precisa estar em .webaudit/
  let toCheck = files;
  if (name === "cp" || name === "install" || name === "ln") {
    const ti = args.findIndex((a) => a === "-t" || a === "--target-directory" || a.startsWith("--target-directory="));
    if (ti >= 0) toCheck = [args[ti].includes("=") ? args[ti].split("=")[1] : args[ti + 1]]; else toCheck = [files[files.length - 1]];
    if (toCheck[0] === undefined) deny(`${name} sem destino explícito bloqueado no modo leitura`);
  }
  for (const f of toCheck) {
    if (cwdState.unknown && !f.startsWith("/")) deny(`${name} com diretório de trabalho desconhecido bloqueado: ${f}`);
    checkWritePath(ctx, f.replace(/[*?\[].*$/, ""), cwdState.dir, name);
  }
}

function analyzeSimple(ctx, cmd, st, viaXargs = false, depth = 0) {
  let ws = cmd.words.slice();
  // atribuições de variável no início
  while (ws.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[0].text)) ws.shift();
  // palavras de controle
  while (ws.length && SEP_WORDS.has(ws[0].text)) ws.shift();
  // redirecionamentos de escrita
  for (const r of cmd.redirects) {
    if (r.op === "<") continue;
    if (r.dyn) deny(`redirecionamento com destino dinâmico bloqueado no modo leitura: ${r.target}`);
    if (["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"].includes(r.target)) continue;
    if (st.unknown && !r.target.startsWith("/")) deny(`redirecionamento com diretório de trabalho desconhecido bloqueado: ${r.target}`);
    checkWritePath(ctx, r.target, st.dir, "redirecionamento");
  }
  if (!ws.length) return;

  // desembrulha comandos-invólucro
  for (let guard = 0; guard < 8 && ws.length; guard++) {
    const first = basename(ws[0].text);
    if (ws[0].dyn) deny("comando dinâmico ($VAR/$(…)) bloqueado no modo leitura");
    if (first === "sudo" || first === "doas" || first === "su") deny("elevação de privilégio bloqueada no modo leitura");
    if (first === "env") {
      ws.shift();
      while (ws.length && (ws[0].text.startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(ws[0].text))) {
        const t = ws.shift().text; if (t === "-u" || t === "-C" || t === "-S") ws.shift();
      }
      continue;
    }
    if (first === "timeout") { ws.shift(); while (ws.length && ws[0].text.startsWith("-")) ws.shift(); ws.shift(); continue; }
    if (first === "time") { ws.shift(); continue; }
    if (first === "xargs") {
      ws.shift();
      while (ws.length && ws[0].text.startsWith("-")) { const t = ws.shift().text; if (["-I", "-n", "-P", "-L", "-d", "-E", "-s"].includes(t)) ws.shift(); }
      viaXargs = true; continue;
    }
    if (WRAPPERS.has(first)) { ws.shift(); while (ws.length && ws[0].text.startsWith("-")) { const t = ws.shift().text; if (t === "-n") ws.shift(); } continue; }
    break;
  }
  if (!ws.length) return;
  const name = basename(ws[0].text);
  const args = ws.slice(1).map((w) => w.text);
  const argsDyn = ws.slice(1).some((w) => w.dyn);

  if (name === "cd") {
    const t = args[0];
    if (t === undefined || t === "-" || ws[1]?.dyn) { st.unknown = true; return; }
    st.dir = resolve(st.dir, expandHome(t)); st.unknown = false; return;
  }
  if (name === "git") return ctx.mode === "fix" ? analyzeGitFix(args) : analyzeGit(args);
  if (FS_MUTATORS.has(name)) return checkFsMutator(ctx, name, args, st, viaXargs);
  if (NETWORK_TOOLS.has(name)) deny(`${name} bloqueado no modo leitura (envio de dados a terceiros)`);
  if (DEPLOY_TOOLS.has(name)) deny(`${name} bloqueado no modo leitura (deploy/infraestrutura/containers)`);
  if (DB_CLIENTS.has(name)) deny(`${name} bloqueado no modo leitura (cliente de banco de dados: nunca altera dados)`);
  if (EDITORS.has(name)) deny(`editor ${name} bloqueado no modo leitura`);
  if (ARCHIVERS.has(name)) deny(`${name} bloqueado no modo leitura (escreve arquivos)`);
  if (SYSTEM_PKG.has(name)) deny(`${name} bloqueado no modo leitura (instalação de pacotes do sistema)`);
  if (name === "source" || name === ".") deny("source/. bloqueado no modo leitura (executa arquivo arbitrário)");
  if (name === "eval") { analyzeString(ctx, args.join(" "), st, depth + 1); return; }
  if (name === "tar") { if (args.some((a) => /^-[a-zA-Z]*[xcurtA]/.test(a) && !/^-[a-zA-Z]*t/.test(a)) || args.some((a) => /^[xcurA]/.test(a)) || args.includes("-C")) deny("tar que extrai/cria arquivos bloqueado no modo leitura"); return; }
  if (name === "sed") { if (args.some((a) => /^-[a-zA-Z]*i/.test(a) || a === "--in-place" || a.startsWith("--in-place="))) deny("sed -i bloqueado no modo leitura"); return; }
  if (name === "perl") { if (args.some((a) => /^-[a-zA-Z]*i/.test(a))) deny("perl -i bloqueado no modo leitura"); if (args.some((a) => /^-[a-zA-Z]*[eE]$/.test(a))) deny("interpretador com código inline bloqueado no modo leitura"); return; }
  if (name === "awk" || name === "gawk") { if (args.includes("inplace") || args.some((a) => a === "-i")) deny("awk -i inplace bloqueado no modo leitura"); return; }
  if (name === "dd") { for (const a of args) if (a.startsWith("of=")) checkWritePath(ctx, a.slice(3), st.dir, "dd"); return; }
  if (name === "find") { if (args.some((a) => ["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"].includes(a))) deny("find com -delete/-exec/-fprint bloqueado no modo leitura"); return; }
  if (name === "curl") return analyzeCurl(ctx, args, st);
  if (name === "wget") return analyzeWget(ctx, args, st);
  if (name === "gh") return analyzeGh(args);
  if (SHELLS.has(name)) {
    const ci = args.findIndex((a) => /^-[a-zA-Z]*c$/.test(a));
    if (ci >= 0) { analyzeString(ctx, args[ci + 1] ?? "", st, depth + 1); return; }
    const script = args.find((a) => !a.startsWith("-"));
    if (!script || script === "-") deny(`${name} lendo script da entrada padrão bloqueado no modo leitura`);
    if (!inPluginRoot(script, st) && !(ctx.mode === "fix" && inTarget(ctx, script, st))) deny(`execução de script fora do plugin bloqueada no modo leitura: ${script}`);
    return;
  }
  if (name === "node" || name === "nodejs" || name === "deno") {
    if (args.some((a) => ["-e", "--eval", "-p", "--print", "--input-type=module", "--input-type"].includes(a) || /^-[a-zA-Z]*[ep]$/.test(a))) deny("interpretador com código inline bloqueado no modo leitura");
    const script = args.find((a) => !a.startsWith("-"));
    if (args.includes("-v") || args.includes("--version")) return;
    if (!script || script === "-") deny(`${name} lendo código da entrada padrão bloqueado no modo leitura`);
    if (!inPluginRoot(script, st) && !(ctx.mode === "fix" && inTarget(ctx, script, st))) deny(`execução de script fora do plugin bloqueada no modo leitura (use npm run, com confirmação): ${script}`);
    return;
  }
  if (/^python[0-9.]*$/.test(name) || name === "ruby" || name === "php" || name === "perl") {
    if (args.some((a) => ["-c", "-e", "-r", "-m"].includes(a))) deny("interpretador com código inline/módulo bloqueado no modo leitura");
    const script = args.find((a) => !a.startsWith("-"));
    if (args.includes("--version") || args.includes("-V") || args.includes("-v")) return;
    if (!script || script === "-") deny(`${name} lendo código da entrada padrão bloqueado no modo leitura`);
    if (!inPluginRoot(script, st) && !(ctx.mode === "fix" && inTarget(ctx, script, st))) deny(`execução de script fora do plugin bloqueada no modo leitura: ${script}`);
    return;
  }
  if (name === "npx" || name === "pnpx" || name === "bunx") deny(`${name} bloqueado no modo leitura (baixa e executa pacotes)`);
  if (NPM_LIKE.has(name)) return analyzeNpmLike(name, args, ctx.mode);
  if (PKG_OTHER.has(name)) {
    const verb = args.find((a) => !a.startsWith("-"));
    if (name === "pip" || name === "pip3") { if (PKG_OTHER.get(name).includes(verb)) deny(`${name} ${verb} bloqueado no modo leitura`); return; }
    if (verb && PKG_OTHER.get(name).includes(verb)) deny(`${name} ${verb} bloqueado no modo leitura (instala/altera dependências)`);
    return;
  }
  void argsDyn;
  // demais comandos: permitidos (a camada é de proteção, não sandbox)
}

function inPluginRoot(script, st) {
  if (/\$/.test(script)) return false;
  const abs = realish(resolve(st.dir, expandHome(script)));
  return abs === PLUGIN_ROOT || abs.startsWith(PLUGIN_ROOT + sep);
}

function analyzeGit(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    const a = args[i];
    if (GIT_GLOBAL_WITH_ARG.has(a)) i += 2; else i += 1;
  }
  const sub = args[i];
  if (sub === undefined) return;
  if (GIT_ALLOW.has(sub)) return;
  const rest = args.slice(i + 1);
  if (sub === "branch") { if (rest.some((a) => /^-[a-zA-Z]*[dDmMcCu]/.test(a) || /^--(delete|move|copy|set-upstream|unset-upstream|edit-description|force)/.test(a))) deny("git branch que altera branches bloqueado no modo leitura"); return; }
  if (sub === "tag") { if (rest.some((a) => !a.startsWith("-") ) && !rest.some((a) => a === "-l" || a === "--list")) deny("git tag que cria/remove tags bloqueado no modo leitura"); if (rest.some((a) => /^-[a-zA-Z]*[adsfu]/.test(a) && a !== "-l")) deny("git tag que altera tags bloqueado no modo leitura"); return; }
  if (sub === "config") { if (!rest.some((a) => ["--get", "--get-all", "--get-regexp", "--list", "-l", "--show-origin"].includes(a))) deny("git config que altera configuração bloqueado no modo leitura"); return; }
  if (sub === "remote") { const v = rest.find((a) => !a.startsWith("-")); if (v && !["show", "get-url"].includes(v)) deny("git remote que altera remotos bloqueado no modo leitura"); return; }
  if (sub === "stash") { if (rest[0] === "list" || rest[0] === "show") return; deny("git stash bloqueado no modo leitura"); }
  deny(`git ${sub} bloqueado no modo leitura`);
}

function analyzeGitFix(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) { if (GIT_GLOBAL_WITH_ARG.has(args[i])) i += 2; else i += 1; }
  const sub = args[i]; if (sub === undefined || GIT_ALLOW.has(sub)) return;
  const rest = args.slice(i + 1);
  if (sub === "switch") { if (rest.some((a) => a === "-c" || a === "-C" || a === "--create" || a === "--force-create")) return; deny("git switch só é permitido para criar a branch do fix (-c)"); }
  if (sub === "checkout") { if (rest.some((a) => a === "-b" || a === "-B")) return; deny("git checkout só é permitido para criar a branch do fix (-b); descartar alterações é bloqueado"); }
  if (sub === "branch") { if (rest.some((a) => /^-[a-zA-Z]*[dDmMcCu]/.test(a) || /^--(delete|move|copy|set-upstream|unset-upstream|edit-description|force)/.test(a))) deny("git branch que altera branches existentes bloqueado"); return; }
  if (sub === "config") { if (!rest.some((a) => ["--get", "--get-all", "--get-regexp", "--list", "-l", "--show-origin"].includes(a))) deny("git config que altera configuração bloqueado"); return; }
  if (sub === "remote") { const v = rest.find((a) => !a.startsWith("-")); if (v && !["show", "get-url"].includes(v)) deny("git remote que altera remotos bloqueado"); return; }
  if (sub === "tag") { if (rest.some((a) => a === "-l" || a === "--list") || !rest.length) return; deny("git tag bloqueado (criar tags é publicar versão)"); }
  deny(`git ${sub} bloqueado no modo correção (commit, push, tag, reset, stash e similares só com pedido explícito do usuário, fora do /fix)`);
}

function analyzeCurl(ctx, args, st) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === "-X" || a === "--request") && !/^(GET|HEAD)$/i.test(args[i + 1] ?? "")) deny("curl com método diferente de GET/HEAD bloqueado no modo leitura");
    if (/^-X.+/.test(a) && !/^-X(GET|HEAD)$/i.test(a)) deny("curl com método diferente de GET/HEAD bloqueado no modo leitura");
    if (/^(-d|--data(-[a-z]+)?|-F|--form(-string)?|-T|--upload-file|--json)(=|$)/.test(a) || /^-[a-zA-Z]*[dFT]$/.test(a)) deny("curl que envia dados bloqueado no modo leitura");
    if (a === "-O" || a === "--remote-name" || a === "-J" || a === "--remote-header-name") deny("curl -O bloqueado no modo leitura (grava no diretório atual)");
    if (a === "-o" || a === "--output") { const t = args[i + 1]; if (t !== "/dev/null" && t !== "-") checkWritePath(ctx, t ?? "", st.dir, "curl -o"); }
  }
}
function analyzeWget(ctx, args, st) {
  let out = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--post-") || a === "--body-data" || a === "--body-file") deny("wget que envia dados bloqueado no modo leitura");
    if (a === "--method" && !/^(GET|HEAD)$/i.test(args[i + 1] ?? "")) deny("wget com método diferente de GET/HEAD bloqueado no modo leitura");
    if (a === "-O" || a === "--output-document") out = args[i + 1];
    if (a.startsWith("--output-document=")) out = a.slice(18);
    { const m = /^-[a-zA-Z]*O(.*)$/.exec(a); if (m && !a.startsWith("--")) out = m[1] !== "" ? m[1] : args[i + 1]; }
  }
  if (out === null) deny("wget sem -O bloqueado no modo leitura (grava no diretório atual)");
  if (out !== "-" && out !== "/dev/null") checkWritePath(ctx, out, st.dir, "wget -O");
}
function analyzeGh(args) {
  const sub = args.filter((a) => !a.startsWith("-"));
  if (sub[0] === "api") {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if ((a === "-X" || a === "--method") && !/^GET$/i.test(args[i + 1] ?? "")) deny("gh api com método diferente de GET bloqueado no modo leitura");
      if (["-f", "-F", "--field", "--raw-field", "--input"].includes(a)) deny("gh api que envia dados bloqueado no modo leitura");
    }
    return;
  }
  if (sub[0] === "auth" && sub[1] === "status") return;
  if (["view", "list", "status", "diff", "checks"].includes(sub[1])) return;
  deny(`gh ${sub.join(" ")} bloqueado no modo leitura (somente consulta)`);
}
function analyzeNpmLike(name, args, mode = "read") {
  const verb = args.find((a) => !a.startsWith("-"));
  if (name === "yarn" && verb === undefined) deny("yarn sem subcomando (install) bloqueado no modo leitura");
  if (verb === undefined) return;
  if (name === "bun" && /\.(m?[jt]s|cjs|tsx?)$/.test(verb)) deny(`bun executando arquivo bloqueado no modo leitura: ${verb}`);
  if (name === "npm" && verb === "audit" && args.includes("fix")) deny("npm audit fix bloqueado no modo leitura");
  if (verb === "audit" && args.includes("fix")) deny(`${name} audit fix bloqueado no modo leitura`);
  if (mode === "fix") { if (FIX_NPM_BLOCK.has(verb)) deny(`${name} ${verb} bloqueado no modo correção (publica, executa pacotes ou altera a configuração do gerenciador)`); return; }
  if (NPM_BLOCK.has(verb)) deny(`${name} ${verb} bloqueado no modo leitura (instala/altera dependências ou publica)`);
}

function analyzeString(ctx, str, st, depth = 0) {
  if (depth > 5) deny("comando aninhado em excesso bloqueado no modo leitura");
  const { commands, nested } = parseShell(str);
  for (const c of commands) analyzeSimple(ctx, c, st, false, depth);
  for (const inner of nested) analyzeString(ctx, inner, { ...st }, depth + 1);
}

// ───────────────────────── avaliação ─────────────────────────
export function evaluate(input, targetRoot, mode = "read") {
  const ctx = makeCtx(targetRoot, mode);
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  const cwd = input.cwd ?? process.cwd();
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path ?? ti.notebook_path ?? ti.path;
    if (typeof p !== "string" || !p) deny(`${tool} sem caminho de arquivo bloqueado no modo leitura`);
    checkWritePath(ctx, p, cwd, tool);
    return;
  }
  if (tool === "Bash") {
    const command = ti.command;
    if (typeof command !== "string") deny("Bash sem comando legível bloqueado no modo leitura");
    analyzeString(ctx, command, { dir: cwd, unknown: false });
  }
}

function log(targetRoot, line) {
  try { appendFileSync(join(targetRoot, WEBAUDIT_DIR, "guard.log"), `${new Date().toISOString()} ${line}\n`); } catch {}
}

function main() {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch {}
  let input = null;
  try { input = JSON.parse(raw); } catch {}
  const cwd = input?.cwd ?? process.cwd();

  let lock = findLock(cwd);
  if (lock.state === "none" || lock.state === "expired") {
    // tenta também a partir do arquivo-alvo (ex.: worktree)
    const p = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
    if (typeof p === "string") {
      const alt = findLock(dirname(resolve(cwd, expandHome(p))));
      if (alt.state === "valid" || alt.state === "invalid") lock = alt;
    }
  }
  if (lock.state === "none" || lock.state === "expired") process.exit(0); // sem lock válido: permite tudo

  const targetRoot = lock.targetRoot;
  try {
    if (!input || typeof input !== "object") deny("entrada do hook ilegível (falha fechada com lock ativo)");
    if (lock.state === "invalid") deny(`lock do modo leitura ilegível (falha fechada): ${lock.reason ?? ""}`);
    evaluate(input, targetRoot, lock.data?.mode === "fix" ? "fix" : "read");
    process.exit(0);
  } catch (e) {
    const fixMode = lock.data?.mode === "fix";
    let msg = e instanceof Deny ? e.message : `erro interno do guard (bloqueado por segurança): ${e?.message ?? e}`;
    if (fixMode) msg = msg.replace(/no modo leitura/g, "no modo correção");
    log(targetRoot, `BLOQUEADO ${input?.tool_name ?? "?"}: ${msg}`);
    process.stderr.write(fixMode
      ? `AI WebAudit (modo correção): ${msg}\nDurante o /ai-webaudit:fix ficam sempre proibidos: commit, push, tag, reset, deploy, banco de dados e publicação de pacotes. Commit só com pedido explícito do usuário, depois do fix.\n`
      : `AI WebAudit (modo leitura): ${msg}\nO modo leitura só permite gravar em ${WEBAUDIT_DIR}/ e comandos que não alteram o projeto. Para corrigir problemas use /ai-webaudit:fix.\n`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
