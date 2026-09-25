import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * WO: docs/workorders/FLD-QUOTE-CALC.md — AC-V1.
 * // @REQ: PRICE-VAT-RATE
 *
 * Test statyczny sprawdzający, że próg VAT 300m² pochodzi wyłącznie z kontraktu SLA
 * (SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm), a żaden plik domenowy związany z wyceną i rodzajem
 * obiektu nie zawiera twardego literału 300.
 */

const KEYWORDS = ['PROPERTY_AREA', 'propertyKind', 'property_kind', 'propertyAreaBand', 'PropertyAreaBand'];

function findFilesToScan(rootDir: string): string[] {
  const matchedFiles: string[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // Ignorujemy pliki testów i pliki generowane
        if (entry.name.includes('.test.') || entry.name.includes('.itest.') || entry.name.includes('.spec.') || fullPath.includes('/generated/')) {
          continue;
        }

        const isPricingDomain = fullPath.includes('/src/lib/pricing/') ||
          fullPath.includes('/settings/pricing/') ||
          fullPath.includes('/packages/pricing/');

        if (isPricingDomain) {
          matchedFiles.push(fullPath);
        } else {
          // Sprawdzamy czy plik zawiera którekolwiek słowo kluczowe
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (KEYWORDS.some((kw) => content.includes(kw))) {
            matchedFiles.push(fullPath);
          }
        }
      }
    }
  }

  walk(rootDir);
  return matchedFiles;
}

// Regex: \b300\b bez poprzedzenia literą/podkreśleniem (np. nie łapie UP_TO_300)
// Łapie: " 300 ", "<= 300", "do 300 m²"
const BANNED_300_REGEX = /(?<![a-zA-Z0-9_])300(?![a-zA-Z0-9_])/g;

function scanFileForBanned300(filePath: string): { line: number; content: string }[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations: { line: number; content: string }[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignoruj linie komentarzy opisujące regułę lub testy
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }
    if (BANNED_300_REGEX.test(line)) {
      violations.push({ line: i + 1, content: line.trim() });
    }
  }
  return violations;
}

describe('PRICE-VAT-RATE — AC-V1 statyczna weryfikacja braku literału 300 w kodzie wyceny', () => {
  it('żaden plik wyceny ani rodzaju obiektu nie zawiera samodzielnego literału 300', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const files = findFilesToScan(repoRoot);

    const allViolations: { file: string; line: number; content: string }[] = [];
    for (const file of files) {
      const violations = scanFileForBanned300(file);
      for (const v of violations) {
        allViolations.push({ file: path.relative(repoRoot, file), ...v });
      }
    }

    expect(allViolations).toEqual([]);
  });

  it('próba żywotności: skaner wykrywa samodzielny literał 300 w kodzie sprawdzającym powierzchnię', () => {
    const fakeCode = 'if (area <= 300) { propertyKind = "RESIDENTIAL_UP_TO_THRESHOLD"; }';
    expect(BANNED_300_REGEX.test(fakeCode)).toBe(true);

    const allowedCode = 'const band = "UP_TO_300";';
    BANNED_300_REGEX.lastIndex = 0;
    expect(BANNED_300_REGEX.test(allowedCode)).toBe(false);
  });
});
