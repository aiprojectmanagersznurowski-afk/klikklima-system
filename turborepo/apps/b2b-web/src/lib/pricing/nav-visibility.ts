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

/**
 * WO: docs/workorders/STD-INSTALL-CONFIG.md
 * // @REQ: STD-INSTALL-CONFIG
 *
 * Pozycja /settings/standard-installation w nawigacji jest widoczna dla ról z prawem
 * odczytu konfiguracji systemowej (admin).
 */
export function isStandardInstallationNavItemVisible(actorRole: Role | null): boolean {
  if (!actorRole) return false;
  return (
    can(actorRole, 'system_config', 'read') === 'yes' ||
    can(actorRole, 'price_list_items', 'read') === 'yes'
  );
}
