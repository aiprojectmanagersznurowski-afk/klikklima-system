# KlikKlima — zasady dla agentów spoza Claude Code

Ten plik czytają agenci Gemini. Zawiera te same reguły, które u agentów Claude Code wymuszają hooki
(`.claude/hooks/*`). **Ty tych hooków nie masz, więc odpowiadasz za nie sam.** Złamanie którejkolwiek
zasady z sekcji „Zakazy" zostanie wykryte w bramce CI albo w recenzji i PR wróci do poprawy.

Pełny opis systemu: [`.claude/CLAUDE.md`](.claude/CLAUDE.md). Plan prac:
[`docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md`](docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md).
Podział na gałęzie: [`docs/workorders/PLAN-ROWNOLEGLY-BRANCHE.md`](docs/workorders/PLAN-ROWNOLEGLY-BRANCHE.md).

## Zasada zerowa

**Kontrakt jest źródłem prawdy. Dokumenty opisują intencję, kod realizuje kontrakt.**

Katalog `contracts/` zawiera maszynę stanów lejka, katalog powiadomień, progi SLA, macierz uprawnień
i rejestr wymagań. Katalog `packages/contracts/src/generated/` jest **generowany**.

## Zakazy

1. **Nie zmieniaj `contracts/`, `packages/contracts/src/generated/`, `packages/database/prisma/schema.prisma`
   ani `supabase/migrations/`.** Jeżeli Twoje zadanie tego wymaga — zatrzymaj się i napisz, czego
   potrzebujesz. Zmiany kontraktu idą przez okno kontraktowe i jedną wspólną gałąź, nigdy przez gałąź
   funkcjonalną.
2. **Nie edytuj testów, żeby przeszły.** Jeśli test jest błędny, zgłoś to jako `TEST-DEFECT` i zakończ
   pracę nad tym wątkiem.
3. **Zakazane w kodzie:** `@ts-ignore`, `as any`, `it.skip`, `test.only`, hardkodowane kolory hex
   w komponentach, ikony spoza `lucide-react`, zielone alerty SLA, klucz `service_role` w kodzie klienckim.
4. **Zakazane polecenia:** `prisma migrate reset`, `git push --force`, jakikolwiek commit na `main`.
5. **Nie używaj literałów dla progów czasowych** (14 dni, 48 h, 3/7 dni, 30 dni, cap 5). Wszystkie
   pochodzą z kontraktu SLA.

## Zanim otworzysz PR

```bash
bash scripts/verify.sh --full     # pełna bramka: kontrakt, kodegen, nazewnictwo, testy
```

Pojedyncze bramki, jeśli chcesz szybciej:

```bash
node tools/kk-validate.mjs        # spójność kontraktu
node tools/kk-codegen.mjs --check # czy kod nie rozjechał się z kontraktem
node tools/kk-naming.mjs          # nazewnictwo wg ADR-002
node tools/kk-trace.mjs           # pokrycie wymagań testami
```

## Stos technologiczny (ADR-001, rozstrzygnięte)

| Warstwa | Decyzja | Odrzucone |
|---|---|---|
| Panel B2B | Next.js App Router + Server Actions | Vite SPA, tRPC |
| ORM | Prisma (serwerowo, omija RLS) | Drizzle |
| B2C | Next.js + `supabase-js` (RLS aktywne) | — |
| Mutacje | Server Actions + walidacja Zod | Route Handlery (wyjątki: publiczne webhooki oraz aplikacja terenowa wg ADR-013) |
| Pobieranie danych | Server Components | `useEffect`, SWR |
| Stan formularzy | `react-hook-form` + `zodResolver` | `useState` na pojedyncze pola |
| Aplikacja terenowa | React Native + Expo (`apps/field-app`) | PWA |

## Nazewnictwo (ADR-002)

Identyfikatory techniczne **po angielsku, `snake_case`**. Polski wyłącznie w treściach dla użytkownika,
komentarzach i dokumentacji.

- tabela: `snake_case`, liczba mnoga (`installation_photos`)
- kolumna: `snake_case` (`booking_date`), klucz obcy: `<encja>_id`
- model Prisma: `PascalCase` + `@@map("snake_case")`, pole: `camelCase` + `@map("snake_case")`
- enum: `SCREAMING_SNAKE_CASE`, czas: `_at` = moment, `_date` = data, flaga: `is_` / `has_`
- **role zostają po polsku** (`admin`, `dyspozytor`, `audytor`, `monter`) — to wartości danych

Słownik i nazwy porzucone: [`docs/architecture/NAMING.md`](docs/architecture/NAMING.md).

## Pułapki, na których łatwo się przewrócić

1. **Prisma omija RLS.** Panel B2B nie jest chroniony przez bazę. Autoryzacja musi być jawna w każdej
   Server Action i w każdym Route Handlerze. Brak sprawdzenia roli to podatność, nie niedopatrzenie.
2. **Zmiana statusu i kolejka powiadomień to jedna transakcja.** Rozjazd oznacza SMS do klienta
   o zdarzeniu, które nie zaszło.
3. **Cron i webhooki muszą być idempotentne.** Klient nie może dostać drugiego SMS-a ani drugiej faktury,
   bo zadanie uruchomiło się dwa razy.
4. **Rezerwacja slotu to problem współbieżności.** Sprawdzenie w JavaScripcie nie wystarcza — potrzebna
   blokada w bazie.

## Jak pracujesz

- Jedna gałąź = jeden Work Order. Nazwa gałęzi i zakres plików: patrz plan podziału na gałęzie.
- **Najpierw commit z testami (czerwone), potem commit z implementacją (zielone).** Jeden commit
  ze wszystkim uniemożliwia sprawdzenie, czy test kiedykolwiek był czerwony.
- Rebase na `main` codziennie.
- Po trzech nieudanych podejściach do zieleni zatrzymaj się i napisz diagnozę zamiast próbować dalej.
- Nie wychodź poza katalogi przypisane Twojej gałęzi. Jeśli musisz — napisz, zamiast brać.

## Język

Dokumentacja, Work Ordery, komunikaty w interfejsie i komentarze domenowe: **po polsku**.
Identyfikatory w kodzie i nazwy tabel: **po angielsku, snake_case**.
