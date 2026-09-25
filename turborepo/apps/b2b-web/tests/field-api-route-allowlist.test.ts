import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// @REQ: FLD-API-LAYER (AC6)
// Test statyczny pilnujący allowlisty Route Handlerów w panelu B2B (ADR-001 + ADR-013)

function findRouteFiles(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

export function validateRouteAllowlist(routes: string[]): { valid: boolean; violations: string[] } {
  // ADR-001: webhooki publiczne; ADR-013: dedykowana warstwa zapisu aplikacji terenowej; Supabase OAuth
  const ALLOWED_PREFIXES = [
    'api/webhooks/',
    'api/field/',
    'auth/callback/',
  ];

  const violations: string[] = [];
  for (const r of routes) {
    const isAllowed = ALLOWED_PREFIXES.some((prefix) => r.startsWith(prefix));
    if (!isAllowed) {
      violations.push(r);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

describe('FLD-API-LAYER: Allowlista Route Handlerów (AC6)', () => {
  const appDir = path.resolve(__dirname, '../src/app');

  it('T6.1: Wszystkie istniejące pliki route.ts w apps/b2b-web/src/app mieszczą się w dozwolonych prefiksach', () => {
    const actualRoutes = findRouteFiles(appDir);
    expect(actualRoutes.length).toBeGreaterThan(0);

    const check = validateRouteAllowlist(actualRoutes);
    expect(check.valid, `Znaleziono niedozwolone Route Handlery poza ADR-001/ADR-013: ${check.violations.join(', ')}`).toBe(true);
  });

  it('T6.2: Liveness — detektor odrzuca Route Handlery spoza dozwolonych prefiksów (np. próba ominięcia Server Actions dla leadów)', () => {
    const fakeRoutes = [
      'api/webhooks/shipping/route.ts',
      'api/field/availability/self/route.ts',
      'api/leads/update-status/route.ts', // NARUSZENIE
      'api/customers/route.ts', // NARUSZENIE
    ];

    const check = validateRouteAllowlist(fakeRoutes);
    expect(check.valid).toBe(false);
    expect(check.violations).toEqual([
      'api/leads/update-status/route.ts',
      'api/customers/route.ts',
    ]);
  });

  it('T6.3: Prefiksy nie pozwalają na obejścia typu api/field-spoofing/route.ts', () => {
    const spoofRoutes = [
      'api/field-fake/orders/route.ts',
      'api/field_other/test/route.ts',
    ];

    const check = validateRouteAllowlist(spoofRoutes);
    expect(check.valid).toBe(false);
    expect(check.violations).toHaveLength(2);
  });
});
