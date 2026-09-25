# WO: FLD-QUOTE-ROOMS — szkic oferty: pomieszczenia, pozycje ogólne, pozycje indywidualne (WO-P4)

**Status: gotowy do przekazania test-authorowi po scaleniu WO-P1 (pozycje w bazie) i WO-P3 (silnik).**
Indeks strumienia: `PRICE-LIST-VAT.md`.

## Wymagania

- `FLD-QUOTE-ROOMS` (MEDIUM, `TODO`).
- `FLD-QUOTE-GENERAL-ITEMS` (MEDIUM, `TODO`).
- `FLD-QUOTE-MANUAL-ITEM` (LOW, `TODO`) — AC4 (zamrożenie ceny pozycji indywidualnej) testowane w WO-P5.
- Styk z `FLD-AUDIT-FORM` (B3/B8): „pomieszczenia są rekordami powiązanymi z wariantem oferty" —
  ten WO dostarcza te rekordy i operacje na nich; formularz w aplikacji terenowej to B3/B8.

## Kontekst kodu

### Istnieje

- `quote_rooms` (`name NOT NULL`, `power_kw NUMERIC(6,2)` nullowalne, `position`, FK do wariantu
  `ON DELETE CASCADE`) i `quote_items` — `supabase/migrations/20260925090000_price_list_and_quotes.sql`:
  - `quote_items_scope_room_consistency_check`:
    `(scope='ROOM' AND quote_room_id IS NOT NULL) OR (scope='INSTALLATION' AND quote_room_id IS NULL)`,
  - `quote_items_catalog_xor_manual_check`: `num_nonnulls(price_list_item_id, manual_name) = 1`,
  - `quote_items_manual_requires_description_check`: `manual_name IS NULL OR manual_description IS NOT NULL`,
  - `quote_items_quantity_positive_check`: `quantity > 0`,
  - `quote_room_id … ON DELETE CASCADE`, `price_list_item_id … ON DELETE RESTRICT`.
- `quote_items.scope` jest **zdenormalizowany** z `price_list_items.scope` (komentarz
  nad `model QuoteItem`, `schema.prisma:1416`). CHECK nie sięga do innej tabeli.
- Silnik wyceny i schemat Zod wejścia — WO-P3. Funkcja publikacji wersji i pozycje z arkusza — WO-P1.
- RBAC `quotes`: `create: audytor, admin`, `update: audytor:own, admin` (`contracts/rbac.contract.mjs:103`).

### Brakuje

- Jakichkolwiek operacji na `quote_rooms`/`quote_items` w kodzie (`grep quoteItem|quoteVariant`
  po `apps/` — zero wyników).

### Luki w bazie, które MUSI zamknąć serwer (baza ich nie pilnuje)

1. **Zgodność `quote_items.scope` z zasięgiem pozycji cennika.** Pozycję cennika `INSTALLATION`
   można zapisać z `scope='ROOM'` i pomieszczeniem — CHECK przepuści. Serwer ustala `scope`
   **z pozycji cennika**, nigdy z wejścia.
2. **Pomieszczenie z tego samego wariantu.** `quote_items.quote_room_id` może wskazywać
   pomieszczenie innego wariantu (albo innej oferty) — brak ograniczenia.
3. **Wersja ceny należąca do tej pozycji.** `price_list_item_version_id` może wskazywać wersję
   innej pozycji — brak ograniczenia.
4. **Opis pozycji indywidualnej niepusty.** CHECK przepuszcza `''` i `'   '`.
5. **Edycja tylko w `DRAFT`.** Baza pozwala zmieniać pozycje oferty wysłanej.

## Zmiana kontraktu

**NIEWYMAGANA.** Luki 1–3 dałoby się zamknąć w bazie (wyzwalacz albo złożony klucz obcy) —
kandydat do okna kontraktowego, nie warunek tego WO.

## Kryteria akceptacji (wykonalne)

Tagi: `// @REQ: FLD-QUOTE-ROOMS`, `// @REQ: FLD-QUOTE-GENERAL-ITEMS`, `// @REQ: FLD-QUOTE-MANUAL-ITEM`.
Testy na żywej bazie: `*.itest.ts`; fikstura zakłada leada, ofertę `DRAFT` z wariantem 1 bezpośrednio
przez Prismę (tworzenie oferty i wariantów to WO-P5) i importuje arkusz funkcją z WO-P1.

### Pomieszczenia (ROOMS)

- [ ] **AC-R1** Zapytanie o pozycje części „pomieszczenie" zwraca wyłącznie aktywne pozycje `ROOM`
  (po imporcie arkusza: 23), żadnej `INSTALLATION`. Dodanie pozycji cennika `INSTALLATION` (np.
  `uruchomienie`) do pomieszczenia jest odrzucane błędem domenowym, **zero wierszy** w `quote_items`;
  pole `scope` przysłane w wejściu nie ma wpływu na zapis.
- [ ] **AC-R2** Pozycja `ROOM` bez pomieszczenia: serwer odrzuca błędem domenowym; ponadto zapis
  z pominięciem serwera (surowy `INSERT` w teście) odrzuca baza (`quote_items_scope_room_consistency_check`).
- [ ] **AC-R3** Pomieszczenie wymaga niepustej nazwy (spacje brzegowe obcięte, pusta → błąd) i
  przyjmuje moc jednostki wpisaną ręcznie (liczba > 0, do dwóch miejsc po przecinku) albo jej brak;
  system nie wylicza mocy. Pomieszczenie należy do wskazanego wariantu. Dodanie pozycji do
  pomieszczenia **innego wariantu** niż wariant pozycji jest odrzucane (luka 2).
- [ ] **AC-R4** Usunięcie pomieszczenia usuwa wszystkie jego pozycje; pozycje innych pomieszczeń
  i pozycje ogólne tego wariantu pozostają nietknięte (liczność przed i po).
- [ ] **AC-R5** Ta sama pozycja cennika (`instalacja freonowa 1/4 i 3/8`) dodana do dwóch pomieszczeń
  z ilościami 3 i 5 daje dwa wiersze, a suma netto wariantu obejmuje 8 mb × 130.00 = 1040.00.

### Pozycje ogólne (GENERAL-ITEMS)

- [ ] **AC-G1** Zapytanie o pozycje części „ogólne" zwraca wyłącznie aktywne pozycje `INSTALLATION`
  (po imporcie: 16), w tym pięć wariantów montażu jednostki zewnętrznej, `wysokość jedn zew`,
  `zwyżka`, `uruchomienie`, `przejście dachowe`, `Zabezpieczenie wykończonego mieszkania do bruzdowania`.
- [ ] **AC-G2** Pozycja `INSTALLATION` z pomieszczeniem: serwer odrzuca; surowy `INSERT` odrzuca baza.
  Pozycja `INSTALLATION` zapisana bez pomieszczenia jest odczytywana jako pozycja ogólna wariantu,
  a pozycja `ROOM` bez pomieszczenia nie istnieje w żadnym stanie — nie ma „nieuzupełnionego
  pomieszczenia" (brak pomieszczenia ma znaczenie domenowe).
- [ ] **AC-G3** Pozycje zasilania (`dł przewodu zasilającego`, `wpięcie zasilania do rozdzielni`,
  `wpięcie zasilania do gniazda na sztywno`, `wpięcie zasilania do gniazda na wtyczke`,
  `bruzdowanie na przewód zasilający`, `bruzdowanie na przewód zasilający w żelbecie`) są w części
  ogólnej i nie ma ich w części „pomieszczenie".
- [ ] **AC-G4** Wariant wyłącznie z pozycjami ogólnymi (bez pomieszczeń): `uruchomienie` 1 × 400.00
  i `dł przewodu zasilającego` 5 × 15.00, urządzenia 0, obiekt `RESIDENTIAL_UP_TO_THRESHOLD` →
  netto **475.00**, brutto **513.00**.

### Pozycje indywidualne (MANUAL-ITEM)

- [ ] **AC-M1** Pozycja indywidualna wymaga nazwy, **niepustego opisu** (`''` i same spacje
  odrzucone przez serwer — luka 4) i ceny jednostkowej netto ≥ 0. Brak któregokolwiek → błąd
  domenowy, zero wierszy. Audytor wskazuje, czy pozycja należy do pomieszczenia (`ROOM` + pomieszczenie),
  czy do całej instalacji (`INSTALLATION` bez pomieszczenia).
- [ ] **AC-M2** Dodanie pozycji indywidualnej nie zmienia liczby wierszy w `price_list_items`
  i `price_list_item_versions`; pozycja ma `price_list_item_id IS NULL`.
- [ ] **AC-M3** Pozycja indywidualna wchodzi do sumy netto i brutto wariantu na tych samych
  zasadach co cennikowa: wariant z AC-G4 + pozycja indywidualna „stelaż" 1 × 350.00 → netto 825.00,
  brutto przy 8% **891.00**, przy 23% **1014.75**.

## Przypadki brzegowe, które MUSZĄ mieć test

- **Oferta nie w `DRAFT`** (`SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`): dodanie/usunięcie pomieszczenia,
  dodanie/usunięcie pozycji, zmiana ilości — odrzucone, stan bez zmian (luka 5).
- **Pozycja cennika nieaktywna** — nie pojawia się w AC-R1/AC-G1 i nie da się jej dodać.
- **Pozycja bez wersji bieżącej** (stan awaryjny) — dodanie kończy się błędem domenowym, nie zapisem
  z ceną 0.
- **Cena zapisana przy dodaniu** — `unit_price_net` = cena sprzedaży wersji bieżącej, a
  `price_list_item_version_id` wskazuje tę wersję i należy do tej samej pozycji (luka 3). Cena
  przysłana w wejściu dla pozycji cennikowej jest ignorowana.
- **Ilość ≤ 0 albo nieliczbowa** — błąd domenowy po polsku, nie surowy błąd CHECK.
- **Ta sama pozycja dwa razy w tym samym pomieszczeniu** — dozwolone (dwa wiersze) albo scalane;
  zachowanie ma być jedno i przetestowane. Rekomendacja: dozwolone, bez scalania.

## Poza zakresem

- Tworzenie oferty i wariantów, wysyłka, wybór wariantu, zamrożenie (WO-P5).
- Formularz audytora, tryb offline, klucz idempotencji (B3: `FLD-API-LAYER`, `FLD-OFFLINE-OUTBOX`).
- Autoryzacja `audytor:own` — w wołającym (B3), patrz uwagi przekrojowe w indeksie.
- Kolejność pomieszczeń (`position`) i zmiana nazwy pomieszczenia.

## Ryzyka i nieznane

- **`zwyżka` i montaż „na stelażu" występują w dwóch rolach.** `FLD-QUOTE-MANUAL-ITEM` podaje je
  jako przykłady pozycji indywidualnych („stelaż, zwyżka"), `CENNIK-ROBOCIZNY.md` pkt 5 każe wyłączyć
  `wysokość jedn zew` i `zwyżka` „z automatycznego kalkulatora", a jednocześnie arkusz ma je jako
  pozycje cennika `INSTALLATION` (zwyżka 700.00, stelaż 350.00), a `FLD-QUOTE-GENERAL-ITEMS` AC1 każe
  je pokazywać w części ogólnej. Odczyt spójny ze wszystkimi trzema: w formularzu audytora są
  wybieralne z cennika **i** audytor może zamiast nich dodać pozycję indywidualną z inną ceną;
  „wyłączenie z automatu" dotyczy montażu standardowego w Triage (`STD-INSTALL-CONFIG`). Ten WO
  zakłada ten odczyt; jeśli Michał chce, żeby zwyżka NIE była wybieralna z cennika, zmienia się AC-G1.
- Moc jednostki opcjonalna w szkicu — czy wymagana przy wysyłce, dokumenty nie mówią.

## Kolejność ról

`test-author` → `implementer-server` (`apps/b2b-web/src/lib/pricing/` — operacje szkicu) → `/kk-verify`.
