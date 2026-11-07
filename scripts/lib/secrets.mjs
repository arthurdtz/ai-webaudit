// Padrões de segredo + mascaramento. NUNCA devolve o valor inteiro.
import { maskValue } from "./common.mjs";

const FAKE = /(FAKE|EXAMPLE|CHANGE[_-]?ME|PLACEHOLDER|YOUR[_-]?(API|KEY|TOKEN|SECRET|PASSWORD)|XXXX|DUMMY|SAMPLE|NOT[_-]?REAL|REDACTED|TODO|<[^>]{1,40}>|\$\{[^}]+\}|\{\{[^}]+\}\})/i;
const REF = /^(process\.env|import\.meta\.env|os\.environ|getenv|env\.|ENV\[|\$[A-Za-z_{])/;

export const PATTERNS = [
  { id: "aws-access-key", name: "AWS access key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, confidence: "high" },
  { id: "github-token", name: "GitHub token", re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/g, confidence: "high" },
  { id: "stripe-live", name: "Stripe chave secreta (live)", re: /\b(sk|rk)_live_[0-9a-zA-Z]{16,}\b/g, confidence: "high" },
  { id: "stripe-test", name: "Stripe chave secreta (teste)", re: /\b(sk|rk)_test_[0-9a-zA-Z]{16,}\b/g, confidence: "test_key" },
  { id: "google-api-key", name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, confidence: "high" },
  { id: "slack-token", name: "Slack token", re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/g, confidence: "high" },
  { id: "openai-key", name: "Chave tipo sk-", re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/g, confidence: "high" },
  { id: "private-key", name: "Chave privada", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, confidence: "high" },
  { id: "jwt", name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, confidence: "medium" },
  { id: "db-url-password", name: "URL de banco com senha", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:([^\s@\/]{6,})@[^\s\/]+/gi, confidence: "medium", group: 1 },
  { id: "generic-assignment", name: "Atribuição de segredo", re: /\b([A-Za-z0-9_]*(?:secret|token|passwd|password|pwd|api[_-]?key|apikey|private[_-]?key|client[_-]?secret|access[_-]?key|service[_-]?role)[A-Za-z0-9_]*)\s*[:=]\s*["']?([^\s"'`,;)}\]]{8,})/gi, confidence: "low", group: 2, nameGroup: 1 },
];

/** Procura segredos no texto. Retorna ocorrências com valor MASCARADO. */
export function scanText(text, lineAt) {
  const hits = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text))) {
      const value = m[p.group ?? 0];
      if (!value) continue;
      if (p.id === "generic-assignment") {
        if (REF.test(value) || /^[A-Za-z_][A-Za-z0-9_.]*\(/.test(value)) continue; // referência a variável/chamada
        if (/^(true|false|null|undefined|none)$/i.test(value)) continue;
        if (/^(string|number|boolean)$/i.test(value)) continue;
      }
      const fake = FAKE.test(value) || FAKE.test(m[0]);
      let confidence = p.confidence;
      if (fake) confidence = "marker_fake";
      hits.push({
        pattern: p.id, pattern_name: p.name, line: lineAt(m.index), confidence,
        name: p.nameGroup ? m[p.nameGroup] : undefined,
        masked: maskValue(value), length: value.length,
      });
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }
  return hits;
}
export const HIGH_REGEX_SOURCE = PATTERNS.filter((p) => p.confidence === "high").map((p) => p.re.source).join("|");
