---
name: rbac-blokuje-role-w-wymaganiach
description: Zdania wymagań typu "rola X robi Y" trzeba konfrontować z contracts/rbac.contract.mjs — bywają niewykonalne bez zmiany kontraktu
metadata:
  type: project
---

Zanim zaplanujesz ekran opisany zdaniem „<rola> robi <czynność>", sprawdź wiersz zasobu
w `contracts/rbac.contract.mjs`. Rejestr wymagań i dokumenty architektury bywają wcześniejsze
niż macierz uprawnień i opisują aktora, który tej zdolności nie ma.

Napotkany przypadek (2026-09-15, `FLD-QUOTE-BASKET-SELECT`): wymaganie mówi „audytor przy wycenie
wybiera koszyk", a `bookings.create` przysługuje wyłącznie `admin` i `dyspozytor`. Ekran byłby
niewykonalny bez okna kontraktowego.

**Why:** Prisma omija RLS, więc bramka `can()` w Server Action jest JEDYNĄ granicą — nie da się
tego obejść w UI. Rozbieżność wykryta dopiero przy implementacji oznacza przepisanie ekranu.

**How to apply:** w sekcji „Zmiana kontraktu" Work Ordera rozdziel wariant bez zmiany RBAC
(korekta brzmienia wymagania) od wariantu ze zmianą (okno + `contract-steward`) i zakończ turę
`WYMAGA DECYZJI`, zamiast wybierać samodzielnie. Patrz też [[docs-that-lie]].
