# ADR-007 — wykaz zmian

Decyzja: **przebudować `notification_queue` i `message_templates`**. Data: 2026-08-18.

---

## notification_queue: 5 kolumn → 21

| Grupa | Kolumny | Po co |
|---|---|---|
| tożsamość wiadomości | `notification_id`, `template_key`, `channel` | wiadomo, które powiadomienie z katalogu i którym szablonem |
| odbiorca | `recipient_kind`, `recipient_user_id`, `client_id`, `recipient_address` | obsługa powiadomień wewnętrznych (I1–I7), które nie idą do klienta |
| powiązanie | `lead_id`, `installation_id`, `service_id`, `incident_id` | N10–N18 dotyczą serwisów i usterek, nie leadów |
| treść | `payload` | zmienne szablonu zamrożone w chwili kolejkowania |
| harmonogram | `send_after`, `next_attempt_at`, `sent_at` | okno SMS 8:00–18:00 i backoff wykładniczy |
| ponawianie | `attempts`, `last_error`, `dead_lettered_at`, `idempotency_key` | Centrum Powiadomień z `b2b_app_requirements.md` |
| stan | `status` = `PENDING SENT ERROR DEAD_LETTER CANCELLED` | rozróżnienie „spróbujemy jeszcze" od „poddaliśmy się" |

### Trzy decyzje projektowe warte uzasadnienia

**Cztery klucze nullable zamiast pary „typ + id".** Wariant polimorficzny z `entity_type` i `entity_id` jest krótszy, ale baza nie ma jak sprawdzić, czy wskazywany rekord istnieje — integralność referencyjna przestaje działać dokładnie tam, gdzie zaczyna się bałagan. Cztery kolumny nullable z `CHECK` na „dokładnie jedna niepusta" kosztują trzy pola i zachowują klucze obce.

**`recipient_address` przechowuje adres z chwili wysyłki.** Numer telefonu klienta bywa poprawiany. Gdyby historia komunikacji czytała numer przez relację, wiadomość sprzed miesiąca wyświetlałaby się przy dzisiejszym numerze — a przy reklamacji „nie dostałem SMS-a" to jest różnica między dowodem a domysłem.

**`idempotency_key` jest ograniczeniem bazy, nie konwencją w kodzie.** Ponowienie inkrementuje `attempts` na istniejącym rekordzie; wstawienie drugiego z tym samym kluczem odbija się o `UNIQUE`. Klient nie dostaje dwóch SMS-ów nawet wtedy, gdy dwie instancje workera ruszą jednocześnie.

## message_templates

| Było | Jest |
|---|---|
| `trigger_event` w wolnym tekście | `template_key` z `UNIQUE` + `notification_id` |
| `channel` = SMS/EMAIL | + `PUSH` |
| — | `required_vars`, `is_active`, `updated_at` |

`template_key` z ograniczeniem unikalności to ta sama ochrona, którą w kontrakcie realizuje reguła `R10-template-unique`. Kolizja opisana w ADR-003 zaczęła się właśnie od identyfikatorów, których nic nie pilnowało.

## contracts

- `QUEUE_POLICY.note` — nieaktualna adnotacja o brakujących kolumnach zastąpiona opisem stanu faktycznego.
- `NTF-RETRY`: `BLOCKED` → `TODO`, kryteria przepisane na wykonywalne.
- Nowe: `NTF-POLY` (powiązanie polimorficzne), `NTF-HISTORY` (historia na Karcie 360).
- Nowa reguła walidatora **`R18-channel-window`**: kanał użyty w katalogu musi mieć okno wysyłki w `QUEUE_POLICY.sendWindow`, a odbiorca musi należeć do znanego zbioru. Mutacja w `kk-selftest` podmienia `SMS` na `WHATSAPP` i sprawdza, czy bramka się zapala. Zapala się.

---

## Co pozostaje otwarte

**Kanał `PUSH` nie ma jeszcze nośnika.** Powiadomienia I3, I4 i proponowane I5/I7 są pushami, ale w modelu nie ma tabeli tokenów urządzeń. To wyjdzie przy ADR-006, gdzie rozstrzygasz, czy I5–I7 w ogóle wchodzą.

**Kto czyści `DEAD_LETTER`.** Wiadomości w tym statusie zostają w tabeli bezterminowo. Polityka retencji — czy po roku archiwizować, czy kasować — dotyka RODO i najlepiej rozstrzygnąć ją razem z ADR-008 (`audit_log`).

**Okno wysyłki a strefa czasowa.** `QUEUE_POLICY` mówi `Europe/Warsaw`, a kolumny są `timestamp`. Jeżeli baza pracuje w UTC, przeliczenie okna 8:00–18:00 musi się dziać w jednym miejscu — najlepiej w funkcji planisty, nie w każdym wywołaniu.
