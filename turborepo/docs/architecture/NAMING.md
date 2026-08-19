# Konwencja nazewnicza (ADR-002) — obowiązująca

**Zasada:** identyfikatory techniczne po angielsku, `snake_case`. Polski zostaje w treściach dla użytkownika, w komentarzach i w dokumentacji.

| Warstwa | Konwencja | Przykład |
|---|---|---|
| Tabela w PostgreSQL | `snake_case`, liczba mnoga | `installation_photos` |
| Kolumna | `snake_case` | `booking_date` |
| Klucz obcy | `<encja_pojedynczo>_id` | `client_id`, `crew_id` |
| Model Prisma | `PascalCase` + `@@map` | `model Crew { … @@map("crews") }` |
| Pole modelu Prisma | `camelCase` + `@map` | `bookingDate DateTime @map("booking_date")` |
| Wartość enuma | `SCREAMING_SNAKE_CASE`, po angielsku | `AWAITING_PARTS` |
| Typ TypeScript | `PascalCase` | `LeadStatus` |
| Znacznik czasu | `_at` dla momentu, `_date` dla daty | `completed_at`, `next_service_date` |
| Flaga logiczna | `is_` / `has_` | `is_active`, `is_bestseller` |

Nie używamy: polskich nazw, `camelCase` w kolumnach, `PascalCase` w nazwach tabel, mieszania `netto`/`brutto` z angielskim (`net_price`, nie `price_netto`).

---

## Słownik przekładu (stan poprzedni → obowiązujący)

Ta tabela istnieje po to, żeby czytając starszy dokument, notatkę albo commit sprzed decyzji, wiedzieć, o czym mowa. **Nie wolno wprowadzać nazw z lewej kolumny do nowego kodu.**

### Tabele

| Było | Jest |
|---|---|
| `KLIENCI` / `klienci` | `clients` |
| `ADRESY` | `addresses` |
| `AUDYTORZY` / `audytorzy` | `auditors` |
| `ZESPOLY_MONTERSKIE` / `zespoly_monterskie` | `crews` |
| `LEADY` / `leady` | `leads` |
| `INSTALACJE` / `instalacje` | `installations` |
| `SERWISY` / `serwisy` | `services` |
| `USTERKI_INCIDENTS` / `usterki_incidents` | `incidents` |
| `LOGISTYKA_ZAMOWIENIA` / `logistyka_zamowienia` | `shipments` |
| `AUTHORIZED_USER` | `authorized_users` |
| `cennik_uslug` | `service_pricing` |
| `modele_3d` | `product_3d_models` |

Nazwy tabel są tożsame z listą `RESOURCES` w `contracts/rbac.contract.mjs`. Jeżeli dodajesz tabelę objętą uprawnieniami, musi trafić do obu miejsc — walidator sprawdza tylko kontrakt, nie zgadnie o istnieniu tabeli.

### Kolumny

| Było | Jest | | Było | Jest |
|---|---|---|---|---|
| `imie_i_nazwisko` | `full_name` | | `data_planowana` | `scheduled_at` |
| `koordynator_imie_nazwisko` | `coordinator_full_name` | | `data_zakonczenia` | `completed_at` |
| `telefon` | `phone` | | `data_wysylki` | `shipped_at` |
| `telefon_kontaktowy` | `contact_phone` | | `data_rezerwacji` | `booking_date` |
| `nazwa` | `name` | | `wazna_do` | `valid_until` |
| `ulica_miasto` | `street_city` | | `status_akceptacji` | `approval_status` |
| `klient_id` | `client_id` | | `status_platnosci` | `payment_status` |
| `adres_id` | `address_id` | | `status_wysylki` | `shipment_status` |
| `audytor_id` | `auditor_id` | | `priorytet` | `priority` |
| `zespol_id` | `crew_id` | | `opis_problem_klienta` | `customer_problem_description` |
| `instalacja_id` | `installation_id` | | `uwagi_monterskie` | `installer_notes` |
| `zdjecie_url` | `photo_url` | | `uwagi_serwisowe` | `service_notes` |
| `zdjecia_z_montazu` | `installation_photos` | | `firma_kurierska` | `courier_company` |
| `zdjecia_wideo_url` | `media_urls` | | `liczba_brygad` | `crew_count` |
| `protokol_url` | `protocol_url` | | `aktywny` | `is_active` |
| `certyfikat_fgaz` | `fgaz_certificate_no` | | `odpowiedzi_triage` | `triage_answers` |
| `uprawnienia_sep` | `sep_qualified` | | `wycena_items` | `quote_items` |
| `doswiadczenie_hvac_lata` | `hvac_experience_years` | | `finalna_wycena_pln` | `final_quote_pln` |
| `price_netto` | `net_price` | | `set_price_netto` | `set_net_price` |
| `createdAt` | `created_at` | | | |

### Zmienne szablonów powiadomień

Zmienna szablonu jest interpolowana w kodzie (`{{first_name}}`) i przechowywana w `message_templates`, więc podlega ADR-002 tak samo jak kolumna.

| Było | Jest | | Było | Jest |
|---|---|---|---|---|
| `imie` | `first_name` | | `data` | `date` |
| `numer_zlecenia` | `order_number` | | `data_waznosci` | `valid_until` |
| `adres` | `address` | | `typ_certyfikatu` | `certificate_type` |
| `godzina` | `time` | | `osoba_lub_zespol` | `assignee` |

Bez zmian: `link`, `eta`, `total_price`, `tracking_id`.

`data` było najgorsze z całej listy: po polsku znaczy „data", po angielsku „dane". Przy szablonie pisanym przez jedną osobę, a wypełnianym przez drugą, to jest błąd czekający na zdarzenie.

Reguła `R17-var-naming` w walidatorze blokuje powrót starych nazw i wszystko, co nie jest `snake_case`.

### Wartości enumów

| Było | Jest |
|---|---|
| `priorytet`: `NISKI` `SREDNI` `KRYTYCZNY` | `LOW` `MEDIUM` `CRITICAL` |
| status usterki: `NOWE` `W_DRODZE` `NA_CZESCI` `NAPRAWIONE` `ODRZUCENIE_GWARANCJI` | `NEW` `EN_ROUTE` `AWAITING_PARTS` `REPAIRED` `WARRANTY_REJECTED` |

Statusy lejka (`NEW_LEAD` … `INSTALLATION_COMPLETED`) i role (`admin`, `dyspozytor`, `audytor`, `monter`) **nie zmieniają się**. Role zostają po polsku celowo: są wartościami danych występującymi w interfejsie, w `authorized_users` i w kontrakcie RBAC, a ich zmiana wymagałaby migracji danych bez korzyści technicznej.

---

## Czego ta konwencja nie rozstrzyga

`street_city` to wierne tłumaczenie `ulica_miasto`, czyli nadal jedno pole na dwie informacje. Rozbicie na `street`, `building_no`, `city`, `postal_code` jest osobną decyzją — dotyka ADR-012 (brak `regions` i mapowania kodów pocztowych do auto-przypisywania audytora). Nie zrobiłem tego przy okazji zmiany nazewnictwa, bo to zmiana modelu, nie nazwy.
