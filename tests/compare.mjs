#!/usr/bin/env node
// Compara um findings.json com o gabarito da fixture (tests/fixtures/expected-findings.json).
// Uso: node tests/compare.mjs <findings.json> [--expected <expected-findings.json>] [--json]
// Saída: recall de must_find, itens de must_not_flag apontados, achados fora do gabarito.
// Exit: 0 se recall >= meta (80%) e 0 must_not_flag apontados; 1 caso contrário; 2 erro de uso.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const ei = args.indexOf("--expected");
const expectedPath = ei >= 0 ? args[ei + 1] : join(root, "tests/fixtures/expected-findings.json");
const findingsPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--expected");
if (!findingsPath) { console.error("Uso: node tests/compare.mjs <findings.json> [--expected <arquivo>] [--json]"); process.exit(2); }
let findings, expected;
try { findings = JSON.parse(readFileSync(findingsPath, "utf8")); expected = JSON.parse(readFileSync(expectedPath, "utf8")); } catch (e) { console.error(`Erro ao ler arquivos: ${e.message}`); process.exit(2); }

export const SEV = expected.scoring?.severity_order ?? ["OPCIONAL", "MELHORIA", "IMPORTANTE", "CRITICO"];
const rank = (s) => SEV.indexOf(s);
const list = findings.findings ?? [];
const norm = (p) => String(p ?? "").replace(/^\.\//, "");
const evFiles = (f) => f.evidence.map((e) => norm(e.file)).filter(Boolean);
const touches = (f, file) => evFiles(f).some((x) => x === file || x.endsWith("/" + file) || file.endsWith("/" + x));
const termMatch = (ev, match) => { const terms = match.split("|"); return ev.some((e) => terms.some((t) => `${e.file ?? ""} ${e.snippet ?? ""} ${e.output_excerpt ?? ""}`.includes(t))); };
// must_not_flag olha só a evidência PRIMÁRIA (a primeira): evidência de contraste (ex.: "o link da página de contato está correto") não conta como apontar o acerto.
const primaryTouches = (f, file) => { const e = f.evidence[0]; if (!e?.file) return false; const x = norm(e.file); return x === file || x.endsWith("/" + file) || file.endsWith("/" + x); };

const mustFind = expected.must_find.map((m) => {
  const sameCheck = list.filter((f) => f.check_id === m.check_id);
  const hit = sameCheck.find((f) => touches(f, m.file) && rank(f.severity) >= rank(m.min_severity));
  let status = "FOUND", detail = hit ? `${hit.id} ${hit.severity}` : "";
  if (!hit) {
    const lowSev = sameCheck.find((f) => touches(f, m.file));
    const otherFile = sameCheck[0];
    if (lowSev) { status = "LOW_SEVERITY"; detail = `${lowSev.id} veio ${lowSev.severity} (mínimo ${m.min_severity})`; }
    else if (otherFile) { status = "WRONG_FILE"; detail = `${otherFile.id} cita ${evFiles(otherFile).join(", ") || "(sem arquivo)"} em vez de ${m.file}`; }
    else status = "MISSING";
  }
  return { ...m, status, detail };
});
const found = mustFind.filter((m) => m.status === "FOUND").length;
const recall = mustFind.length ? found / mustFind.length : 0;

const violations = [];
for (const n of expected.must_not_flag) {
  for (const f of list.filter((x) => x.check_id === n.check_id && rank(x.severity) >= rank("MELHORIA"))) {
    if (!primaryTouches(f, n.file)) continue;
    if (n.match && !termMatch([f.evidence[0]], n.match)) continue;
    violations.push({ id: n.id, check_id: n.check_id, file: n.file, finding: f.id, severity: f.severity, title: f.title, reason: n.reason });
  }
}
const planted = new Set();
for (const m of mustFind) if (m.status === "FOUND") for (const f of list) if (f.check_id === m.check_id && touches(f, m.file)) planted.add(f.id);
const extra = list.filter((f) => !planted.has(f.id)).map((f) => ({ id: f.id, check_id: f.check_id, severity: f.severity, files: [...new Set(evFiles(f))], title: f.title }));
const minRatio = expected.scoring?.must_find_min_ratio ?? 0.8; const maxViol = expected.scoring?.must_not_flag_max ?? 0;
const pass = recall >= minRatio && violations.length <= maxViol;
const byArea = {}; for (const m of mustFind) { const a = (byArea[m.area] ??= { found: 0, total: 0 }); a.total++; if (m.status === "FOUND") a.found++; }
const result = { findings_file: findingsPath, total_findings: list.length, must_find: { found, total: mustFind.length, recall: Math.round(recall * 1000) / 10, threshold: minRatio * 100, by_area: byArea, items: mustFind }, must_not_flag: { violations: violations.length, items: violations }, outside_gabarito: { count: extra.length, items: extra }, pass };
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Gabarito: ${expectedPath}\nAchados no findings.json: ${list.length}\n`);
  console.log(`MUST_FIND: ${found}/${mustFind.length} = ${result.must_find.recall}% (meta ${result.must_find.threshold}%)`);
  for (const m of mustFind) console.log(`  ${m.status === "FOUND" ? "✔" : "✖"} ${m.id} ${m.check_id} ${m.file} [mín. ${m.min_severity}] ${m.status}${m.detail ? " — " + m.detail : ""}`);
  console.log(`\nPor área: ${Object.entries(byArea).map(([a, v]) => `${a} ${v.found}/${v.total}`).join(" · ")}`);
  console.log(`\nMUST_NOT_FLAG apontados: ${violations.length} (meta ${maxViol})`);
  for (const v of violations) console.log(`  ✖ ${v.id} ${v.check_id} ${v.file}: ${v.finding} (${v.severity}) "${v.title}" — ${v.reason}`);
  console.log(`\nFora do gabarito: ${extra.length}`);
  for (const e of extra) console.log(`  · ${e.id} ${e.check_id} ${e.severity} ${e.files.join(",")} — ${e.title}`);
  console.log(`\nRESULTADO: ${pass ? "APROVADO" : "REPROVADO"} (recall ${result.must_find.recall}%, ${violations.length} must_not_flag)`);
}
process.exit(pass ? 0 : 1);
