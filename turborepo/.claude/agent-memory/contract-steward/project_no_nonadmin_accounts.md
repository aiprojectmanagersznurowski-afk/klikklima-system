---
name: no-nonadmin-accounts
description: Potwierdzone 2026-08-26 przez człowieka — w produkcyjnej authorized_users są wyłącznie konta admin; luki RBAC dla audytor/monter są prewencyjne, nie aktywne
metadata:
  type: project
---

W produkcyjnej tabeli `authorized_users` NIE ma dziś ani jednego konta o roli innej niż `admin` — żadnego `audytor`, żadnego `monter`. Potwierdzone przez Michala 2026-08-26 (decyzja D6 przy `SEC-RLS-AUDITOR-SCOPE`).

**Why:** Odpowiedź na to pytanie rozstrzyga, czy brak bramek `read`/zakresu `:own` w panelu B2B to aktywny incydent bezpieczeństwa, czy dług prewencyjny. Jest prewencyjny — nie ma kim tej luki eksploatować. Ryzyko zostaje jednak `HIGH`, bo aktywacja nie wymaga żadnej zmiany w kodzie: wystarczy jeden wiersz w `authorized_users`. Kod jest już na te konta przygotowany (gałąź roli `audytor` w `middleware.ts`), a Field App — docelowe miejsce pracy audytora i montera — nie istnieje w tym repozytorium, więc pierwsze takie konto dostanie panel B2B jako jedyną aplikację i po zalogowaniu trafi prosto na `/leads`.

**How to apply:** Przy ocenie ryzyka wymagań dotyczących ról `audytor`/`monter` — kolejkuj normalnie, nie eskaluj jako pożar, ale nie obniżaj `risk` argumentem „i tak nie ma takich kont". Zweryfikuj ten stan przy bazie, zanim się na niego powołasz: to zdjęcie z 2026-08-26, a `addAuthorizedUser` przyjmuje dowolną rolę z `ROLES`. Powiązane: [[authz-gate-coverage-gap]], [[requirement-status-drift]].
