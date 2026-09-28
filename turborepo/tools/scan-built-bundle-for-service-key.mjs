#!/usr/bin/env node
/**
 * B2C-RLS-PUBLIC / SEC-SERVICE-KEY-SERVER-ONLY — skan zbudowanego bundla klienckiego pod
 * kątem wycieku klucza service_role. Sprawdza WYJŚCIE bundlera (.next/static/**), nie
 * źródła — minifikacja, tree-shaking i source mapy mogą przenieść literał tam, gdzie
 * statyczny grep na *.tsx (reguła `service-key` w tools/kk.config.mjs) go nie zobaczy.
 *
 * Trzy niezależne sygnały, każdy sam w sobie wystarczający do `leaked: true`:
 *   (a) SENTINEL         — dosłowny wartownik przekazany przez wywołującego (build z
 *                           testowym sekretem podstawionym pod SUPABASE_SERVICE_ROLE_KEY)
 *   (b) ENV_VAR_NAME      — literał nazwy zmiennej środowiskowej klucza serwisowego
 *   (c) JWT_SERVICE_ROLE  — token JWT, którego zdekodowany payload ma role: "service_role"
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ENV_VAR_NAME = 'SUPABASE_SERVICE_ROLE_KEY';
const JWT_PATTERN = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function decodeBase64Url(segment) {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function excerptAround(content, index, length) {
  const start = Math.max(0, index - 20);
  const end = Math.min(content.length, index + length + 20);
  return content.slice(start, end);
}

function scanContent(content, sentinel) {
  const findings = [];

  const sentinelIdx = content.indexOf(sentinel);
  if (sentinelIdx !== -1) {
    findings.push({ kind: 'SENTINEL', excerpt: excerptAround(content, sentinelIdx, sentinel.length) });
  }

  const envIdx = content.indexOf(ENV_VAR_NAME);
  if (envIdx !== -1) {
    findings.push({ kind: 'ENV_VAR_NAME', excerpt: excerptAround(content, envIdx, ENV_VAR_NAME.length) });
  }

  for (const match of content.matchAll(JWT_PATTERN)) {
    const [token] = match;
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) continue;
    const decoded = decodeBase64Url(payloadSegment);
    if (!decoded) continue;
    try {
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.role === 'service_role') {
        findings.push({ kind: 'JWT_SERVICE_ROLE', excerpt: excerptAround(content, match.index ?? 0, token.length) });
      }
    } catch {
      // Nie każdy trafiony wzorzec trzysegmentowy jest JWT-em z JSON-em w środku — to jest OK.
    }
  }

  return findings;
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {{ dir: string; sentinel: string }} params
 * @returns {Promise<{ leaked: boolean; findings: Array<{ file: string; kind: 'SENTINEL'|'ENV_VAR_NAME'|'JWT_SERVICE_ROLE'; excerpt: string }> }>}
 */
export async function scanBuiltBundleForServiceKey({ dir, sentinel }) {
  const allFindings = [];

  let files;
  try {
    statSync(dir);
    files = walk(dir);
  } catch {
    return { leaked: false, findings: [] };
  }

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // plik binarny nieczytelny jako utf8 (obraz, font) — nie jest wektorem tekstowego wycieku
    }
    const findings = scanContent(content, sentinel);
    for (const f of findings) {
      allFindings.push({ file, kind: f.kind, excerpt: f.excerpt });
    }
  }

  return { leaked: allFindings.length > 0, findings: allFindings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const sentinel = process.argv[3] ?? '__no_sentinel__';
  if (!dir) {
    console.error('Użycie: node tools/scan-built-bundle-for-service-key.mjs <dir> [sentinel]');
    process.exit(2);
  }
  const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
  if (result.leaked) {
    console.error(`✗ Wykryto wyciek klucza serwisowego w ${dir}:`);
    for (const f of result.findings) {
      console.error(`  [${f.kind}] ${f.file}\n    ${f.excerpt.slice(0, 200)}`);
    }
    process.exit(1);
  }
  console.log(`✓ Brak wycieku klucza serwisowego w ${dir}.`);
}
