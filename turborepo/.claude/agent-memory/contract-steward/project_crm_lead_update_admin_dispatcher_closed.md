---
name: crm-lead-update-admin-dispatcher-closed
description: CRM-LEAD-UPDATE-ADMIN-DISPATCHER zamknięte 2026-09-08 dopiero po naprawie dwóch kryteriów, których zielone testy nie wykrywały — wzorzec do powtórzenia przy kolejnych ID
metadata:
  type: project
---

`CRM-LEAD-UPDATE-ADMIN-DISPATCHER` (contracts/requirements.contract.mjs) jest **DONE od 2026-09-08**. Droga do zamknięcia jest tu ważniejsza niż sam status.

Przy pierwszym podejściu odmówiłem zamknięcia: 22/22 testy serwerowe były zielone, a mimo to 2 z 13 kryteriów nie były spełnione.

1. **Fail-closed (kryteria 4 i 8)** — `getCurrentActorRole()` stało WEWNĄTRZ wspólnego `try` obu akcji. Wyjątek przy odczycie roli wpadał do `catch` na końcu funkcji i zwracał komunikat błędu ZAPISU, nie odmowę uprawnień. Test tej ścieżki przechodził, bo asercja sprawdzała tylko `success: false` i brak wywołania Prismy — generyczny `catch` spełnia to trywialnie.
2. **Warstwa UI (kryterium 9)** — kontrolki edycji renderowane bezwarunkowo.

**Why:** zielony zestaw testów nie jest dowodem spełnienia kryterium. Asercja na KSZTAŁT odpowiedzi (`success: false`) przechodzi dla obu zachowań — poprawnego i wadliwego. Dopiero asercja na dokładną TREŚĆ komunikatu rozróżnia odmowę uprawnień od błędu zapisu. To ta sama klasa pomyłki co [[project_authz_gate_coverage_gap]]: bramka istnieje, ale nikt nie sprawdził, czy jest poprawna.

**How to apply:** czytając `acceptance` przed zmianą `status`, dla każdego kryterium wskaż KONKRETNĄ linię kodu i KONKRETNĄ asercję, która by oblała, gdyby kod był zły. Jeśli asercja przechodzi także dla wadliwej implementacji, kryterium nie jest pokryte, choćby test był zielony. Wzorzec poprawnego fail-closed jest w `leads/[id]/actions.ts` w `getLeadDetail`: osobny `try/catch` WYŁĄCZNIE wokół odczytu roli, przed głównym blokiem zapisu — kopiuj go, nie wymyślaj od nowa. Patrz też [[project_crews_admin_gates_closed]] (kryteria czytać literalnie, nie wg szablonu) i [[project_requirement_status_drift]].

Uwaga na przyszłość: `deleteLead` nie mieszka już w `leads/[id]/actions.ts`, a `DeleteLeadButton` w `leads/[id]/page.tsx` NIE ma bramki roli w UI — to otwarty dług po stronie `CRM-DELETE-ADMIN-ONLY` (kryterium 11 tego ID wyklucza delete wprost), nie regresja tego wymagania.
