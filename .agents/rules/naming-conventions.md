# Konwencje Nazewnictwa (Naming Conventions)

## Pliki i Katalogi

| Element | Konwencja | Przykład |
|---|---|---|
| Komponenty React | `PascalCase.tsx` | `LeadDetailsCard.tsx` |
| Server Actions | `actions.ts` | `(dashboard)/leads/actions.ts` |
| Schematy Zod | `schemas.ts` | `(dashboard)/leads/schemas.ts` |
| Katalogi stron Next.js | `kebab-case` | `(dashboard)/lead-details/page.tsx` |
| Grupy routingu | `(nazwaGrupy)` | `(dashboard)`, `(auth)` |
| Pliki dokumentacji | `snake_case.md` | `b2b_funnel_process.md` |
| Pliki testowe | `*.spec.ts` lub `*.test.ts` | `leads.spec.ts` |

## Zmienne i Funkcje

| Element | Konwencja | Przykład |
|---|---|---|
| Zmienne i funkcje | `camelCase` | `fetchLeadById`, `isLoading` |
| Stałe (const enum-like) | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `STATUS_NOWY` |
| Komponenty React | `PascalCase` | `LeadCard`, `AuditorsTable` |
| Typy i Interfejsy | `PascalCase` + sufiks | `LeadCardProps`, `AuditorFormData` |
| Hooki React | `camelCase` z prefixem `use` | `useLeadFilter`, `useDebounce` |

## Baza Danych (Prisma)

| Element | Konwencja | Przykład |
|---|---|---|
| Nazwy tabel | `snake_case` + liczba mnoga | `indoor_units`, `crew_members` |
| Nazwy kolumn | `snake_case` | `created_at`, `klient_id` |
| Nazwy enum | `PascalCase` | `StatusLeada`, `RolaUzytkownika` |
