# ADR-001 — wykaz zmian w dokumentach

Decyzja: **Next.js App Router + Server Actions + Prisma**. Odrzucone: tRPC, React Query, Drizzle, Vite.
Data: 2026-08-18. Zmienione pliki: trzy. Zmian: sześć.

Pliki w tym katalogu są **poprawionymi wersjami** Twoich oryginałów i mają je zastąpić w `docs/architecture/`.
`engineering_standards.md` i pozostałe siedem dokumentów pozostają bez zmian — nie były sprzeczne z decyzją.

---

## b2b_app_requirements.md

**Wiersz 4 — rama architektoniczna**
- było: `panelu administracyjnego B2B (Web SPA)`
- jest: `panelu administracyjnego B2B (aplikacja webowa Next.js App Router)`
- powód: „SPA" niosło ze sobą Vite i warstwę API. App Router renderuje na serwerze — to nie jest SPA.

**Wiersz 5 — stos technologiczny**
- było: `React/Next.js (SPA/SSR) … tRPC/React Query (komunikacja), Prisma/Drizzle (ORM)`
- jest: Next.js App Router + RSC, Server Actions jako jedyna warstwa mutacji, Prisma jako jedyny ORM
- dopisano cytat rozstrzygnięcia z listą odrzuconych wariantów, żeby agent czytający sam ten plik wiedział, że alternatywy były rozważone i odrzucone, a nie pominięte

**Wiersz 154 — Optimistic UI**
- było: `Optimistic UI za pomocą React Query / Server Actions`
- jest: Server Action wywołana z `useOptimistic` (React 19)
- dopisano zdanie o obsłudze odrzucenia przez guarda maszyny stanów: optymistyczny stan nie może zostać stanem końcowym. Bez tego zdania optimistic UI po odrzuconym przejściu pokazuje klientowi status, którego nie ma w bazie.

## system_architecture.md

**Wiersz 25 — etykieta w diagramie Mermaid**
- było: `💻 3. Panel Administracyjny B2B (Web SPA)`
- jest: `💻 3. Panel Administracyjny B2B (Next.js App Router)`

**Wiersz 134 — wiersz tabeli stosu**
- było: `Vite + React (lub Next.js)`, uzasadnienie przez szybkość i brak SEO
- jest: `Next.js (App Router)`, uzasadnienie przez to, że panel nie potrzebuje SEO, ale potrzebuje dostępu do danych bez wystawiania zapytań do przeglądarki
- **zmieniona także kolumna „Baza danych, Autoryzacja i Backend"**: było `Łączy się bezpośrednio z Supabase`, jest `Prisma na serwerze (Server Actions, z pominięciem RLS); supabase-js wyłącznie do sesji i Auth`.
  Powód: ta komórka była sprzeczna z wierszem 1 tej samej tabeli, który opisuje Model Hybrydowy i wprost mówi, że Panel B2B Admin używa Prismy omijając RLS. To była sprzeczność wewnątrz jednego dokumentu, na jednym ekranie. Poprawiona przy okazji, bo dotyczyła dokładnie tej samej decyzji.

## ui_ux_guidelines.md

**Wiersz 8 — framework**
- było: `Next.js (App Router, Server Actions / React Query dla Optimistic UI)`
- jest: `Next.js (App Router; mutacje wyłącznie przez Server Actions, Optimistic UI przez useOptimistic z React 19 — bez React Query i bez tRPC, zgodnie z ADR-001)`
- ukośnik między „Server Actions" a „React Query" czytał się jak swobodny wybór. Był źródłem połowy tej sprzeczności.

---

## Czego celowo nie zmieniłem

`engineering_standards.md` §3 dopuszcza React Query „dla złożonego pollingu po stronie klienta". Zostawiłem to zdanie: jest to realny wyjątek, którego może kiedyś potrzebować podgląd statusu dostawy na żywo. Ale to jedyna furtka w całej dokumentacji i nie działa sama z siebie — hook `guard-forbidden` zablokuje taki import, a jego odblokowanie wymaga jawnej zmiany w `tools/kk.config.mjs`. Czyli: wyjątek istnieje, ale przechodzi przez Ciebie, nie przez agenta.

## Egzekwowanie

Cztery reguły w `tools/kk.config.mjs` blokują zapis pliku, który:

| reguła | co blokuje |
|---|---|
| `adr001-trpc` | import z `@trpc/*` |
| `adr001-react-query` | import z `@tanstack/react-query` |
| `adr001-drizzle` | import z `drizzle-orm` |
| `adr001-api-route` | handler `GET/POST/…` w `apps/*/app/api/**/route.ts`, poza `app/api/webhooks/` |

Przetestowane w obie strony: cztery blokady zapalają się, a Server Action, import Prismy i webhook P24 przechodzą.
