import { can, type Role } from "@klikklima/contracts"

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok C, AC-C5): pozycja nawigacji do własnego grafiku
 * (`/me/schedule`) jest widoczna wyłącznie rolom, które mają `availability_rules:update`
 * dla siebie (`admin` bez wariantu, `audytor`/`monter` z wariantem `:own`). `dyspozytor`
 * ma tylko `read` na tym zasobie — widzi dane pracowników w warstwie B, ale nie ma
 * własnego grafiku do edycji, więc pozycja nawigacji jest dla niego ukryta.
 *
 * Czysty moduł: brak elementu w UI nie zastępuje bramki serwerowej (AC-A2/AC-A3/AC-A4
 * w `setAvailabilityRuleAction`), jest jej wymaganym uzupełnieniem — patrz WO.
 */
export function isScheduleNavItemVisible(actorRole: Role | null): boolean {
  return !!actorRole && can(actorRole, "availability_rules", "update") !== "no"
}
