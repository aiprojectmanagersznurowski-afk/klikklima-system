import { can, type Role } from '@klikklima/contracts';

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — AC1.
 * Pozycja /settings/pricing w nawigacji jest widoczna wyłącznie dla ról z prawem odczytu
 * cennika (admin, dyspozytor, audytor). Dla montera jest ukryta.
 */
export function isPricingNavItemVisible(actorRole: Role | null): boolean {
  if (!actorRole) return false;
  return can(actorRole, 'price_list_items', 'read') === 'yes';
}
