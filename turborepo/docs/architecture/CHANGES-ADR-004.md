# ADR-004 — wykaz zmian

Decyzja: **trzeci bucket `ARCHIVED_LOST` plus dwa wyjścia z bucketu zimnych leadów**. Data: 2026-08-18.

---

## contracts/funnel.contract.mjs

| Element | Było | Jest |
|---|---|---|
| stan `ARCHIVED_LOST` | `PROPOSED` | `STABLE`, `terminal: true` |
| przejście `T15` „Zwróć do obiegu" | `PROPOSED` | `STABLE`, guard `quoteRefreshedIfStale` |
| przejście `T16` „Archiwizuj trwale" | `PROPOSED` | `STABLE`, guard `lostReasonProvided` |
| `LOST_REASONS` | nie istniało | 6 wartości, słownik zamknięty |

Maszyna stanów ma teraz 11 stanów (8 etapów + 3 buckety) i 16 przejść, wszystkie `STABLE`.

### Słownik powodów utraty

`COMPETITOR`, `PRICE_TOO_HIGH`, `POSTPONED`, `NO_CONTACT`, `TECHNICAL_BLOCKER`, `OTHER`.

`b2b_crm_specifications.md` §7 podaje tylko dwa przykłady i słowo „np.". Wymaganie `CRM-ZIMNE-AC3` mówi natomiast, że powód ma zasilać moduł analityczny — a analityka po wolnym tekście nie działa: „za drogo", „Za drogo", „zbyt drogo" i „cena" to w bazie cztery różne powody. Stąd lista zamknięta.

**Te sześć wartości to propozycja, nie decyzja.** Zmiana listy to jedna linia w kontrakcie i `node tools/kk-codegen.mjs`. Warto ją skonfrontować z tym, czego faktycznie potrzebuje raportowanie sprzedaży, zanim wejdzie do produkcji — po pierwszych stu zarchiwizowanych leadach zmiana słownika oznacza już migrację danych.

## contracts/requirements.contract.mjs

| Wymaganie | Było | Jest |
|---|---|---|
| `CRM-ZIMNE-AC2` | `BLOCKED`, 1 kryterium | `TODO`, 3 kryteria |
| `CRM-ZIMNE-AC3` | `BLOCKED`, 2 kryteria | `TODO`, 4 kryteria |

Dopisane kryteria są takie, żeby dało się z nich napisać test w obie strony — nie „guard istnieje", tylko „cena świeża przechodzi, cena przeterminowana odrzucona".

## docs/architecture/b2b_funnel_process.md

- wstęp: „2 buckety" → „3 buckety";
- `stateDiagram-v2`: deklaracja `Bucket_Lost`, przejścia `Bucket_Odrzucone --> E3` i `Bucket_Odrzucone --> Bucket_Lost`, oraz `Bucket_Lost --> [*]`;
- nowa sekcja opisowa „Bucket: Zarchiwizowany (Lost)";
- rozszerzony opis bucketu „Wyceny odrzucone" o oba wyjścia i ich guardy.

## docs/architecture/database_model.md

- „8 etapów + 2 buckety" → „+ 3 buckety" (wstęp, komentarz ERD przy `leads.status`, opis encji);
- dopisany opis stanu `ARCHIVED_LOST` z warunkiem `lost_reason` i informacją o braku wyjścia.

---

## Egzekwowanie

`ARCHIVED_LOST` nie ma przejścia wychodzącego, co normalnie łamie regułę `R05-no-dead-end`. Dopuszcza to wyłącznie jawne `terminal: true` — czyli stan bez wyjścia jest legalny tylko wtedy, gdy ktoś świadomie tak go opisał, a nie wtedy, gdy o przejściu zapomniano.

Dodana mutacja w `kk-selftest` zdejmuje `terminal: true` i sprawdza, czy bramka się zapala. Zapala się. Reguł jest teraz 16 i wszystkie dowiodły, że potrafią zablokować zmianę.

`kk-smoke` sprawdza dodatkowo na wygenerowanym kodzie, że `isValidLostReason` odrzuca wolny tekst, że `ARCHIVED_LOST` nie ma wyjść i że `T16` jest osiągalne z bucketu zimnych leadów.

## Co pozostaje otwarte

Przywrócenie leada z `ARCHIVED_LOST` wymaga ręcznej interwencji w bazie. To celowe — archiwizacja ma być nieodwracalna w normalnym trybie pracy. Jeżeli okaże się, że dyspozytorzy potrzebują cofnięcia (np. po pomyłce), będzie to nowe przejście z guardem uprawnień admina i wpisem do `audit_log` — czyli zależy od ADR-008, który wciąż jest otwarty.
