---
name: orphaned-debt-needs-new-id
description: Dług spoza kryteriów zamykanego ID sprawdź u właściciela — jeśli właściciel jest DONE, dług jest SIEROTĄ i wymaga nowego ID
metadata:
  type: feedback
---

Zanim odłożę punkt otwarty jako „poza zakresem, do noty", sprawdzam STATUS wymagania,
które miałoby go przejąć. Jeżeli ten właściciel jest już `DONE`, dług nie ma gdzie zamieszkać —
wtedy zakładam nowe ID w rejestrze, a nie sam wpis w `note`.

**Why:** 2026-09-16 przy zamykaniu `FNL-2PHASE-BOOKING` dwa punkty otwarte wyglądały identycznie
(„brzeg z WO, nie kryterium, więc do noty"), ale miały różny los. Zmiana `installation_type` po
zamknięciu etapu I trafiła pod `FNL-2PHASE` kryt. 2 — bezpiecznie, bo tamto zostaje TODO.
Rollback niezwalniający rezerwacji etapu II miał trafić pod `FNL-ROLLBACK` — a to jest DONE
od 2026-09-08. Zapis w nocie ZAMKNIĘTEGO wymagania nikogo już nie zatrzyma; nikt nie czyta not
przy DONE planując pracę. Stąd `FNL-2PHASE-ROLLBACK-RELEASE`.

**How to apply:** przy każdym domknięciu, dla każdego punktu otwartego zgłoszonego przez
`test-author`/`implementer-*`, zadaj dwa pytania w tej kolejności: (1) czy to odpowiada
DOSŁOWNIE któremuś z kryteriów zamykanego ID — jeśli tak, blokuje DONE; (2) jeśli nie, KTO jest
właścicielem i czy ten właściciel jest jeszcze OTWARTY. Dopiero negatywna odpowiedź na (2)
uzasadnia nowe ID. Nowe ID zakładaj wąskie i z `note` opisującą stan ZMIERZONY (nazwa funkcji,
plik, brak testu), nie postulowany.

Powiązane: [[feedback_closing_requirement_with_residual_debt]] (ten sam odruch dla kryterium
NIEPOKRYTEGO wewnątrz zamykanego ID), [[feedback_scope_mismatch_check_other_owner]],
[[project_fnl_2phase_booking_done]].
