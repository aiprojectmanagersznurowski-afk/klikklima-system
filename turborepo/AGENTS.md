# KlikKlima — instrukcje dla agentów

Ten plik jest wspólną podstawą dla wszystkich narzędzi agentowych (Antigravity, Claude Code, Cursor, Copilot). Szczegóły per narzędzie: `.agents/rules/` i `.claude/CLAUDE.md`.

## Reguła nadrzędna

**Kontrakt w `contracts/*.contract.mjs` jest jedynym źródłem prawdy.** Maszyna stanów lejka, katalog powiadomień, progi SLA, macierz uprawnień i rejestr wymagań mieszkają tam i nigdzie indziej. Kod importuje je z `@klikklima/contracts`, a nie przepisuje.

Nie edytuj `contracts/` ani `packages/contracts/src/generated/` bez otwartego okna kontraktowego:

```bash
node tools/kk-contract-window.mjs open <TICKET>
```

Pliki w `packages/contracts/src/generated/` są generowane. Ręczna edycja jest wykrywana przez `node tools/kk-codegen.mjs --check` i zatrzymuje bramkę.

## Stos (ADR-001)

Next.js App Router + Server Components, mutacje wyłącznie przez Server Actions, Prisma jako jedyny ORM, Tailwind v4 + shadcn/ui, ikony wyłącznie `lucide-react`.

Odrzucone i blokowane przez hooki: tRPC, React Query, Drizzle, Vite, Route Handlery dla logiki wewnętrznej (wyjątek: `app/api/webhooks/`).

## Nazewnictwo (ADR-002)

Identyfikatory techniczne po angielsku, `snake_case`. Modele Prisma `PascalCase` z `@@map`. Polski zostaje w treściach dla użytkownika i w dokumentacji. Słownik porzuconych nazw: `docs/architecture/NAMING.md`.

## Zakazane w kodzie aplikacji

- progi SLA jako literały — importuj nazwaną politykę z `@klikklima/contracts/sla`
- ID powiadomień jako gołe stringi — importuj z `@klikklima/contracts/notifications`
- `@ts-ignore`, `as any`, `it.skip`, `it.only`
- kolory hex i klasy `green`/`emerald` w kontekście SLA
- zapis do `next_service_date` (pole pochodne) i mutacje `audit_log` (append-only)

Wszystkie te reguły są egzekwowane przez hooki i bramkę commitową, nie przez dobre chęci.

## Pętla pracy

```
PLAN → CONTRACT (jeśli trzeba) → RED → GREEN → VERIFY → REVIEW → INTEGRATE
```

Fazy RED i GREEN mają twardą granicę: w RED powstaje wyłącznie test, w GREEN wyłącznie implementacja. Sprawdzenie:

```bash
node tools/kk-phase.mjs red     # albo green, albo contract
```

## Zanim zamkniesz zadanie

```bash
bash scripts/verify.sh --full
```

Bramka pominięta nie liczy się jako zaliczona. Jeżeli etap jest oznaczony jako POMINIĘTY, brakuje dowodu — a nie masz sukcesu.

## Czego nie robisz sam

Commit, PR, merge, wdrożenie i otwarcie okna kontraktowego należą do człowieka. Przygotuj zmianę i opisz ją; decyzję podejmuje Michal.
