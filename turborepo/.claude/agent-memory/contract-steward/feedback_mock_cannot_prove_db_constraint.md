---
name: mock-cannot-prove-db-constraint
description: Kryterium, którego podmiotem jest ograniczenie w bazie, nie da się zaliczyć testem z atrapą Prismy — sprawdzaj podmiot zdania przed zmianą statusu na DONE
metadata:
  type: feedback
---

Przy domykaniu wymagania czytam KAŻDE kryterium pod kątem tego, co jest jego podmiotem. Jeżeli podmiotem jest obiekt bazy („ograniczenie zabrania…", „indeks jest częściowy", „wyzwalacz odrzuca"), to test na atrapie Prismy go nie zalicza — atrapa przejdzie tak samo przy `EXCLUDE`, przy `UNIQUE` i przy braku ograniczenia w ogóle. Jeżeli podmiotem jest kod („akcja zwraca błąd domenowy", „bramka odmawia"), atrapa wystarczy i żądanie żywej bazy byłoby przesadą.

**Why:** kryteria w tym rejestrze są pisane kontrastowo — same mówią, czego słabsza konstrukcja by nie złapała (np. „zwykły UNIQUE na godzinie startu przepuściłby montaż całodniowy od 08:00 i audyt od 10:00"). Test, który przechodzi w obu wariantach, nie rozstrzyga dokładnie tego, o co kryterium pyta. Zielony `kk-trace` tego nie wyłapie, bo liczy tagi `@REQ` na plikach, nie treść asercji ([[project_requirement_status_drift]]).

**How to apply:** przy każdym zleceniu „zmień status na DONE" rozpisz kryteria 1:1 na nazwy testów i oznacz, który dowód jest z żywego Postgresa, a który z atrapy. Sprawdź też, czy obiekt bazy ma w ogóle innego właściciela w rejestrze — nazwa okna kontraktowego nie jest ID wymagania, więc luka bywa niczyja. Przykład zastosowania: [[project_fld_booking_atomic_assign_blocked]].
