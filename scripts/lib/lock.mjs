// Lock do modo leitura (SPEC §9): <alvo>/.webaudit/.lock
// Criado na Fase 0, removido na Fase 6; o guard só atua enquanto existir um lock VÁLIDO.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
export const WEBAUDIT_DIR = ".webaudit";
export const LOCK_NAME = ".lock";

/**
 * Lê e avalia um lock.
 * @returns {{state:"none"|"valid"|"expired"|"invalid", path:string, data?:object, ageMs?:number, reason?:string}}
 */
export function readLock(lockPath, now = Date.now()) {
  if (!existsSync(lockPath)) return { state: "none", path: lockPath };
  let data;
  try {
    data = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (e) {
    // Lock ilegível: tratado como INVÁLIDO (o guard falha fechado enquanto a idade do arquivo for < TTL).
    let ageMs = Infinity;
    try { ageMs = now - statSync(lockPath).mtimeMs; } catch {}
    return { state: ageMs > LOCK_TTL_MS ? "expired" : "invalid", path: lockPath, ageMs, reason: `lock ilegível: ${e.message}` };
  }
  const created = Date.parse(data?.created_at ?? "");
  let createdMs = created;
  if (!Number.isFinite(createdMs)) {
    try { createdMs = statSync(lockPath).mtimeMs; } catch { createdMs = 0; }
  }
  const ageMs = now - createdMs;
  if (ageMs > LOCK_TTL_MS) return { state: "expired", path: lockPath, data, ageMs };
  return { state: "valid", path: lockPath, data, ageMs };
}

/** Sobe de `startDir` até a raiz procurando `.webaudit/.lock`. Retorna o primeiro lock encontrado (qualquer estado ≠ none). */
export function findLock(startDir, now = Date.now()) {
  let dir = resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const candidate = join(dir, WEBAUDIT_DIR, LOCK_NAME);
    const res = readLock(candidate, now);
    if (res.state !== "none") return { ...res, targetRoot: dir };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { state: "none" };
}
