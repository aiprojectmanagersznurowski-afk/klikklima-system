# WO: FLD-CONSENT-DOCS — wersjonowane zgody RODO i regulamin pracowniczy (model danych)

> **STATUS: WYMAGA DECYZJI D-C i D-D. Nie startować.**
> Model danych da się zaprojektować dopiero po odpowiedzi, czy dokumenty prawne to nowy zasób RBAC
> czy rozszerzenie istniejącego `documents`, oraz gdzie brak zgody ma realnie blokować pracę.

**Cel:** administrator ma miejsce, w którym wgrywa i **wersjonuje** treść zgód RODO i regulaminu,
a system wie, kto zaakceptował którą wersję i kiedy. Bez tego D4 („pracownik musi zaakceptować przed
podjęciem zleceń") jest deklaracją bez nośnika.

**Rola wiodąca:** `contract-steward`. **Okno kontraktowe: WYMAGANE**
(`contracts/rbac.contract.mjs`, ewentualnie `contracts/funnel.contract.mjs` przy decyzji D-D,
`schema.prisma`, `supabase/migrations/`).

## Wymagania

| ID | Stan | Uwaga |
|---|---|---|
| `FLD-CONSENT-ACCEPT` | `BLOCKED` (zarejestrowane w WO-A) | po tym WO przechodzi na `TODO` |
| `FLD-LEGAL-DOC-VERSION` | `BLOCKED` (zarejestrowane w WO-A) | po tym WO przechodzi na `TODO` |
| `B2C-CONSENT-RODO` | `TODO`, HIGH, 0 testów | **wzorzec do naśladowania, nie do skopiowania** — patrz niżej |
| `B2C-CONTENT-PAGES` | `TODO`, LOW | ma kryterium „Wersja dokumentu prawnego prezentowana na stronie jest tą samą wartością, którą zapisuje zgoda" — czyli po stronie klienckiej ten sam problem czeka nierozwiązany |

## Kontekst kodu (zweryfikowany 2026-08-20/21)

### Istnieje

| Miejsce | Stan faktyczny |
|---|---|
| `contracts/requirements.contract.mjs` `B2C-CONSENT-RODO` | kryteria: „Zapisywany jest moment udzielenia zgody **oraz wersja** zaakceptowanego dokumentu — sama flaga logiczna nie wystarcza" i „Późniejsza zmiana treści regulaminu **nie modyfikuje wersji zapisanej przy istniejących leadach**". Wymaganie jest sformułowane, ale **nie ma ani jednego testu ani implementacji** |
| `contracts/rbac.contract.mjs` | zasób `documents` (ADR-012): `read: ['admin','dyspozytor','audytor:own','monter:own']`, `create: ['admin','dyspozytor','audytor','monter']`, `update: ['admin']`, `delete: ['admin']` |
| `docs/architecture/database_model.md` | `documents.kind` = `QUOTE_PDF CONTRACT HANDOVER_PROTOCOL PHOTO OTHER` — **brak wartości dla dokumentu prawnego i brak dla certyfikatu** |
| `apps/b2b-web/.../leads/actions.ts:78-104` | `getAuditors()` / `getCrews()` — istniejący, działający filtr puli przypisania (dziś: `is_active`/`aktywny` + ważność certyfikatów). To jest naturalny punkt zaczepienia dla warunku „ma zaakceptowane zgody" |
| `contracts/funnel.contract.mjs` | `T01 assignAuditor` ma guardy `auditorIsActive`, `auditorCertsValid`, `auditorDailyCapNotExceeded`; `T05 assignCrew` ma `crewCertsValid`, `crewCalendarFree`. Wzorzec „warunku dopuszczenia pracownika do zlecenia" **już istnieje w kontrakcie** |
| `apps/b2c-web` | strony Regulamin / Polityka prywatności są statyczne; **nigdzie w systemie nie ma edytora ani wersjonowania treści prawnej** |

### Brakuje

1. Tabeli (lub tabel) na treść dokumentu prawnego i jego wersje.
2. Rejestru akceptacji: kto, którą wersję, kiedy.
3. Wartości w `documents.kind` dla dokumentu prawnego — o ile w ogóle idziemy tą drogą (D-C).
4. Rozstrzygnięcia, czym jest „pracownik" w kluczu obcym: `audytorzy` i `zespoly_monterskie` to dziś
   dwie niepowiązane encje bez wspólnego nadrzędnego rekordu osoby.

## Zmiana kontraktu

**WYMAGANA.** Nowe encje w schemacie plus — przy wariancie „nowy zasób" — wpisy w `RESOURCES`
i wiersze w `MATRIX` (`R13-rbac` odrzuci zasób bez wiersza oraz `delete` przyznane komukolwiek
poza `admin`). Przy decyzji D-D wariant „guard" dotyka dodatkowo `contracts/funnel.contract.mjs`
(`GUARD_IDS` + guard na `T01`/`T05`), co jest zmianą maszyny stanów, nie samego słownika.

## Decyzje wymagające człowieka

### D-C — gdzie mieszkają wersjonowane dokumenty prawne

- **C1 — nowe zasoby**: `legal_documents` (rodzaj dokumentu) + `legal_document_versions` (treść/plik,
  numer wersji, moment opublikowania, znacznik „obowiązująca") + `employee_consents` (akceptacje).
  Czysty model, ale dokłada 2-3 pozycje do `RESOURCES` i tyleż wierszy do `MATRIX`.
- **C2 — rozszerzenie `documents`** o `kind = LEGAL_TERMS` / `LEGAL_RODO` i o wersjonowanie.
  Mniej encji, ale `documents` jest dziś zasobem **per rekord biznesowy** (oferta, protokół, zdjęcie)
  z `create` przyznanym audytorowi i monterowi — czyli pracownik miałby prawo tworzenia dokumentu
  tej samej klasy, którą ma tylko akceptować. To trzeba by rozłączyć wewnątrz jednego zasobu,
  a macierz RBAC nie rozróżnia rodzajów w obrębie zasobu.

Powiązane pytanie, którego żaden dokument nie rozstrzyga: **czy zgody B2C (klient,
`B2C-CONSENT-RODO`) i zgody pracownicze mają dzielić ten sam rejestr wersji.** Argument za: `B2C-CONTENT-PAGES`
żąda, żeby wersja prezentowana klientowi była tą samą wartością, którą zapisuje zgoda — czyli
klient też potrzebuje wersjonowanego źródła treści. Argument przeciw: inny odbiorca, inny cykl życia,
inne podstawy prawne.

**WYMAGA DECYZJI: C1 czy C2, i czy rejestr wersji jest wspólny dla klienta i pracownika.**

### D-D — gdzie brak zgody blokuje pracę

D4 mówi: „pracownik musi zaakceptować zgody i regulamin **przed podjęciem zleceń**". To zdanie ma
dwa różne odczytania i różne konsekwencje kontraktowe:

- **D-D1 — guard przy przypisaniu.** Nowy guard (np. `workerConsentsAccepted`) na `T01` i `T05`.
  Administrator nie może przypisać zlecenia pracownikowi bez aktualnych zgód. Egzekwowane w tym samym
  miejscu co `auditorCertsValid`, testowalne **dziś**, bez Field App. Koszt: zmiana maszyny stanów.
- **D-D2 — filtr puli przypisania.** Pracownik bez zgód nie pojawia się w `getAuditors()`/`getCrews()`.
  Bez zmiany maszyny stanów, ale bez guarda przypisanie z pominięciem interfejsu nadal przechodzi.
- **D-D3 — blokada po stronie Field App** („pracownik nie może otworzyć zlecenia"). Zgodne z literalnym
  brzmieniem D4, ale **niemożliwe do przetestowania przed fazą 3** i najsłabsze: zlecenie jest już
  przypisane, klient już dostał `N1`.

Rekomendacja analityczna (do potwierdzenia, nie do przyjęcia w milczeniu): D-D1 **razem z** D-D2 —
guard jako reguła, filtr puli jako ergonomia. Dokładnie ten układ ma dziś `is_active`: guard
`auditorIsActive` w kontrakcie i filtr `where: { is_active: true }` w puli.

**WYMAGA DECYZJI: który punkt egzekwowania, i czy dopuszczamy zmianę `funnel.contract.mjs` w fazie 0.**

## Kryteria akceptacji (do domknięcia po decyzjach)

- [ ] **AC1** Wgranie nowej treści dokumentu tworzy **nową wersję**; treść wersji już opublikowanej
      pozostaje niezmieniona — test odczytuje starą wersję po opublikowaniu nowej i porównuje bajt w bajt.
- [ ] **AC2** W danym momencie dokładnie **jedna** wersja danego rodzaju dokumentu jest obowiązująca.
      Gwarantuje to ograniczenie w bazie (częściowy indeks unikalny), nie sprawdzenie w kodzie —
      test próbuje oznaczyć dwie wersje jako obowiązujące i oczekuje odrzucenia przez bazę.
- [ ] **AC3** Akceptacja zapisuje **kto, którą wersję i kiedy**; wskazanie wersji jest kluczem obcym,
      nie tekstem. Próba zapisu akceptacji wskazującej na nieistniejącą wersję jest odrzucona przez bazę.
- [ ] **AC4** Ponowna akceptacja tej samej wersji przez tego samego pracownika nie tworzy drugiego
      wpisu — ograniczenie unikalności, nie sprawdzenie „czy istnieje" przed zapisem (to drugie
      przegrywa wyścig przy dwóch równoległych żądaniach).
- [ ] **AC5** Opublikowanie nowej wersji **nie modyfikuje ani nie unieważnia** istniejących wpisów
      akceptacji — po publikacji test odczytuje wpis sprzed niej i sprawdza, że wskazuje starą wersję
      z niezmienionym znacznikiem czasu (odpowiednik ostatniego kryterium `B2C-CONSENT-RODO`).
- [ ] **AC6** Wersji, do której odwołuje się jakakolwiek akceptacja, nie da się usunąć — próba kończy
      się odmową, nie kaskadą i nie osieroconym wpisem.
- [ ] **AC7** Tworzenie i publikowanie wersji przysługuje wyłącznie roli `admin`; próba wykonania tej
      operacji z konta `dyspozytor`, `audytor` lub `monter` jest odrzucona **po stronie serwera**
      (Prisma omija RLS — brak sprawdzenia roli w Server Action to podatność, nie niedopatrzenie).
- [ ] **AC8** Pracownik bez akceptacji obowiązującej wersji nie może otrzymać zlecenia — dokładny
      punkt egzekwowania wg decyzji D-D; test odtwarza go z pominięciem interfejsu.
- [ ] **AC9** Zmiana obowiązującej wersji sprawia, że pracownik z akceptacją **poprzedniej** wersji
      przestaje spełniać warunek — jego wcześniejsza akceptacja pozostaje w rejestrze nienaruszona.
- [ ] **AC10** `kk-validate`, `kk-selftest`, `kk-codegen --check` zielone; przy nowych zasobach
      `R13-rbac` przechodzi (wiersz w `MATRIX` dla każdego zasobu, `delete` wyłącznie `admin`).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Publikacja nowej wersji w trakcie akceptowania starej.** Pracownik otwiera dokument, administrator
  publikuje nową wersję, pracownik klika „akceptuję". Zapisana wersja musi być tą, którą pracownik
  widział — albo operacja ma zostać odrzucona. Cicha akceptacja treści, której nikt nie przeczytał,
  jest bezwartościowa dowodowo (a to jest jedyny powód, dla którego ten rejestr istnieje).
- **Dwa równoległe żądania akceptacji tej samej wersji** (AC4) — dokładnie jeden wpis.
- **Dwie wersje oznaczone jako obowiązujące** (AC2) — sprawdzenie w bazie, nie w kodzie.
- **Pracownik należący do obu światów.** Ta sama osoba jako audytor i jako przedstawiciel ekipy:
  jedna akceptacja czy dwie? Dziś `audytorzy` i `zespoly_monterskie` nie mają wspólnego rekordu osoby,
  więc odpowiedź „jedna" wymaga trzeciej encji.
- **Strefa czasowa momentu akceptacji.** `timestamptz`; „zaakceptował przed przypisaniem" liczone na
  znacznikach, nie na datach kalendarzowych.
- **Retencja RODO.** `AUDIT_REQUIREMENTS.retentionDays = 1825`. Czy rejestr akceptacji podlega temu
  samemu okresowi, czy dłuższemu (dowód wobec organu)? Wpływa na to, czy usunięcie konta pracownika
  kasuje jego akceptacje — patrz Ryzyka R2.

## Poza zakresem

- Interfejs administratora do wgrywania treści (`implementer-ui`, po tym WO).
- Interfejs akceptacji w Field App (faza 3).
- Przechowywanie **plików certyfikatów** (F-Gaz, SEP) — pokrewny brak (`documents.kind` nie ma
  `CERTIFICATE`), ale to pytanie otwarte 5 i osobna decyzja. Nie doklejać do tego WO.
- Zgody klienckie w B2C (`B2C-CONSENT-RODO`) — chyba że decyzja D-C połączy rejestry wersji; wtedy
  zakres rośnie i WO wymaga ponownego oszacowania.
- Migracja treści dzisiejszych statycznych stron Regulaminu / Polityki prywatności do nowego modelu.

## Ryzyka i nieznane

- **R1 — „pracownik" nie jest dziś encją.** Klucz obcy w rejestrze akceptacji musi wskazać `audytorzy`
  albo `zespoly_monterskie`. Dwie nullowalne kolumny z warunkiem „dokładnie jedna niepusta" to
  rozwiązanie działające, ale rozjeżdżające się przy trzeciej roli (serwisant). Trzecia encja
  („osoba") to większa zmiana, niż wygląda.
- **R2 — usunięcie konta pracownika a dowód zgody.** `SEC-RODO-DELETE` anonimizuje dane klienta
  z zachowaniem historii. Dla pracownika analogicznej reguły nie ma. Jeżeli usunięcie kasuje
  akceptacje, tracimy dowód, że w chwili wykonywania pracy zgody były udzielone.
- **R3 — „treść" to plik czy tekst.** Plik w Storage wymaga własnego bucketu i polityk (dziś istnieją
  tylko `audytorzy` i `zespoly`, oba na awatary). Tekst w bazie upraszcza wersjonowanie i porównywanie,
  ale kończy się edytorem treści w panelu. Żaden dokument tego nie rozstrzyga.
- **R4 — kolizja z fazą 1.** ADR-012 planuje migrację dziesięciu tabel, w tym `documents`. Jeżeli
  D-C wybierze wariant C2 (rozszerzenie `documents`), ten WO wchodzi w kolizję z fazą 1 i powinien
  zostać po niej ustawiony w kolejce, nie przed nią.

---

## D-C i D-D — ROZSTRZYGNIĘTE (człowiek, 2026-08-21)

**D-C: dokumenty prawne to NOWY zasób RBAC**, nie rozszerzenie `documents`. Wersjonowanie treści,
edycja wyłącznie dla administratora. Skutek dla R4: ten WO **nie wchodzi w kolizję z fazą 1** (migracja
ADR-012) i nie musi być za nią ustawiony w kolejce.

**D-D: brak akceptacji zgód blokuje pracę dopiero w Field App**, nie wcześniej. Nie dotykamy maszyny
stanów (żadnego guardu przy `T01`/`T05`) ani puli przypisań w panelu. Uzasadnienie: blokada w panelu
sprawiłaby, że administrator widzi zniknięcie pracownika z listy bez czytelnego powodu, a guard przy
przejściu wymagałby własnych testów maszyny stanów za korzyść, której v1 nie potrzebuje — pracownik
bez zaakceptowanych zgód i tak nie wejdzie do aplikacji, w której wykonuje się zlecenie.

**Konsekwencja dla kolejności:** egzekwowanie blokady należy do fazy 3 (Field App v1). Ten WO dowozi
wyłącznie model danych, treść zarządzaną przez administratora i rejestr akceptacji.
