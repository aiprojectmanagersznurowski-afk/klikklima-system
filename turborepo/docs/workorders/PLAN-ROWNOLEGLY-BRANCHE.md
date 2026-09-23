# Podział prac na gałęzie — praca równoległa kilku agentów

> **Stan na 2026-09-23.** Dokument odpowiada na pytanie: jak rozdzielić
> [plan dokończenia systemu](PLAN-DOKONCZENIA-SYSTEMU.md) na gałęzie tak, żeby kilku agentów (Claude Code
> i agenci Gemini) mogło pracować jednocześnie, nie wchodząc sobie w drogę i nie łamiąc zasady zerowej.

## 1. Rzecz, którą trzeba wiedzieć, zanim odpali się drugiego agenta

Dyscyplinę tego repozytorium trzymają **hooki Claude Code** (`.claude/hooks/guard-paths.mjs`,
`guard-forbidden.mjs`, `guard-bash.mjs`). To one blokują zapis do `contracts/`, edycję testów przez
implementera, `as any`, hardkodowane kolory i pracę na `main`.

**Agent Gemini nie uruchamia tych hooków.** Dla niego to zwykłe pliki i zwykły `git`. Jeżeli zmieni
kontrakt albo dopisze `@ts-ignore`, nikt go lokalnie nie zatrzyma. Dlatego przy pracy równoległej
bezpieczeństwo musi przenieść się z lokalnych hooków na **bramkę CI i regułę ochrony gałęzi `main`**:

1. Włącz ochronę `main` w GitHub: zakaz bezpośredniego pushu, wymagane przejście `kk-gate.yml`.
   Bramka leży w **korzeniu repozytorium** (`.github/workflows/kk-gate.yml`, poziom wyżej niż `turborepo/`)
   i uruchamia się na `pull_request` do `main`, w czterech zadaniach: `kontrakt`, `aplikacja`,
   `integracja` (żywy Postgres przez `supabase start`) i `recenzja-agentowa`. Jako wymagane do scalenia
   ustaw wszystkie cztery.
2. Każda gałąź przed PR uruchamia `bash scripts/verify.sh --full` — to ten sam zestaw bramek
   (`kk-validate`, `kk-codegen --check`, `kk-naming`, testy), który u Claude wymuszają hooki.
3. Każdy PR przed scaleniem przechodzi `/kk-review` (recenzent i audytor bezpieczeństwa).
4. Plik [`GEMINI.md`](../../GEMINI.md) w katalogu głównym zawiera te same zakazy w formie, którą agenci
   Gemini czytają automatycznie. **Bez niego nie odpalaj żadnego agenta spoza Claude Code.**

## 2. Etap 0 — jedna gałąź, przed wszystkimi pozostałymi

Nie da się tego zrównoleglić i nie warto próbować.

**Gałąź: `chore/contract-registration`**

| Zakres | Pliki |
|---|---|
| rejestracja 31 nowych wymagań, zmiany statusów | `contracts/requirements.contract.mjs` |
| `FLD-PHOTO-SET` na wzór 4+2n, `FNL-2PHASE-INVOICE` po etapie II, `N8a` bez faktury | `contracts/` |
| `leads:create` dla audytora, zasoby na podpisy, zdjęcia, dokumenty | `contracts/rbac.contract.mjs` |
| próg 300 m² dla stawki VAT | `contracts/sla.contract.mjs` |
| słownik `PROPERTY_AREA_BANDS` i pole `PROPERTY_AREA_BAND` w Triage | `contracts/triage.contract.mjs` |
| tabele: `price_list_items`, `quotes`, `quote_*`, `contracts`, `signatures`, `invoices`, `documents` | `packages/database/prisma/schema.prisma`, `supabase/migrations/` |
| regeneracja | `packages/contracts/src/generated/**` |

Dlaczego serializacja: `packages/contracts/src/generated/**` jest **generowany**, a importuje go cały
monorepo. Dwie gałęzie regenerujące go równolegle dają konflikt w każdym pliku naraz, a rozwiązywanie
konfliktów w plikach generowanych to proszenie się o cichy błąd.

Wymaga: `node tools/kk-contract-window.mjs open KK-IMPL-2026Q4` (polecenie interaktywne, **musi je
uruchomić człowiek**), potem `contract-steward`, potem `node tools/kk-codegen.mjs` i `--check`.

Szacunek: 1–2 dni pracy. **Dopiero po scaleniu tej gałęzi startują pozostałe.**

## 3. Gałęzie równoległe

Kolejność kolumny „Start" to zależności, nie priorytet.

| # | Gałąź | Strumień | Katalogi, które są jej wyłączną własnością | Start | MD |
|---|---|---|---|---|---|
| B1 | `feat/ntf-gateway` | P1 | `apps/b2b-web/src/lib/notifications/**`, `apps/b2b-web/src/app/(dashboard)/notifications/**`, `supabase/functions/**` | od razu po etapie 0 | 8–12 |
| B2 | `feat/price-list-vat` | P4 | `apps/b2b-web/src/lib/pricing/**`, `.../settings/pricing/**`, `.../settings/standard-installation/**`, `apps/b2c-web/app/actions/get*.ts` | od razu | 18–26 |
| B3 | `feat/field-app-foundation` | P5 etap 1 | **`apps/field-app/**` (nowa aplikacja)**, `apps/b2b-web/src/app/api/field/**` | od razu | 17–27 |
| B4 | `feat/funnel-transitions` | P3 | `apps/b2b-web/src/lib/funnel/**`, `packages/documents/**` (nowy pakiet, silnik PDF) | po B1 | 14–20 |
| B5 | `feat/rodo-delete-anonymize` | P2 część | `apps/b2b-web/src/lib/rodo/**`, `.../settings/privacy/**` | od razu | 4–6 |
| B6 | `feat/crm-cards` | P9 | `apps/b2b-web/src/app/(dashboard)/{customers,installations,incidents,auditors,crews}/**` | od razu | 20–30 |
| B7 | `feat/b2c-triage` | P8 | `apps/b2c-web/**` poza plikami z B2 | od razu | 12–18 |
| B8 | `feat/field-app-install-path` | P5 etapy 2–3 | `apps/field-app/**` | **po B3** | 26–39 |
| B9 | `feat/sign-onsite` | P6 część | `packages/signature/**` (nowy), `apps/field-app/src/features/signature/**` | po B3 | 12–16 |

**Gałąź, której świadomie nie ma na liście:** przegląd dziennika zdarzeń (`SEC-AUDIT-LOG*`, reszta P2).
To zmiana dotykająca **każdej** Server Action w panelu, więc równolegle z czymkolwiek daje konflikt
w plikach, których nie jest właścicielem. Robimy ją jednym przebiegiem, gdy B1, B4 i B6 są już scalone.

## 4. Punkty kolizji i zasady, które je usuwają

| Hotspot | Ryzyko | Zasada |
|---|---|---|
| `packages/contracts/src/generated/**` | konflikt w każdym pliku naraz | **żadna gałąź równoległa nie regeneruje kontraktu.** Potrzebna zmiana kontraktu → zatrzymaj gałąź, zgłoś, zbieramy do następnego okna kontraktowego (proponuję jedno okno tygodniowo) |
| `supabase/migrations/` | dwie gałęzie z tym samym znacznikiem czasu | każda gałąź dostaje **zarezerwowany slot** (rozdział 5). Migracje spoza etapu 0 tylko wtedy, gdy dotyczą wyłącznie własnych tabel |
| `packages/database/prisma/schema.prisma` | jeden plik, wszyscy go chcą | zmiany schematu **wyłącznie w etapie 0 i w oknach kontraktowych**. Nigdy na gałęzi funkcjonalnej |
| `apps/b2b-web/src/app/(dashboard)/layout.tsx` | każda nowa sekcja dokłada pozycję menu | pozycje menu dodają **tylko B2 i B3**. Pozostałe gałęzie zgłaszają potrzebę, wpis dokłada właściciel pliku |
| `package.json`, `package-lock.json` | konflikt lockfile przy każdej nowej zależności | nowe zależności zgłaszane z góry i instalowane **w etapie 0**. Jeśli to niemożliwe: po rebase **regeneruj** lockfile (`npm install`), nigdy nie scalaj go ręcznie |
| `apps/b2b-web/tests/**` | dwóch agentów pisze testy tego samego modułu | testy należą do tej gałęzi, która jest właścicielem katalogu produkcyjnego |
| `docs/BACKLOG.md` | wszyscy dopisują | backlog aktualizujemy **na Trello**, nie w pliku. `BACKLOG.md` staje się materiałem historycznym |

## 5. Zarezerwowane znaczniki czasu migracji

Żeby dwie gałęzie nie stworzyły pliku o tej samej nazwie i żeby kolejność uruchomienia była przewidywalna:

| Gałąź | Zarezerwowany prefiks |
|---|---|
| `chore/contract-registration` | `20260925090000_` … `20260925093000_` |
| B2 `feat/price-list-vat` | `20260929090000_` |
| B3 `feat/field-app-foundation` | `20260929100000_` |
| B5 `feat/rodo-delete-anonymize` | `20260929110000_` |
| B9 `feat/sign-onsite` | `20261006090000_` |

Pozostałe gałęzie nie tworzą migracji. Jeśli się okaże, że muszą — to sygnał, że zakres wyszedł poza
Work Order, i temat wraca do okna kontraktowego.

## 6. Ilu agentów ma sens

**Trzech albo czterech pracujących jednocześnie, nie więcej.** Nie dlatego, że zabraknie gałęzi, tylko
dlatego, że każdy PR musi przejść recenzję i scalenie, a to wąskie gardło po Twojej stronie. Przy sześciu
agentach zaczniesz być recenzentem na pełen etat.

Proponowany przydział startowy:

| Agent | Gałąź | Dlaczego ta |
|---|---|---|
| Agent 1 (najsilniejszy model) | B3 `feat/field-app-foundation` | nowa aplikacja od zera, najwięcej decyzji projektowych, zero kolizji z resztą |
| Agent 2 | B2 `feat/price-list-vat` | zamknięta domena, dane wejściowe gotowe ([cennik](../architecture/CENNIK-ROBOCIZNY.md)) |
| Agent 3 | B1 `feat/ntf-gateway` | odblokowuje sześć innych strumieni, więc im wcześniej, tym lepiej |
| Agent 4 (opcjonalnie) | B6 `feat/crm-cards` | prace powtarzalne, łatwo dzielone po ekranach, najmniej ryzykowne |

Po scaleniu B3 zwolniony agent bierze B8, po B1 — B4.

## 7. Rytm pracy

- **Rebase na `main` codziennie rano.** Gałąź żyjąca dłużej niż 3 dni bez rebase to przyszły dzień
  rozwiązywania konfliktów.
- **PR nie większy niż jeden Work Order.** Jeżeli PR dotyka więcej niż jednego wymagania, wraca do podziału.
- **Kolejność w PR: najpierw commit z testami (RED), potem commit z implementacją (GREEN).** U agentów
  Gemini nie ma hooka, który to wymusi, więc sprawdzam to w recenzji: jeśli testy i implementacja
  przyszły jednym commitem, nie wiadomo, czy test kiedykolwiek był czerwony.
- **Limit trzech podejść do zieleni.** Po trzeciej nieudanej iteracji agent zatrzymuje się i pisze
  diagnozę dla człowieka, zamiast próbować czwarty raz.

## 8. Czego brakuje, zanim pierwszy agent dostanie zadanie

1. **Okno kontraktowe i etap 0** — bez zarejestrowanych wymagań agenci nie mają czego implementować,
   a `kk-trace` nie ma czego śledzić.
2. **Work Ordery** dla pierwszych czterech gałęzi (`/kk-plan` na wymaganie). Jeden WO na artefakt i rolę.
3. **Ochrona `main` w GitHub** — inaczej pierwszy agent, który nie przeczyta zasad, wypchnie na `main`.
4. ~~Decyzja o stawce VAT przy zaliczce~~ **rozstrzygnięte 2026-09-23 (D17)**: stawka wynika z obiektu,
   zaliczka liczy się po stawce obiektu. B2 odblokowane.
5. ~~Pytanie do księgowego o próg 300 m²~~ **rozstrzygnięte 2026-09-23**: próg obowiązuje jednakowo
   dla mieszkań i domów, lokal komercyjny zawsze 23%. B2 nie ma już otwartych blokad.
