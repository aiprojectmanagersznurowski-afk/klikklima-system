# ADR-002 — wykaz zmian w dokumentach

Decyzja: **identyfikatory techniczne po angielsku, `snake_case`; modele Prisma `PascalCase` z `@@map`**.
Data: 2026-08-18. Zmienione pliki: dwa. Słownik przekładu: [`NAMING.md`](./NAMING.md).

---

## database_model.md — przepisany w całości

**9 tabel** przemianowanych: `KLIENCI`→`clients`, `ADRESY`→`addresses`, `AUDYTORZY`→`auditors`,
`ZESPOLY_MONTERSKIE`→`crews`, `LEADY`→`leads`, `SERWISY`→`services`,
`USTERKI_INCIDENTS`→`incidents`, `LOGISTYKA_ZAMOWIENIA`→`shipments`, `AUTHORIZED_USER`→`authorized_users`.

**38 kolumn** przemianowanych — pełna lista w `NAMING.md`.

**2 enumy** przetłumaczone: priorytet usterki (`NISKI/SREDNI/KRYTYCZNY` → `LOW/MEDIUM/CRITICAL`) oraz
status usterki (`NOWE/W_DRODZE/NA_CZESCI/NAPRAWIONE/ODRZUCENIE_GWARANCJI` →
`NEW/EN_ROUTE/AWAITING_PARTS/REPAIRED/WARRANTY_REJECTED`).

**Encje w diagramie ERD zapisane małymi literami.** Wersaliki to konwencja ozdobna Mermaida —
po zmianie diagram pokazuje dosłownie te nazwy, które będą w bazie, więc nie da się ich przepisać z błędem.

**Dodana nota** pod nagłówkiem sekcji 1, odsyłająca do `NAMING.md`.

### Poprawki wykraczające poza tłumaczenie

Trzy niespójności wyszły dopiero przy przepisywaniu i dotyczą dokładnie tej decyzji:

| Co | Było | Jest | Dlaczego |
|---|---|---|---|
| `AUTHORIZED_USER.createdAt` | `camelCase` | `created_at` | jedyna kolumna w całym modelu w innej konwencji niż pozostałe |
| `price_netto`, `set_price_netto` | polsko-angielska hybryda | `net_price`, `set_net_price` | „netto" w nazwie kolumny to ten sam problem, tylko mniej widoczny |
| `AUTHORIZED_USER` | liczba pojedyncza | `authorized_users` | wszystkie pozostałe tabele w liczbie mnogiej |

## contracts/notifications.contract.mjs — 27 powiadomień

Zmienne szablonów były mieszanką obu języków (`imie`, `numer_zlecenia`, `adres`, `godzina` obok `link`, `eta`, `total_price`). Ujednolicone na angielski `snake_case` — decyzja Michała z 2026-08-18. Zmiana dotknęła 27 tablic `vars`, sama treść szablonów pozostaje po polsku.

Najpoważniejszy był `data`: po polsku „data", po angielsku „dane". Teraz `date`.

Dodana **reguła walidatora `R17-var-naming`** blokuje powrót porzuconych nazw i wszystko, co nie jest `snake_case`. Reguła ma własną mutację w `kk-selftest` — bramka ma teraz 15 reguł i wszystkie udowodniły, że potrafią zablokować zmianę.

## b2b_app_requirements.md — trzy miejsca

| Wiersz | Było | Jest |
|---|---|---|
| 147 | `` `Clients`, `Leads`, `Quotes`, `Installations`, `Shipments`, `Crews`, `Auditors` `` | te same nazwy w `snake_case`, z odesłaniem do ADR-002 |
| 148 | `` tabelą `Quotes` … statusu `Leada` `` | `` tabelą `quotes` … rekordu w `leads` `` |
| 150 | `` tabeli `Shipments` `` | `` tabeli `shipments` `` |

`Leada` było angielskim rzeczownikiem z polską końcówką fleksyjną w backtickach — czyli wyglądało jak identyfikator, którym nigdy nie było.

---

## Czego nie zmieniłem

**Role zostają po polsku:** `admin`, `dyspozytor`, `audytor`, `monter`. To wartości danych w kolumnie
`authorized_users.role` i w `contracts/rbac.contract.mjs`, widoczne w interfejsie. Zmiana wymagałaby
migracji danych i przejścia przez cały kontrakt RBAC, a nie rozwiązuje żadnego z problemów, dla których
podjęto ADR-002 (kolizje ze słowami zarezerwowanymi, polskie znaki, literówki przy dwóch wariantach nazwy).

**`street_city` to nadal jedno pole na dwie informacje.** Wierne tłumaczenie `ulica_miasto`. Rozbicie na
`street`, `building_no`, `city`, `postal_code` należy do ADR-012 (brak `regions` i mapowania kodów
pocztowych do auto-przypisywania audytora), bo to zmiana modelu, nie nazwy.

**Pozostałe dziewięć dokumentów** nie zawierało identyfikatorów w backtickach — sprawdzone skanem, nie na oko.

---

## Egzekwowanie

| Warstwa | Co robi |
|---|---|
| `guard-forbidden`, reguła `adr002-pl-tables` | blokuje zapis `.ts/.tsx/.sql/.prisma` z porzuconą nazwą tabeli |
| `guard-forbidden`, reguła `adr002-pl-columns` | to samo dla 30 porzuconych nazw kolumn |
| `guard-forbidden`, reguła `adr002-camel-column` | blokuje `@map("camelCase")` w schemacie Prisma |
| `tools/kk-naming.mjs` | skanuje całe repozytorium, także kod napisany przed decyzją |
| etap w `scripts/verify.sh` | bramka nie przechodzi, dopóki skan nie jest czysty |

Skaner pomija linie komentarza — zapis „historycznie tabela nazywała się `leady`" jest dozwolony,
bo objaśnienie starej nazwy to nie jest jej użycie.

Przetestowane w obie strony: cztery blokady w hooku zapalają się, poprawny `@map("booking_date")`,
zapytanie o `leads` i polska proza w `.md` przechodzą. Skaner na sztucznym repo znalazł 4 naruszenia
w 2 plikach i zwrócił 0 po ich usunięciu.
