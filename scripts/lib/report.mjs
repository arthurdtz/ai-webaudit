// Gera o report.md (references/shared/report-template.md) a partir do findings.json. Texto em pt-BR.
const SEV_ORDER = ["CRITICO", "IMPORTANTE", "MELHORIA", "OPCIONAL"];
const SEV_LABEL = { CRITICO: "CRÍTICO", IMPORTANTE: "IMPORTANTE", MELHORIA: "MELHORIA", OPCIONAL: "OPCIONAL" };
const SEV_SECTION = { CRITICO: "3.1 Críticos", IMPORTANTE: "3.2 Importantes", MELHORIA: "3.3 Melhorias", OPCIONAL: "3.4 Opcionais" };
const EFFORT_LABEL = { P: "pequeno", M: "médio", G: "grande" };
const NATURE_LABEL = { CONFIRMADO: "confirmado", RISCO_POTENCIAL: "risco potencial", PREVENTIVO: "preventivo" };
const VERIF_LABEL = { estatica: "estática", "ativa-local": "ativa-local", "ativa-remota": "ativa-remota", "manual-pendente": "manual pendente" };
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = (s) => "`" + String(s ?? "").replace(/`/g, "'") + "`";

function evidenceLine(e) {
  const where = e.file ? `${code(e.file + (e.line ? ":" + e.line : ""))}` : e.command ? code(e.command) : e.raw_ref ? code(e.raw_ref) : "";
  const detail = e.snippet ? ` — ${code(e.snippet.replace(/\s+/g, " ").slice(0, 200))}` : e.output_excerpt ? ` — ${code(e.output_excerpt.replace(/\s+/g, " ").slice(0, 200))}` : "";
  return `${where}${detail}`.trim() || "(sem detalhe)";
}

export function renderReport(d, { context = {} } = {}) {
  const f = d.findings; const by = (s) => f.filter((x) => x.severity === s);
  const counts = Object.fromEntries(SEV_ORDER.map((s) => [s, by(s).length]));
  const isPre = d.skill === "pre-launch";
  const project = context.stack?.package_name ?? d.target_path.split("/").filter(Boolean).pop();
  const date = d.generated_at.slice(0, 16).replace("T", " ") + " UTC";
  const criticals = by("CRITICO");
  const areaCount = {}; for (const x of f) areaCount[x.area] = (areaCount[x.area] ?? 0) + 1;
  const topAreas = Object.entries(areaCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([a, n]) => `${a} (${n})`).join(", ");
  const modes = d.collection_modes.join(", ");
  const skippedTools = d.tools.filter((t) => t.status !== "ok");

  // 1. resumo executivo (determinístico, sem afirmações de conformidade)
  const exec = [];
  exec.push(`Auditoria \`/ai-webaudit:${d.skill}\` do projeto **${project}** (${d.stack.framework}${d.stack.site_type ? `, ${d.stack.site_type}` : ""}), modos de coleta: ${modes}.`);
  exec.push(f.length ? `Foram registrados **${f.length}** achados com evidência: ${SEV_ORDER.map((s) => `${counts[s]} ${SEV_LABEL[s].toLowerCase()}`).join(", ")}.` : "Nenhum achado com evidência foi registrado nas áreas analisadas (isto **não** significa ausência de problemas: veja o que não foi testado).");
  if (criticals.length) exec.push(`Críticos: ${criticals.slice(0, 6).map((x) => `${code(x.id)} ${x.title}`).join("; ")}${criticals.length > 6 ? `; e mais ${criticals.length - 6}` : ""}.`);
  if (topAreas) exec.push(`Áreas com mais achados: ${topAreas}.`);
  exec.push(`Áreas analisadas: ${d.areas_selected.join(", ") || "nenhuma"}${d.areas_excluded.length ? `; não acionadas: ${d.areas_excluded.map((a) => a.area).join(", ")}` : ""}.`);
  exec.push(`**Não testado / verificação manual pendente: ${d.not_tested.length} item(ns)**${skippedTools.length ? `; ferramentas sem execução ou com falha: ${skippedTools.map((t) => t.name).join(", ")}` : ""} (seções 5 e 6).`);
  if (isPre) exec.push(counts.CRITICO ? `**Bloqueadores conhecidos: SIM (${counts.CRITICO})**. Este resultado não indica que o site esteja pronto: reflete apenas o que foi testado.` : "**Bloqueadores conhecidos: NÃO IDENTIFICADOS**. Este resultado não indica que o site esteja pronto: reflete apenas o que foi testado e não substitui os itens da seção 6.");
  exec.push("Este relatório não é certificação de segurança, acessibilidade ou conformidade legal (seção 8).");

  const L = [];
  L.push(`# Relatório AI WebAudit — ${project}`, "");
  L.push("| Campo | Valor |", "|---|---|");
  L.push(`| Data | ${date} |`, `| Run | ${code(d.run_id)} |`, `| Skill | ${code("/ai-webaudit:" + d.skill)}${d.arguments ? " " + code(d.arguments) : ""} |`);
  L.push(`| Commit / branch | ${d.git.is_repo ? `${code((d.git.commit ?? "").slice(0, 10))} / ${code(d.git.branch ?? "")}${d.git.dirty ? " (há alterações não commitadas)" : ""}` : "(sem git)"} |`);
  L.push(`| Stack | ${esc([d.stack.framework, d.stack.language, d.stack.site_type, d.stack.hosting && `hosting: ${d.stack.hosting}`].filter(Boolean).join(" · "))} |`, `| Modos de coleta | ${modes} |`, "");

  L.push("## 1. Resumo executivo", "", ...exec.map((l) => `- ${l}`), "");
  L.push("| Severidade | Quantidade |", "|---|---|", ...SEV_ORDER.map((s) => `| ${SEV_LABEL[s]} | ${counts[s]} |`), "");

  L.push("## 2. Ordem prática de correção", "");
  const order = f.filter((x) => x.severity !== "OPCIONAL").slice(0, 20);
  if (order.length) order.forEach((x, i) => L.push(`${i + 1}. ${code(x.id)} — ${x.title} (esforço ${EFFORT_LABEL[x.effort]}; ${SEV_LABEL[x.severity].toLowerCase()}, ${NATURE_LABEL[x.nature]})`)); else L.push("Nenhuma correção prioritária registrada.");
  if (f.filter((x) => x.severity !== "OPCIONAL").length > 20) L.push("", `(Lista limitada aos 20 primeiros; ${f.filter((x) => x.severity !== "OPCIONAL").length - 20} adicional(is) na seção 3.)`);
  L.push("", "A ordem segue severidade, depois esforço (menor primeiro). Itens de áreas diferentes podem ter trade-offs (seção 4): decida antes de aplicar.", "");

  L.push("## 3. Achados", "");
  for (const s of SEV_ORDER) {
    L.push(`### ${SEV_SECTION[s]}`, "");
    const items = by(s);
    if (!items.length) { L.push("Nenhum.", ""); continue; }
    L.push("| ID | Área | Título | Natureza | Verificação | Esforço |", "|---|---|---|---|---|---|");
    for (const x of items) L.push(`| ${code(x.id)} | ${x.area} | ${esc(x.title)} | ${NATURE_LABEL[x.nature]} | ${VERIF_LABEL[x.verification]} | ${EFFORT_LABEL[x.effort]} |`);
    L.push("");
    for (const x of items) {
      L.push(`#### ${x.id} — ${x.title}`, "", `- **Verificação:** ${code(x.check_id)}`, `- **Descrição:** ${x.description}`);
      L.push(`- **Evidência:**`, ...x.evidence.map((e) => `  - ${evidenceLine(e)}`));
      L.push(`- **Impacto:** ${x.impact}`, `- **Recomendação:** ${x.recommendation}`, `- **Critério de validação:** ${x.validation_criteria}`);
      L.push(`- **Relacionados:** ${x.related_ids.length ? x.related_ids.map(code).join(", ") : "nenhum"}`, `- **Trade-offs:** ${x.tradeoffs.length ? x.tradeoffs.join(" / ") : "nenhum"}`, "");
    }
  }

  L.push("## 4. Trade-offs entre áreas", "");
  const trade = f.filter((x) => x.tradeoffs.length);
  if (trade.length) for (const x of trade) L.push(`- ${code(x.id)} (${x.area}): ${x.tradeoffs.join(" / ")}${x.related_ids.length ? ` — relacionados: ${x.related_ids.map(code).join(", ")}` : ""}`); else L.push("Nenhum.");
  L.push("");

  L.push("## 5. O que foi testado e como", "", "| Ferramenta | Versão | Status | Observação |", "|---|---|---|---|");
  for (const t of d.tools) L.push(`| ${esc(t.name)} | ${esc(t.version ?? "n/d")} | ${t.status} | ${esc(t.error ?? "")} |`);
  if (!d.tools.length) L.push("| (nenhuma ferramenta registrada) | | | |");
  L.push("", `Áreas analisadas: ${d.areas_selected.join(", ") || "nenhuma"}. Modos de coleta: ${modes}. Subagentes somente leitura (Read, Grep, Glob) analisaram o código e os resultados em ${code("raw/")}.`, "");

  L.push("## 6. Não testado / verificação manual pendente", "");
  if (d.not_tested.length) for (const n of d.not_tested) L.push(`- **${n.area}**${n.check_id ? " " + code(n.check_id) : ""} — ${n.description} Motivo: ${n.reason}`); else L.push("Nenhum item registrado.");
  L.push("", "## 7. Áreas não acionadas", "");
  if (d.areas_excluded.length) { L.push("| Área | Motivo |", "|---|---|"); for (const a of d.areas_excluded) L.push(`| ${a.area} | ${esc(a.reason)} |`); } else L.push("Todas as áreas aplicáveis foram acionadas.");
  L.push("", "## 8. Aviso", "", "Este relatório não é certificação de segurança, acessibilidade ou conformidade legal. Ferramentas automáticas cobrem só parte dos critérios; os itens da seção 6 exigem verificação humana. Os resultados refletem o estado do projeto no commit indicado.", "");
  return L.join("\n");
}
