---
name: feedback-mutation-testing-in-memory
description: Jak robić testy mutacyjne Server Action BEZ zapisu do repo — przepis (typescript transpileModule + new Function) oraz listy mutantów dla bramki roli i dla minimalizacji danych (select/kształt)
metadata:
  type: feedback
---

Testy mutacyjne bramki autoryzacyjnej wykonuj **w pamięci**, nigdy przez podmianę pliku
produkcyjnego (nawet „z przywróceniem z kopii"). Patrz [[feedback-audit-execution-constraints]].

**Why:** wynik jest identyczny, a drzewo robocze użytkownika zostaje nietknięte. Mutacja pliku
w repo to zapis poza zakresem roli, a przy przerwanym przebiegu zostawia podatny kod na dysku.
Zweryfikowane 2026-08-25 na SEC-AUTHZ-USER-MGMT: 11 mutantów, wynik zgodny z `npx vitest run`
(baseline 0/17 padających = 17/17 zielonych w vitest).

**How to apply — przepis (`tsx` NIE jest zainstalowany lokalnie, `typescript` TAK):**
`node --input-type=module --eval "$(cat <<'EOF' … EOF)"` (heredoc z cudzysłowem = brak escapowania;
wewnątrz używaj template literals, nie `\"`). **Przy dłuższych skryptach `--eval "$(cat <<EOF)"`
potrafi wywalić się na parsowaniu bashu („unexpected EOF while looking for matching `)`") — wtedy
podaj skrypt na STDIN: `node --input-type=module - <<'ENDOFSCRIPT' … ENDOFSCRIPT`. Działa
identycznie i jest odporne na nawiasy/regexy w treści (2026-08-26).** W skrypcie:
1. `ts.transpileModule(readFileSync('packages/contracts/src/generated/rbac.ts'))` →
   `await import('data:text/javascript;base64,' + …)` = PRAWDZIWE `can()`/`ROLES`/`PERMISSIONS`.
2. Wczytaj prawdziwy `actions.ts`, podmień fragment stringiem (**rzuć wyjątkiem, jeśli wzorzec
   nie został znaleziony** — cicha mutacja no-op udaje „test zabił mutanta").
3. Usuń `"use server"` i linie `import`, zamień `export async function` → `async function`,
   przetranspiluj, wstrzyknij zależności przez `new Function('prisma','revalidatePath','can',
   'ROLES','getCurrentActorRole', js + 'return { … }')`.
4. Przepisz asercje z prawdziwego pliku testowego i **zwaliduj harness baseline'em** — musi dać
   zero padnięć, inaczej mierzysz swój harness, nie kod.
5. Owiń `can` w szpiega liczącego wywołania — to jedyny sposób, żeby odróżnić „bramka odmówiła"
   od „bramka w ogóle nie zapytała macierzy".

**Minimalna lista mutantów dla bramki roli** (i czego dowodzi każdy):
- usunięcie całej bramki (osobno: z wywołaniem `getCurrentActorRole` i bez) — czy testy nazwane
  „bramka" łapią eskalację, czy tylko `null`;
- usunięcie walidacji danych (np. `ROLES.includes`) — osobno od bramki uprawnień;
- **osłabienie do samego `!actorRole`** — najważniejszy. Zabija go WYŁĄCZNIE test, który
  przepuszcza rolę uwierzytelnioną, ale nieuprawnioną (`dyspozytor`/`audytor`/`monter`).
  Zestaw testujący tylko `null`/`undefined` jest na to ślepy i przechodzi na kodzie, który
  nigdy nie woła `can()`;
- **`'yes'` → `'own'`: uwaga na polaryzację warunku.** Bramki w tym repo mają postać
  `if (!role || can(...) !== 'yes') return deny`. Osłabienie do „przepuszczaj też `own`" to
  mutant `can(...) === 'no'`, **nie** `can(...) !== 'no'` — ten drugi odwraca warunek i odrzuca
  wszystkich, więc wygląda na „mutanta zabitego przez wszystkie testy", a naprawdę niczego nie
  mierzy. Zweryfikowane 2026-08-26 na `updateInstallationStatus` (agent zlecający poprosił wprost
  o wariant `!== 'no'`; dopiero `=== 'no'` przepuścił `monter`/`own` i został zabity przez test
  montera). Zawsze dopisz kontrolę: mutant, którego oblewają WSZYSTKIE role, jest podejrzany.
- podmiana `capability` w obrębie tej samej listy ról (`create` → `read` przy
  `authorized_users`) — mutant **równoważny**, żaden test go nie zabije i to nie jest defekt
  testów, tylko własność macierzy. Odnotuj jako ryzyko szczątkowe, nie jako blokadę;
- podmiana `resource` (`authorized_users` → `leads`) — łapie tylko ta rola, która ma szersze
  uprawnienia na podmienionym zasobie;
- **tożsamość brana z ARGUMENTU akcji zamiast z sesji** (`{ audytor_id: options?.audytor_id ?? own.id }`)
  — przy filtrach `:own` to najgroźniejszy mutant po `undefined` w `where`, i przeżywa całą
  baterię, jeśli żaden test nie wywoła akcji z podstawionym cudzym identyfikatorem w
  argumencie. Zweryfikowane 2026-08-26 na `getLeads()` (20 testów, mutant przeżył). Test
  „kontrola negatywna: `where.audytor_id` nie równa się cudzemu id" go NIE zabija, bo nie
  podaje tego id na wejściu — musi być argument;
- przesunięcie zapytania Prismy PRZED bramkę — dowodzi, że asercje „`findUnique` nie został
  wywołany" realnie pilnują kolejności, a nie są ozdobą. **Uwaga: `tools/kk-authz-gate.mjs`
  sprawdza wyłącznie OBECNOŚĆ `can()` w akcji, nie jego KOLEJNOŚĆ względem zapytań** —
  akcja z bramką na końcu przechodzi bramkę statyczną i jednocześnie jest oraclem stanu dla
  roli bez uprawnień (zweryfikowane 2026-08-26 na `assignCrewToLead`: `monter` dostaje
  „Lead nie został znaleziony" vs „nieważny certyfikat: F-Gaz, SEP" zanim `can()` w ogóle
  zostanie zapytane). Przy każdej akcji z bramką na końcu odpal wariant „rola nieuprawniona
  + dwa różne stany bazy" i porównaj komunikaty.
- **rozróżnienie kształtu odmowy dla „rekord nie istnieje" vs „cudzy rekord"** — mutant dla
  wymagań z kryterium nieodróżnialności (WO AC4 przy `/leads/[id]`). Zabija go WYŁĄCZNIE
  asercja porównująca CAŁE obiekty obu odmów (`expect(a).toEqual(b)`); zestaw sprawdzający
  osobno `result.success === false` dla obu przypadków jest na to ślepy. Zweryfikowane
  2026-08-26 na `getLeadDetail()`.

**Minimalna lista mutantów dla minimalizacji danych** (`select` + zawężający `map`, wymagania
klasy SEC-…-MINIMIZE; zwalidowana 2026-08-25 na SEC-ASSIGNMENT-POOL-MINIMIZE, baseline 0/9):
- **`select` usunięty, `map` zostaje** — najważniejszy. Wynik jest identycznie wąski, więc
  KAŻDY test kształtu przechodzi. Zabija go WYŁĄCZNIE asercja na argumentach zapytania
  (`findManyMock.mock.calls[0][0].select`). Bateria bez tej asercji jest ślepa na kod, który
  wciąga IBAN do pamięci serwera i dopiero potem go odrzuca;
- **`select` dociąga jedno pole wrażliwe, `map` bez zmian** — jak wyżej, ten sam jedyny zabójca;
- **`map` → `({ ...a })`** — zabija go tylko porównanie ZBIORÓW kluczy; asercja „żaden klucz
  nie jest wrażliwy" go przepuszcza, gdy dołożone pola są niewrażliwe (`is_active`,
  `availability_declaration`). To empiryczny dowód, po co kontrakt żąda równości zbiorów;
- **usunięcie filtra biznesowego przy zachowanym zawężeniu** (dostępność pracownika, ważność
  certyfikatu) — zawężanie kolumn to dokładnie ta klasa zmiany, przy której filtr znika
  bezgłośnie, bo zniknięcie nie psuje kompilacji. Testy filtrów muszą być w tej samej baterii;
- **funkcja zwraca `[]`** — kontrola pozytywna; bez niej cały zestaw przechodzi dla naprawy,
  która zabiera użytkownikowi możliwość wyboru.
- **relacja objęta INNYM wymaganiem MINIMIZE** — ślepa plamka między plikami testowymi.
  Każdy plik testu zawęża sobie zakres zdaniem „to pole jest już domknięte przez inne ID,
  tu go nie testujemy", a plik tamtego ID mockuje inną funkcję. Efekt: pole jest poprawnie
  zawężone w kodzie i ZERO testów tego pilnuje. Zweryfikowane 2026-08-25 na
  SEC-LEADS-LIST-MINIMIZE: `getLeads().audytor` (rozszerzenie z powrotem do `true` przepuszcza
  `iban`/`nip`/`telefon`/`email` audytora, baterie obu ID zielone). Przy każdym MINIMIZE
  zmutuj też relacje wyłączone z zakresu — to najtańsze miejsce na regresję.
**Typ wyprowadzony (`Awaited<ReturnType<typeof …>>`) jest bramką TYLKO w jedną stronę.**
Zmierzone 2026-08-26 nakładką na `CompilerHost` (patrz [[feedback-audit-execution-constraints]])
na `leads-client.tsx`:
- odczyt usuniętego pola (`l.audytor_id`, `l.notatki_wewnetrzne`) → **błąd TS2339/TS2551**,
  czyli zawężenie jest realne, a usunięcie rzutowań `as Lead` nie jest iluzoryczne;
- **dopisanie nadmiarowej właściwości** (`{ ...l, telefon: "…" , status }`) w callbacku
  `current.map(…)` → **0 diagnostyk**. Brak excess property check, bo `map` wnioskuje `U`
  z literału zamiast go kontekstować typem docelowym.
Wniosek do powtarzania w werdyktach: przy każdym MINIMIZE bramką jest test kształtu, nie typ —
i to jest fakt zmierzony, nie teza z Work Ordera. Nie akceptuj „typ tego pilnuje" bez tej próby.

Warstwę „props z Server Componentu do komponentu klienckiego" testuj osobno: wystarczy
przepisać inline samo wyrażenie budujące propsy i puścić przez nie wariant `{...x, extra}`
i wariant z jawnym wyliczeniem pól — nie trzeba odtwarzać mockowania modułów z vitest.
