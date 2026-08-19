# KlikKlima — zasady pracy dla agentów

System HVAC end-to-end: pozyskanie leada (B2C Triage) → audyt i wycena (Field App) → logistyka i montaż (panel B2B) → serwis i usterki.
Monorepo Turborepo, Supabase PostgreSQL, Next.js, Prisma.

## Zasada zerowa

**Kontrakt jest źródłem prawdy. Dokumenty opisują intencję, kod realizuje kontrakt.**

Katalog `contracts/` zawiera maszynę stanów lejka, katalog powiadomień, progi SLA, macierz uprawnień i rejestr wymagań.
`packages/contracts/src/generated/` jest **generowany** — nie edytuj tych plików nigdy, w żadnych okolicznościach.

```bash
node tools/kk-validate.mjs      # spójność kontraktu
node tools/kk-selftest.mjs      # czy bramka w ogóle potrafi zablokować zmianę
node tools/kk-codegen.mjs       # kontrakt -> TypeScript + dokumentacja
node tools/kk-codegen.mjs --check   # wykrycie dryfu (bramka CI)
node tools/kk-trace.mjs         # pokrycie wymagań testami
bash scripts/verify.sh --full   # pełna bramka
```

## Zakazy, które nie podlegają negocjacji

Egzekwowane przez hooki (`exit 2`), nie przez dobrą wolę:

- Zmiana czegokolwiek w `contracts/`, `packages/contracts/src/generated/`, `schema.prisma`, `supabase/migrations/` bez otwartego okna kontraktowego i roli `contract-steward`.
- Edycja testów przez implementera. Jeżeli test jest błędny → zgłoś `TEST-DEFECT` i zakończ turę.
- Edycja kodu produkcyjnego przez `test-author`.
- `@ts-ignore`, `as any`, `it.skip`, `test.only`.
- Hardkodowane kolory hex w komponentach, ikony spoza `lucide-react`, zielone alerty SLA.
- Klucz `service_role` w kodzie klienckim.
- `prisma migrate reset`, `git push --force`, praca bezpośrednio na `main`.

## Stos technologiczny (ADR-001 — ROZSTRZYGNIĘTE 2026-08-18)

Dokumenty źródłowe były w tym punkcie sprzeczne. Michal rozstrzygnął, dokumenty poprawiono, decyzja jest egzekwowana przez `guard-forbidden`:

| Warstwa | Decyzja | Odrzucone |
|---|---|---|
| Panel B2B | Next.js App Router + Server Actions | Vite SPA, tRPC |
| ORM | Prisma (serwerowo, omija RLS) | Drizzle |
| B2C | Next.js + `supabase-js` (RLS aktywne) | — |
| Mutacje | Server Actions + walidacja Zod | Route Handlery (wyjątek: publiczne webhooki) |
| Pobieranie danych | Server Components | `useEffect`, SWR |
| Stan formularzy | `react-hook-form` + `zodResolver` | `useState` na pojedyncze pola |

## Nazewnictwo (ADR-002 — ROZSTRZYGNIĘTE 2026-08-18)

Identyfikatory techniczne **po angielsku, `snake_case`**. Polski wyłącznie w treściach dla użytkownika, komentarzach i dokumentacji.

| Warstwa | Konwencja | Przykład |
|---|---|---|
| Tabela | `snake_case`, l. mnoga | `installation_photos` |
| Kolumna | `snake_case` | `booking_date` |
| Klucz obcy | `<encja>_id` | `client_id`, `crew_id` |
| Model Prisma | `PascalCase` + `@@map("snake_case")` | `model Crew { … @@map("crews") }` |
| Pole Prisma | `camelCase` + `@map("snake_case")` | `bookingDate DateTime @map("booking_date")` |
| Enum | `SCREAMING_SNAKE_CASE`, po angielsku | `AWAITING_PARTS` |
| Czas | `_at` = moment, `_date` = data | `completed_at`, `next_service_date` |
| Flaga | `is_` / `has_` | `is_active` |

Nazwy tabel objętych uprawnieniami są tożsame z `RESOURCES` w `contracts/rbac.contract.mjs`.
Wyjątek świadomy: **role zostają po polsku** (`admin`, `dyspozytor`, `audytor`, `monter`) — to wartości danych w `authorized_users`, nie identyfikatory schematu.

Zanim nazwiesz cokolwiek nowego albo zobaczysz polską nazwę w starszym dokumencie, sprawdź słownik: `docs/architecture/NAMING.md`.
Hook `guard-forbidden` blokuje zapis pliku zawierającego którąkolwiek z porzuconych nazw (`leady`, `klienci`, `zespoly_monterskie`, `price_netto`, …), a `node tools/kk-naming.mjs` skanuje całe repozytorium.

Pełne uzasadnienie i pozostałe sprzeczności: `docs/01-ADR-spec-conflicts.md`.

## Ważne pułapki tego systemu

1. **Prisma omija RLS.** Panel B2B nie jest chroniony przez bazę. Autoryzacja musi być jawna w każdej Server Action. Brak sprawdzenia roli to podatność, nie niedopatrzenie.
2. **Zmiana statusu i kolejka powiadomień to jedna transakcja.** Rozjazd oznacza SMS do klienta o zdarzeniu, które nie zaszło.
3. **Cron i webhooki muszą być idempotentne.** Klient nie może dostać drugiego SMS-a, bo job uruchomił się dwa razy.
4. **Rezerwacja slotu to problem współbieżności.** Sprawdzenie w JS nie wystarcza — potrzebna blokada w bazie.
5. **Wszystkie progi czasowe (14 dni, 48 h, 3/7 dni, 30 dni, cap 5) pochodzą z kontraktu SLA.** Literał w kodzie to przyszła rozbieżność między modułami.

## Podział ról

| Agent | Pisze | Nie dotyka |
|---|---|---|
| `spec-analyst` | Work Ordery | kodu, testów |
| `contract-steward` | kontrakty, schemat, migracje | logiki biznesowej |
| `test-author` | testy | kodu produkcyjnego |
| `implementer-server` | logika serwerowa | testów, kontraktów |
| `implementer-ui` | komponenty | testów, kontraktów |
| `notification-architect` | powiadomienia, kolejka | kontraktów |
| `reviewer` | — (tylko odczyt) | wszystkiego |
| `rls-security-auditor` | — (tylko odczyt) | wszystkiego |
| `e2e-runner` | — (tylko uruchamianie) | wszystkiego |
| `doc-scribe` | dokumentacja opisowa | plików generowanych |

## Pętla pracy

`/kk-plan` → (akceptacja człowieka) → `/kk-loop` → `/kk-verify` → `/kk-review` → commit i PR po zgodzie człowieka.

Limit iteracji GREEN: **3**. Po trzeciej nieudanej — zatrzymanie i diagnoza dla człowieka. Czwarta próba na oślep jest droższa niż jedno pytanie.

## Język

Dokumentacja, Work Ordery, komunikaty w interfejsie i komentarze domenowe: **po polsku**.
Identyfikatory w kodzie i nazwy tabel: **po angielsku, snake_case** (ADR-002).
