// Testes SEM modelo: consolidate.mjs (Fase 5/6) e compare.mjs usando saídas sintéticas de subagentes.
// Execução: node --test tests/pipeline.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONSOLIDATE = join(ROOT, "scripts", "consolidate.mjs");
const COMPARE = join(ROOT, "tests", "compare.mjs");
const EXPECTED = JSON.parse(readFileSync(join(ROOT, "tests/fixtures/expected-findings.json"), "utf8"));
const SEVS = ["OPCIONAL", "MELHORIA", "IMPORTANTE", "CRITICO"];
const PREFIXES = ["SEO", "GEO", "AEO", "AIO", "CRO", "QA", "ANL", "PERF", "A11Y", "PRIV", "LOC", "OPS", "CONT", "API", "SEC"];

function agentFinding(m, over = {}) {
  const critical = m.min_severity === "CRITICO";
  return {
    check_id: m.check_id, area: m.area, title: `Teste ${m.check_id}`, description: "Achado sintético.", severity: m.min_severity,
    nature: critical || m.min_severity === "IMPORTANTE" ? "CONFIRMADO" : "RISCO_POTENCIAL", verification: "estatica",
    evidence: [{ type: "codigo", file: m.file, line: 1, snippet: "trecho" }], impact: "i", recommendation: "r", validation_criteria: "v", effort: "P", related_check_ids: [], tradeoffs: [], ...over,
  };
}
function mkRun({ agents, modes = ["estatica"] }) {
  const target = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-pipe-")));
  const run = join(target, ".webaudit", "runs", "2026-11-07_1000");
  mkdirSync(join(run, "agents"), { recursive: true }); mkdirSync(join(run, "raw"), { recursive: true });
  writeFileSync(join(run, "run.json"), JSON.stringify({ run_id: "2026-11-07_1000", skill: "audit", arguments: "--static-only", target_path: target, collection_modes: modes }));
  writeFileSync(join(run, "areas.json"), JSON.stringify({ areas_selected: PREFIXES, areas_excluded: [] }));
  writeFileSync(join(run, "context.json"), JSON.stringify({ target_path: target, git: { is_repo: true, commit: "abcdef0123", branch: "main", dirty: false }, stack: { framework: "HTML estático" }, language: "pt-BR", site_type: "negócio local", hosting: { guess: "vercel" } }));
  for (const [name, content] of Object.entries(agents)) writeFileSync(join(run, "agents", `${name}.json`), typeof content === "string" ? content : JSON.stringify(content));
  return { target, run };
}
const perfectAgents = () => ({ "all-agents": { subagent: "x", areas_analyzed: PREFIXES, findings: EXPECTED.must_find.map((m) => agentFinding(m)), not_tested: [], errors: [] } });
const consolidate = (run, ...extra) => spawnSync("node", [CONSOLIDATE, run, ...extra], { encoding: "utf8" });
const compare = (file) => spawnSync("node", [COMPARE, file], { encoding: "utf8" });

test("consolidate: numera IDs, valida o schema, gera report.md e latest", () => {
  const { target, run } = mkRun({ agents: perfectAgents() });
  const r = consolidate(run); assert.equal(r.status, 0, r.stdout + r.stderr);
  const f = JSON.parse(readFileSync(join(run, "findings.json"), "utf8"));
  assert.equal(f.findings.length, EXPECTED.must_find.length);
  for (const x of f.findings) assert.match(x.id, new RegExp(`^WA-${x.area}-\\d{3}$`));
  // ordenado por severidade
  const ranks = f.findings.map((x) => SEVS.indexOf(x.severity)).map((n) => 3 - n);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.ok(f.tools.some((t) => t.name === "lighthouse" && t.status === "skipped"), "modo estático registra ferramentas puladas");
  assert.ok(f.not_tested.some((n) => n.check_id === "PERF-C01"), "PERF-C01 vai para não testado sem coleta local");
  const md = readFileSync(join(run, "report.md"), "utf8");
  for (const h of ["## 1. Resumo executivo", "## 2. Ordem prática de correção", "## 3. Achados", "### 3.1 Críticos", "## 4. Trade-offs entre áreas", "## 5. O que foi testado e como", "## 6. Não testado / verificação manual pendente", "## 7. Áreas não acionadas", "## 8. Aviso"]) assert.ok(md.includes(h), h);
  assert.match(md, /não é certificação/i);
  assert.doesNotMatch(md, /conforme (a )?(LGPD|WCAG)|sem problemas|seguro\b/i);
  assert.equal(readFileSync(join(target, ".webaudit", "latest"), "utf8").trim(), "2026-11-07_1000");
  assert.equal(spawnSync("node", [join(ROOT, "scripts/validate-findings.mjs"), join(run, "findings.json")]).status, 0);
});

test("compare: gabarito perfeito → APROVADO; sem must_not_flag apontados", () => {
  const { run } = mkRun({ agents: perfectAgents() }); consolidate(run);
  const r = compare(join(run, "findings.json")); assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /MUST_FIND: 28\/28 = 100%/); assert.match(r.stdout, /APROVADO/);
});

test("compare: recall abaixo de 80% → REPROVADO; severidade baixa e arquivo errado detectados", () => {
  const agents = perfectAgents(); const all = agents["all-agents"].findings;
  all.splice(0, 8); // remove 8 → 20/28 = 71%
  const lowIdx = all.findIndex((x) => x.check_id === "SEO-C07"); if (lowIdx >= 0) all[lowIdx].severity = "OPCIONAL";
  const { run } = mkRun({ agents }); consolidate(run);
  const r = compare(join(run, "findings.json")); assert.equal(r.status, 1);
  assert.match(r.stdout, /REPROVADO/); assert.match(r.stdout, /MISSING/);
});

test("compare: acerto apontado (must_not_flag) → REPROVADO", () => {
  const agents = perfectAgents(); const ok = EXPECTED.must_not_flag.find((n) => n.id === "OK03");
  agents["all-agents"].findings.push(agentFinding({ check_id: ok.check_id, area: "SEO", file: ok.file, min_severity: "IMPORTANTE" }));
  const { run } = mkRun({ agents }); consolidate(run);
  const r = compare(join(run, "findings.json")); assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /MUST_NOT_FLAG apontados: 1/);
});

test("compare: 'match' distingue o erro do acerto no mesmo arquivo (OK02: logo decorativo × hero sem alt)", () => {
  const agents = perfectAgents(); // F14 já aponta img/hero.svg (não contém logo.svg) → não é violação
  const { run } = mkRun({ agents }); consolidate(run);
  assert.match(compare(join(run, "findings.json")).stdout, /MUST_NOT_FLAG apontados: 0/);
  const bad = perfectAgents(); // sem F14 (senão o consolidador funde os dois achados de A11Y-C02 em index.html e a evidência do logo ficaria em 2º lugar)
  bad["all-agents"].findings = bad["all-agents"].findings.filter((x) => !(x.check_id === "A11Y-C02"));
  bad["all-agents"].findings.push(agentFinding({ check_id: "A11Y-C02", area: "A11Y", file: "index.html", min_severity: "IMPORTANTE" }, { title: "logo sem alt", evidence: [{ type: "codigo", file: "index.html", line: 99, snippet: '<img src="img/logo.svg" alt="">' }] }));
  const t2 = mkRun({ agents: bad }); consolidate(t2.run);
  assert.match(compare(join(t2.run, "findings.json")).stdout, /MUST_NOT_FLAG apontados: 1/);
});

test("compare: evidência de contraste (2ª evidência no arquivo do acerto) NÃO conta como apontar o acerto (OK05)", () => {
  const agents = perfectAgents(); const ok = EXPECTED.must_not_flag.find((n) => n.id === "OK05");
  const cro = agents["all-agents"].findings.find((x) => x.check_id === "CRO-C08");
  cro.evidence.push({ type: "codigo", file: ok.file, line: 19, snippet: "https://wa.me/5511987654321" }); // contraste: link correto citado em segundo lugar
  const { run } = mkRun({ agents }); consolidate(run);
  const r = compare(join(run, "findings.json")); assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /MUST_NOT_FLAG apontados: 0/);
  // mas como evidência PRIMÁRIA conta
  const agents2 = perfectAgents(); const c2 = agents2["all-agents"].findings.find((x) => x.check_id === "CRO-C08");
  agents2["all-agents"].findings.push({ ...c2, evidence: [{ type: "codigo", file: ok.file, line: 19, snippet: "x" }] });
  const t2 = mkRun({ agents: agents2 }); consolidate(t2.run);
  assert.match(compare(join(t2.run, "findings.json")).stdout, /MUST_NOT_FLAG apontados: 1/);
});

test("compare: title_match (OK08) — achado sobre OUTRO cabeçalho com a linha nosniff como evidência NÃO viola; título acusando o nosniff viola", () => {
  const ok = EXPECTED.must_not_flag.find((n) => n.id === "OK08"); assert.ok(ok.title_match, "OK08 deve usar title_match");
  const mk = (title) => { const a = perfectAgents(); a["all-agents"].findings.push(agentFinding({ check_id: "API-C04", area: "API", file: "vercel.json", min_severity: "MELHORIA" }, { title, evidence: [{ type: "configuracao", file: "vercel.json", line: 6, snippet: '{ "key": "X-Content-Type-Options", "value": "nosniff" }' }] })); return mkRun({ agents: a }); };
  const good = mk("Sem Referrer-Policy e Permissions-Policy na configuração"); consolidate(good.run);
  const rg = compare(join(good.run, "findings.json")); assert.equal(rg.status, 0, rg.stdout); assert.match(rg.stdout, /MUST_NOT_FLAG apontados: 0/);
  const bad = mk("Sem X-Content-Type-Options: nosniff na configuração"); consolidate(bad.run);
  const rb = compare(join(bad.run, "findings.json")); assert.equal(rb.status, 1); assert.match(rb.stdout, /MUST_NOT_FLAG apontados: 1/);
});

test("consolidate: rejeita achado inválido (vai para não testado), JSON ruidoso é recuperado, JSON quebrado é ignorado", () => {
  const good = agentFinding(EXPECTED.must_find[0]);
  const bad = agentFinding(EXPECTED.must_find[1], { severity: "GRAVISSIMO" });
  const wrongPrefix = agentFinding(EXPECTED.must_find[2], { area: "QA" });
  const crit = agentFinding({ check_id: "SEO-C01", area: "SEO", file: "x.html", min_severity: "CRITICO" }, { nature: "RISCO_POTENCIAL" });
  const { run } = mkRun({ agents: {
    a: `Aqui está o resultado:\n${JSON.stringify({ findings: [good, bad, wrongPrefix, crit], not_tested: [], errors: ["arquivo ilegível"] })}\nFim.`,
    b: "{quebrado",
  } });
  const r = consolidate(run); assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout); assert.equal(out.findings, 1); assert.equal(out.rejected.length, 3);
  const c = JSON.parse(readFileSync(join(run, "consolidation.json"), "utf8"));
  assert.ok(c.errors.some((e) => /recuperado/.test(e)) && c.errors.some((e) => /não é JSON válido/.test(e)) && c.errors.some((e) => /arquivo ilegível/.test(e)));
  assert.ok(JSON.parse(readFileSync(join(run, "findings.json"), "utf8")).not_tested.some((n) => /descartado/.test(n.description)));
});

test("consolidate: deduplica, liga related_ids nos dois sentidos e aponta relacionados órfãos", () => {
  const a = agentFinding({ check_id: "SEO-C06", area: "SEO", file: "index.html", min_severity: "IMPORTANTE" }, { related_check_ids: ["QA-C11", "QA-C99"] });
  const a2 = agentFinding({ check_id: "SEO-C06", area: "SEO", file: "index.html", min_severity: "IMPORTANTE" }, { evidence: [{ type: "codigo", file: "index.html", line: 9, snippet: "outra" }] });
  const q = agentFinding({ check_id: "QA-C11", area: "QA", file: "js/main.js", min_severity: "CRITICO" });
  const { run } = mkRun({ agents: { a: { findings: [a, a2, q] } } });
  const r = consolidate(run); assert.equal(r.status, 0, r.stdout + r.stderr);
  const f = JSON.parse(readFileSync(join(run, "findings.json"), "utf8")).findings;
  assert.equal(f.length, 2); const seo = f.find((x) => x.area === "SEO"); const qa = f.find((x) => x.area === "QA");
  assert.equal(seo.evidence.length, 2); assert.deepEqual(seo.related_ids, [qa.id]); assert.deepEqual(qa.related_ids, [seo.id]);
  const c = JSON.parse(readFileSync(join(run, "consolidation.json"), "utf8")); assert.equal(c.merged, 1); assert.equal(c.orphan_related.length, 1);
});

test("consolidate: segredo não mascarado no achado falha a validação (sem report)", () => {
  const leak = agentFinding(EXPECTED.must_find.find((m) => m.check_id === "SEC-C01"), { evidence: [{ type: "codigo", file: ".env", line: 1, snippet: "KEY=AKIAIOSFODNN7EXAMPLE" }] });
  const { run } = mkRun({ agents: { s: { findings: [leak] } } });
  const r = consolidate(run); assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /segredo não mascarado/);
});
