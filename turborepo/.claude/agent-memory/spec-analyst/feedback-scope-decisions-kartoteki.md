---
name: feedback-scope-decisions-kartoteki
description: Michal rozstrzyga otwarte decyzje WO hurtem i chętnie łączy tryby CRUD w jedną turę, gdy dzielą mapowanie danych; oczekuje, że stary tekst WO zostaje jako zapis historyczny
metadata:
  type: feedback
---

Kiedy użytkownik rozstrzyga decyzje z Work Ordera, rozszerzaj WO **w miejscu** dopisując datowaną sekcję i oznaczając stare akapity jako zdezaktualizowane — nie usuwaj i nie przepisuj oryginalnej treści.

**Why:** WO jest zapisem tego, co było wiadomo w danym momencie. Michal wprost prosił, żeby przy dopisywaniu edycji do `CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN` nie ruszać odłożonej Części B ani nie kasować „Poza zakresem" — skreślenie z datą niesie informację, której czysty diff nie niesie.

**How to apply:**
- Rozstrzygnięte `WYMAGA DECYZJI` oznaczaj jako `ROZSTRZYGNIĘTE <data> (użytkownik)` i zostawiaj oryginalny opis wariantów poniżej.
- Pozycje wycofane z „Poza zakresem" przekreślaj (`~~…~~`) z adnotacją, zamiast kasować.
- Michal łączy tryby CRUD (create + update) w jedną turę, jeśli dzielą mapowanie `FormData → Prisma`, schemat walidacji i modal — mimo [[feedback-workorder-sizing]]. Kryterium podziału to **wspólny artefakt**, nie liczba operacji. Jeśli zakres i tak grozi limitem 3 iteracji GREEN, podaj zalecaną kolejność wewnątrz tury i wskaż, co odciąć jako pierwsze — zamiast domagać się podziału WO.
- Michal weryfikuje hipotezy WO bezpośrednim zapytaniem do bazy (np. `total crews: 0` obaliło domniemany błąd E4). Gdy WO stawia diagnozę „funkcja nie działa", dopisz, jakim zapytaniem można ją sfalsyfikować.
