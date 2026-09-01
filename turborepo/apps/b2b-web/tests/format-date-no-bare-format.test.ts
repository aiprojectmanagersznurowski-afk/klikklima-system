import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Wymaganie: FNL-B-FORMATDATE (Work Order BATCH-MEDIUM-LOW-CLEANUP.md, punkt 2, AC2.2).
 *
 * Test STATYCZNY (grep nad źródłami, nie nad zachowaniem runtime): żaden plik
 * `apps/b2b-web/src/app/(dashboard)/**\/*-client.tsx` nie może wywoływać
 * `format(new Date(` — to jest gołe wywołanie `format` z `date-fns` na dacie,
 * bez przejścia przez strefę czasową (`formatInTimeZone`/wspólny helper
 * `formatDate` z `src/lib/format-date.ts`).
 *
 * DZIŚ (przed GREEN) ten test MUSI failować — łamią go 4 pliki:
 *   - incidents/incidents-client.tsx:140
 *   - services/services-client.tsx:120,125
 *   - installations/installations-client.tsx:151
 *   - customers/customers-client.tsx:132
 * Po GREEN (przejście na wspólny `formatDate()` z `src/lib/format-date.ts`)
 * ten test ma przechodzić.
 */

function findClientFiles(dir: string): string[] {
  const fs = require('node:fs') as typeof import('node:fs');
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findClientFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('-client.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('AC2.2: brak gołego format(new Date( w plikach *-client.tsx panelu B2B', () => {
  it('żaden plik (dashboard)/**/*-client.tsx nie zawiera wzorca format(new Date(', () => {
    const dashboardDir = path.resolve(
      __dirname,
      '../src/app/(dashboard)',
    );
    const clientFiles = findClientFiles(dashboardDir);

    expect(clientFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of clientFiles) {
      const content = readFileSync(file, 'utf-8');
      if (/format\(\s*new Date\(/.test(content)) {
        offenders.push(path.relative(dashboardDir, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
