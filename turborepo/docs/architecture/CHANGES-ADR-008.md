# ADR-008 — wykaz zmian

Decyzja: **tabela `audit_log`, append-only, rejestrująca sześć operacji wrażliwych**. Data: 2026-08-18.
Ostatni punkt rejestru ADR.

---

## Nowa tabela `audit_log`

| Grupa kolumn | Pola | Po co |
|---|---|---|
| co się stało | `action`, `entity_table`, `entity_id` | sześć operacji z `AUDIT_REQUIREMENTS.mustLog` |
| kto | `actor_user_id`, `actor_role` | rola z chwili operacji, nie dzisiejsza |
| na jakiej podstawie | `legal_basis`, `justification` | odpowiedź na pytanie kontroli |
| stan | `before_snapshot`, `after_snapshot` | dane wrażliwe zanonimizowane |
| kiedy | `occurred_at`, `retention_until` | czas operacji, nie zapisu; retencja 1825 dni |
| korelacja | `request_id` | powiązanie z żądaniem HTTP |

## Cztery decyzje projektowe

**`entity_id` bez klucza obcego.** Klucz obcy do usuniętego rekordu albo blokuje usunięcie, albo kasuje wpis audytowy razem z rekordem. Oba warianty niweczą sens rejestru, którego głównym zadaniem jest przetrwać usunięcie. Zamiast tego `entity_table` + `entity_id` jako zwykłe pola.

**`actor_role` z chwili operacji.** Odczytywana przez relację rola zmieniałaby się wstecz przy każdym awansie lub degradacji — rejestr pokazywałby, że operację wykonał administrator, choć w tamtym momencie osoba była dyspozytorem.

**`legal_basis` z zamkniętej listy plus obowiązkowe `justification`.** Rejestr mówiący, że klient został usunięty, ale nie czy było to żądanie z RODO, czy pomyłka operatora, nie odpowiada na pytanie, które padnie przy kontroli. Lista zamknięta, bo po wolnym tekście nie da się raportować — to ta sama zasada co przy `LOST_REASONS` w ADR-004.

**`before_snapshot` z zanonimizowanymi danymi wrażliwymi.** Migawka sprzed anonimizacji zawierałaby komplet danych osobowych, których właśnie się pozbywamy. Rejestr wykonania prawa do bycia zapomnianym nie może być miejscem, w którym te dane przetrwają pięć lat.

## contracts/rbac.contract.mjs

`AUDIT_REQUIREMENTS` z `PROPOSED` na `STABLE`, uzupełnione o `legalBases` (pięć wartości) i `requiresJustification`. Wiersz `audit_log` w macierzy już wcześniej miał puste `update` i `delete` — teraz jest to sprawdzane.

## contracts/requirements.contract.mjs

`SEC-AUDIT-LOG`: `BLOCKED` → `TODO`, jedno kryterium zastąpione sześcioma wykonywalnymi. Najważniejsze z nich: **wycofanie transakcji operacji wycofuje też wpis audytowy** — rejestr nie może zawierać śladów po operacjach, które ostatecznie się nie wydarzyły. To wymusza zapis w tej samej transakcji, a nie w osobnym wywołaniu po fakcie.

`SEC-RODO-DELETE` uzupełnione o `legal_basis = RODO_ERASURE_REQUEST` i wymóg anonimizacji migawki.

Rejestr ma 59 wymagań, z czego **zero zablokowanych**.

---

## Dwie warstwy egzekwowania

**`R22-audit-append-only`** (walidator) sprawdza, czy deklaracja `appendOnly: true` zgadza się z macierzą uprawnień. Wiersz przyznający komukolwiek `update` lub `delete` na `audit_log` zatrzymuje bramkę. Sprawdza też, że `create` jest komuś przyznane (rejestr, którego nie da się zapisać, jest równie bezużyteczny) i że wymóg uzasadnienia idzie w parze z zamkniętą listą podstaw.

Mutacja w `kk-selftest` przyznaje adminowi `update` na `audit_log` i sprawdza, czy bramka się zapala. Zapala się. Reguł jest 21.

**`adr008-audit-mutate`** (hook) blokuje `auditLog.update`, `auditLog.deleteMany`, `upsert` oraz `UPDATE`/`DELETE FROM audit_log` w plikach `.ts`, `.tsx` i `.sql` — czyli także w migracjach. `create` i `findMany` przechodzą.

Ochrona docelowa leży w bazie: polityka RLS odrzucająca `UPDATE` i `DELETE` dla wszystkich ról oraz `REVOKE UPDATE, DELETE ON audit_log FROM authenticated`. Hook i walidator pilnują, żeby nikt nie napisał kodu, który tej polityki nie zakłada.

## Co pozostaje otwarte

**Kto czyta rejestr.** Macierz daje `read` wyłącznie roli `admin`. Przy kontroli może się okazać, że potrzebny jest eksport dla audytora zewnętrznego — to nowa ścieżka, nie nowa rola.

**Czyszczenie po `retention_until`.** Pole istnieje, mechanizm usuwania przeterminowanych wpisów nie. Uwaga: to jedyne dopuszczalne `DELETE` na tej tabeli i musi ominąć własną blokadę — czyli działać jako zadanie bazodanowe z podwyższonymi uprawnieniami, nigdy z kodu aplikacji.

**Retencja kolejki powiadomień.** Pytanie zostawione otwarte w ADR-007 nadal takie jest: `audit_log` ma swoje 1825 dni, ale wiadomości w statusie `DEAD_LETTER` potrzebują osobnej polityki.
