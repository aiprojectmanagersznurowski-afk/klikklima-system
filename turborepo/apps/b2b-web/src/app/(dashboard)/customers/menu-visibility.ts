import { can, type Role } from "@klikklima/contracts";

/**
 * CRM-CLIENT-ANONYMIZE-RODO (AC10): pozycja menu "Anonimizuj (RODO)" jest
 * widoczna wyłącznie dla ról, którym kontrakt RBAC przyznaje uprawnienie
 * `clients:delete` — wydzielone jako czysta logika (bez importów UI) na
 * wzór `services/menu-visibility.ts`, żeby dało się ją testować bez
 * renderu. Pytamy kontrakt, a nie duplikujemy macierzy uprawnień lokalnym
 * literałem roli, żeby przyszła zmiana macierzy RBAC propagowała się tu
 * automatycznie zamiast rozjeżdżać się z serwerem.
 */
export function isAnonymizeMenuItemVisible(actorRole: Role | null): boolean {
  return actorRole !== null && can(actorRole, 'clients', 'delete') === 'yes';
}
