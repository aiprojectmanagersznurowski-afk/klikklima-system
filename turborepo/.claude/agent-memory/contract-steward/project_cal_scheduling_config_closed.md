---
name: cal-scheduling-config-closed
description: 2026-09-15 CAL-VISIT-DURATION-BASKETS i CAL-TRAVEL-BUFFER domknięte na DONE; AC2 rozdzielone na nośnik (zostaje) i ekran wyceny (wyniesiony do FLD-QUOTE-BASKET-SELECT)
metadata:
  type: project
---

`CAL-VISIT-DURATION-BASKETS` i `CAL-TRAVEL-BUFFER` zamknięte na DONE 2026-09-15 (okno `CAL-SCHEDULING-CONFIG-CLOSE`, commit `9073232`, gałąź `feat/crm-suite-complete`). Powstał nowy wpis `FLD-QUOTE-BASKET-SELECT` (TODO, 4 kryteria).

**Why:** Kryterium AC2 koszyków łączyło DWA dostarczenia o różnych właścicielach: nośnik (klucz obcy `bookings.visit_basket_id`, dowiedziony — schema + `create-booking.ts` zapisuje identyfikator) i konsumenta (ekran wyceny z wyborem koszyka, NIEISTNIEJĄCY). Sprawdzone dosłownie, nie z opisu WO: `visitBasketId` występuje w `apps/*/src` dokładnie raz — w `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts`, w schemacie Zod — i w ZERO komponentach interfejsu; katalog `apps/` zawiera wyłącznie `b2b-web` i `b2c-web`, Field App jako aplikacja nie istnieje. Blokowanie siedmiu dowiedzionych kryteriów z powodu jednego, którego nie da się dziś zrealizować bez całej nowej aplikacji, byłoby fałszywą dokładnością.

**How to apply:** Gdy kryterium opisuje PRODUCENTA i KONSUMENTA naraz, a konsument nie istnieje — rozdziel po tej granicy, zostaw nośnik przy wpisie, który go definiuje, wynieś resztę do nowego ID (nigdy nie kasuj). Precedensy w tym rejestrze: `CAL-SLOT-ENGINE` wyniesione z `FLD-AVAIL-WEEKLY-RULES`, warstwa kliencka `CAL-POOL-AGGREGATE` przejęta przez `B2C-BOOKING-SLOT`. Zawężając kryterium, zapisz w jego treści JAWNIE, że zakres zawężono i dokąd poszła druga połowa — inaczej wygląda to jak ciche skasowanie. Patrz [[closing-requirement-with-residual-debt]], [[cal-slot-engine-done]].

Stan żywej bazy potwierdzony tego dnia (przydatne przy kolejnych wpisach kalendarzowych): 7 koszyków, maksimum 480 min (`INSTALL_STANDARD`, `INSTALL_PHASE_1`); wiersz `scheduling_config` ma komplet czterech kluczy i `travel_buffer_minutes = 60`; wyzwalacz `bookings_pool_matches_basket_trg` ŻYWY.

DOMKNIĘCIE OSTATNIEGO DŁUGU (2026-09-15, okno `CAL-SCHEDULING-CONFIG-AUDIT-CHECK-APPLIED`): migracja `20260915120000_cal_scheduling_config_audit_check.sql` URUCHOMIONA i zweryfikowana niezależnie (`audit_log_resource_check` -> 15 wartości, patrz [[audit-log-resource-check-subset-of-resources]]). Oba wpisy mają ZASTRZEŻENIE 2 zdjęte: ekran `/settings/calendar` jest funkcjonalny w produkcji, nie tylko strukturalnie gotowy. Zostaje jeden węższy, świadomy dług: `scheduling-config-audit-log-check.itest.ts` nadal NIEURUCHOMIONY (brak Dockera) — ale dowodził dokładnie tego, co odczyt `pg_constraint` pokazał bezpośrednio.
