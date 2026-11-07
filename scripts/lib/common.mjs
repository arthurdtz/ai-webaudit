// Utilitários compartilhados pelos scripts de detecção e coleta.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function pluginVersion() {
  try { return JSON.parse(readFileSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8")).version ?? "0.0.0"; } catch { return "0.0.0"; }
}
export const TOOL_NAME = "ai-webaudit";
export const USER_AGENT = () => `AI-WebAudit/${pluginVersion()}`;

/** Argumentos: posicionais + --flag valor|--flag. */
export function parseArgs(argv, { flags = [], bools = [] } = {}) {
  const positional = []; const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (bools.includes(key)) opts[key] = true;
      else if (flags.includes(key)) opts[key] = argv[++i];
      else { console.error(`Opção desconhecida: ${a}`); process.exit(2); }
    } else positional.push(a);
  }
  return { positional, opts };
}

/** Mascara valores sensíveis: no máximo os 4 primeiros caracteres + ****. */
export function maskValue(v) {
  const s = String(v ?? "");
  if (s.length <= 4) return "****";
  return s.slice(0, 4) + "****";
}

export function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}
export function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (idx) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };
}

/** Garante que o diretório do run está dentro de <alvo>/.webaudit/ (SPEC §9). */
export function assertRunDir(target, run) {
  const t = realpathSync(resolve(target));
  const wa = join(t, ".webaudit");
  const r = resolve(run);
  const fail = (rr) => { console.error(`Erro: o diretório do run (${rr}) precisa estar dentro de ${wa}/ — os coletores só gravam em .webaudit/.`); process.exit(2); };
  // checa ANTES de criar qualquer coisa (caminho lógico) e de novo depois (resolvendo links simbólicos)
  if (!(r === wa || r.startsWith(wa + sep))) fail(r);
  mkdirSync(r, { recursive: true });
  const rr = realpathSync(r);
  if (!(rr === wa || rr.startsWith(wa + sep))) fail(rr);
  return { target: t, run: rr };
}

export function envelope({ tool, version, command, startedAt, status, error, warnings, data }) {
  return {
    tool, version: version ?? "n/d", command, started_at: startedAt, finished_at: new Date().toISOString(),
    status, ...(error ? { error: String(error).slice(0, 2000) } : {}), ...(warnings?.length ? { warnings } : {}), data: data ?? null,
  };
}
/** Grava raw/<nome>.json dentro do run. */
export function writeRaw(runDir, name, payload) {
  const dir = join(runDir, "raw");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  return relative(runDir, file);
}
export function ensure(p) { mkdirSync(p, { recursive: true }); return p; }
export { existsSync };
