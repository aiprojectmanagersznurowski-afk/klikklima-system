# Prompty startowe dla agentów

> **2026-09-23.** Gotowe do wklejenia prompty dla czterech agentów pracujących równolegle: jeden Claude
> Code i trzej agenci Gemini. Podział i zasady: [PLAN-ROWNOLEGLY-BRANCHE.md](PLAN-ROWNOLEGLY-BRANCHE.md).

## Kto co dostaje i dlaczego akurat to

Kluczowe ustalenie: **`NTF-*`, `CRM-*` i `B2C-*` są już zarejestrowane w kontrakcie**, więc trzy gałęzie
Gemini **nie czekają na etap 0**. Czekają tylko prace potrzebujące nowych tabel i nowych wymagań.

| Agent | Gałąź | Wymagania | Czeka na etap 0? |
|---|---|---|---|
| **Claude Code** | `chore/contract-registration`, potem `feat/field-app-foundation` | rejestracja 31 nowych + aplikacja terenowa | **jest etapem 0** |
| **Gemini 1** | `feat/ntf-gateway` | `NTF-CATALOG-PARITY`, `NTF-QUEUE-WINDOW`, `NTF-RETRY`, `NTF-POLY`, `NTF-HISTORY` | nie |
| **Gemini 2** | `feat/crm-cards` | `CRM-KLI-AC1/2/3`, `CRM-INST-AC1/2`, `CRM-AUDYT-KARTOTEKA`, `CRM-ZESP-KARTOTEKA` | nie |
| **Gemini 3** | `feat/b2c-triage` | `B2C-TRIAGE-STEPS`, `B2C-TRIAGE-CONDITIONAL`, `B2C-SOFT-LEAD`, `B2C-NAV-STATE`, `B2C-CATALOG-LIST` | nie |

Claude dostaje etap 0 i aplikację terenową, bo obie prace wymagają najwięcej decyzji projektowych, obie
dotykają kontraktu i obie są najdroższe w poprawianiu. Gemini dostają prace zamknięte w jednym katalogu,
z wymaganiami, które ktoś już opisał kryteriami akceptacji.

## Zanim odpalisz agentów

1. **Ochrona `main` w GitHub** — bez tego pierwszy agent, który nie doczyta zasad, wypchnie na `main`.
2. **Osobny katalog roboczy dla każdego agenta**, żeby nie deptali sobie po plikach:

```bash
cd /Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system
git worktree add ../kk-ntf     -b feat/ntf-gateway   main
git worktree add ../kk-crm     -b feat/crm-cards     main
git worktree add ../kk-b2c     -b feat/b2c-triage    main
# w każdym katalogu raz:  npm install
```

3. Każdy agent dostaje **jeden** prompt z tego dokumentu i pracuje wyłącznie w swoim katalogu.

---

## Prompt 1 — Claude Code (etap 0, potem Field App)

```text
Pracujesz w repozytorium KlikKlima (monorepo Turborepo). Przeczytaj najpierw .claude/CLAUDE.md,
docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md i docs/workorders/PLAN-ROWNOLEGLY-BRANCHE.md.

ZADANIE A (etap 0, blokuje trzech innych agentów — zrób je najpierw i scal jak najszybciej).
Gałąź: chore/contract-registration. Rola: contract-steward, okno kontraktowe KK-IMPL-2026Q4
otworzę ja poleceniem interaktywnym — poproś mnie o to, zanim dotkniesz contracts/.

Zarejestruj w contracts/requirements.contract.mjs wymagania wypisane w rozdziale 6.3 dokumentu
docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md oraz w rozdziale 2 planu dokończenia systemu:
rodziny FLD-*, FLD-SIGN-*, PRICE-*, INV-*, DOC-*, STD-INSTALL-CONFIG, B2C-PROPERTY-AREA-BAND.
Każde wymaganie ma mieć kryteria akceptacji sprawdzalne testem, nie opis intencji.

Do tego zmiany w istniejącym kontrakcie:
- FLD-PHOTO-SET: ze stałych 4 zdjęć na wzór 4+2n (decyzja D7), osobny komplet dla etapu I;
- FNL-2PHASE-INVOICE: rozliczenie po etapie II, czyli przy T09, nigdy przy T17 (D9);
- N8a: zdjęcie załącznika invoice_phase_1 (po etapie I nie ma faktury);
- rbac: prawo leads:create dla roli audytor + drugie wejście do lejka (D14), zasoby na podpisy,
  zdjęcia i dokumenty;
- triage: słownik PROPERTY_AREA_BANDS (UP_TO_300, ABOVE_300) i pole PROPERTY_AREA_BAND (D17);
- sla: próg 300 m² dla stawki VAT;
- schema.prisma + migracje: price_list_items (z atrybutem scope ROOM/INSTALLATION), quotes,
  quote_variants, quote_rooms, quote_items (room_id OPCJONALNE), contracts, signatures, invoices,
  documents. Znaczniki czasu migracji z rozdziału 5 planu podziału na gałęzie.

Na koniec: node tools/kk-codegen.mjs, node tools/kk-validate.mjs, node tools/kk-codegen.mjs --check,
bash scripts/verify.sh --full. Potem PR i poproś mnie o scalenie.

ZADANIE B (dopiero po scaleniu A). Gałąź: feat/field-app-foundation.
Zbuduj fundament aplikacji terenowej: apps/field-app (React Native + Expo) oraz warstwę zapisu
apps/b2b-web/src/app/api/field/** wg szkicu docs/architecture/ADR-013-warstwa-zapisu-field-app.md.
Zakres: FLD-APP-SHELL, FLD-API-LAYER, FLD-APP-DISTRIBUTION, FLD-MOBILE-TEST-HARNESS, FLD-JOBS-OWN,
FLD-AUTH-BLOCKED. Zacznij od /kk-plan na FLD-API-LAYER, bo to on przesądza o kształcie reszty.

Nie wychodź poza katalogi przypisane tym gałęziom. Po każdej zielonej bramce uruchom /kk-review.
```

---

## Prompt 2 — Gemini 1: bramka powiadomień

```text
Pracujesz w repozytorium KlikKlima, katalog roboczy ../kk-ntf, gałąź feat/ntf-gateway.
PRZECZYTAJ NAJPIERW plik GEMINI.md w katalogu głównym repozytorium — zawiera zakazy, których
złamanie oznacza odrzucenie PR. Potem przeczytaj docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md,
rozdział "P1: Wysyłka powiadomień".

Kontekst: kolejka notification_queue działa i jest idempotentna, ale NIC z niej nie wychodzi —
ani jeden SMS, ani jeden e-mail. To blokuje sześć innych strumieni prac, więc Twoja gałąź jest
najpilniejsza w całym projekcie.

Zakres (wymagania są już zarejestrowane w contracts/requirements.contract.mjs — przeczytaj ich
kryteria akceptacji, to one są definicją ukończenia):
  NTF-CATALOG-PARITY, NTF-QUEUE-WINDOW, NTF-RETRY, NTF-POLY, NTF-HISTORY
plus wysyłka: SMSAPI dla SMS (pole nadawcy zgłoszone i przetestowane) i Mailtrap dla e-maili
(decyzja D13). Klucze są w .env, nie wypisuj ich nigdzie.

Twoje katalogi (poza nie wychodzisz):
  apps/b2b-web/src/lib/notifications/**
  apps/b2b-web/src/app/(dashboard)/notifications/**
  supabase/functions/**
  apps/b2b-web/tests/** — tylko pliki testów dotyczące powiadomień

Pułapki tego obszaru:
- wysyłka MUSI być idempotentna: to samo powiadomienie uruchomione dwa razy wysyła jeden SMS,
  a nie dwa. Klient nie może dostać duplikatu, bo cron odpalił się ponownie;
- okno 8:00-18:00 i pozostałe progi czasowe pochodzą z kontraktu SLA, nigdy z literału w kodzie;
- katalog powiadomień (contracts/notifications.contract.mjs) jest źródłem prawdy — jeśli czegoś
  w nim brakuje, ZATRZYMAJ SIĘ i napisz mi o tym. Nie dopisuj nic do contracts/ samodzielnie.

Sposób pracy:
1. Napisz krótki plan (co, w jakiej kolejności, jakie testy) i pokaż mi go PRZED pisaniem kodu.
2. Najpierw commit z testami (mają być czerwone), potem commit z implementacją.
3. Przed PR: bash scripts/verify.sh --full — musi być zielone.
4. Rebase na main codziennie. Nigdy nie commituj na main, nigdy git push --force.
5. Po trzech nieudanych podejściach do zieleni zatrzymaj się i napisz diagnozę zamiast próbować dalej.

Komunikaty w interfejsie, komentarze domenowe i opisy commitów po polsku. Identyfikatory w kodzie
i nazwy tabel po angielsku, snake_case.
```

---

## Prompt 3 — Gemini 2: kartoteki CRM

```text
Pracujesz w repozytorium KlikKlima, katalog roboczy ../kk-crm, gałąź feat/crm-cards.
PRZECZYTAJ NAJPIERW plik GEMINI.md w katalogu głównym repozytorium — zawiera zakazy, których
złamanie oznacza odrzucenie PR. Potem docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md, rozdział
"P9: CRM i serwisy".

Zakres (wymagania zarejestrowane w contracts/requirements.contract.mjs, ich kryteria akceptacji
są definicją ukończenia):
  CRM-KLI-AC1  — globalna wyszukiwarka klienta po imieniu, nazwisku, telefonie
  CRM-KLI-AC2  — zmiana danych kontaktowych propaguje się do aktywnych leadów
  CRM-KLI-AC3  — Karta 360 ładuje historię i pliki asynchronicznie
  CRM-INST-AC1 — widok Instalacji odświeża status po zakończeniu montażu przez ekipę
  CRM-INST-AC2 — dzisiejsze instalacje bez statusu Zakończona po 16:00 są podświetlone
  CRM-AUDYT-KARTOTEKA, CRM-ZESP-KARTOTEKA — zakładanie i edycja kartotek z panelu

Twoje katalogi (poza nie wychodzisz):
  apps/b2b-web/src/app/(dashboard)/customers/**
  apps/b2b-web/src/app/(dashboard)/installations/**
  apps/b2b-web/src/app/(dashboard)/auditors/**
  apps/b2b-web/src/app/(dashboard)/crews/**
  apps/b2b-web/tests/** — tylko pliki testów dotyczące tych widoków

NIE dotykasz apps/b2b-web/src/app/(dashboard)/layout.tsx. Jeśli potrzebujesz nowej pozycji w menu,
napisz mi o tym — ten plik ma jednego właściciela, żeby nie robić konfliktów.

Pułapki tego obszaru:
- Prisma omija RLS, więc panel B2B NIE jest chroniony przez bazę. Każda Server Action musi jawnie
  sprawdzić rolę przez can(). Brak sprawdzenia to podatność, nie niedopatrzenie;
- kolory statusów i alertów SLA biorą się ze zmiennych motywu, nigdy z literałów hex. Alert SLA
  nigdy nie jest zielony;
- ikony wyłącznie z lucide-react, formularze na react-hook-form + zodResolver;
- dane pobierasz w Server Components, nie w useEffect.

Sposób pracy:
1. Napisz krótki plan i pokaż mi go PRZED pisaniem kodu. Rozbij pracę na widoki — po jednym PR
   na widok, nie jeden wielki PR na wszystko.
2. Najpierw commit z testami (czerwone), potem implementacja.
3. Przed PR: bash scripts/verify.sh --full.
4. Rebase na main codziennie. Nigdy nie commituj na main.
5. Po trzech nieudanych podejściach do zieleni zatrzymaj się i napisz diagnozę.

Komunikaty w interfejsie i komentarze po polsku, identyfikatory w kodzie po angielsku, snake_case.
```

---

## Prompt 4 — Gemini 3: Triage i landing page

```text
Pracujesz w repozytorium KlikKlima, katalog roboczy ../kk-b2c, gałąź feat/b2c-triage.
PRZECZYTAJ NAJPIERW plik GEMINI.md w katalogu głównym repozytorium — zawiera zakazy, których
złamanie oznacza odrzucenie PR. Potem docs/workorders/PLAN-DOKONCZENIA-SYSTEMU.md, rozdział
"P8: B2C".

Zakres (wymagania zarejestrowane w contracts/requirements.contract.mjs):
  B2C-TRIAGE-STEPS, B2C-TRIAGE-CONDITIONAL, B2C-SOFT-LEAD, B2C-NAV-STATE,
  B2C-CATALOG-LIST, B2C-DEVICE-MODAL, B2C-CATALOG-VIEW-TRACKED

Twoje katalogi: apps/b2c-web/** z JEDNYM wyjątkiem — NIE dotykasz plików wyceny:
apps/b2c-web/app/actions/getSetForConfig.ts, getRecommendation.ts, getCatalog.ts,
getBestsellers.ts, getLowestPriceForIndoorUnit.ts. Te przepisuje równolegle inna gałąź
(feat/price-list-vat), bo zmienia się sposób liczenia ceny montażu.

Kontekst, który oszczędzi Ci błędu: kreator Triage opiera się na kontrakcie
contracts/triage.contract.mjs — słowniki BUILDING_TYPES, ROOM_SIZE_BANDS, PROPERTY_CONDITIONS
i reguły dyskwalifikacji (np. COMMERCIAL_PROPERTY kieruje lokal komercyjny na ekran eksperta).
Kreator ma odwzorowywać kontrakt, a nie własną kopię tych list. Jeśli brakuje w nim wartości,
której potrzebujesz — ZATRZYMAJ SIĘ i napisz mi. Nie dopisuj nic do contracts/.

Pułapki tego obszaru:
- B2C łączy się przez supabase-js i RLS jest aktywne, więc brak polityki oznacza pusty wynik,
  a nie błąd. Testuj na prawdziwych danych, nie na atrapie;
- klucz service_role NIGDY nie trafia do kodu klienckiego;
- zgody RODO zapisujemy z wersją regulaminu, nigdy jako samą flagę logiczną.

Sposób pracy:
1. Napisz krótki plan i pokaż mi go PRZED pisaniem kodu.
2. Najpierw commit z testami (czerwone), potem implementacja.
3. Przed PR: bash scripts/verify.sh --full.
4. Rebase na main codziennie. Nigdy nie commituj na main.
5. Po trzech nieudanych podejściach do zieleni zatrzymaj się i napisz diagnozę.

Treści dla użytkownika i komentarze po polsku, identyfikatory w kodzie po angielsku, snake_case.
```

---

## Co robisz Ty, kiedy oni pracują

- **Recenzujesz i scalasz.** To jest wąskie gardło, nie liczba agentów. Trzech agentów Gemini plus
  Claude wygeneruje mniej więcej jeden PR dziennie każdy.
- **Pilnujesz, żeby nikt nie tknął `contracts/`.** Jeśli agent zgłasza, że potrzebuje zmiany kontraktu,
  zbierz to i przekaż mi — zmiany idą paczką w jednym oknie kontraktowym, nie po jednej.
- **Nie pozwalasz na gałąź żyjącą dłużej niż trzy dni bez rebase.**

## Po scaleniu pierwszych gałęzi

| Zwolniony agent | Bierze | Dlaczego dopiero teraz |
|---|---|---|
| po `feat/ntf-gateway` | `feat/funnel-transitions` (P3) | każde przejście lejka wysyła powiadomienie |
| po `feat/crm-cards` | `feat/rodo-anonymize` (`CRM-CLIENT-ANONYMIZE-RODO`) | dotyka tych samych widoków CRM, więc równolegle dawałoby konflikty |
| po `feat/field-app-foundation` | `feat/field-app-install-path` (P5 etapy 2–3) | stoi na fundamencie z etapu 1 |
| po etapie 0 | `feat/price-list-vat` (P4) | potrzebuje tabeli `price_list_items` |
