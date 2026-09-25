import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — AC3.
 * // @REQ: PRICE-LIST-ADMIN
 *
 * Żadna Server Action ani funkcja pomocnicza w `settings/pricing/**` i `lib/pricing/**`
 * nie wykonuje `update` ani `updateMany` na modelu `priceListItemVersion` modyfikującego
 * kwoty `sale_price_net` lub `crew_cost_net` (w Prisma: `salePriceNet`, `crewCostNet`).
 * Dozwolone jest wyłącznie przełączanie `isCurrent: false` (lub `isCurrent: true`).
 * Wersje cen są niemutowalne (append-only).
 */

function scanForForbiddenPriceVersionUpdates(dirPath: string): { file: string; line: number; content: string }[] {
  const violations: { file: string; line: number; content: string }[] = [];
  if (!fs.existsSync(dirPath)) return violations;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))) {
      continue;
    }
    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Szukamy wywołań priceListItemVersion.(update|updateMany)
    const regex = /priceListItemVersion\.(?:update|updateMany)\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const callBody = match[1];
      // Sprawdzamy czy wewnątrz wywołania modyfikowane są kwoty w bloku data:
      const dataBlockMatch = /data\s*:\s*\{([\s\S]*?)\}/.exec(callBody);
      if (dataBlockMatch) {
        const dataContent = dataBlockMatch[1];
        if (
          dataContent.includes('salePriceNet') ||
          dataContent.includes('crewCostNet') ||
          dataContent.includes('sale_price_net') ||
          dataContent.includes('crew_cost_net')
        ) {
          // Znajdź numer linii
          const line = content.substring(0, match.index).split('\n').length;
          violations.push({ file: fullPath, line, content: match[0].split('\n')[0].trim() });
        }
      }
    }
  }
  return violations;
}

describe('PRICE-LIST-ADMIN — AC3 statyczna weryfikacja niemutowalności wersji cen', () => {
  it('kod w settings/pricing/** i lib/pricing/** nie modyfikuje kwot w priceListItemVersion', () => {
    const b2bRoot = path.resolve(__dirname, '..');
    const settingsPricing = path.join(b2bRoot, 'src/app/(dashboard)/settings/pricing');
    const libPricing = path.join(b2bRoot, 'src/lib/pricing');

    const violationsSettings = scanForForbiddenPriceVersionUpdates(settingsPricing);
    const violationsLib = scanForForbiddenPriceVersionUpdates(libPricing);

    expect(violationsSettings).toEqual([]);
    expect(violationsLib).toEqual([]);
  });

  it('próba żywotności: skaner poprawnie wykrywa niedozwolony update kwoty w wersji ceny', () => {
    const testContent = [
      'await prisma.priceListItemVersion.update({',
      '  where: { id: "v1" },',
      '  data: { salePriceNet: 150 },',
      '})',
    ].join('\n');

    const regex = /priceListItemVersion\.(?:update|updateMany)\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
    let detected = false;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(testContent)) !== null) {
      const callBody = match[1];
      const dataBlockMatch = /data\s*:\s*\{([\s\S]*?)\}/.exec(callBody);
      if (dataBlockMatch) {
        const dataContent = dataBlockMatch[1];
        if (dataContent.includes('salePriceNet') || dataContent.includes('crewCostNet')) {
          detected = true;
          break;
        }
      }
    }
    expect(detected).toBe(true);
  });
});
