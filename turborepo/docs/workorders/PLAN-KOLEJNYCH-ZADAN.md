# Plan kolejnych zadań — stan na 2026-09-02

Zestawienie po zamknięciu batcha MEDIUM/LOW, trzech dużych WO (punkty 4/16/21) i audytu wydajności.

---

## 🔴 P0 — SEC-READ-GATES: odczyty bez bramki autoryzacji

**Znalezione podczas planowania, nie było na żadnej wcześniejszej liście.**

Sześć funkcji odczytowych nie sprawdza roli. Sześć odpowiadających im stron też nie. Middleware weryfikuje wyłącznie **obecność** e-maila w `AuthorizedUser`, nigdy rolę.

| Funkcja | Plik | Macierz RBAC mówi | Stan faktyczny |
|---|---|---|---|
| `getCustomers` | `customers/actions.ts` | `admin`, `dyspozytor` | **każdy zalogowany** |
| `getCrews` | `crews/actions.ts` | `admin`, `dyspozytor` | każdy zalogowany |
| `getCrews` | `leads/actions.ts` | `admin`, `dyspozytor` | każdy zalogowany |
| `getAuditors` | `auditors/actions.ts` | `admin`, `dyspozytor` | każdy zalogowany |
| `getInstallations` | `installations/actions.ts` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |
| `getUpcomingServices` | `services/actions.ts` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |
| `getIncidents` | `incidents/actions.ts` | `admin`, `dyspozytor`, `monter:own` | każdy widzi wszystkie |

Najcięższy przypadek: `/customers` wystawia **dane osobowe** (imię, e-mail, telefon) rolom, które kontraktowo nie mają do nich prawa. Przy operacji, która właśnie dostała pełną ścieżkę anonimizacji RODO, jest to sprzeczność sama w sobie.

`getAuditors` w `leads/actions.ts` i `getLeadDetail`, `getLogisticsLeads`, `getLeads`, `getAuditorForEdit`, `getCrewForEdit` bramki **mają** — czyli wzorzec w repo istnieje i jest sprawdzony, brakuje go tylko w tych siedmiu miejscach.

**Dlaczego przetrwało:** `kk-authz-gate` z założenia skanuje wyłącznie funkcje mutujące (`prisma.*.create/update/delete`). `SEC-RLS-AUDITOR-SCOPE` objęło jeden odczyt (`getLeads`). Odczyty jako klasa nie zostały nigdy przejrzane.

**Zakres:**
1. Bramka `can(role, <zasób>, 'read')` w siedmiu funkcjach, przed pierwszym zapytaniem Prisma.
2. Wariant `:own` dla `monter` w `installations`/`services`/`incidents` — zawężenie `where`, nie odmowa (wzorzec: `scopeWhere` w `getLeads`).
3. **Rozszerzenie `kk-authz-gate.mjs` o funkcje odczytowe** — inaczej ta klasa wróci przy następnym nowym widoku. To jest właściwa naprawa systemowa; punkty 1–2 to naprawa objawów.
4. Bramka na poziomie strony (`notFound()` dla roli bez `read`) — dziś strona renderuje się i dopiero akcja zwraca pustkę.

Role: `test-author` → `implementer-server` → `contract-steward` (narzędzie). Wymaga okna kontraktowego dla punktu 3.

---

## 🟠 P1 — LOGISTICS-SHIPPING-EFFECTS, fazy B i C

Faza A zamknięta (`releaseCrewSlot`, `suspendLogisticsSla`, atomowy rollback z blokadą `FOR UPDATE`). Zostało to, co WO opisuje jako największy kawałek:

- **Faza B:** tabela `notification_queue` (nie istnieje — potwierdzone: 4 trafienia w całym repo, wszystkie w kontraktach), model Prisma, migracja, rejestracja wymagania `NTF-QUEUE-TABLE`, helper `enqueueNotification(tx, …)` z `idempotency_key`.
- **Faza C:** wpięcie w `shipLogisticsOrder` (`N5`, wymóg `tracking_id`), `bypassLogisticsOrder` (zero wpisów — AC negatywne), `rollbackLogisticsOrder` (`N_ROLLBACK` + `I4`).

Znane pułapki z WO: `bind.transition: 'T10|T11|T12|T13'` to string z pipe'ami bez parsera w repo; brak nadawcy SMS/e-mail w monorepo (kolejka to maksimum, jakie da się dowieźć i przetestować).

Wymaga okna kontraktowego (nowa tabela + wymaganie). Rola `notification-architect`.

---

## 🟡 P2 — dług narzędziowy i identyfikowalność

| # | Zadanie | Dlaczego to boli |
|---|---|---|
| 1 | `apps/b2b-web` nie ma skryptu `check-types`, więc `verify.sh` **pomija typy** (`turbo run check-types`) | Błędy `tsc` nigdy nie zapalą bramki. W tej sesji dwa razy weszły niezauważone |
| 2 | Brak `@REQ` na testach RODO | `SEC-RODO-DELETE`, `SEC-AUDIT-LOG`, `CRM-DELETE-ADMIN-ONLY-CLIENTS` figurują w `kk-trace` jako HIGH RISK **bez testu**, choć kod i testy istnieją |
| 3 | `format-date.test.ts` — 5,41 s przy limicie 5000 ms | To nie flake losowy, tylko test na granicy. Będzie zapalał bramkę losowo, aż ktoś podniesie limit albo przyspieszy test |
| 4 | Nagłówek `20260902170500_perf_foreign_key_indexes.sql` mówi „NIE URUCHOMIONA" | Migracja **została** uruchomiona (11/11 indeksów potwierdzonych). Odwrotność incydentu 1/4 — nieaktualny komentarz wprowadzi w błąd następną osobę |
| 5 | `markAsDelivered` sprawdza tylko `leads.update`, bez `shipments.update` | Niespójne z trzema sąsiednimi akcjami, naprawionymi w punkcie 17 |
| 6 | `b2b_crm_specifications.md:32` — „twarde usunięcie / usunięcie zgodne z RODO" | Dokument przeczy sam sobie i kontraktowi. Następny agent trafi na tę samą sprzeczność. Rola `doc-scribe` |

---

## 🔵 P3 — czeka na decyzję poza kodem

| Temat | Kto rozstrzyga |
|---|---|
| Czy anonimizacja spełnia żądanie usunięcia z art. 17 RODO w tej jurysdykcji | dział prawny — **blokuje produkcyjne użycie tej ścieżki** |
| Czy `leady.odpowiedzi_triage` zawiera PII wpisane w polach opisowych | ktoś musi obejrzeć zawartość tego JSON-a na produkcji; jeśli tak, anonimizacja jest niekompletna |
| Dryf `schema.prisma` vs żywa baza (zniknięty unique index na `email` w `audytorzy`/`zespoly_monterskie`) | wymaga decyzji: przywrócić czy zaktualizować schemat |
| E2E Playwright czerwone | przedistniejące, nierozpoznane |

---

## ⚪ Świadomie odłożone

- **`force-dynamic` → cache.** Standardowy cache Next.js współdzieli wynik między użytkownikami, a panel pokazuje dane per rola. Bezpieczny wariant (`use cache: private`) jest `experimental` i wymaga flagi `cacheComponents` zmieniającej semantykę w całej aplikacji. Zysk po naprawach P0/P1 audytu spadł do ~0,3 s. Wrócić, gdy flaga przestanie być eksperymentalna albo gdy pomiar na realnych danych pokaże, że to wąskie gardło.
- **Numerowane przyciski stron** w paginacji klientów (dziś Prev/Next + „Strona X z Y").
- **Indeksy** — zrobione i zweryfikowane, ale przypomnienie: przy 0 wierszach nie dają nic. Wartość pojawi się dopiero z danymi.

---

## Rekomendowana kolejność

1. **P0 SEC-READ-GATES** — jedyna pozycja z realną ekspozycją danych osobowych. Konta testowe (`dyspozytor`/`audytor`/`monter`) już istnieją, więc da się to zweryfikować end-to-end, a nie tylko testem jednostkowym.
2. **P2.1 (`check-types` w bramce)** — tanie, a zapobiega klasie błędów, która w tej sesji przeszła dwa razy.
3. **P2.4 (nagłówek migracji)** — dwie minuty, a chroni przed powtórką incydentu 1/4 w drugą stronę.
4. **P1 Fazy B/C logistyki** — największy kawałek, ale bez ekspozycji; może poczekać na osobną, wypoczętą turę.
5. Reszta P2, potem P3 po odpowiedziach z zewnątrz.
