# WO: FLD-QUOTE-VARIANTS — warianty, wysłanie z zamrożeniem cen, wybór wariantu i zaliczka (WO-P5)

**Status: gotowy do przekazania test-authorowi po scaleniu WO-P3 i WO-P4, z potwierdzeniem D-P5.**
Dwa wymagania HIGH — obowiązkowy przegląd człowieka przed merge. Indeks: `PRICE-LIST-VAT.md`.

## Wymagania

- `FLD-QUOTE-VARIANTS` (**HIGH**, `TODO`) — AC5 domykany tu tylko w części ofertowej (umowa
  i faktura są konsumentami strażnika z tego WO; blokada w nich to `FLD-CONTRACT-GENERATE`, `INV-*`).
- `FLD-QUOTE-PRICE-SNAPSHOT` (**HIGH**, `TODO`) — AC5 (wycena z Triage) **poza tym WO**, patrz niżej.
- `FLD-QUOTE-MANUAL-ITEM` AC4 (zamrożenie ceny pozycji indywidualnej).
- Styk z `FNL-E2-E3` (B4): „Utworzenie quote ustawia status SENT i ważność = now + QUOTE_VALIDITY",
  „Status leada zmienia się bez akcji dyspozytora", „Kolejkowane jest N4". Ten WO dostarcza
  **zamrożenie i ustawienie ważności**; przejście T02 i N4 dokłada B4 w tej samej transakcji.

## Kontekst kodu

### Istnieje

- `quotes` (`status` CHECK `DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED`, `property_kind`,
  `vat_rate_percent` CHECK `8|23`, `selected_variant_id` z FK `ON DELETE SET NULL` i częściowym
  UNIQUE, `deposit_amount_gross`, `sent_at`, `valid_until`), `quote_variants` (`variant_number`
  CHECK `IN (1,2,3)`, UNIQUE `(quote_id, variant_number)`, `total_net_amount`, `equipment_net_amount`) —
  `supabase/migrations/20260925090000_price_list_and_quotes.sql`.
- **Brak CHECK, że `selected_variant_id` należy do tej samej oferty** — FK wskazuje dowolny wariant.
- `SLA.QUOTE_VALIDITY.days` = 14 (`packages/contracts/src/generated/sla.ts:9`). Precedens liczenia
  dni: `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:64` (`SLA.….days * 24 * 60 * 60 * 1000`).
- Enum Prisma `QuoteStatus` (`schema.prisma:431`: `DRAFT|SENT|ACCEPTED|REJECTED`, bez `EXPIRED`)
  **nie jest używany** przez `model Quote` (`status String`). Nie używać go w kodzie — rozjazd
  z CHECK w bazie.
- Silnik (P3), operacje szkicu (P4), publikacja wersji ceny (P1).

### Brakuje

- Tworzenia oferty i wariantów, wysłania, wyboru wariantu — w całym repo.

## Zmiana kontraktu

**NIEWYMAGANA.** Kandydaci do okna kontraktowego (nie warunek): CHECK/wyzwalacz „wybrany wariant
należy do oferty"; kolumna zaliczki per wariant (patrz Ryzyka).

## WYMAGA DECYZJI (potwierdzenia)

### D-P5 — skąd cena netto zestawu urządzeń

Wzór D8 liczy zaliczkę z „ceny netto zestawu urządzeń", a `quote_variants` ma tylko
`equipment_net_amount` — bez wskazania urządzeń z `indoor_units`/`outdoor_units`. Katalog urządzeń
na tablecie (N5) jest w `FIELD-APP-I-PODPISY-ZAKRES.md` M7 „później (osobna decyzja)".
**Rekomendacja:** cena zestawu jest **daną wejściową wpisywaną przez audytora** (jak cena pozycji
indywidualnej), wymaganą jawnie przy wysyłce (0.00 dozwolone — klient ma własne urządzenia; `NULL`
nie). Zgodne z CALC AC4: serwer nie przyjmuje z urządzenia **wyliczonych** kwot, a cena zestawu nie jest
wyliczana. Wyliczanie z katalogu wymaga zmiany schematu — okno kontraktowe.

## Kryteria akceptacji (wykonalne)

Tagi: `// @REQ: FLD-QUOTE-VARIANTS`, `// @REQ: FLD-QUOTE-PRICE-SNAPSHOT`, `// @REQ: FLD-QUOTE-MANUAL-ITEM`.
Wszystkie na żywej bazie (`*.itest.ts`), z arkuszem zaimportowanym funkcją z WO-P1.

### Warianty i zaliczka (VARIANTS)

- [ ] **AC-W1** Utworzenie oferty dla leada daje ofertę `DRAFT` z wariantem nr 1 i rodzajem obiektu
  podpowiedzianym z Triage (P3, AC-V4). Dodanie wariantu przydziela najniższy wolny numer;
  czwarty wariant jest odrzucany błędem domenowym, a surowy `INSERT` z `variant_number = 4` odrzuca
  baza. Oferta bez wariantu nie istnieje (ostatniego wariantu nie da się usunąć).
- [ ] **AC-W2** Zaliczka wg D8 ze stawki obiektu: oferta z wariantem, zestaw 10 000.00 netto,
  wysłana i wybrana — dla `RESIDENTIAL_UP_TO_THRESHOLD` `deposit_amount_gross` = **11 880.00**, dla
  `COMMERCIAL` = **13 530.00** (dwa przypadki w jednym teście).
- [ ] **AC-W3** Zaliczka jest zapisana na ofercie przy wyborze wariantu i odczytywana, nie liczona
  ponownie: funkcja odczytu zaliczki (dla umowy/faktury) zwraca wartość kolumny — test nadpisuje
  kolumnę w fiksturze wartością różną od wzoru i oczekuje wartości kolumny.
- [ ] **AC-W4** Reguła kontrolna R16: wysłanie oferty, w której **którykolwiek** wariant ma zaliczkę
  większą od swojej wartości brutto (zestaw + montaż), jest odrzucane błędem domenowym wskazującym
  wariant; oferta zostaje `DRAFT`, żadne pole się nie zmienia. Przykład przy 23%: zestaw 10 000.00,
  montaż 500.00 → wartość brutto 12 915.00 < zaliczka 13 530.00 → odmowa. Granica: montaż 1000.00 →
  wartość 13 530.00 = zaliczka → wysłanie **dozwolone** („nigdy nie przekracza").
- [ ] **AC-W5** Wybór wariantu zapisuje `selected_variant_id` na ofercie. Wybór wariantu innej oferty,
  wybór w ofercie `DRAFT`, `REJECTED`, `EXPIRED` albo po `valid_until` — odrzucone, stan bez zmian.
  Strażnik „gotowa do umowy/faktury" zwraca odmowę dla oferty bez wybranego wariantu i zgodę po wyborze.
- [ ] **AC-W6** Wysłanie ustawia `status='SENT'`, `sent_at` = chwila wysłania i
  `valid_until = sent_at + SLA.QUOTE_VALIDITY.days × 24 h`. Test podmienia wartość SLA (np. na 10)
  i oczekuje 10 dni — literał 14 w kodzie oblewa test.

### Zamrożenie (PRICE-SNAPSHOT)

- [ ] **AC-F1** Przy wysłaniu każda pozycja cennikowa ma `unit_price_net` równe cenie sprzedaży wersji
  **bieżącej w chwili wysłania** i `price_list_item_version_id` wskazujący tę wersję (także gdy szkic
  powstał przy starszej cenie). `quotes.vat_rate_percent` i `quote_variants.total_net_amount` są
  zapisane.
- [ ] **AC-F2** Po wysłaniu: opublikowanie nowej ceny każdej pozycji użytej w ofercie i wycofanie jednej
  z nich nie zmienia sumy netto, VAT, brutto ani zaliczki żadnego wariantu tej oferty.
- [ ] **AC-F3** Odtworzenie oferty wysłanej (funkcja odczytu kwot z danych zamrożonych — **nie**
  z cennika) zwraca dokładnie te same kwoty (netto, VAT, brutto, zaliczka per wariant), które zwróciła
  operacja wysłania. Sprawdzane na ofercie po zmianie cennika, nie na świeżo policzonej.
- [ ] **AC-F4** Zamrożenie obejmuje stawkę i zaliczkę: po wysłaniu zmiana rodzaju obiektu jest
  odrzucana (P3, AC-V5), a zaliczka wybranego wariantu pozostaje bez zmian po zmianie cennika.
  Pozycja indywidualna zachowuje cenę wpisaną przez audytora — wysłanie jej nie przelicza
  (MANUAL-ITEM AC4).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Podwójne wysłanie** (powtórzone żądanie, dwa równoległe wywołania): dokładnie jedno się udaje,
  drugie kończy się błędem domenowym „oferta już wysłana"; `sent_at`, `valid_until` i ceny z pierwszego
  wysłania pozostają. Nośnik: warunkowy zapis `WHERE status='DRAFT'` albo blokada wiersza — nie
  sprawdzenie w JS.
- **Publikacja ceny równolegle z wysłaniem:** każda pozycja oferty ma cenę z jednej, spójnej wersji;
  ceny wszystkich pozycji czytane jednym zapytaniem wewnątrz transakcji wysłania.
- **Wysłanie z pozycją wycofaną z cennika** (szkic sprzed wycofania) — odrzucone z listą takich pozycji.
- **Wysłanie bez rodzaju obiektu** albo z wariantem bez ceny zestawu (`NULL`) — odrzucone.
- **Wysłanie wariantu pustego** (bez pozycji i z zestawem 0.00) — odrzucone.
- **Ponowny wybór:** ten sam wariant drugi raz — bez zmian i bez błędu; **inny** wariant po wyborze —
  odrzucony (rekomendacja; patrz Ryzyka).
- **Transakcja wołającego:** funkcja wysłania działa na przekazanym kliencie transakcyjnym i nie
  zmienia statusu leada ani nie dotyka `notification_queue` — test sprawdza zero zapisów w tych
  tabelach (to należy do B4, w tej samej transakcji).
- **Strefa czasowa:** `valid_until` liczone od `sent_at` w UTC; wysłanie tuż przed zmianą czasu
  (ostatnia niedziela marca/października) daje dokładnie N × 24 h.

## Poza zakresem

- Przejście T02, powiadomienie N4, link akceptacyjny (`FNL-E2-E3`, B4).
- Zmiana statusu na `ACCEPTED`/`REJECTED`/`EXPIRED` (akceptacja klienta — `FNL-E3-E4`; wygasanie —
  `FNL-E3-BUCKET`).
- **`FLD-QUOTE-PRICE-SNAPSHOT` AC5 (wycena z Triage).** Dziś Triage zapisuje jednorazowo tekst
  `"<kwota> PLN netto"` w `leady.estymowana_wycena` (`apps/b2c-web/app/actions/saveLead.ts:67-83`),
  liczony z `cennik_uslug`, nie z nowego cennika. Kryterium ma sens dopiero z
  `B2C-TRIAGE-PRICE-FROM-PRICE-LIST` i tam powinno zostać domknięte. Skutek: po tym WO
  `FLD-QUOTE-PRICE-SNAPSHOT` NIE jest `DONE`.
- Dokument PDF oferty, e-mail do klienta.
- Autoryzacja (`quotes:create` audytor/admin, `update` `audytor:own`/admin) — w wołającym (B3).

## Ryzyka i nieznane

- **Wartość oferty obejmuje zestaw urządzeń.** R16 („przy tanim montażu 110% ceny brutto urządzeń
  może wyjść więcej niż oferta") ma sens tylko wtedy, gdy oferta = urządzenia + montaż. Tak liczy
  `total_net_amount` w tym WO. Jeżeli intencja była inna, zmienia się AC-W4.
- **Zaliczka per wariant nie jest zapisana** — klient widzi w ofercie zaliczkę każdego wariantu,
  a baza przechowuje tylko zaliczkę wybranego. Odtworzenie zaliczek niewybranych wariantów zależy
  od niezmienności wzoru i mnożnika 1,1 w kodzie (nie w kontrakcie).
- **Zmiana wybranego wariantu** przez klienta przed wpłatą — dokumenty milczą. Rekomendacja „odrzuć"
  chroni proformę (`INV-PROFORMA` powstaje przy akceptacji na kwotę zaliczki); jeśli biznes chce
  zmiany zdania, potrzebna reguła unieważnienia proformy.
- Cena w szkicu może się zmienić przy wysłaniu (AC-F1) — audytor musi zobaczyć kwoty zwrócone przez
  wysłanie, nie te z ekranu szkicu. Wymóg dla B3.

## Kolejność ról

`test-author` → `implementer-server` (`apps/b2b-web/src/lib/pricing/`) → `/kk-verify` → przegląd
człowieka (HIGH).
