# ADR-006 — wykaz zmian

Decyzja: **`I5`, `I6` i `I7` wchodzą do katalogu**. Data: 2026-08-18.
Po tej zmianie katalog powiadomień nie ma już ani jednego elementu w statusie `PROPOSED`.

---

## contracts/notifications.contract.mjs

| ID | Wyzwalacz | Odbiorca | Kanał | Skąd wymóg |
|---|---|---|---|---|
| `I5` | przejście `T01` (przypisanie audytora) | audytor | PUSH | sequence diagram w `b2b_funnel_process.md` |
| `I6` | cron, 30 dni przed wygaśnięciem F-Gaz / SEP | administrator | EMAIL | `b2b_crm_specifications.md` §5 i §6 |
| `I7` | utworzenie usterki krytycznej | dyspozytor | PUSH | `b2b_crm_specifications.md` §4 |

Wszystkie trzy z `PROPOSED` na `STABLE`, z notatkami opisującymi stan faktyczny zamiast luki.

## database_model.md — nowa tabela `device_tokens`

Kanał `PUSH` istniał w kolejce od ADR-007, ale nie miał nośnika. `device_tokens` wiąże token z kontem w `authorized_users`, bo push w tym systemie idzie wyłącznie do pracownika — klient korzysta z aplikacji webowej i dostaje SMS albo e-mail.

`is_active` gaśnie po odrzuceniu tokena przez dostawcę push. Bez tego kolejka próbowałaby wysyłać na martwe urządzenia aż do wyczerpania `maxAttempts`, zamieniając dead letter w rejestr odinstalowanych aplikacji.

Tabela nie ma wpisu w macierzy RBAC — jak `addresses` czy `region_postal_codes` nie jest widokiem CRM, tylko rejestrem technicznym zapisywanym przez aplikację w imieniu zalogowanego użytkownika.

## contracts/requirements.contract.mjs

- **`NTF-PUSH-TOKEN`** — push rozsyłany na wszystkie aktywne tokeny użytkownika, a nie tylko ostatni; brak tokena kończy wiadomość statusem `CANCELLED`, nie `ERROR`, bo nie ma czego ponawiać.
- **`NTF-I7-SLA`** — zegar 48 godzin liczony od `created_at` usterki, nie od wysyłki powiadomienia. Gdyby liczyć od wysyłki, opóźniona kolejka przesuwałaby termin reakcji.

Rejestr ma 56 wymagań.

## Nowa reguła bramki

**`R20-push-recipient`**: powiadomienie z kanałem `PUSH` i odbiorcą `CLIENT` jest odrzucane. Klient nie rejestruje urządzenia, więc taka wiadomość nigdy by nie doszła — a kolejka mieliłaby ją przez pięć prób do dead letter, zanim ktokolwiek zauważyłby, że kanał był od początku niemożliwy.

Mutacja w `kk-selftest` zmienia odbiorcę `I5` na `CLIENT` i sprawdza, czy bramka się zapala. Zapala się. Reguł jest 19.

---

## Zależność od ADR-009

`I6` alarmuje 30 dni przed wygaśnięciem certyfikatu, ale w obecnym modelu `fgaz_valid_until` i `sep_valid_until` wiszą przy zespole (`crews`), nie przy osobie. Powiadomienie zadziała, tylko wskaże ekipę zamiast konkretnego montera — a wymaganie `CRM-ZESP-AC1` mówi o certyfikatach członków zespołu. Do rozstrzygnięcia w ADR-009.

Zmienna `assignee` w `I6` jest tu celowo neutralna: przyjmie nazwę ekipy dziś i imię montera po zmianie modelu, bez ruszania szablonu.

## Co pozostaje otwarte

**Cisza nocna dla pushy.** `QUEUE_POLICY.sendWindow` daje `PUSH` okno całodobowe, bo `I7` ma być natychmiastowy. Ale `I5` — przypisanie audytora — obudzi go o trzeciej w nocy, jeżeli dyspozytor pracuje po godzinach. Rozważ osobne okno dla powiadomień niepilnych; to jedna linia w `QUEUE_POLICY`, ale wymaga rozróżnienia priorytetu w katalogu.
