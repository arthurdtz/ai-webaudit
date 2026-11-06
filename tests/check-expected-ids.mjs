#!/usr/bin/env node
// Confere o gabarito da fixture: todo check_id existe nas referências, o prefixo bate com a área,
// o arquivo existe na fixture e (quando há "match") o termo aparece no arquivo.
// Uso: node tests/check-expected-ids.mjs [caminho/expected-findings.json]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedPath = process.argv[2] ?? join(root, "tests/fixtures/expected-findings.json");
const siteDir = join(dirname(expectedPath), "sample-site");
const SEV = ["OPCIONAL", "MELHORIA", "IMPORTANTE", "CRITICO"];

const checks = new Map(); // check_id -> arquivo da referência
const refDir = join(root, "references");
for (const f of readdirSync(refDir).filter((n) => /^\d\d-.*\.md$/.test(n) && n !== "00-orchestrator.md")) {
  for (const m of readFileSync(join(refDir, f), "utf8").matchAll(/^### ([A-Z0-9]+-C\d\d)\b/gm)) checks.set(m[1], f);
}

const data = JSON.parse(readFileSync(expectedPath, "utf8"));
const problems = [];
const rows = [];
function verify(kind, e) {
  const prefix = /^([A-Z0-9]+)-C\d\d$/.exec(e.check_id)?.[1];
  if (!checks.has(e.check_id)) problems.push(`${kind} ${e.id}: check_id ${e.check_id} não existe nas referências`);
  if (e.area && prefix !== e.area) problems.push(`${kind} ${e.id}: prefixo ${prefix} difere da área ${e.area}`);
  const file = join(siteDir, e.file);
  if (!existsSync(file)) problems.push(`${kind} ${e.id}: arquivo ${e.file} não existe na fixture`);
  else if (e.match) {
    const text = readFileSync(file, "utf8");
    if (!e.match.split("|").some((t) => text.includes(t))) problems.push(`${kind} ${e.id}: termo "${e.match}" não aparece em ${e.file}`);
  }
  if (e.min_severity && !SEV.includes(e.min_severity)) problems.push(`${kind} ${e.id}: severidade inválida ${e.min_severity}`);
  rows.push([kind, e.id, e.check_id, checks.get(e.check_id) ?? "—", e.file, e.min_severity ?? "—"]);
}
for (const e of data.must_find) verify("must_find", e);
for (const e of data.must_not_flag) verify("must_not_flag", e);

const ids = [...data.must_find, ...data.must_not_flag].map((e) => e.id);
for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) problems.push(`id duplicado no gabarito: ${id}`);

console.log("tipo | id | check_id | referência | arquivo | severidade mínima");
for (const r of rows) console.log(r.join(" | "));
const areas = new Set(data.must_find.map((e) => e.area));
console.log(`\nmust_find: ${data.must_find.length} · must_not_flag: ${data.must_not_flag.length} · áreas cobertas em must_find: ${areas.size}/15`);
const all = ["SEO","GEO","AEO","AIO","CRO","QA","ANL","PERF","A11Y","PRIV","LOC","OPS","CONT","API","SEC"];
const missing = all.filter((a) => !areas.has(a));
if (missing.length) console.log(`áreas sem must_find: ${missing.join(", ")}`);
if (problems.length) {
  console.error(`\nINVÁLIDO: ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("OK: todos os check_id existem nas referências e os arquivos da fixture conferem.");
