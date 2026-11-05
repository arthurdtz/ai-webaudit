#!/usr/bin/env node
// Valida um findings.json contra references/shared/findings.schema.json
// e aplica regras semânticas que o JSON Schema não expressa.
// Uso: node scripts/validate-findings.mjs <findings.json> [--schema <schema.json>]
// Saída: 0 = válido, 1 = inválido, 2 = erro de uso/leitura.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const defaultSchema = resolve(here, "..", "references", "shared", "findings.schema.json");

// Padrões comuns de segredo; um valor é aceito se estiver mascarado (…****).
const SECRET_PATTERNS = [
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{12,}\b/ },
  { name: "GitHub token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { name: "chave sk-", re: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { name: "Stripe key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "chave privada", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "atribuição de segredo",
    re: /\b(?:secret|token|password|passwd|api[_-]?key)\b\s*[:=]\s*["']?(?!\S{0,4}\*{4})[A-Za-z0-9_\-/+=]{12,}/i,
  },
];

function usage(msg) {
  if (msg) console.error(`Erro: ${msg}`);
  console.error("Uso: node scripts/validate-findings.mjs <findings.json> [--schema <schema.json>]");
  process.exit(2);
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    usage(`não foi possível ler ${label} (${path}): ${e.code ?? e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`INVÁLIDO: ${label} (${path}) não é JSON válido: ${e.message}`);
    process.exit(1);
  }
}

function humanize(err) {
  const where = err.instancePath || "(raiz)";
  switch (err.keyword) {
    case "required":
      return `${where}: campo obrigatório ausente "${err.params.missingProperty}"`;
    case "additionalProperties":
      return `${where}: campo não permitido "${err.params.additionalProperty}"`;
    case "enum":
      return `${where}: valor inválido; permitidos: ${err.params.allowedValues.join(", ")}`;
    case "pattern":
      return `${where}: formato inválido (esperado ${err.params.pattern})`;
    case "type":
      return `${where}: tipo inválido (esperado ${[].concat(err.params.type).join(" ou ")})`;
    case "minItems":
      return `${where}: precisa de ao menos ${err.params.limit} item(ns)`;
    case "const":
      return `${where}: valor deve ser ${JSON.stringify(err.params.allowedValue)}`;
    case "if":
      return `${where}: regra condicional não satisfeita`;
    default:
      return `${where}: ${err.message}`;
  }
}

function semanticChecks(data) {
  const errors = [];
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const ids = new Set();

  findings.forEach((f, i) => {
    const at = `/findings/${i}${f?.id ? ` (${f.id})` : ""}`;
    if (!f || typeof f !== "object") return;

    if (f.id) {
      if (ids.has(f.id)) errors.push(`${at}: id duplicado "${f.id}"`);
      ids.add(f.id);
      const prefix = /^WA-([A-Z0-9]+)-\d{3}$/.exec(f.id)?.[1];
      if (prefix && f.area && prefix !== f.area) {
        errors.push(`${at}: prefixo do id (${prefix}) difere da área (${f.area})`);
      }
    }
    if (f.check_id && f.area) {
      const prefix = /^([A-Z0-9]+)-C\d{2}$/.exec(f.check_id)?.[1];
      if (prefix && prefix !== f.area) {
        errors.push(`${at}: prefixo do check_id (${prefix}) difere da área (${f.area})`);
      }
    }
    if (Array.isArray(data.areas_selected) && f.area && !data.areas_selected.includes(f.area)) {
      errors.push(`${at}: área ${f.area} não consta em areas_selected`);
    }
    if (f.severity === "CRITICO" && f.nature !== "CONFIRMADO") {
      const concrete = Array.isArray(f.evidence) && f.evidence.some((e) => e?.file && e?.snippet);
      if (!(f.nature === "RISCO_POTENCIAL" && ["SEC", "API", "PRIV"].includes(f.area) && concrete)) {
        errors.push(`${at}: CRITICO exige nature CONFIRMADO, ou RISCO_POTENCIAL em SEC/API/PRIV com evidência concreta (file + snippet)`);
      }
    }
    if (data.skill !== "fix" && f.fix_status && f.fix_status !== "aberto") {
      errors.push(`${at}: auditoria só grava fix_status "aberto" (encontrado "${f.fix_status}")`);
    }

    const text = JSON.stringify(f);
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) errors.push(`${at}: possível segredo não mascarado (${name}); mascarar com 4 primeiros caracteres + ****`);
    }
  });

  findings.forEach((f, i) => {
    for (const rel of f?.related_ids ?? []) {
      if (!ids.has(rel)) errors.push(`/findings/${i} (${f.id}): related_ids aponta para "${rel}", que não existe neste run`);
      if (rel === f.id) errors.push(`/findings/${i} (${f.id}): related_ids contém o próprio id`);
    }
  });

  if (Array.isArray(data.areas_selected) && Array.isArray(data.areas_excluded)) {
    for (const ex of data.areas_excluded) {
      if (data.areas_selected.includes(ex.area)) errors.push(`área ${ex.area} aparece em areas_selected e areas_excluded`);
    }
  }
  return errors;
}

const args = process.argv.slice(2);
let file;
let schemaPath = defaultSchema;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--schema") schemaPath = args[++i] ?? usage("--schema exige um caminho");
  else if (args[i].startsWith("--")) usage(`opção desconhecida ${args[i]}`);
  else if (!file) file = args[i];
  else usage("informe apenas um arquivo");
}
if (!file) usage("informe o caminho do findings.json");

const schema = readJson(schemaPath, "schema");
const data = readJson(file, "findings");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const problems = [];
if (!validate(data)) {
  const seen = new Set();
  for (const err of validate.errors) {
    // "if"/"anyOf" e ramos da regra CRÍTICO geram ruído; a regra tem mensagem própria em semanticChecks
    if (err.keyword === "if" || err.keyword === "anyOf") continue;
    if (err.schemaPath.includes("/allOf/0/")) continue;
    const msg = humanize(err);
    if (!seen.has(msg)) {
      seen.add(msg);
      problems.push(msg);
    }
  }
}
problems.push(...semanticChecks(data));

if (problems.length) {
  console.error(`INVÁLIDO: ${file} — ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`OK: ${file} válido (${data.findings.length} achado(s)).`);
