# Cennik robocizny — pozycje kosztorysowe

Źródło: arkusz Google „Formularz wyceny" udostępniony przez Michała 2026-09-23.
Odczytany i zapisany w repozytorium jako [`cennik-robocizny.csv`](cennik-robocizny.csv) — ten plik CSV jest
materiałem wejściowym dla wymagania `PRICE-LIST-IMPORT` (moduł M9, patrz
[zakres Field App i podpisów](../workorders/FIELD-APP-I-PODPISY-ZAKRES.md)).

**Pozycji: 39.** Plan architektury mówił o 35 — to nieaktualna liczba.
Jednostki miary: `mb`, `szt`, `m`. Kategorie: `Materiał`, `Robocizna`, `Robocizno-materiał`.

Kolumny arkusza:

| Kolumna w arkuszu | Znaczenie | Nazwa w CSV |
|---|---|---|
| Materiał / Robocizna / Robocizno-Materiał | kategoria pozycji | `category` |
| Pozycja | nazwa pozycji | `item_name` |
| Opis | opis dla klienta | `description` |
| Jednostka miary | `mb`, `szt`, `m` | `unit` |
| KOSZT NETTO Ekip monterskich | ile płacimy ekipie albo ile kosztuje materiał | `crew_cost_net` |
| (dodane przeze mnie, nie ma w arkuszu) | czy pozycja należy do pomieszczenia czy do całej instalacji | `scope` |
| PRZYCHÓD NETTO KlikKlima do rozliczenia z ekipą monterską | cena sprzedaży netto | `sale_price_net` |

## Czego w arkuszu nie ma, a schemat będzie potrzebował

1. **Brak stawki VAT.** Wszystkie kwoty są netto. **Rozstrzygnięte 2026-09-23:** stawka nie jest
   atrybutem pozycji, tylko wynika z obiektu — lokal mieszkalny do 300 m² to 8%, powyżej 300 m² to 23%,
   lokal usługowy to 23%. Oznacza to, że wycena musi znać **powierzchnię lokalu** i **jego przeznaczenie**,
   a tych danych Triage dziś nie zbiera (pyta o metraż pomieszczeń, nie lokalu).
2. **13 pozycji nie ma kosztu ekipy** — w tym wszystkie czysto robociznowe: `podłączenie ściennej`,
   `podłączenie kanałówki/kasety`, `uruchomienie`, `przewiert`, `przewiert w żelbecie` oraz całe
   `bruzdowanie`. Bez tego nie da się policzyć marży na pozycji ani rozliczenia z ekipą.
3. **5 pozycji nie ma kategorii ani opisu** — cała grupa montażu jednostki zewnętrznej
   (`stojak`, `stelaż z profili`, `wisi do 3m`, `wisi na kominie`, `wysokość jedn zew`).
4. **Brak flagi zaliczkowej `FZ`** opisanej w planie. Po decyzji D8 (zaliczka = 110% ceny brutto
   urządzeń) nie jest już potrzebna do liczenia zaliczki.
5. **`wysokość jedn zew`** (250 zł za metr) oraz **`zwyżka`** to pozycje, które plan każe wyłączyć
   z automatycznego kalkulatora — wycena indywidualna.

## Podział pozycji: pomieszczenie czy cała instalacja

Kolumna `scope` w CSV (dodana 2026-09-23, **moja propozycja do zatwierdzenia**) mówi, czy pozycja
należy do konkretnego pomieszczenia, czy do całej instalacji. Formularz wyceny audytora ma dwie
części właśnie z tego powodu (patrz D17 w dokumencie zakresu).

| `scope` | Ile pozycji | Co to jest | Przykłady |
|---|---|---|---|
| `ROOM` | 23 | wszystko, co idzie „na jednostkę wewnętrzną": trasa, odprowadzenie skroplin, przebicia, podłączenie | instalacja freonowa, koryta, przewiert, skropliny, syfon, pompka, podłączenie ściennej, bruzdowanie tras |
| `INSTALLATION` | 16 | wszystko, co jest wspólne dla całego układu, niezależnie od liczby pomieszczeń | montaż jednostki zewnętrznej (5 wariantów), wysokość jedn. zew., zasilanie i jego bruzdowanie, wpięcie zasilania, uruchomienie, przejście dachowe, zabezpieczenie mieszkania, zwyżka |

Dwie rzeczy warte uwagi przy zatwierdzaniu:

1. **Zasilanie jest wspólne** (`dł przewodu zasilającego`, `wpięcie zasilania`, `bruzdowanie na przewód
   zasilający`), bo idzie do jednostki zewnętrznej, a nie do każdego pomieszczenia z osobna.
2. **`Lutowanie` zaliczyłem do pomieszczenia**, bo dotyczy łączenia rur na trasie. Jeśli w praktyce
   liczysz je ryczałtem na całą instalację, przenieś do `INSTALLATION`.

## Ile wychodzi montaż standardowy

Zestawienie orientacyjne: pozycje z cennika przypisane do zakresu z
[DEFINICJA-MONTAZU-STANDARDOWEGO.md](../prezentacje/DEFINICJA-MONTAZU-STANDARDOWEGO.md).
**To moja propozycja mapowania, do zatwierdzenia** — dokładny skład ustawi konfiguracja
montażu standardowego (`STD-INSTALL-CONFIG`).

| Pozycja | Ilość | Mnożnik | Cena jedn. netto | Wartość |
|---|---|---|---|---|
| podłączenie ściennej | 1 | na jednostkę wewnętrzną | 1 000.00 zł | 1 000.00 zł |
| uruchomienie | 1 | na układ | 400.00 zł | 400.00 zł |
| instalacja freonowa 1/4 i 3/8 | 3 | mb, na jednostkę | 130.00 zł | 390.00 zł |
| koryta na instalację freonową | 3 | mb, na jednostkę | 40.00 zł | 120.00 zł |
| przewiert | 1 | na jednostkę | 300.00 zł | 300.00 zł |
| skropliny grawitacyjnie giętkie | 3 | mb, na jednostkę | 6.00 zł | 18.00 zł |
| dł przewodu zasilającego | 5 | mb, na układ | 15.00 zł | 75.00 zł |
| wpięcie zasilania do gniazda na sztywno | 1 | na układ | 60.00 zł | 60.00 zł |
| jedn zew stoi na podstawach kauczukowych | 1 | na układ | 120.00 zł | 120.00 zł |

- Na każdą jednostkę wewnętrzną: **1 828.00 zł netto**
- Wspólne dla całego układu: **655.00 zł netto**
- **Single-split, 1 pomieszczenie: 2 483.00 zł netto**
- **Multi-split, 2 pomieszczenia: 4 311.00 zł netto**
- **Multi-split, 3 pomieszczenia: 6 139.00 zł netto**

**Porównanie z dzisiejszą ceną w Triage.** `getSetForConfig.ts` liczy montaż jako
`cena z pozycji 'Montaż wzorcowy' × liczba pomieszczeń`, a gdy tej pozycji nie ma — `1200 zł × liczba
pomieszczeń`. Przy cenniku powyżej standard dla jednego pomieszczenia wychodzi **około dwa razy drożej**
niż literał 1200 zł. Rzeczywistej wartości pozycji `'Montaż wzorcowy'` w bazie produkcyjnej nie
sprawdzałem. To jest ryzyko R18 z dokumentu zakresu: przepięcie Triage na wspólny cennik zmienia cenę
widoczną publicznie, więc wymaga porównania przed i po, a nie cichego wdrożenia.
