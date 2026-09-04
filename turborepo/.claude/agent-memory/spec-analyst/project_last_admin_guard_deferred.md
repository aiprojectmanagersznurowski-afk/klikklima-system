---
name: project_last_admin_guard_deferred
description: SEC-LAST-ADMIN-GUARD (ochrona przed usunięciem/degradacją ostatniego admina) świadomie odroczona — tylko wąska wersja weszła do SEC-AUDIT-LOG-ROLE-CHANGE
metadata:
  type: project
---

Decyzja Michała (2026-09-04): przy budowie `SEC-AUDIT-LOG-ROLE-CHANGE` dodajemy WYŁĄCZNIE ochronę "nie można zdegradować ostatniego admina" na ścieżce zmiany roli (transakcja `Serializable`, AC7/AC8 w WO). Ochrona przed **usunięciem** ostatniego konta admin (`deleteAuthorizedUser`) NIE wchodzi w zakres tej tury — to osobne, jeszcze niezarejestrowane wymaganie `SEC-LAST-ADMIN-GUARD`.

**Why:** oba wektory (delete i degradacja roli) prowadzą do tego samego stanu awaryjnego (zero kont admin, brak dostępu do `/settings` bez bezpośredniego dostępu do bazy), ale zamykanie obu naraz zwiększało zakres tury. Michał świadomie wybrał węższy krok teraz.

**How to apply:** przy najbliższej okazji dotykania `deleteAuthorizedUser` (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts`) — zaproponować zarejestrowanie i zamknięcie `SEC-LAST-ADMIN-GUARD` jako osobnego WO, nie doklejać go po cichu do innego zadania. Nie zakładaj, że luka została zamknięta tylko dlatego, że `SEC-AUDIT-LOG-ROLE-CHANGE` ma swoją wąską wersję.
