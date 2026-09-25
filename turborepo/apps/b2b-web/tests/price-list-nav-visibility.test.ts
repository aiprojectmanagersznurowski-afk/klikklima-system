import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPricingNavItemVisible } from '../src/lib/pricing/nav-visibility';
import { getNavItemsForRole } from '../src/navigation/sidebar-items';
import type { Role } from '@klikklima/contracts';

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — AC1.
 * // @REQ: PRICE-LIST-ADMIN
 *
 * /settings/pricing jest osiągalny z sekcji ustawień w nawigacji panelu (pozycja obok
 * "Kalendarz i wizyty"), widoczna dla admin, dyspozytor, audytor; dla monter pozycja jest
 * ukryta.
 */

const LAYOUT_PATH = path.resolve(__dirname, '../src/app/(dashboard)/layout.tsx');

function readLayout(): string {
  return readFileSync(LAYOUT_PATH, 'utf-8');
}

describe('PRICE-LIST-ADMIN — AC1 nawigacja i widoczność pozycji cennika', () => {
  it('isPricingNavItemVisible zwraca true wyłącznie dla admin, dyspozytor, audytor', () => {
    expect(isPricingNavItemVisible('admin')).toBe(true);
    expect(isPricingNavItemVisible('dyspozytor')).toBe(true);
    expect(isPricingNavItemVisible('audytor')).toBe(true);
    expect(isPricingNavItemVisible('monter')).toBe(false);
    expect(isPricingNavItemVisible(null)).toBe(false);
  });

  it('layout.tsx importuje isPricingNavItemVisible i zawiera pozycję /settings/pricing', () => {
    const layoutContent = readLayout();
    expect(layoutContent).toMatch(/import\s*\{[^}]*isPricingNavItemVisible[^}]*\}\s*from\s*['"][^'"]*nav-visibility['"]/);
    expect(layoutContent).toMatch(/\/settings\/pricing/);
    expect(layoutContent).toMatch(/Cennik wyceny/);
    expect(layoutContent).toMatch(/isPricingNavItemVisible\(actorRole\)/);
  });

  it('getNavItemsForRole w sidebar-items.ts zawiera Cennik wyceny dla uprawnionych ról i ukrywa dla montera', () => {
    const roles: Role[] = ['admin', 'dyspozytor', 'audytor'];
    for (const role of roles) {
      const items = getNavItemsForRole(role);
      const settings = items.find((i) => i.id === 'settings');
      expect(settings).toBeDefined();
      const pricingSubItem = settings?.subItems?.find((s) => s.href === '/settings/pricing');
      expect(pricingSubItem).toBeDefined();
      expect(pricingSubItem?.label).toBe('Cennik wyceny');
    }

    const monterItems = getNavItemsForRole('monter');
    const monterSettings = monterItems.find((i) => i.id === 'settings');
    const monterPricing = monterSettings?.subItems?.find((s) => s.href === '/settings/pricing');
    expect(monterPricing).toBeUndefined();
  });
});
