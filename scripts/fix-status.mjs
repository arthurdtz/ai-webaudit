#!/usr/bin/env node
// Apoio ao /ai-webaudit:fix (SPEC §10): localiza o run, seleciona achados, atualiza fix_status e escreve fix-log.md.
// Só lê/escreve dentro de <alvo>/.webaudit/runs/<id>/ (findings.json e fix-log.md). Não altera o código do projeto.
//   node scripts/fix-status.mjs resolve <alvo> [--run <id>]
//   node scripts/fix-status.mjs select  <run> (<ID> [<ID>…] | --all-critical)
//   node scripts/fix-status.mjs set     <run> <ID> <status> [--files a,b] [--validation "texto"] [--note "texto"]
//   node scripts/fix-status.mjs summary <run>
// status: aberto | autorizado | corrigido | validado | falhou-validacao | descartado
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATUSES = ["aberto", "autorizado", "corrigido", "validado", "falhou-validacao", "descartado"];
const die = (code, msg) => { console.error(`Erro: ${msg}`); process.exit(code); };
const [cmd, a1, ...rest] = process.argv.slice(2);
if (!["resolve", "select", "set", "summary"].includes(cmd) || !a1) die(2, "uso: fix-status.mjs <resolve|select|set|summary> <alvo|run> …");
const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };

if (cmd === "resolve") {
  let target; try { target = realpathSync(resolve(a1)); } catch { die(2, `alvo não encontrado: ${a1}`); }
  const wa = join(target, ".webaudit");
  const id = flag("--run") ?? (existsSync(join(wa, "latest")) ? readFileSync(join(wa, "latest"), "utf8").trim() : null);
  if (!id) die(2, `nenhuma auditoria encontrada em ${wa}/ (rode /ai-webaudit:audit antes, ou informe --run <id>)`);
  if (!/^\d{4}-\d{2}-\d{2}_\d{4}$/.test(id)) die(2, `id de run inválido: ${id}`);
  const run = join(wa, "runs", id);
  if (!existsSync(join(run, "findings.json"))) die(2, `run ${id} não tem findings.json (${run})`);
  console.log(run); process.exit(0);
}

const run = resolve(a1);
if (!run.includes(`${sep}.webaudit${sep}runs${sep}`)) die(2, "o run precisa estar dentro de <alvo>/.webaudit/runs/.");
const fpath = join(run, "findings.json");
if (!existsSync(fpath)) die(2, `findings.json não encontrado em ${run}`);
const data = JSON.parse(readFileSync(fpath, "utf8"));

if (cmd === "select") {
  const all = rest.includes("--all-critical");
  const ids = rest.filter((x) => /^WA-[A-Z0-9]+-\d{3}$/.test(x));
  const bad = rest.filter((x) => !x.startsWith("--") && !/^WA-[A-Z0-9]+-\d{3}$/.test(x));
  if (bad.length) die(2, `IDs inválidos: ${bad.join(", ")} (formato WA-<PREFIXO>-<NNN>)`);
  if (!all && !ids.length) die(2, "informe IDs (WA-SEC-001 …) ou --all-critical");
  const unknown = ids.filter((id) => !data.findings.some((f) => f.id === id));
  if (unknown.length) die(2, `IDs inexistentes neste run: ${unknown.join(", ")}`);
  const wanted = all ? data.findings.filter((f) => f.severity === "CRITICO").map((f) => f.id) : ids;
  const selected = []; const skipped = [];
  for (const id of wanted) {
    const f = data.findings.find((x) => x.id === id);
    const explicit = ids.includes(id);
    if (!explicit && ["validado", "descartado", "corrigido"].includes(f.fix_status)) { skipped.push({ id, reason: `fix_status já é ${f.fix_status}` }); continue; }
    if (explicit && f.fix_status === "descartado") { skipped.push({ id, reason: "marcado como descartado (peça explicitamente para reabrir)" }); continue; }
    selected.push({ id: f.id, check_id: f.check_id, area: f.area, title: f.title, severity: f.severity, nature: f.nature, effort: f.effort, fix_status: f.fix_status, description: f.description, recommendation: f.recommendation, validation_criteria: f.validation_criteria, evidence: f.evidence, related_ids: f.related_ids, tradeoffs: f.tradeoffs });
  }
  console.log(JSON.stringify({ run, run_id: data.run_id, target_path: data.target_path, selected, skipped, note: all ? "--all-critical: todos os CRITICO ainda não corrigidos" : "IDs informados" }, null, 2));
  process.exit(selected.length ? 0 : 1);
}

if (cmd === "summary") {
  const by = {}; for (const f of data.findings) by[f.fix_status] = (by[f.fix_status] ?? 0) + 1;
  console.log(JSON.stringify({ run_id: data.run_id, total: data.findings.length, by_fix_status: by }, null, 2)); process.exit(0);
}

// set
const [id, status] = [rest[0], rest[1]];
if (!id || !status) die(2, "uso: fix-status.mjs set <run> <ID> <status> [--files a,b] [--validation t] [--note t]");
if (!STATUSES.includes(status)) die(2, `status inválido: ${status}. Válidos: ${STATUSES.join(", ")}`);
const f = data.findings.find((x) => x.id === id);
if (!f) die(2, `achado inexistente: ${id}`);
const original = readFileSync(fpath, "utf8");
const previous = f.fix_status; f.fix_status = status;
writeFileSync(fpath, JSON.stringify(data, null, 2) + "\n");
try { execFileSync("node", [join(HERE, "validate-findings.mjs"), fpath], { stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { writeFileSync(fpath, original); die(1, `o findings.json ficaria inválido; alteração revertida:\n${e.stdout}${e.stderr}`); }
const rel = flag("--files"), val = flag("--validation"), note = flag("--note");
const logPath = join(run, "fix-log.md");
if (!existsSync(logPath)) writeFileSync(logPath, `# fix-log — run ${data.run_id}\n\nRegistro do /ai-webaudit:fix: o que mudou, como foi validado e o resultado. Nenhum commit foi feito pelo plugin.\n`);
appendFileSync(logPath, `\n## ${new Date().toISOString()} — ${id} (${f.check_id}): ${previous} → **${status}**\n\n- **Achado:** ${f.title}\n- **Severidade:** ${f.severity}\n${rel ? `- **Arquivos alterados:** ${rel.split(",").map((x) => "`" + x.trim() + "`").join(", ")}\n` : ""}${val ? `- **Validação:** ${val}\n` : ""}${note ? `- **Observação:** ${note}\n` : ""}`);
console.log(JSON.stringify({ id, check_id: f.check_id, from: previous, to: status, log: logPath }));
