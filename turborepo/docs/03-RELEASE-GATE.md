# Bramka gotowości wydania

To jest odpowiednik tego, co nazwałeś „proof of life" — moment, w którym sprawdzamy, czy system działa jako całość, a nie jako zbiór zielonych testów jednostkowych. Kryteria są binarne. Nie ma „w zasadzie gotowe".

Uruchomienie: `/kk-release-gate` albo ręcznie krok po kroku.

## Kryteria — wszystkie muszą być spełnione

### A. Integralność kontraktu

| # | Kryterium | Weryfikacja |
|---|---|---|
| A1 | Kontrakt spójny, zero elementów `PROPOSED` | `node tools/kk-validate.mjs --strict` |
| A2 | Wszystkie reguły bramki żywe | `node tools/kk-selftest.mjs` → 14/14 |
| A3 | Zero dryfu między kontraktem a kodem | `node tools/kk-codegen.mjs --check` |
| A4 | Zero wymagań w statusie `BLOCKED` | `node tools/kk-trace.mjs` |

### B. Pokrycie

| # | Kryterium | Weryfikacja |
|---|---|---|
| B1 | Każde wymaganie `IMPLEMENTING`/`DONE` ma przechodzący test | `kk-trace --enforce --results` |
| B2 | Każde wymaganie `risk: HIGH` ma test integracyjny, nie tylko jednostkowy | przegląd ręczny macierzy |
| B3 | Pełna macierz stan × akcja pokryta testem model-based | test `FNL-NO-ILLEGAL-TRANSITIONS` |
| B4 | Zero etapów `pominięte` w `verify.sh` | `bash scripts/verify.sh --full --clean` |

### C. Ścieżka główna — scenariusz end-to-end

Na **świeżo zaseedowanej bazie**, jednym przebiegiem, z asercją stanu kolejki powiadomień po każdym kroku:

| # | Krok | Asercja |
|---|---|---|
| C1 | Formularz Triage tworzy leada | status `NEW_LEAD`, kolejka zawiera `I1` |
| C2 | Administrator przypisuje audytora | `AWAITING_AUDIT`, kolejka: `N1`, `I5` |
| C3 | Audytor wysyła wycenę | `AUDIT_COMPLETED` (auto), `N4`, `wazna_do` = +14 dni |
| C4 | Klient akceptuje i rezerwuje termin | `AWAITING_CREW_ASSIGNMENT`, `I2`, slot zarezerwowany |
| C5 | Administrator przypisuje ekipę | `HARDWARE_IN_WAREHOUSE`, `I3`, rekord wysyłki |
| C6 | Wysłano kurierem z tracking ID | `HARDWARE_IN_TRANSIT`, `N5` |
| C7 | Webhook „Doręczono" | `AWAITING_INSTALLATION` |
| C8 | Monter kończy montaż | `INSTALLATION_COMPLETED`, `N8` z 3 załącznikami, `next_service_date` = +1 rok |

### D. Ścieżki wyjątkowe

| # | Scenariusz | Asercja |
|---|---|---|
| D1 | Bypass E5→E7 | pominięte E6, brak `N5`, brak rekordu kuriera |
| D2 | Rollback z E6 | bucket, slot zwolniony, `N_ROLLBACK` + `I4`, SLA wstrzymane |
| D3 | Powrót z rollbacku | z powrotem na E4, nowy slot |
| D4 | Wygaśnięcie wyceny (czas **symulowany**, nie `sleep`) | bucket `QUOTE_REJECTED`, `N_REJECT`, `bucket_entered_at` |
| D5 | Dwukrotne uruchomienie crona | brak drugiego powiadomienia (idempotencja) |
| D6 | Dwie równoległe rezerwacje tego samego slotu | dokładnie jedna wygrywa, druga dostaje błąd domenowy |
| D7 | Ekipa z wygasłym certyfikatem | niewidoczna w E4 **i** odrzucona przy próbie wymuszenia po stronie serwera |

### E. Bezpieczeństwo

| # | Kryterium | Weryfikacja |
|---|---|---|
| E1 | Logowanie odrzuca e-mail spoza `authorized_users` | test integracyjny |
| E2 | Audytor nie widzi cudzych leadów — także przez relacje (join) | zapytanie wykonane jako rola audytora |
| E3 | Usuwanie działa wyłącznie dla admina, na trzech warstwach | 3 osobne testy: UI, Server Action, RLS |
| E4 | Usunięcie klienta anonimizuje, nie kasuje historii montażu | test integracyjny |
| E5 | Zero sekretów w bundlu klienckim | skan zbudowanego bundla |
| E6 | Każda tabela z danymi osobowymi ma włączone RLS i polityki | audyt `rls-security-auditor` z wykonanymi zapytaniami |

### F. Komunikacja

| # | Kryterium | Weryfikacja |
|---|---|---|
| F1 | Parzystość katalogu powiadomień z `message_templates` w obie strony | test kontraktowy |
| F2 | SMS poza oknem 8:00–18:00 jest przesuwany, nie gubiony | test ze strefą Europe/Warsaw |
| F3 | Zmiana czasu letni/zimowy nie łamie kolejkowania | test z datą przejścia |
| F4 | Ponowienie wysyłki nie duplikuje wiadomości | test idempotencji |
| F5 | Po `maxAttempts` wiadomość trafia do dead-letter z `last_error` | test |

## Werdykt

Wypisz tabelę wszystkich kryteriów ze statusem. **Jedno niespełnione = brak gotowości.**

Uwaga praktyczna: przy dzisiejszym stanie dokumentacji kryteria A1, A4, B1, F4 i F5 są nieosiągalne, dopóki nie rozstrzygniesz ADR-004, ADR-007, ADR-008 i ADR-009. To nie jest usterka bramki — to jest bramka wykonująca swoje zadanie.
