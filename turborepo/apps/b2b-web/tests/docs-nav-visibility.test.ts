import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROLES, type Role } from '@klikklima/contracts';

/**
 * NOWA FUNKCJA (decyzje Michała, 2026-09-17): pozycja nawigacji "Dokumentacja" w panelu B2B
 * jest widoczna WYŁĄCZNIE dla roli `admin`. Narzędzie wewnętrzne, bez ID wymagania — testy
 * bez `@REQ`.
 *
 * Zasób "dokumentacja" NIE jest wpisany do `RESOURCES` w `contracts/rbac.contract.mjs` (nie
 * odpowiada żadnej tabeli — to statyczne pliki `.md` z repozytorium, nie dane biznesowe) —
 * w przeciwieństwie do `isScheduleNavItemVisible` (FLD-AVAIL-WEEKLY-RULES), które opiera się
 * na `can(role, 'availability_rules', 'update')`, bramka tej pozycji nawigacji jest
 * PROSTYM porównaniem roli: `actorRole === 'admin'`, bez przechodzenia przez `can()` —
 * dokładnie zgodnie z decyzją WO ("widoczna i dostępna wyłącznie dla roli admin").
 *
 * ═══════════════════════ KONTRAKT Z IMPLEMENTEREM (implementer-ui) ═══════════════════════
 *
 * Nowy plik `apps/b2b-web/src/lib/docs/nav-visibility.ts` (czysty moduł — wzorem
 * `apps/b2b-web/src/lib/schedule/nav-visibility.ts`):
 *
 *   export function isDocsNavItemVisible(actorRole: Role | null): boolean
 *     — zwraca `true` WYŁĄCZNIE gdy `actorRole === 'admin'`, w każdym innym przypadku
 *     (w tym `null`, w tym każda z pozostałych trzech ról) `false`.
 *
 * `apps/b2b-web/src/app/(dashboard)/layout.tsx` dopisuje pozycję nawigacji z etykietą
 * "Dokumentacja" i `href: '/dokumentacja'`, warunkowaną wywołaniem `isDocsNavItemVisible(...)`
 * zaimportowanym z `.../lib/docs/nav-visibility` — analogicznie do `isScheduleNavItemVisible`
 * / `/me/schedule` już obecnych w tym pliku.
 *
 * Dzisiejszy RED: `nav-visibility.ts` (docs) jeszcze nie istnieje (Cannot find module —
 * poprawny RED); `layout.tsx` istnieje, ale nie zawiera jeszcze importu/wywołania
 * `isDocsNavItemVisible` ani `/dokumentacja` (RED na asercji dopasowania treści).
 */

const LAYOUT_PATH = path.resolve(__dirname, '../src/app/(dashboard)/layout.tsx');

function readLayout(): string {
  return readFileSync(LAYOUT_PATH, 'utf-8');
}

describe('isDocsNavItemVisible — widoczna wyłącznie dla roli admin', () => {
  it('zwraca true wyłącznie dla "admin", false dla pozostałych trzech ról', async () => {
    const { isDocsNavItemVisible } = await import('../src/lib/docs/nav-visibility');

    const nonAdminRoles = ROLES.filter((role) => role !== 'admin') as Role[];
    expect(nonAdminRoles).toEqual(['dyspozytor', 'audytor', 'monter']);

    expect(isDocsNavItemVisible('admin')).toBe(true);
    for (const role of nonAdminRoles) {
      expect(isDocsNavItemVisible(role)).toBe(false);
    }
  });

  it('zwraca false dla braku roli (null, np. brak sesji)', async () => {
    const { isDocsNavItemVisible } = await import('../src/lib/docs/nav-visibility');

    expect(isDocsNavItemVisible(null)).toBe(false);
  });
});

describe('layout.tsx — pozycja nawigacji "Dokumentacja" warunkowana isDocsNavItemVisible', () => {
  it('importuje isDocsNavItemVisible z lib/docs/nav-visibility', () => {
    const content = readLayout();
    expect(content).toMatch(
      /import\s*\{[^}]*isDocsNavItemVisible[^}]*\}\s*from\s*['"][.\/]*lib\/docs\/nav-visibility['"]/,
    );
  });

  it('zawiera pozycję nawigacji z etykietą "Dokumentacja" i href "/dokumentacja"', () => {
    const content = readLayout();
    expect(content).toContain('/dokumentacja');
    expect(content).toContain('Dokumentacja');
  });

  it('pozycja nawigacji z href "/dokumentacja" jest warunkowana wywołaniem isDocsNavItemVisible(...)', () => {
    const content = readLayout();
    const hrefIndex = content.indexOf("'/dokumentacja'");
    const hrefIndexDouble = content.indexOf('"/dokumentacja"');
    const foundAt = [hrefIndex, hrefIndexDouble].filter((i) => i !== -1);
    expect(foundAt.length).toBeGreaterThan(0);

    const anchor = Math.min(...foundAt);
    const precedingContext = content.slice(Math.max(0, anchor - 600), anchor);
    expect(precedingContext).toMatch(/isDocsNavItemVisible\(/);
  });
});
