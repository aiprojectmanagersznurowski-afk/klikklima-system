import type { Role } from "@klikklima/contracts"

/**
 * Przeglądarka dokumentacji projektu (decyzje Michała, 2026-09-17): pozycja nawigacji
 * "Dokumentacja" jest widoczna WYŁĄCZNIE dla roli `admin`. "Dokumentacja" nie jest zasobem
 * w `RESOURCES` (contracts/rbac.contract.mjs) — to statyczne pliki `.md` z repozytorium,
 * nie dane biznesowe — więc bramka jest prostym porównaniem roli, bez `can()`, wzorem
 * `isScheduleNavItemVisible` w `../schedule/nav-visibility.ts`.
 */
export function isDocsNavItemVisible(actorRole: Role | null): boolean {
  return actorRole === "admin"
}
