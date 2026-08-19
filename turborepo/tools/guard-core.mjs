#!/usr/bin/env node
/**
 * guard-core — wspólny silnik reguł dla wszystkich adapterów hooków.
 *
 * Reguły żyją tutaj raz. Adaptery (Claude Code, Antigravity) tłumaczą wyłącznie
 * format wejścia i wyjścia. Bez tego rozdziału każda zmiana reguły wymagałaby
 * poprawki w dwóch miejscach, a rozjazd między IDE byłby kwestią czasu.
 *
 * API:
 *   checkWrite(relPath, content, role) -> { blocked, reason } | { blocked: false }
 *   checkBash(commandLine)             -> { blocked, reason } | { blocked: false }
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KK_PROJECT_DIR
  || process.env.CLAUDE_PROJECT_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..');

let config = null;
try {
  ({ config } = await import(`file://${join(ROOT, 'tools/kk.config.mjs')}`));
} catch {
  config = null;
}

export const toRelative = (p) => {
  if (!p) return '';
  return (isAbsolute(p) ? relative(ROOT, p) : p).replace(/\\/g, '/');
};

const contractWindowOpen = () => {
  try {
    const f = join(ROOT, '.claude/state/contract-window.json');
    if (!existsSync(f)) return false;
    const w = JSON.parse(readFileSync(f, 'utf8'));
    if (!w.open) return false;
    return !w.expiresAt || Date.parse(w.expiresAt) > Date.now();
  } catch {
    return false;
  }
};

const isTestPath = (rel) => (config?.testPathPatterns || []).some((p) => rel.includes(p));
const isContractPath = (rel) => (config?.contractProtectedPaths || []).some((p) => rel.startsWith(p));

/**
 * checkWrite(path, content, opts)
 *
 * opts.role            — nazwa subagenta, jeśli adapter ją zna (Claude Code). Bez niej
 *                        reguły rozdziału ról są pomijane; zastępuje je tools/kk-phase.mjs.
 * opts.enforceContract — czy pilnować ścieżek kontraktowych. TRUE przy zapisie z agenta,
 *                        FALSE przy skanie commita i repozytorium: wygenerowane artefakty
 *                        MUSZĄ trafić do gita, więc blokowanie ich przy commicie
 *                        uniemożliwiłoby zapisanie legalnej zmiany kontraktu.
 *
 * Dla zgodności trzeci argument może być nadal łańcuchem z nazwą roli.
 */
export function checkWrite(rawPath, content = '', opts = {}) {
  if (typeof opts === 'string' || opts === null) opts = { role: opts, enforceContract: true };
  const { role = null, enforceContract = false } = opts;
  if (!config) return { blocked: false };
  const rel = toRelative(rawPath);
  if (!rel) return { blocked: false };

  // 1. Ścieżki kontraktowe — tylko przy zapisie z agenta
  if (enforceContract && isContractPath(rel)) {
    if (role && role !== 'contract-steward') {
      return {
        blocked: true,
        rule: 'contract-path',
        reason: `Ścieżka kontraktowa "${rel}" jest zapisywalna wyłącznie przez contract-steward. Kontrakt jest źródłem prawdy — zmiana wymaga Work Order i otwartego okna kontraktowego.`,
      };
    }
    if (!contractWindowOpen()) {
      return {
        blocked: true,
        rule: 'contract-window',
        reason: `Okno kontraktowe jest zamknięte. Otwórz je świadomie: node tools/kk-contract-window.mjs open <TICKET>`,
      };
    }
  }

  // 2. Rozdział ról (jeśli adapter zna rolę)
  if (role) {
    if (isTestPath(rel) && /^implementer-/.test(role)) {
      return {
        blocked: true,
        rule: 'role-test-write',
        reason: `${role} nie edytuje plików testowych. Kto ma przejść test, ten go nie poprawia — zgłoś problem z testem w podsumowaniu.`,
      };
    }
    if (role === 'test-author' && !isTestPath(rel) && !rel.startsWith('.claude/state/')) {
      return {
        blocked: true,
        rule: 'role-impl-write',
        reason: `test-author pisze wyłącznie testy. Implementacja należy do implementera.`,
      };
    }
    const scopes = config.agentWriteScopes?.[role];
    if (scopes && !scopes.some((s) => rel.startsWith(s.replace('**/', '')) || rel.includes(s.replace(/\*\*/g, '')))) {
      return {
        blocked: true,
        rule: 'role-scope',
        reason: `${role} nie ma zakresu zapisu dla "${rel}". Dozwolone: ${scopes.join(', ')}`,
      };
    }
  }

  // 3. Wzorce zakazane w treści
  for (const p of config.forbiddenPatterns || []) {
    if (p.severity === 'warn') continue;
    if (!new RegExp(p.appliesTo).test(rel)) continue;
    if ((p.allowIn || []).some((a) => rel.includes(a))) continue;
    const m = new RegExp(p.re).exec(content || '');
    if (m) {
      return { blocked: true, rule: p.id, reason: `[${p.id}] ${p.msg} (dopasowano: "${String(m[0]).slice(0, 60)}")` };
    }
  }

  return { blocked: false };
}

export function checkBash(commandLine = '') {
  if (!config || !commandLine) return { blocked: false };
  for (const p of config.forbiddenBashPatterns || []) {
    if (new RegExp(p.re).test(commandLine)) {
      return { blocked: true, rule: 'bash', reason: p.msg };
    }
  }
  return { blocked: false };
}

export const kkConfig = config;
export const projectRoot = ROOT;
