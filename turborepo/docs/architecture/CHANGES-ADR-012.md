# ADR-012 — wykaz zmian

Decyzja: **uzupełnić model danych o tabele wymagane przez CRM**. Data: 2026-08-18.
Model urósł z 17 do 27 encji. To największa z dotychczasowych zmian i jedyna wymagająca migracji z utratą pola.

---

## Dodane tabele

| Tabela | Zastępuje / realizuje | Uwaga projektowa |
|---|---|---|
| `bookings` | `leads.booking_date` | jedyne źródło prawdy o terminach; zmiana terminu tworzy nowy rekord z `reschedule_of` |
| `absences` | „Zablokuj kalendarz" (CRM §6), status dostępności (§5) | `reason` obejmuje `VEHICLE_FAILURE` — awaria auta blokuje ekipę jak urlop |
| `regions` + `region_postal_codes` | „Zarządzaj regionem" (CRM §5) | kod pocztowy `UNIQUE` globalnie, inaczej auto-przypisanie jest niedeterministyczne |
| `documents` | pola `protocol_url`, `installation_photos` | jeden rejestr plików z typem, zamiast pól rozsianych po tabelach |
| `invoices` | zakładka „Dokumenty", rozliczenia | `client_id` z `onDelete: SetNull` — wymóg `SEC-RODO-DELETE` |
| `contact_log` | „Ostatni kontakt", „Zadzwoń do klienta" | `outcome` odróżnia próbę od rozmowy |
| `notes` | notatki na Karcie 360 | `is_pinned` do wyróżnienia |
| `vehicles` | „Pojazd / Wyposażenie" (CRM §6) | osobna tabela, bo auto bywa przepinane między ekipami |
| `soft_leads` | Exit Intent | świadomie poza `leads` — brak kompletu danych, nie podlega lejkowi |

## Zmiany w istniejących tabelach

| Tabela | Zmiana | Powód |
|---|---|---|
| `leads` | **usunięte** `booking_date` | dwa źródła prawdy o terminie to gwarantowana rozbieżność |
| `auditors` | + `region_id` | auto-przypisywanie po kodzie pocztowym |
| `auditors` | + `daily_audit_cap` | CRM §5 pkt 2; `NULL` = wartość globalna z `SLA.AUDITOR_DAILY_CAP` |
| `auditors` | + `availability_status` | Aktywny / Urlop / Zwolnienie |

## contracts/rbac.contract.mjs

Dziewięć nowych zasobów: `bookings`, `absences`, `regions`, `documents`, `invoices`, `contact_log`, `notes`, `vehicles`, `soft_leads`. Wszystkie z `delete` wyłącznie dla `admin`, zgodnie z regułą globalną. `contact_log` nie ma `update` — log kontaktu, który da się edytować, przestaje być logiem.

`region_postal_codes`, `addresses` i tabele katalogu produktowego nie mają własnych wpisów: dziedziczą uprawnienia po encji nadrzędnej i nie występują jako osobny widok CRM.

## contracts/requirements.contract.mjs

Wzmocnione: `FNL-E3-E4` (atomowość rezerwacji), `CRM-ZESP-AC3` (blokada kalendarza).
Nowe: `CRM-BOOK-HISTORY` (historia przekładań), `CRM-REGION-AUTO` (auto-przypisanie po kodzie).
Rejestr ma teraz 49 wymagań.

---

## Błąd wyłapany przez bramkę

W pierwszej wersji macierzy RBAC wpisałem `klient` jako rolę mogącą tworzyć rezerwacje. Reguła `R13-rbac` odrzuciła to: `klient` nie jest rolą — nie ma konta w `authorized_users`.

To nie jest formalność. Rezerwacja przez klienta idzie publicznym linkiem z tokenem o ograniczonym czasie życia i jest osobnym, wąskim endpointem z własnym guardem. Gdyby `klient` trafił do macierzy jako rola, dostałby drogę do wszystkiego, co ta rola ma przypisane w pozostałych wierszach. Uprawnienie do jednej akcji przez token to co innego niż rola w systemie.

## Co pozostaje otwarte

**Migracja `leads.booking_date`.** Pole zniknęło z modelu, ale jeżeli masz już dane produkcyjne, migracja musi je przenieść do `bookings`, a nie skasować. Kolejność: utwórz `bookings`, przepisz istniejące terminy, dopiero potem `DROP COLUMN`. `contract-steward` ma w twardych zasadach zapis o `RENAME` zamiast `DROP`+`ADD` — tutaj obowiązuje ta sama ostrożność.

**`installations.scheduled_at` kontra `bookings`.** Instalacja nadal ma własną datę planowaną. Rozstrzygnięcie, czy jest to kopia potwierdzonej rezerwacji, czy niezależne pole, należy do ADR-010 (podwójne źródło harmonogramu serwisu) — ten sam problem, ta sama decyzja.

**`protocol_url` i `installation_photos`** zostały w `installations`. Nowy kod ma pisać do `documents`; usunięcie starych pól to osobna migracja, po przeniesieniu danych.

**`audit_log`** figuruje w RBAC, ale nie ma go w modelu danych — to ADR-008, wciąż otwarty.
