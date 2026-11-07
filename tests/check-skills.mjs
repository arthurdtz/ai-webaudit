#!/usr/bin/env node
// Verificações dos testes das skills pre-launch, optimize e fix (usadas por tests/run-skills.sh). Somente leitura.
//   node tests/check-skills.mjs prelaunch <run>      veredito no topo + checklist manual + skill=pre-launch
//   node tests/check-skills.mjs optimize  <run>      só áreas do objetivo "aumentar conversão" + plano em fases
//   node tests/check-skills.mjs pick      <run>      imprime 3 IDs de áreas diferentes (um CRÍTICO): QA-C11, A11Y-C03, SEO-C06
//   node tests/check-skills.mjs fixed     <run> <ID…> fix_status ∈ {validado, corrigido} e presença no fix-log.md
//   node tests/check-skills.mjs gone      <run-novo> <run-antigo> <ID…>   os achados corrigidos não aparecem mais
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [cmd, run, ...rest] = process.argv.slice(2);
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const fails = []; const ok = (c, msg) => { console.log(`${c ? "✔" : "✖"} ${msg}`); if (!c) fails.push(msg); };
const finish = () => { console.log(fails.length ? `\nFALHOU: ${fails.length} verificação(ões)` : "\nTudo OK"); process.exit(fails.length ? 1 : 0); };
if (!cmd || !run) { console.error("uso: check-skills.mjs <prelaunch|optimize|pick|fixed|gone> <run> [...]"); process.exit(2); }
const F = () => read(join(run, "findings.json"));

if (cmd === "prelaunch") {
  const f = F(); const md = readFileSync(join(run, "report.md"), "utf8"); const lines = md.split("\n");
  const crit = f.findings.filter((x) => x.severity === "CRITICO").length;
  ok(f.skill === "pre-launch", `findings.json: skill = ${f.skill}`);
  ok(/^> \*\*Bloqueadores conhecidos: (SIM \(\d+\)|NÃO IDENTIFICADOS)\*\*/.test(lines[2] ?? ""), `veredito logo abaixo do título: ${(lines[2] ?? "").slice(0, 70)}`);
  ok(crit ? lines[2].includes(`SIM (${crit})`) : lines[2].includes("NÃO IDENTIFICADOS"), `veredito coerente com ${crit} crítico(s)`);
  ok(/não\*\* garante/.test(lines[2] ?? ""), "veredito avisa que não garante ausência de problemas");
  ok(md.includes("## 9. Checklist manual pós-publicação"), "seção 9 (checklist manual pós-publicação)");
  for (const t of ["Search Console", "Perfil da Empresa", "formulário em produção", "Monitoramento"]) ok(md.includes(t), `checklist menciona: ${t}`);
  const excl = f.areas_excluded.map((a) => a.area);
  ok(["GEO", "AEO", "AIO", "CONT"].every((a) => excl.includes(a) || !f.areas_selected.includes(a)), `áreas fora do foco não acionadas (excluídas: ${excl.join(",")})`);
  ok(["QA", "SEO", "PRIV", "A11Y", "PERF", "OPS"].every((a) => f.areas_selected.includes(a)), `áreas do foco acionadas: ${f.areas_selected.join(",")}`);
  ok(!/site pronto|sem problemas|conforme (a )?(LGPD|WCAG)/i.test(md), "relatório não afirma 'pronto/sem problemas/conforme'");
  finish();
}
if (cmd === "optimize") {
  const f = F(); const md = readFileSync(join(run, "report.md"), "utf8"); const allowed = new Set(["CRO", "ANL", "PERF", "QA", "A11Y"]);
  ok(f.skill === "optimize", `findings.json: skill = ${f.skill}`);
  ok(f.areas_selected.length > 0 && f.areas_selected.every((a) => allowed.has(a)), `só áreas do objetivo: ${f.areas_selected.join(",")}`);
  ok(f.findings.every((x) => allowed.has(x.area)), `achados só dessas áreas (${[...new Set(f.findings.map((x) => x.area))].join(",")})`);
  ok(f.areas_excluded.length >= 5, `demais áreas registradas como excluídas com motivo (${f.areas_excluded.length})`);
  ok(md.includes("## 9. Plano de implementação em fases"), "seção 9 — plano em fases");
  for (const h of ["Fase 0", "Fase 1", "Fase 2", "Fase 3"]) ok(md.includes(h), `plano tem ${h}`);
  ok(/> \*\*Objetivo:\*\*/.test(md), "relatório mostra o objetivo"); ok(/\| ★ \|/.test(md), "itens do objetivo marcados com ★");
  ok(/Não há estimativa de ganho/.test(md), "plano avisa que não há estimativa de ganho");
  finish();
}
if (cmd === "pick") {
  const f = F().findings; const want = ["QA-C11", "A11Y-C03", "SEO-C06"]; const ids = [];
  for (const c of want) { const x = f.find((y) => y.check_id === c); if (!x) { console.error(`achado ${c} não encontrado no run`); process.exit(1); } ids.push(x.id); }
  console.log(ids.join(" ")); process.exit(0);
}
if (cmd === "fixed") {
  const f = F().findings; const log = existsSync(join(run, "fix-log.md")) ? readFileSync(join(run, "fix-log.md"), "utf8") : "";
  ok(Boolean(log), "fix-log.md existe");
  for (const id of rest) { const x = f.find((y) => y.id === id); ok(x && ["validado", "corrigido"].includes(x.fix_status), `${id} fix_status = ${x?.fix_status}`); ok(log.includes(id), `${id} no fix-log.md`); }
  finish();
}
if (cmd === "gone") {
  const [oldRun, ...ids] = rest; const now = F().findings; const old = read(join(oldRun, "findings.json")).findings;
  for (const id of ids) { const o = old.find((x) => x.id === id); const file = o?.evidence?.[0]?.file;
    const still = now.filter((x) => x.check_id === o.check_id && (x.evidence ?? []).some((e) => e.file === file));
    ok(still.length === 0, `${id} (${o.check_id} em ${file}) ${still.length ? "AINDA APARECE: " + still.map((s) => s.id + " " + s.title).join("; ") : "não aparece mais"}`); }
  finish();
}
console.error("subcomando desconhecido"); process.exit(2);
