// Testes do guard (scripts/guard.mjs): simulam a entrada do hook PreToolUse.
// Execução: node --test tests/guard/   (ou: cd scripts && npm test)
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, utimesSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GUARD = join(ROOT, "scripts", "guard.mjs");
const PLUGIN_SCRIPT = join(ROOT, "scripts", "collect-static.mjs");

function run(input, rawStdin) {
  const r = spawnSync("node", [GUARD], { input: rawStdin ?? JSON.stringify(input), encoding: "utf8" });
  return { code: r.status, stderr: r.stderr };
}
function mkTarget({ lock = true, ageMs = 0, rawLock } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-guard-")));
  mkdirSync(join(dir, ".webaudit", "runs", "r1"), { recursive: true });
  if (lock) {
    const lockPath = join(dir, ".webaudit", ".lock");
    const created = new Date(Date.now() - ageMs).toISOString();
    writeFileSync(lockPath, rawLock ?? JSON.stringify({ created_at: created, skill: "audit" }));
    if (ageMs) { const t = new Date(Date.now() - ageMs); utimesSync(lockPath, t, t); }
  }
  return dir;
}
const bash = (cwd, command) => run({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd });
const tool = (cwd, name, file_path, extra = {}) => run({ hook_event_name: "PreToolUse", tool_name: name, tool_input: { file_path, ...extra }, cwd });
const blocked = (r, msg) => { assert.equal(r.code, 2, `esperava bloqueio (exit 2), veio ${r.code}. ${msg ?? ""}`); assert.match(r.stderr, /modo leitura/); };
const allowed = (r, msg) => assert.equal(r.code, 0, `esperava permitir (exit 0), veio ${r.code}: ${r.stderr}. ${msg ?? ""}`);

test("Write fora de .webaudit/ → bloqueia", () => {
  const t = mkTarget();
  blocked(tool(t, "Write", join(t, "index.html")));
  blocked(tool(t, "Write", "/tmp/x.txt"));
  blocked(tool(t, "Write", "index.html")); // relativo ao cwd
});

test("Write dentro de .webaudit/ → permite", () => {
  const t = mkTarget();
  allowed(tool(t, "Write", join(t, ".webaudit", "runs", "r1", "context.json")));
  allowed(tool(t, "Write", ".webaudit/runs/r1/report.md")); // relativo
  allowed(tool(t, "Edit", join(t, ".webaudit", "latest")));
  allowed(tool(t, "NotebookEdit", join(t, ".webaudit", "n.ipynb"), { notebook_path: join(t, ".webaudit", "n.ipynb") }));
});

test("Edit/MultiEdit/NotebookEdit fora de .webaudit/ → bloqueia", () => {
  const t = mkTarget();
  blocked(tool(t, "Edit", join(t, "src", "a.js")));
  blocked(tool(t, "MultiEdit", join(t, "src", "a.js")));
  blocked(run({ tool_name: "NotebookEdit", tool_input: { notebook_path: join(t, "n.ipynb") }, cwd: t }));
});

test("travessia de caminho, link simbólico e lock não escapam", () => {
  const t = mkTarget();
  blocked(tool(t, "Write", join(t, ".webaudit", "..", "index.html")), "..");
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-out-")));
  symlinkSync(outside, join(t, ".webaudit", "link"));
  blocked(tool(t, "Write", join(t, ".webaudit", "link", "x.txt")), "symlink dentro de .webaudit");
  blocked(tool(t, "Write", join(t, ".webaudit", ".lock")), "sobrescrever o lock");
  blocked(bash(t, "echo '{}' > .webaudit/.lock"), "redirecionar para o lock");
  // .webaudit como link simbólico para fora
  const t2 = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-guard-")));
  const out2 = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-out-")));
  symlinkSync(out2, join(t2, ".webaudit"));
  writeFileSync(join(out2, ".lock"), JSON.stringify({ created_at: new Date().toISOString() }));
  blocked(tool(t2, "Write", join(t2, ".webaudit", "x.txt")), ".webaudit simbólico");
  rmSync(outside, { recursive: true, force: true }); rmSync(out2, { recursive: true, force: true });
});

test("Read/Grep/Glob e demais ferramentas → permite", () => {
  const t = mkTarget();
  for (const name of ["Read", "Grep", "Glob", "WebFetch", "Agent"]) {
    allowed(run({ tool_name: name, tool_input: { file_path: join(t, "index.html"), pattern: "x" }, cwd: t }), name);
  }
});

test("Bash: comandos de risco → bloqueia", () => {
  const t = mkTarget();
  for (const c of [
    "git commit -m x", "git commit --amend", "git push origin main", "git reset --hard", "git clean -fd", "git checkout -- .",
    "git checkout main", "git -C . commit -m x", "git stash", "git add -A", "git rm a.txt", "git tag v1", "git branch -D x",
    "git config user.name x", "git remote add o url",
    "rm -rf node_modules", "rm -rf /", "rm index.html", "rm -r .webaudit/../src", "rmdir src", "mv a b", "cp a b", "touch x.txt", "mkdir out", "truncate -s0 a",
    "sed -i 's/a/b/' index.html", "sed --in-place s/a/b/ x", "perl -pi -e 's/a/b/' x",
    "npm install", "npm i left-pad", "npm ci", "pnpm add x", "yarn add x", "yarn", "bun add x", "npm audit fix", "npx some-tool", "pnpm dlx x", "npm exec x",
    "pip install x", "pip3 install -r r.txt", "apt-get install x", "brew install x", "gem install x", "composer require x", "go install x", "cargo install x",
    "vercel deploy", "vercel --prod", "netlify deploy --prod", "firebase deploy", "wrangler deploy", "wrangler pages deploy dist", "flyctl deploy", "aws s3 sync . s3://b", "docker run x",
    "gh pr create", "gh release create v1", "gh api -X POST /x", "gh api /x -f a=b",
    "curl -X POST https://x", "curl -d a=b https://x", "curl -F a=@f https://x", "curl -T f https://x", "curl -O https://x/f", "curl -o index.html https://x", "wget https://x", "wget -O index.html https://x", "wget --post-data=a https://x",
    "scp a h:/x", "rsync -a . h:/x", "ssh h", "nc h 1",
    "echo x > index.html", "echo x >> src/a.js", "cat a > ../out.txt", "echo x &> out.txt", "tee out.txt", "ls | tee a.txt", "echo x >| a",
    "bash -c 'rm -rf src'", "sh -c \"git push\"", "eval 'git commit -m x'", "echo $(git commit -m x)", "echo `rm -rf src`", "true && git push",
    "ls; git push", "ls | xargs rm", "find . -delete", "find . -exec rm {} ;", "tar xf a.tar", "unzip a.zip", "dd if=a of=out.bin",
    "node -e \"require('fs').writeFileSync('a','b')\"", "node scripts/other.mjs", "python3 -c 'print(1)'", "python3 x.py", "bash x.sh", "source x.sh", "sudo ls",
    "cd /tmp && rm -rf x", "cd .. && echo x > y", "$CMD arg", "rm -rf $DIR", "echo x > $FILE", "cat <<EOF > index.html\nx\nEOF",
  ]) {
    blocked(bash(t, c), c);
  }
});

test("Bash: comandos legítimos → permite", () => {
  const t = mkTarget();
  for (const c of [
    `node ${PLUGIN_SCRIPT} ${t} ${t}/.webaudit/runs/r1`,
    `node "${ROOT}/scripts/detect-stack.mjs" ${t}`,
    `node ${ROOT}/scripts/lock.mjs release ${t}`,
    "ls -la", "cat index.html", "grep -rn lorem .", "head -n 20 index.html", "find . -name '*.html'", "wc -l index.html",
    "git status", "git log --oneline -5", "git diff", "git -C . rev-parse HEAD", "git branch", "git branch --show-current", "git tag -l", "git config --get remote.origin.url", "git remote -v", "git ls-files", "git log --all -p -n 50", "git grep -n x",
    "npm run build", "npm run dev", "npm test", "npm ls", "npm audit", "npm audit --json", "pnpm run build", "yarn build", "bun run build", "bun test",
    "curl -s https://exemplo.com", "curl -sI https://exemplo.com", "curl -X GET https://x", "curl -o .webaudit/runs/r1/raw/a.html https://x", "wget -qO- https://x", "wget -O .webaudit/raw/a.html https://x",
    "mkdir -p .webaudit/runs/r1/raw", "touch .webaudit/x", "cp a .webaudit/runs/r1/a", "rm -f .webaudit/runs/r1/tmp.txt",
    "echo ok > .webaudit/runs/r1/note.txt", "echo ok >> .webaudit/log.txt", "echo ok > /dev/null", "ls 2>&1", "ls 2>/dev/null", "echo a | tee .webaudit/a.txt",
    "node --version", "gh pr view 1", "gh pr list", "gh auth status", "gh api /repos/x/y",
    "kill 1234", "sleep 1", "echo \"git commit é só texto\"", "echo 'rm -rf /'", "grep 'git push' README.md", "date",
    "cd .webaudit && ls", "cd subdir && cat a.txt", "echo '>' | cat", "ls && echo done",
    "cat <<'EOF'\nrm -rf /\nEOF",
  ]) {
    allowed(bash(t, c), c);
  }
});

test("sem lock → permite tudo (inclusive o que seria bloqueado)", () => {
  const t = mkTarget({ lock: false });
  allowed(tool(t, "Write", join(t, "index.html")));
  allowed(bash(t, "git commit -m x"));
  allowed(bash(t, "rm -rf node_modules"));
  allowed(bash(t, "npm install"));
});

test("lock expirado (> 2 h) → permite tudo", () => {
  const t = mkTarget({ ageMs: 2 * 60 * 60 * 1000 + 5 * 60 * 1000 });
  allowed(tool(t, "Write", join(t, "index.html")));
  allowed(bash(t, "git push"));
});

test("lock com 1h59 → ainda ativo (bloqueia)", () => {
  const t = mkTarget({ ageMs: 119 * 60 * 1000 });
  blocked(tool(t, "Write", join(t, "index.html")));
  blocked(bash(t, "git push"));
});

test("lock encontrado a partir de subdiretório do alvo", () => {
  const t = mkTarget();
  mkdirSync(join(t, "src", "components"), { recursive: true });
  blocked(run({ tool_name: "Write", tool_input: { file_path: join(t, "src", "a.js") }, cwd: join(t, "src", "components") }));
});

test("falha fechada: entrada ilegível ou lock corrompido com lock ativo → bloqueia", () => {
  const t = mkTarget();
  // entrada ilegível, mas cwd do processo não está no alvo → sem lock encontrado → permite
  const r0 = spawnSync("node", [GUARD], { input: "{not json", encoding: "utf8", cwd: tmpdir() });
  assert.equal(r0.status, 0);
  // entrada ilegível com cwd do processo dentro do alvo (lock válido) → bloqueia
  const r1 = spawnSync("node", [GUARD], { input: "{not json", encoding: "utf8", cwd: t });
  assert.equal(r1.status, 2, r1.stderr);
  // lock corrompido recente → falha fechada
  const t2 = mkTarget({ rawLock: "{corrompido" });
  blocked(tool(t2, "Write", join(t2, "index.html")), "lock corrompido");
  // Bash sem comando legível
  blocked(run({ tool_name: "Bash", tool_input: {}, cwd: t }));
  // Write sem caminho
  blocked(run({ tool_name: "Write", tool_input: {}, cwd: t }));
});

test("hook roda dentro de subagente (agent_id) com as mesmas regras", () => {
  const t = mkTarget();
  blocked(run({ tool_name: "Write", tool_input: { file_path: join(t, "a.js") }, cwd: t, agent_id: "x", agent_type: "ai-webaudit:security" }));
  allowed(run({ tool_name: "Write", tool_input: { file_path: join(t, ".webaudit", "a.json") }, cwd: t, agent_id: "x" }));
});

test("lock.mjs: acquire cria lock e exclude; recusa o diretório do plugin; release remove", () => {
  const t = realpathSync(mkdtempSync(join(tmpdir(), "webaudit-lock-")));
  spawnSync("git", ["init", "-q", t]);
  const LOCK = join(ROOT, "scripts", "lock.mjs");
  let r = spawnSync("node", [LOCK, "acquire", t, "--skill", "audit", "--run", "2026-11-06_1200"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  r = spawnSync("node", [LOCK, "status", t], { encoding: "utf8" });
  assert.equal(JSON.parse(r.stdout).state, "valid");
  const excl = spawnSync("git", ["-C", t, "check-ignore", ".webaudit/x"], { encoding: "utf8" });
  assert.equal(excl.status, 0, ".webaudit/ deve estar no .git/info/exclude");
  r = spawnSync("node", [LOCK, "acquire", t], { encoding: "utf8" });
  assert.equal(r.status, 4);
  r = spawnSync("node", [LOCK, "release", t], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(spawnSync("node", [LOCK, "status", t], { encoding: "utf8" }).stdout).state, "none");
  r = spawnSync("node", [LOCK, "acquire", ROOT], { encoding: "utf8" });
  assert.equal(r.status, 3, "alvo = diretório do plugin deve ser recusado");
});
