#!/usr/bin/env node
// Fase 5 e 6 (mecânicas): consolida as saídas dos subagentes em findings.json + report.md.
//   node scripts/consolidate.mjs <run> [--no-report] [--skill <skill>]
// Entrada em <run>/: run.json, areas.json, context.json, agents/<subagente>.json, raw/**.json
// Saída em <run>/: findings.json, consolidation.json, report.md  (e <alvo>/.webaudit/latest)
// Valida cada achado contra o schema, deduplica, numera IDs, liga related_ids e valida o resultado.
// Escreve SOMENTE dentro de <run>/ e em <alvo>/.webaudit/latest.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseArgs } from "./lib/common.mjs";
import { objectiveText, renderReport } from "./lib/report.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(HERE, "..", "references", "shared", "findings.schema.json");
const AREA_ORDER = ["SEO", "GEO", "AEO", "AIO", "CRO", "QA", "ANL", "PERF", "A11Y", "PRIV", "LOC", "OPS", "CONT", "API", "SEC"];
const SEV_RANK = { CRITICO: 0, IMPORTANTE: 1, MELHORIA: 2, OPCIONAL: 3 };
const EFFORT_RANK = { P: 0, M: 1, G: 2 };
// verificações que dependem de coleta ativa-local: sem ela, vão para "não testado"
const LOCAL_ONLY = [
  ["PERF", "PERF-C01", "Métricas de laboratório (Lighthouse)."], ["A11Y", "A11Y-C01", "Execução do axe-core e itens 'incomplete'."], ["A11Y", "A11Y-C08", "Contraste medido em navegador."],
  ["QA", "QA-C05", "Responsividade em 360/768/1440 px."], ["QA", "QA-C06", "Erros de console e de rede."], ["QA", "QA-C12", "Build de produção e saída gerada."],
];

export function consolidate(runArg, { report = true, skillOverride } = {}) {
  const run = resolve(runArg);
  const readJson = (rel, required = false) => { const p = join(run, rel); if (!existsSync(p)) { if (required) throw new Error(`arquivo obrigatório ausente: ${rel}`); return null; } try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { throw new Error(`${rel} não é JSON válido: ${e.message}`); } };
  const runMeta = readJson("run.json", true); const areasMeta = readJson("areas.json", true); const context = readJson("context.json") ?? {};
  const target = runMeta.target_path ?? context.target_path;
  const selected = areasMeta.areas_selected ?? [];
  const stats = { agents: {}, rejected: [], merged: 0, errors: [], orphan_related: [] };

  // schema + validadores
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv); ajv.addSchema(schema, "fs");
  const validateFinding = ajv.getSchema("fs#/$defs/finding");

  // ── 1. ler saídas dos subagentes ──
  const agentsDir = join(run, "agents"); const raw = []; const notTested = []; const notApplicable = [];
  for (const f of existsSync(agentsDir) ? readdirSync(agentsDir).filter((n) => n.endsWith(".json")).sort() : []) {
    const name = f.replace(/\.json$/, ""); let text = readFileSync(join(agentsDir, f), "utf8"); let obj;
    try { obj = JSON.parse(text); } catch { const a = text.indexOf("{"), b = text.lastIndexOf("}"); try { obj = JSON.parse(text.slice(a, b + 1)); stats.errors.push(`${name}: JSON recuperado de texto com ruído (o subagente deveria devolver só JSON)`); } catch (e) { stats.errors.push(`${name}: saída não é JSON válido (${e.message}); ignorada`); stats.agents[name] = { findings: 0, invalid_output: true }; continue; } }
    stats.agents[name] = { findings_in: (obj.findings ?? []).length, not_tested: (obj.not_tested ?? []).length, errors: obj.errors ?? [] };
    for (const e of obj.errors ?? []) stats.errors.push(`${name}: ${e}`);
    for (const nt of obj.not_tested ?? []) notTested.push({ ...nt, _from: name });
    for (const na of obj.areas_not_applicable ?? []) notApplicable.push({ ...na, _from: name });
    for (const fd of obj.findings ?? []) raw.push({ ...fd, _from: name });
  }

  // ── 2. normalizar e validar cada achado ──
  const accepted = [];
  for (const fd of raw) {
    const why = [];
    const ci = /^([A-Z0-9]+)-C\d\d$/.exec(fd.check_id ?? "");
    if (!ci) why.push("check_id ausente ou inválido");
    else if (fd.area !== ci[1]) why.push(`prefixo do check_id (${ci[1]}) difere da área (${fd.area})`);
    if (fd.area && !selected.includes(fd.area)) why.push(`área ${fd.area} não está em areas_selected`);
    const cand = { id: `WA-${fd.area ?? "XXX"}-001`, ...fd, fix_status: "aberto", related_ids: [], tradeoffs: fd.tradeoffs ?? [] };
    delete cand._from; delete cand.related_check_ids;
    if (!why.length && !validateFinding(cand)) for (const e of validateFinding.errors) if (!["if", "anyOf"].includes(e.keyword) && !e.schemaPath.includes("/allOf/0/")) why.push(`${e.instancePath || "(raiz)"}: ${e.message}`);
    if (!why.length && cand.severity === "CRITICO" && cand.nature !== "CONFIRMADO") {
      const concrete = (cand.evidence ?? []).some((e) => e.file && e.snippet);
      if (!(cand.nature === "RISCO_POTENCIAL" && ["SEC", "API", "PRIV"].includes(cand.area) && concrete)) why.push("CRITICO exige CONFIRMADO, ou RISCO_POTENCIAL em SEC/API/PRIV com file+snippet");
    }
    if (why.length) { stats.rejected.push({ agent: fd._from, check_id: fd.check_id ?? null, title: fd.title ?? null, reasons: [...new Set(why)].slice(0, 6) }); notTested.push({ area: fd.area && AREA_ORDER.includes(fd.area) ? fd.area : (selected[0] ?? "QA"), ...(ci ? { check_id: fd.check_id } : {}), description: `Achado do subagente ${fd._from} descartado por inconsistência: ${fd.title ?? "(sem título)"}`, reason: `Rejeitado na consolidação: ${[...new Set(why)].slice(0, 2).join("; ")}`, _from: "consolidate" }); continue; }
    accepted.push({ ...cand, _related_check_ids: [...new Set(fd.related_check_ids ?? [])], _from: fd._from });
  }

  // ── 3. deduplicar (mesmo check_id + mesmo arquivo da primeira evidência) ──
  const merged = [];
  for (const f of accepted) {
    const key = `${f.check_id}|${f.evidence?.[0]?.file ?? f.evidence?.[0]?.raw_ref ?? f.evidence?.[0]?.command ?? ""}`;
    const prev = merged.find((m) => m._key === key);
    if (prev) {
      stats.merged++;
      for (const e of f.evidence) if (prev.evidence.length < 5 && !prev.evidence.some((x) => x.file === e.file && x.line === e.line && x.snippet === e.snippet)) prev.evidence.push(e);
      if (SEV_RANK[f.severity] < SEV_RANK[prev.severity] && f.nature === prev.nature) prev.severity = f.severity;
      prev._related_check_ids = [...new Set([...prev._related_check_ids, ...f._related_check_ids])];
      prev.tradeoffs = [...new Set([...(prev.tradeoffs ?? []), ...(f.tradeoffs ?? [])])];
    } else merged.push({ ...f, _key: key });
  }

  // ── 4. ordenar e numerar ──
  const areaIdx = (a) => AREA_ORDER.indexOf(a);
  merged.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] || areaIdx(a.area) - areaIdx(b.area) || a.check_id.localeCompare(b.check_id) || String(a.evidence?.[0]?.file ?? "").localeCompare(String(b.evidence?.[0]?.file ?? "")));
  const counters = {};
  for (const f of merged) { counters[f.area] = (counters[f.area] ?? 0) + 1; f.id = `WA-${f.area}-${String(counters[f.area]).padStart(3, "0")}`; }
  const byCheck = new Map(); for (const f of merged) { if (!byCheck.has(f.check_id)) byCheck.set(f.check_id, []); byCheck.get(f.check_id).push(f.id); }
  for (const f of merged) {
    const rel = new Set();
    for (const cid of f._related_check_ids) { const ids = byCheck.get(cid); if (!ids) { stats.orphan_related.push({ id: f.id, related_check_id: cid }); continue; } for (const id of ids) if (id !== f.id) rel.add(id); }
    f.related_ids = [...rel];
  }
  for (const f of merged) for (const r of f.related_ids) { const o = merged.find((x) => x.id === r); if (o && !o.related_ids.includes(f.id)) o.related_ids.push(f.id); }
  const findings = merged.map(({ _key, _from, _related_check_ids, ...f }) => ({
    id: f.id, check_id: f.check_id, area: f.area, title: f.title, description: f.description, severity: f.severity, nature: f.nature, verification: f.verification,
    evidence: f.evidence, impact: f.impact, recommendation: f.recommendation, validation_criteria: f.validation_criteria, effort: f.effort, fix_status: "aberto",
    related_ids: [...new Set(f.related_ids)].sort(), tradeoffs: f.tradeoffs ?? [],
  }));

  // ── 5. metadados do run, ferramentas e "não testado" ──
  const tools = []; const rawDir = join(run, "raw");
  const walkJson = (d) => { const out = []; for (const n of existsSync(d) ? readdirSync(d) : []) { const p = join(d, n); const st = statSync(p); if (st.isDirectory()) out.push(...walkJson(p)); else if (n.endsWith(".json")) out.push(p); } return out; };
  const byTool = new Map();
  for (const p of walkJson(rawDir)) { let j; try { j = JSON.parse(readFileSync(p, "utf8")); } catch { continue; } if (!j?.tool || !j?.status) continue; const base = j.tool.replace(/^ai-webaudit\//, "").replace(/:.*$/, ""); const name = /lighthouse/.test(j.tool) ? "lighthouse" : /axe/.test(j.tool) ? "axe-core" : base; const cur = byTool.get(name) ?? { name, version: null, ok: 0, failed: 0, errors: [] }; if (j.version && !cur.version) cur.version = String(j.version); if (j.status === "failed") { cur.failed++; if (j.error && cur.errors.length < 2) cur.errors.push(String(j.error).split("\n")[0].slice(0, 200)); } else cur.ok++; byTool.set(name, cur); }
  for (const t of byTool.values()) tools.push({ name: t.name, version: t.version, status: t.failed && !t.ok ? "failed" : "ok", ...(t.failed ? { error: `${t.failed} execução(ões) falharam${t.errors.length ? `: ${t.errors.join(" | ")}` : ""}` } : {}) });
  const modes = runMeta.collection_modes ?? ["estatica"];
  if (!modes.includes("ativa-local")) for (const n of ["lighthouse", "axe-core", "playwright"]) if (!tools.some((t) => t.name === n)) tools.push({ name: n, version: null, status: "skipped", error: "coleta ativa-local não executada" });
  if (!modes.includes("ativa-remota") && modes.length === 1 && modes[0] === "estatica") { /* nada a acrescentar */ }
  const seenNT = new Set(); const finalNT = [];
  const addNT = (nt) => { const k = `${nt.area}|${nt.check_id ?? ""}|${nt.description}`; if (seenNT.has(k)) return; seenNT.add(k); const { _from, ...rest } = nt; if (!AREA_ORDER.includes(rest.area)) return; finalNT.push(rest); };
  for (const nt of notTested) if (selected.includes(nt.area)) addNT(nt);
  if (!modes.includes("ativa-local")) for (const [a, c, d] of LOCAL_ONLY) if (selected.includes(a) && !finalNT.some((x) => x.check_id === c)) addNT({ area: a, check_id: c, description: d, reason: "Depende de coleta ativa-local (servidor local aprovado), que não foi executada nesta auditoria." });
  const excluded = (areasMeta.areas_excluded ?? []).slice();
  const naSelected = notApplicable.filter((n) => selected.includes(n.area) && AREA_ORDER.includes(n.area));
  const areasSelectedFinal = selected.filter((a) => !naSelected.some((n) => n.area === a));
  for (const n of naSelected) if (!excluded.some((e) => e.area === n.area)) excluded.push({ area: n.area, reason: `Não aplicável (subagente ${n._from}): ${n.reason}` });

  const data = {
    run_id: runMeta.run_id, skill: skillOverride ?? runMeta.skill ?? "audit", arguments: runMeta.arguments ?? "", target_path: target,
    git: { is_repo: Boolean(context.git?.is_repo), commit: context.git?.commit ?? null, branch: context.git?.branch ?? null, dirty: context.git?.dirty ?? null },
    stack: { framework: context.stack?.framework ?? "desconhecido", language: context.language ?? undefined, site_type: context.site_type ?? undefined, hosting: context.hosting?.guess ?? undefined },
    collection_modes: modes, areas_selected: areasSelectedFinal, areas_excluded: excluded, tools, not_tested: finalNT, generated_at: new Date().toISOString(), findings,
  };
  for (const k of Object.keys(data.stack)) if (data.stack[k] === undefined) delete data.stack[k];
  writeFileSync(join(run, "findings.json"), JSON.stringify(data, null, 2) + "\n");

  // ── 6. validar o resultado final (schema + regras semânticas) ──
  let validation = { ok: true, output: "" };
  try { validation.output = execFileSync("node", [join(HERE, "validate-findings.mjs"), join(run, "findings.json")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (e) { validation = { ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() }; }

  const consolidation = { generated_at: data.generated_at, validation, counts: { findings: findings.length, by_severity: Object.fromEntries(["CRITICO", "IMPORTANTE", "MELHORIA", "OPCIONAL"].map((s) => [s, findings.filter((f) => f.severity === s).length])), not_tested: finalNT.length, rejected: stats.rejected.length, merged: stats.merged }, ...stats };
  writeFileSync(join(run, "consolidation.json"), JSON.stringify(consolidation, null, 2) + "\n");
  if (report && validation.ok) {
    writeFileSync(join(run, "report.md"), renderReport(data, { context, objective: runMeta.objective ?? (data.skill === "optimize" ? objectiveText(data.arguments) : null), objectiveAreas: runMeta.objective_areas ?? [] }));
    const wa = resolve(run, "..", ".."); // <alvo>/.webaudit
    if (basenameIs(wa, ".webaudit")) writeFileSync(join(wa, "latest"), `${data.run_id}\n`);
  }
  return { data, consolidation };
}
function basenameIs(p, n) { return p.split(sep).pop() === n; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { positional, opts } = parseArgs(process.argv.slice(2), { flags: ["skill"], bools: ["no-report"] });
  if (positional.length !== 1) { console.error("Uso: node scripts/consolidate.mjs <run> [--no-report] [--skill <skill>]"); process.exit(2); }
  const run = resolve(positional[0]);
  if (!run.includes(`${sep}.webaudit${sep}`)) { console.error("Erro: o run precisa estar dentro de <alvo>/.webaudit/."); process.exit(2); }
  try {
    const { consolidation } = consolidate(run, { report: !opts["no-report"], skillOverride: opts.skill });
    console.log(JSON.stringify({ run, ...consolidation.counts, validation: consolidation.validation.ok ? "ok" : "INVÁLIDO", rejected: consolidation.rejected, errors: consolidation.errors, orphan_related: consolidation.orphan_related }, null, 2));
    if (!consolidation.validation.ok) { console.error(consolidation.validation.output); process.exit(1); }
  } catch (e) { console.error(`Erro: ${e.message}`); process.exit(2); }
}
void relative;
