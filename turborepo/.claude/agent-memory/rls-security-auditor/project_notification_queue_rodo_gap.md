---
name: project-notification-queue-rodo-gap
description: notification_queue (NTF-QUEUE-TABLE) nie jest objęta anonimizacją RODO klienta ani żadną polityką retencji — luka do zamknięcia przed Fazą C LOGISTICS-SHIPPING-EFFECTS
metadata:
  type: project
---

Audyt 2026-09-08 diffu `enqueueNotification` (`apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`,
Faza B `LOGISTICS-SHIPPING-EFFECTS`, `NTF-QUEUE-TABLE`): `notification_queue.payload`/`recipient_address`
będą w Fazie C przechowywać PII klienta (e-mail/telefon/adres), a:
- `QUEUE_POLICY` w `contracts/notifications.contract.mjs` (linie ~70-80) ma retry/backoff/dead-letter, ale
  **zero pola retencji/TTL**.
- `CRM-CLIENT-ANONYMIZE-RODO` (następca `SEC-RODO-DELETE`, `contracts/requirements.contract.mjs:191`) ma
  kryteria akceptacji obejmujące wyłącznie `klienci`, `adresy`, `leady`, `serwisy`, `usterki_incidents`,
  `audit_log` — `notification_queue` NIE jest wymieniona nigdzie w tym wpisie.

**Why:** to nie jest błąd dzisiejszego diffu (Faza B nie wstrzykuje jeszcze prawdziwego PII —
`enqueueNotification` nie jest dziś wołana z żadnej Server Action, `grep` na `logistics/actions.ts`
potwierdza brak importu poza `releaseCrewSlot`/`suspendLogisticsSla`), ale gdy Faza C
(`AC-C6`, wpięcie w `rollbackLogisticsOrder`/ship/bypass) zacznie zapisywać prawdziwe adresy klientów,
anonimizacja klienta (`anonymizeClientAction`) nie skasuje/zanonimizuje tych wierszy — dane przetrwają
"usunięcie RODO" w tabeli poza zasięgiem mechanizmu minimalizacji.

**How to apply:** przy kolejnym audycie Fazy C `LOGISTICS-SHIPPING-EFFECTS` (albo przy dowolnym audycie
`enqueueNotification` wołanej z realnej Server Action) sprawdź, czy powstało nowe wymaganie kontraktowe
(np. `NTF-QUEUE-RODO-RETENTION` albo rozszerzenie `CRM-CLIENT-ANONYMIZE-RODO` o kaskadę na
`notification_queue`) PRZED tym, jak payload zacznie nosić prawdziwe dane. Jeśli go nie ma i Faza C już
wypełnia `recipientOverride`/`payload` danymi klienta — to jest realna, nie hipotetyczna, luka RODO,
warta HIGH.
