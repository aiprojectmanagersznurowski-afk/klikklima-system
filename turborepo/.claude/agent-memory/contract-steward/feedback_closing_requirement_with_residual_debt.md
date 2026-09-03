---
name: closing-requirement-with-residual-debt
description: Jak domykać wymaganie do DONE, gdy zostaje kryterium NIEPOKRYTE — wydzielić do osobnego ID, nigdy nie skasować ani nie przemilczeć
metadata:
  type: feedback
---

Gdy wymaganie ma iść na `DONE`, a któreś kryterium akceptacji jest nadal `NIEPOKRYTE`, są dokładnie
trzy dopuszczalne ruchy — i jeden zakazany:

1. Kryterium jest realnie niepokryte i należy do `statement` → **zostaw `IMPLEMENTING`** i napisz dlaczego.
2. Kryterium jest pokryte → przepisz je na `POKRYTE <data>` z dowodem, nie kasuj. Zapis, jak coś
   zostało udowodnione, jest wart tyle co samo kryterium.
3. Kryterium nigdy nie należało do `statement` (inna warstwa, inne ryzyko) → **wynieś do osobnego ID**
   ze statusem `TODO`, a w starym wpisie zostaw kryterium „Poza zakresem tego ID, wyniesione do X"
   z jawnym uzasadnieniem, DLACZEGO to nie blokuje `DONE`.
4. ZAKAZANE: usunąć kryterium `NIEPOKRYTE` i podnieść status. To kasuje dług bez śladu.

Test rozstrzygający dla wyboru 1 vs 3: czy niepokryty element może doprowadzić do naruszenia
`statement`? Przykład (SEC-EMAIL-UNIQUE, 2026-09-03): brak `.toLowerCase()` na e-mailu nie blokował
`DONE`, bo dopasowanie tożsamości jest dokładne co do wielkości liter i fail-closed — rozjazd
wielkości liter daje ODMOWĘ (pracownik traci dostęp do swoich danych), a nigdy trafienie w cudzy
wiersz. Skutkiem jest uciążliwość i dług jakości danych, nie luka w tym wymaganiu → wyniesione
do `SEC-EMAIL-CASE-NORMALIZE`.

**Why:** rejestr wymagań jest jedynym miejscem, gdzie dług jest widoczny po zamknięciu wymagania.
`DONE` przy kryterium `NIEPOKRYTE` w liście to sprzeczność wprost w kontrakcie, ale „posprzątanie"
listy przez skasowanie punktu jest gorsze — po cichu zamienia znany dług w nieznany.

**How to apply:** przy każdej zmianie statusu na `DONE` przejdź kryteria po kolei i przypisz każdemu
jeden z ruchów 1-3. Wcześniej zweryfikuj stan faktyczny w kodzie/bazie (grep, zapytanie), nie ufaj
temu, co kryterium mówiło w poprzedniej turze. Nowe ID zakładaj ze statusem `TODO` — `IMPLEMENTING`
bez testu wywala `kk-trace --enforce`.

Powiązane: [[requirement-id-granularity]], [[requirement-status-drift]], [[blocked-status-semantics]].
