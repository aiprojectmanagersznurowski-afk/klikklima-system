# ADR-010 — wykaz zmian

Decyzja: **`installations.next_service_date` to wyliczona data należności, `services` to konkretne wizyty. Po rezerwacji prawdą jest `services`.** Data: 2026-08-18.

---

## Podział ról

| | `installations.next_service_date` | `services` |
|---|---|---|
| Czym jest | wyliczona data należności przeglądu | konkretna wizyta |
| Skąd pochodzi | ostatni zamknięty etap montażu + 1 rok | rezerwacja klienta |
| Kto zapisuje | wyłącznie efekt `do:computeNextServiceDate` | dyspozytor lub klient przez link z `N10` |
| Dokąd obowiązuje | dopóki nie powstanie rekord `services` ze statusem `SCHEDULED` | od tego momentu |

## Cykl

1. Cron czyta `next_service_date`, na `SLA.SERVICE_REMINDER_LEAD` dni przed wysyła `N10` z linkiem do rezerwacji, zapisuje `reminder_sent_at`.
2. Klient wybiera termin → `bookings` + `services.booking_id`, `scheduled_date`, status `SCHEDULED`.
3. Przełożenie wizyty zmienia `bookings` i `services`. `next_service_date` zostaje nietknięte.
4. Zamknięcie serwisu wyznacza datę należności na kolejny rok i cykl rusza od nowa.

## database_model.md

| Tabela | Zmiana | Powód |
|---|---|---|
| `services` | + `booking_id` | termin wizyty żyje w `bookings` od ADR-012 |
| `services` | + `reminder_sent_at` | ochrona przed powtórnym `N10` |
| `services` | `status` → `AWAITING_CONTACT SCHEDULED COMPLETED IGNORED` | zgodność z CRM §3 |
| `installations` | opis `next_service_date` jako pola pochodnego | jawne wskazanie właściciela zapisu |

### Dlaczego doszedł status `AWAITING_CONTACT`

Poprzedni zestaw nie miał odpowiednika dla „Oczekuje na kontakt" z CRM §3 — a to jest stan, w którym rekord serwisu spędza najwięcej czasu: data należności się zbliża albo minęła, klient jeszcze nie zarezerwował. Bez tego statusu takie rekordy albo nie istniałyby wcale (i widok „serwisy do umówienia" nie miałby z czego powstać), albo udawałyby `PLANNED`, czyli zaplanowane, którymi nie są.

### Dlaczego `reminder_sent_at`

Cron uruchamiany co godzinę i warunek „30 dni przed terminem" prawdziwy przez całą dobę dają dwadzieścia cztery identyczne SMS-y dziennie. `idempotency_key` z ADR-007 zatrzymałby duplikaty w obrębie jednej próby wysyłki, ale nie powstrzymałby crona przed kolejkowaniem nowej wiadomości przy każdym przebiegu.

## contracts/requirements.contract.mjs

- **`SRV-SOURCE-OF-TRUTH`** — kryterium rozstrzygające spór: widok CRM czyta termin z `services`, gdy rekord istnieje, i z `next_service_date`, gdy nie istnieje.
- **`SRV-REMINDER-ONCE`** — jedno przypomnienie na cykl.
- **`SRV-NEXT-DATE`** uzupełnione o zapis, że żadna ścieżka w aplikacji nie zapisuje tego pola.

Rejestr ma 58 wymagań.

## Egzekwowanie

**`adr010-derived-write`** blokuje zapis do `next_service_date` z `apps/**/*.ts(x)`. Odczyt przechodzi. Pole jest wyliczane przy zamknięciu montażu — ręczna zmiana rozjeżdża je z tym, co system policzy przy następnym przeliczeniu, czyli przywraca problem, który ten ADR zamyka.

Sprawdzone w obie strony: zapis przez `prisma.installation.update` blokowany, odczyt i zapis terminu do `services` przechodzą.

---

## Co pozostaje otwarte

**Serwis pogwarancyjny.** Cykl zakłada, że po zamknięciu serwisu automatycznie powstaje kolejna data należności. Nie rozstrzygnięto, czy dotyczy to również instalacji po okresie gwarancji — czy system ma przypominać bezterminowo, czy przestać po którymś roku. To decyzja handlowa, nie techniczna.

**Status `IGNORED`.** Wiadomo, że istnieje, nie wiadomo, kto i kiedy go ustawia — czy po którymś nieudanym kontakcie automatycznie, czy wyłącznie ręcznie przez dyspozytora. Warto rozstrzygnąć razem z polityką ponawiania kontaktu, bo to ten sam mechanizm.
