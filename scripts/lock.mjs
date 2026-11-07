#!/usr/bin/env node
// Lock do modo leitura: Fase 0 (acquire) e Fase 6 (release).
//   node scripts/lock.mjs acquire <alvo> [--skill audit] [--run <AAAA-MM-DD_HHMM>] [--mode read|fix] [--force]
//     --mode read (padrão): modo leitura (só grava em .webaudit/). --mode fix: /fix — só o que é SEMPRE proibido (commit, push, deploy, banco…) e escritas confinadas ao projeto.
//   node scripts/lock.mjs release <alvo>
//   node scripts/lock.mjs status  <alvo>
// acquire: recusa o diretório do plugin como alvo (exit 3); cria <alvo>/.webaudit/; adiciona
//          `.webaudit/` ao .git/info/exclude do alvo (não altera .gitignore); grava o lock (válido por 2 h).
// Códigos: 0 ok · 2 uso · 3 alvo inválido (plugin) · 4 já existe lock válido · 5 erro de E/S.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCK_NAME, LOCK_TTL_MS, WEBAUDIT_DIR, readLock } from "./lib/lock.mjs";

const PLUGIN_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

function die(code, msg) { console.error(`Erro: ${msg}`); process.exit(code); }
const [cmd, targetArg, ...rest] = process.argv.slice(2);
if (!["acquire", "release", "status"].includes(cmd) || !targetArg) {
  die(2, "uso: node scripts/lock.mjs <acquire|release|status> <alvo> [--skill s] [--run id] [--force]");
}
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
if (flag("--mode") && !["read", "fix"].includes(flag("--mode"))) die(2, "--mode deve ser read ou fix");

let target;
try { target = realpathSync(resolve(targetArg)); } catch { die(5, `alvo não encontrado: ${targetArg}`); }
if (!statSync(target).isDirectory()) die(5, `alvo não é um diretório: ${target}`);
if (target === PLUGIN_ROOT || target.startsWith(PLUGIN_ROOT + sep) || PLUGIN_ROOT.startsWith(target + sep) && existsSync(join(target, ".claude-plugin"))) {
  die(3, `o alvo (${target}) é o diretório do plugin. A auditoria roda no projeto aberto, nunca no plugin.`);
}
const waDir = join(target, WEBAUDIT_DIR);
const lockPath = join(waDir, LOCK_NAME);

if (cmd === "status") {
  const l = readLock(lockPath);
  console.log(JSON.stringify({ target, state: l.state, age_minutes: l.ageMs != null ? Math.round(l.ageMs / 60000) : null, data: l.data ?? null }, null, 2));
  process.exit(0);
}
if (cmd === "release") {
  try { rmSync(lockPath, { force: true }); } catch (e) { die(5, `não foi possível remover o lock: ${e.message}`); }
  console.log(`Lock removido: ${lockPath}`);
  process.exit(0);
}

// acquire
const existing = readLock(lockPath);
if (existing.state === "valid" && !rest.includes("--force")) {
  die(4, `já existe um lock válido (${Math.round(existing.ageMs / 60000)} min). Outra auditoria em andamento? Use release ou --force.`);
}
try {
  mkdirSync(waDir, { recursive: true });
  // .git/info/exclude (não altera .gitignore nem arquivos versionados)
  const gitDir = join(target, ".git");
  if (existsSync(gitDir) && statSync(gitDir).isDirectory()) {
    const excl = join(gitDir, "info", "exclude");
    mkdirSync(dirname(excl), { recursive: true });
    const cur = existsSync(excl) ? readFileSync(excl, "utf8") : "";
    if (!cur.split(/\r?\n/).some((l) => l.trim() === ".webaudit/" || l.trim() === ".webaudit")) {
      appendFileSync(excl, `${cur && !cur.endsWith("\n") ? "\n" : ""}.webaudit/\n`);
    }
  }
  const now = new Date();
  const data = {
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
    skill: flag("--skill") ?? null,
    mode: flag("--mode") ?? "read",
    run_id: flag("--run") ?? null,
    target_path: target,
    pid: process.ppid,
  };
  writeFileSync(lockPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`Lock criado: ${lockPath} (modo ${data.mode}, válido por 2 h)`);
} catch (e) {
  die(5, `não foi possível criar o lock: ${e.message}`);
}
