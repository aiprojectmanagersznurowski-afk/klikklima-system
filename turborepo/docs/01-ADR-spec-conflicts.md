# ADR: Sprzeczności i luki w dokumentacji architektury

**Status: 12 z 12 rozstrzygniętych (2026-08-18). Rejestr zamknięty — kontrakt nie ma ani jednego elementu w statusie propozycji, a rejestr wymagań ani jednego zablokowanego.**

Poniższe punkty wyszły przy destylacji Twoich jedenastu dokumentów do kontraktu. To nie są uwagi stylistyczne. Każdy z nich to miejsce, w którym dwóch agentów pracujących równolegle nad różnymi modułami napisze niekompatybilny kod — i obaj będą mieli rację, bo obaj będą się trzymali dokumentacji.

Przy każdym punkcie jest propozycja rozstrzygnięcia. Kontrakt już ją stosuje, żeby dało się pracować od razu. Zmiana decyzji to poprawka w jednym pliku i `node tools/kk-codegen.mjs`.

---

## ADR-001 — Stos technologiczny panelu B2B ✅ ROZSTRZYGNIĘTE 2026-08-18

**Sprzeczność potrójna:**

| Dokument | Twierdzi |
|---|---|
| `b2b_app_requirements.md` | „React/Next.js (SPA/SSR), **tRPC/React Query**, **Prisma/Drizzle**" — ✅ poprawione |
| `engineering_standards.md` | „Server Components domyślnie, **Server Actions dla mutacji**, **nie używaj API routes**, nie używaj React Query" |
| `system_architecture.md` | „Panel B2B: **Vite + React** (lub Next.js) — dla zamkniętego panelu Vite jest najszybszy" — ✅ poprawione |
| `ui_ux_guidelines.md` | „Next.js (App Router, **Server Actions / React Query** dla Optimistic UI)" — ✅ poprawione |

Vite nie ma Server Components ani Server Actions. tRPC to warstwa API, którą `engineering_standards.md` wprost odrzuca. „Prisma/Drizzle" to dwa różne ORM-y z różnymi typami.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** Next.js App Router + Server Actions + Prisma. Uzasadnienie: `engineering_standards.md` jest najbardziej szczegółowy i normatywny, `ui_ux_guidelines.md` też mówi o Next.js, a Server Actions eliminują całą warstwę tRPC. Optimistic UI robimy przez `useOptimistic` z React 19, bez React Query.

**Wykonane:** trzy sprzeczne dokumenty zostały poprawione — wersje po korekcie leżą w `docs/architecture/`, wykaz zmian co do znaku w `docs/architecture/CHANGES-ADR-001.md`. Decyzja jest dodatkowo egzekwowana maszynowo: hook `guard-forbidden` blokuje zapis pliku importującego `@trpc/*`, `@tanstack/react-query` albo tworzącego `app/api/*` dla logiki wewnętrznej.

**Co zostaje otwarte:** `engineering_standards.md` dopuszcza React Query „dla złożonego pollingu po stronie klienta". Nie wykreśliłem tego, bo to sensowny wyjątek — ale jest to jedyna furtka i wymaga Twojej świadomej zgody. Hook zgłosi taki import jako blokadę; odblokowanie to jawna zmiana w `tools/kk.config.mjs`, a nie obejście w kodzie.

---

## ADR-002 — Język identyfikatorów w bazie ✅ ROZSTRZYGNIĘTE 2026-08-18

`database_model.md` miesza w jednym ERD: `KLIENCI`, `LEADY`, `ZESPOLY_MONTERSKIE`, `USTERKI_INCIDENTS` (polski) oraz `installations`, `quotes`, `notification_queue`, `indoor_units` (angielski). Dodatkowo w tekście występuje raz `instalacje`, raz `installations` dla tej samej encji.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** identyfikatory techniczne po angielsku, `snake_case`, modele Prisma `PascalCase` z `@@map`. Polski zostaje w treściach dla użytkownika i w dokumentacji. Powód: kolizje z zarezerwowanymi słowami, brak polskich znaków w nazwach kolumn i tak wymuszają transliterację, a mieszanka gwarantuje literówki typu `usterki_incidents` kontra `incidents`.

**Wykonane:** `database_model.md` przepisany w całości (9 tabel, 38 kolumn, 2 enumy), `b2b_app_requirements.md` poprawiony w trzech miejscach. Pełny słownik przekładu: `docs/architecture/NAMING.md` — służy też do czytania starszych notatek i commitów. Wykaz zmian: `docs/architecture/CHANGES-ADR-002.md`.

**Egzekwowanie:** trzy reguły w `guard-forbidden` blokują zapis pliku z porzuconą nazwą, a `node tools/kk-naming.mjs` skanuje całe repozytorium — hook pilnuje nowego kodu, skaner wyłapuje to, co już leży w repo.

**Wyjątek świadomy:** role (`admin`, `dyspozytor`, `audytor`, `monter`) zostają po polsku. To wartości danych w `authorized_users` i w kontrakcie RBAC, widoczne w interfejsie — ich zmiana wymagałaby migracji danych bez korzyści technicznej.

---

## ADR-003 — Kolizja numeracji powiadomień ✅ ROZSTRZYGNIĘTE 2026-08-18

`complaints_process.md` używa `N1`, `N2`, `N3`, `N4` dla procesu reklamacji.
`notification_definitions.md` używa `N1`–`N4` dla lejka sprzedażowego, a reklamacje ma pod `N15`–`N18`.

To jest ten sam klucz dla dwóch różnych treści. Agent implementujący reklamacje według `complaints_process.md` podepnie szablon „Przydzielono inżyniera do Twojego zgłoszenia — będzie kontakt w celu umówienia terminu" pod zamknięcie naprawy. Klient dostanie bezsensowną wiadomość, a błąd będzie widoczny dopiero na produkcji.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** kanonem jest `notification_definitions.md`. `complaints_process.md` opisuje proces, nie definiuje powiadomień.

**Wykonane:** `complaints_process.md` przenumerowany — `N1`→`N15`, `N2`→`N16`, `N3`→`N17`, `N4`→`N18`, zgodnie z odwzorowaniem jeden do jednego wobec słownika (treści powiadomień pokrywały się dokładnie). Dodana nota u góry dokumentu wskazująca kanon. Wykaz zmian: `docs/architecture/CHANGES-ADR-003.md`.

**Egzekwowanie:** walidator ma regułę `R10-template-unique` wyłapującą kolizje na poziomie `templateKey`, a reguła `adr003-notif-literal` blokuje wpisanie ID powiadomienia jako gołego stringa w kodzie aplikacji — kolizja wzięła się dokładnie z luźnych identyfikatorów żyjących poza katalogiem. Kod ma importować z `packages/contracts/src/generated/notifications`.

---

## ADR-004 — Brakujące stany i przejścia lejka ✅ ROZSTRZYGNIĘTE 2026-08-18

`b2b_crm_specifications.md` §7 definiuje dla zimnych leadów dwie akcje, których nie ma w maszynie stanów ani w enumie `LeadStatus`:

- **„Zwróć do obiegu"** — przeniesienie leada z bucketu z powrotem na Etap 3. Brak takiej krawędzi w `b2b_funnel_process.md`.
- **„Archiwizuj trwale (Lost)"** — wymaga stanu końcowego z obowiązkowym `lost_reason`. Enum ma 8 etapów + 2 buckety, bez stanu „Lost". Pole `lost_reason` istnieje w tabeli, ale nie ma statusu, który by je uzasadniał.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** dodane przejścia `T15` (QUOTE_REJECTED → AUDIT_COMPLETED, guard `quoteRefreshedIfStale`) i `T16` (QUOTE_REJECTED → ARCHIVED_LOST, guard `lostReasonProvided`) oraz trzeci bucket `ARCHIVED_LOST` jako stan terminalny.

**Wykonane:** wszystkie trzy elementy podniesione z `PROPOSED` do `STABLE` w `funnel.contract.mjs`. Wymagania `CRM-ZIMNE-AC2` i `CRM-ZIMNE-AC3` odblokowane (`BLOCKED` → `TODO`) i uzupełnione o kryteria akceptacji, które da się przetestować. `b2b_funnel_process.md` i `database_model.md` uzupełnione o trzeci bucket i oba wyjścia. Wykaz zmian: `docs/architecture/CHANGES-ADR-004.md`.

**Dodany słownik zamknięty `LOST_REASONS`** (6 wartości). `b2b_crm_specifications.md` §7 podawał wyłącznie przykłady („Konkurencja", „Za drogo"), a wymaganie mówi o zasilaniu modułu analitycznego — wolny tekst by to uniemożliwił. **Wartości są moją propozycją i czekają na Twoje potwierdzenie**; sam mechanizm (lista zamknięta, `isValidLostReason` odrzuca wszystko spoza niej) jest już rozstrzygnięty.

**Egzekwowanie:** `ARCHIVED_LOST` jest terminalny i nie ma przejścia wychodzącego — reguła `R05-no-dead-end` dopuszcza to wyłącznie dzięki jawnemu `terminal: true`, a mutacja w `kk-selftest` dowodzi, że po zdjęciu tego oznaczenia bramka zapala się. Bramka ma teraz 16 reguł.

---

## ADR-005 — Montaż dwuetapowy ✅ ROZSTRZYGNIĘTE 2026-08-18

`notification_definitions.md` zawiera `N8a`: „Pierwszy etap montażu zakończony. Zarezerwuj termin na II etap". Ani maszyna stanów, ani `installations` nie przewidują montażu w dwóch etapach. Nie wiadomo, czy to drugi rekord instalacji, czy pole na tej samej instalacji, ani co się dzieje z `next_service_date` przy niedokończonym montażu.

**Decyzja (Michal, 2026-08-18): funkcja jest w zakresie.** Dotyczy wyłącznie mieszkań w stanie deweloperskim.

Przebieg: klient zaznacza stan deweloperski w Triage → audytor potwierdza na miejscu i oznacza wycenę jako dwuetapową → klient rezerwuje etap I → ekipa przygotowuje instalację w mieszkaniu surowym i zamyka etap I → klient dostaje mailem fakturę za etap I i link do rezerwacji etapu II → po wykończeniu mieszkania ekipa montuje jednostki i zamyka montaż.

**Wykonane:** przejście `T17` (`completePhaseOne`), trzy guardy, powiadomienie `N8a` podniesione z `PROPOSED` do `STABLE` i powiązane z `T17`, tabela `installation_phases`, pola `leads.declared_property_condition`, `quotes.installation_type`, `installations.installation_type`. Trzy nowe wymagania. Wykaz zmian: `docs/architecture/CHANGES-ADR-005.md`.

**Deklaracja klienta i decyzja audytora to dwa różne pola.** `leads.declared_property_condition` pochodzi z formularza, `quotes.installation_type` z oględzin — i to drugie jest wiążące. Gdyby był to jeden checkbox, tryb realizacji zależałby od tego, co klient zaznaczył, nie od tego, co audytor zobaczył.

**Lead nie zmienia etapu między fazami.** `T17` jest pętlą własną na E7: po zamknięciu etapu I lead nadal oczekuje instalacji, tylko drugiego etapu. Alternatywą był dziewiąty etap lejka, co zmieniłoby filtry w całym panelu i wszystkie dokumenty mówiące o ośmiu etapach — dla trybu dotyczącego mniejszości zleceń.

**`next_service_date` liczy się od etapu II.** Sprzęt zaczyna pracować dopiero po drugim etapie; przegląd roczny liczony od etapu I wypadłby, zanim klimatyzacja zostanie uruchomiona. To było pytanie otwarte w tym ADR i jest teraz kryterium akceptacji `SRV-NEXT-DATE`.

**Nowa reguła `R19-self-loop-guard`:** pętla własna musi mieć guard. Bez `phaseOneNotCompleted` ekipa mogłaby zamykać etap I w kółko, za każdym razem wystawiając fakturę i wysyłając e-mail. Bramka ma 18 reguł.

---

## ADR-006 — Brakujące powiadomienia (3 sztuki) ✅ ROZSTRZYGNIĘTE 2026-08-18

Wymagane przez inne dokumenty, nieobecne w słowniku powiadomień:

| Proponowane ID | Czego dotyczy | Wymagane przez |
|---|---|---|
| `I5` | Push do audytora przy przypisaniu leada | sequence diagram w `b2b_funnel_process.md` (`S-->>A: [Push] Nowe zlecenie audytu`) |
| `I6` | Alert do administratora 30 dni przed wygaśnięciem F-Gaz/SEP | `b2b_crm_specifications.md` §5 i §6 |
| `I7` | Push do dyspozytora o usterce krytycznej | `b2b_crm_specifications.md` §4 |

Bez `I5` audytor nie dowiaduje się o przypisaniu inaczej niż przez zajrzenie do aplikacji. Bez `I6` cały mechanizm pilnowania certyfikatów jest martwy, mimo że opisany w dwóch miejscach.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** wszystkie trzy wchodzą do katalogu.

**Wykonane:** `I5`, `I6` i `I7` podniesione z `PROPOSED` do `STABLE`. Katalog nie ma już ani jednego elementu w statusie propozycji. Dodana tabela `device_tokens`, dwa wymagania i reguła `R20-push-recipient`. Wykaz zmian: `docs/architecture/CHANGES-ADR-006.md`.

**`device_tokens` to konsekwencja, nie dodatek.** ADR-007 zostawił otwarte pytanie, gdzie żyją tokeny urządzeń — bez nich `I5` i `I7` figurują w kolejce jako `PUSH`, ale nie ma jak ich dostarczyć. Token wiąże się z kontem w `authorized_users`, bo push idzie wyłącznie do pracownika.

**Nowa reguła `R20-push-recipient`:** `PUSH` do odbiorcy `CLIENT` jest błędem. Klient korzysta z aplikacji webowej i nie rejestruje urządzenia — powiadomienie zaplanowane tym kanałem nigdy by nie doszło, a kolejka mieliłaby je aż do dead letter. Bramka ma 19 reguł.

**Zależność:** `I6` alarmuje o wygasających certyfikatach, ale w obecnym modelu certyfikaty wiszą przy zespole, nie przy osobie — to ADR-009, wciąż otwarty. Powiadomienie zadziała, tylko wskaże ekipę zamiast konkretnego montera.

---

## ADR-007 — `notification_queue` nie utrzyma wymaganej funkcjonalności ✅ ROZSTRZYGNIĘTE 2026-08-18

Schemat w `database_model.md`: `id`, `lead_id`, `type`, `status`, `send_after`.

Wymagania z `b2b_app_requirements.md`: Centrum Powiadomień z **historią wysłanych i zakolejkowanych** oraz **opcją ponowienia wysyłki w razie błędów**.

Brakuje: `recipient`, `channel`, `template_key`, `payload`, `attempts`, `last_error`, `sent_at`, `idempotency_key`, `dead_lettered_at`. Bez `attempts` i `last_error` przycisk „ponów" nie ma na czym pracować. Bez `idempotency_key` ponowienie potrafi wysłać klientowi drugiego SMS-a. Bez `recipient` nie da się obsłużyć powiadomień wewnętrznych (I1–I4), które nie idą do klienta.

Dodatkowo: `lead_id` jako jedyne powiązanie uniemożliwia powiadomienia serwisowe (N10–N14) i usterkowe (N15–N18), które dotyczą instalacji i zgłoszeń, a nie leadów. Potrzebne polimorficzne powiązanie albo osobne kolumny nullable.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** kolejka przebudowana, `message_templates` również.

**Wykonane:** `notification_queue` ma 21 kolumn zamiast 5 — pełny zestaw do ponawiania (`attempts`, `next_attempt_at`, `last_error`, `dead_lettered_at`), unikalny `idempotency_key`, `payload`, `recipient_kind` z `recipient_user_id` dla odbiorców wewnętrznych oraz `recipient_address` z chwili wysyłki. `message_templates` dostało `template_key` jako klucz unikalny zamiast `trigger_event` w wolnym tekście. Kanał `PUSH` dodany w obu tabelach. Wykaz zmian: `docs/architecture/CHANGES-ADR-007.md`.

**Powiązanie polimorficzne rozwiązane czterema kluczami nullable** (`lead_id`, `installation_id`, `service_id`, `incident_id`) z warunkiem `CHECK`, że dokładnie jeden jest niepusty — zamiast pary „typ + id" bez integralności referencyjnej. Kosztuje trzy kolumny, ale baza nadal pilnuje, że wskazywany rekord istnieje.

**`recipient_address` jest tu nieoczywisty, a istotny.** Bez zapisania numeru czy e-maila z chwili wysyłki historia komunikacji kłamie po każdej zmianie danych kontaktowych: SMS wysłany na stary numer wyświetlałby się przy nowym.

**Status `DEAD_LETTER` jest osobny od `ERROR`** — pierwszy znaczy „poddaliśmy się", drugi „spróbujemy jeszcze raz". Bez tego rozróżnienia lista błędów w Centrum Powiadomień rośnie bez końca i przestaje cokolwiek mówić.

**Odblokowane:** `NTF-RETRY` (`BLOCKED` → `TODO`) z kryteriami, które da się przetestować — nie „kolumny istnieją", tylko „dwa równoległe ponowienia z tym samym kluczem dają jedną wysyłkę". Dopisane `NTF-POLY` i `NTF-HISTORY`. Rejestr ma 51 wymagań.

**Nowa reguła bramki `R18-channel-window`:** każdy kanał użyty w katalogu musi mieć zdefiniowane okno wysyłki, a odbiorca musi być znany. Kanał bez okna to wiadomość, o której planista nie wie, kiedy ją wysłać. Bramka ma 17 reguł, wszystkie z dowodem żywotności.

---

## ADR-008 — Brak `audit_log` przy wymogach RODO ✅ ROZSTRZYGNIĘTE 2026-08-18

`database_model.md` §4 opisuje twarde usuwanie, anonimizację i uprawnienia administratora, ale w schemacie nie ma tabeli audytowej. Przy operacjach na danych osobowych brak rejestru „kto, kiedy, co i na jakiej podstawie" jest problemem zgodnościowym, nie technicznym.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** tabela `audit_log`, append-only, rejestrująca sześć operacji z `AUDIT_REQUIREMENTS.mustLog`.

**Wykonane:** tabela dodana do modelu, `AUDIT_REQUIREMENTS` podniesione z `PROPOSED` do `STABLE` i uzupełnione o zamkniętą listę podstaw prawnych. `SEC-AUDIT-LOG` odblokowane (`BLOCKED` → `TODO`) z sześcioma wykonywalnymi kryteriami. Wykaz zmian: `docs/architecture/CHANGES-ADR-008.md`.

**Append-only musi wymuszać baza, nie konwencja.** RLS odrzuca `UPDATE` i `DELETE` dla wszystkich ról łącznie z `admin` — bo to właśnie administrator wykonuje operacje, które ten rejestr ma dokumentować. Rejestr, który on sam może poprawić, nie jest dowodem niczego.

**Cztery decyzje projektowe:** `entity_id` bez klucza obcego (klucz do usuniętego rekordu albo blokuje usunięcie, albo kasuje wpis razem z nim); `actor_role` z chwili operacji, nie odczytana przez relację (awans pracownika przepisałby historię wstecz); `legal_basis` z zamkniętej listy plus obowiązkowe `justification` (rejestr mówiący, że klient został usunięty, ale nie czy z żądania RODO, czy przez pomyłkę, nie odpowiada na pytanie kontroli); `before_snapshot` z zanonimizowanymi danymi wrażliwymi (rejestr wykonania prawa do bycia zapomnianym nie może być miejscem, w którym te dane przetrwają).

**Dwie warstwy egzekwowania.** Reguła walidatora `R22-audit-append-only` sprawdza, czy deklaracja `appendOnly: true` zgadza się z macierzą uprawnień — wiersz przyznający komukolwiek `update` na `audit_log` zatrzymuje bramkę. Reguła `adr008-audit-mutate` blokuje `auditLog.update`, `deleteMany` i `DELETE FROM audit_log` w kodzie i migracjach. Bramka ma 21 reguł.

---

## ADR-009 — Certyfikaty: zespół kontra osoba ✅ ROZSTRZYGNIĘTE 2026-08-18

`b2b_crm_specifications.md` §6 opisuje skład osobowy zespołu i certyfikaty z polem **„posiadacz"** — czyli certyfikat należy do konkretnej osoby. Kryterium akceptacji mówi o alercie „przed wygaśnięciem certyfikatu **któregokolwiek członka zespołu**".

`database_model.md` przechowuje w `ZESPOLY_MONTERSKIE` jedno pole `certyfikat_fgaz` i jedną datę na cały zespół, plus `koordynator_imie_nazwisko` jako zwykły tekst i `liczba_brygad` jako liczbę.

Nie da się zrealizować wymagania w tym modelu. Brakuje tabeli `crew_members` (a właściwie `employees` + przypisanie do zespołu) oraz `certificates` powiązanych z osobą.

**Decyzja (Michal, 2026-08-18): nie ewidencjonujemy członków zespołu osobno.** Każdy zespół reprezentuje jedna osoba, która bierze odpowiedzialność za montaż i posiada wymagane uprawnienia. Wystarczy przechowywać jej dane.

**Wykonane:** `coordinator_full_name` (wolny tekst) zastąpione parą `representative_user_id` + `representative_full_name`. Klucz obcy do `authorized_users` daje przedstawicielowi konto w roli `monter`. Pola certyfikatów zostają przy zespole, ale opisy mówią wprost, czyje to certyfikaty. `CRM-ZESP-AC1` przepisane z „któregokolwiek członka zespołu" na przedstawiciela i uzupełnione o kryteria wykonalne. Dodane `CRM-ZESP-REP`. Wykaz zmian: `docs/architecture/CHANGES-ADR-009.md`.

**Wymaganie było niewykonalne, bo opisywało inny model niż ten, który budujemy.** Rozwiązaniem nie okazała się rozbudowa schematu, tylko poprawienie wymagania — sformułowanie „któregokolwiek członka zespołu" pochodziło z dokumentu, nie z rzeczywistej potrzeby. To warto odnotować, bo domyślną reakcją na niewykonalne wymaganie jest dobudowanie tabel.

**Nie dodałem tu żadnej nowej reguły bramki** i to jest świadome. Decyzja polega na tym, czego *nie* budujemy; ochroną jest istniejący guard `crewCertsValid` oraz kryteria akceptacji. Reguła zakazująca tabeli `crew_members` blokowałaby przyszłą rozbudowę, nie chroniąc przed niczym dzisiaj.

**Kiedy ta decyzja przestanie wystarczać:** gdy trzeba będzie wykazać, który konkretny monter wykonał daną instalację — przy reklamacji gwarancyjnej albo kontroli F-Gaz. Wtedy potrzebna będzie ewidencja osób powiązana z `installation_phases`.

---

## ADR-010 — Podwójne źródło harmonogramu serwisu ✅ ROZSTRZYGNIĘTE 2026-08-18

`installations.next_service_date` oraz osobna tabela `serwisy` z `scheduled_date`. Który rekord jest prawdą, gdy klient przełoży termin przeglądu? `b2b_app_requirements.md` Epic 4 mówi, że cron przegląda `installations`, ale `b2b_crm_specifications.md` §3 opisuje statusy serwisu („Oczekuje na kontakt / Zaplanowany / Wykonany / Zignorowany"), które muszą mieszkać w `serwisy`.

**Decyzja (Michal, 2026-08-18):** cron przegląda `installations.next_service_date`, żeby wysłać klientowi przypomnienie z prośbą o rezerwację. Gdy klient zarezerwuje termin, data trafia do `services` i **od tego momentu prawdą jest `services`**.

**Wykonane:** rozdział ról zapisany wprost w `database_model.md` wraz z tabelą porównawczą i opisem cyklu. `services` dostało `booking_id`, `reminder_sent_at` i statusy zgodne z CRM §3. `installations.next_service_date` opisane jako pole pochodne. Dwa nowe wymagania. Wykaz zmian: `docs/architecture/CHANGES-ADR-010.md`.

**Statusy serwisu były niekompletne.** Poprzedni zestaw (`PLANNED SCHEDULED COMPLETED CANCELLED`) nie miał odpowiednika dla „Oczekuje na kontakt" z CRM §3 — czyli dla stanu, w którym rekord serwisu spędza najwięcej czasu: termin się zbliża, klient jeszcze nie zarezerwował. Zestaw to teraz `AWAITING_CONTACT`, `SCHEDULED`, `COMPLETED`, `IGNORED`.

**`reminder_sent_at` chroni przed powtórką.** Cron uruchamiany co godzinę i warunek „30 dni przed" prawdziwy przez całą dobę dają dwadzieścia cztery identyczne SMS-y dziennie. Klucz idempotencji z ADR-007 zatrzymałby duplikaty w obrębie jednej próby wysyłki, ale nie powstrzymałby crona przed kolejkowaniem nowej wiadomości przy każdym przebiegu.

**Egzekwowanie:** reguła `adr010-derived-write` blokuje zapis do `next_service_date` z kodu aplikacji. Pole jest wyliczane przy zamknięciu montażu; ręczna zmiana rozjeżdża je z tym, co system policzy przy następnym przeliczeniu — czyli przywraca dokładnie ten problem, który ten ADR zamyka. Odczyt przechodzi bez przeszkód.

---

## ADR-011 — Dwie różne definicje SLA pod tą samą nazwą ✅ ROZSTRZYGNIĘTE 2026-08-18

- Logistyka: czerwony < 3 dni **do montażu** (`b2b_app_requirements.md` Epic 2).
- Usterki: czerwony po 48 h **od zgłoszenia bez akcji** (`b2b_crm_specifications.md` §4).
- Instalacje: pomarańczowy po godz. 16:00 w dniu montażu (§2).
- Serwisy: czerwony dla zaległych, żółty dla nadchodzących w 30 dni (§3).

Cztery różne mechanizmy nazywane „SLA". Agent implementujący jeden widok skopiuje próg z drugiego.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** osiem nazwanych polityk w `contracts/sla.contract.mjs`, zakaz literałów w kodzie aplikacji.

**Wykonane:** ostrzeżenie o magicznych liczbach zamienione na **blokadę** i rozbite na trzy reguły — porównania dat z literałem, godzina alertu instalacyjnego i przeliczanie okresów z liczb. Dodana reguła walidatora `R21-sla-shape`. Wykaz zmian: `docs/architecture/CHANGES-ADR-011.md`.

**Reguła ostrzegawcza nie chroni przed niczym.** Do tej pory `magic-sla` miała `severity: 'warn'`, czyli agent widział komunikat i pisał dalej. Skoro polityka jest rozstrzygnięta, próg wpisany z palca jest błędem, a nie sugestią — reguła blokuje zapis.

**`R21-sla-shape` pilnuje, żeby „SLA" znaczyło coś konkretnego:** każda polityka deklaruje dokładnie jeden kształt pomiaru (pasma, dni, sztuki albo godzina dnia), ma opisany zasięg i wskazuje wymaganie. Próg bez wymagania to liczba, której nikt nie żądał i której nie da się przetestować.

**Przy okazji wyszła zaległość po ADR-002:** `INCIDENT_RESPONSE` odwoływał się do priorytetów `KRYTYCZNY` i `SREDNI`, czyli wartości przemianowanych na `CRITICAL` i `MEDIUM`. Zegar 48 godzin nie zapaliłby się dla żadnej usterki, bo porównywałby się z wartościami, których nie ma w bazie. Poprawione, a `R21` porównuje teraz priorytety ze zbiorem `INCIDENT_PRIORITIES` i nie pozwoli na powtórkę.

---

## ADR-012 — Braki w modelu danych wobec wymagań CRM ✅ ROZSTRZYGNIĘTE 2026-08-18

Karta 360 i pozostałe widoki wymagają danych, dla których nie ma tabel:

| Czego wymaga CRM | Czego brakuje w schemacie |
|---|---|
| Zakładka „Dokumenty": wyceny PDF, umowy, protokoły, zdjęcia | brak `documents` / `invoices` (są tylko `protokol_url` i `zdjecia_z_montazu` jako pola) |
| „Ostatni kontakt", „logowanie próby kontaktu", „Zadzwoń do klienta" | brak `contact_log` |
| Notatki na karcie klienta | brak `notes` |
| „Zarządzaj regionem — kody pocztowe do auto-przypisywania" | brak `regions` / `postal_code_mapping` |
| Status dostępności audytora (Aktywny/Urlop/Zwolnienie), „Zablokuj kalendarz" | brak `absences` / `availability` |
| Rezerwacja terminu przez klienta | brak `bookings` / `calendar_slots` — a to jest rdzeń przejść E3→E4 i rollbacku |
| Dzienny cap audytora (5) | brak pola konfiguracyjnego |
| Pojazd przypisany do ekipy | brak `vehicles` |
| Soft leady z Exit Intent | brak tabeli |
| Historia komunikacji na Karcie 360 | wymaga `notification_queue` z powiązaniem do klienta, nie tylko leada (patrz ADR-007) |

Najpoważniejszy był brak `bookings`. Rezerwacja terminu występuje w trzech przejściach (T03, T13, T14) i w całym module serwisów, a w modelu danych istniała wyłącznie jako `leads.booking_date` — pojedyncze pole, które nie obsłuży ani współbieżności, ani historii zmian terminu, ani dostępności ekipy.

**Decyzja (zaakceptowana przez Michała 2026-08-18):** dodane wszystkie brakujące tabele. Model ma teraz 27 encji zamiast 17.

**Wykonane:** `database_model.md` rozszerzony o 10 tabel (`bookings`, `absences`, `regions`, `region_postal_codes`, `documents`, `invoices`, `contact_log`, `notes`, `vehicles`, `soft_leads`) wraz z relacjami i opisami. `auditors` dostał `region_id`, `daily_audit_cap` i `availability_status`. Pole `leads.booking_date` **usunięte** — jedno źródło prawdy o terminie. Kontrakt RBAC rozszerzony o 9 zasobów. Dwa wymagania wzmocnione o kryteria, które dopiero teraz da się przetestować, dwa nowe dopisane. Wykaz zmian: `docs/architecture/CHANGES-ADR-012.md`.

**Atomowość rezerwacji należy do bazy, nie do kodu.** `FNL-E3-E4` wymagał braku podwójnej rezerwacji przy równoległych żądaniach — sprawdzenie „czy wolne" w Server Action tego nie daje, bo między odczytem a zapisem mieści się drugie żądanie. Ochroną jest unikalny indeks częściowy, a kryterium akceptacji brzmi teraz: dwa równoległe żądania na ten sam slot, dokładnie jeden sukces.

**Walidator wyłapał błąd w mojej propozycji.** Wpisałem `klient` jako rolę mogącą tworzyć rezerwacje; reguła `R13-rbac` odrzuciła to, bo klient nie ma konta w `authorized_users`. Rezerwacja przez klienta idzie publicznym linkiem z tokenem — to osobny wąski endpoint z własnym guardem, a nie wiersz w macierzy uprawnień. Rozróżnienie jest istotne, bo wpisanie klienta do RBAC otworzyłoby mu drogę do pozostałych zasobów tej samej roli.

---

## Rekomendowana kolejność Twoich decyzji

1. ~~**ADR-001**~~ — ✅ rozstrzygnięte 2026-08-18, dokumenty poprawione, reguła w bramce.
2. ~~**ADR-003**~~ — ✅ rozstrzygnięte 2026-08-18, dokument przenumerowany, reguła w bramce.
3. ~~**ADR-012**~~ i ~~**ADR-007**~~ — ✅ oba rozstrzygnięte 2026-08-18.
4. ~~**ADR-004**~~, ~~**ADR-009**~~ — ✅ oba rozstrzygnięte 2026-08-18.
5. ~~**ADR-008**~~, ~~**ADR-002**~~, ~~**ADR-010**~~, ~~**ADR-011**~~ — ✅ wszystkie rozstrzygnięte.
6. ~~**ADR-005**~~, ~~**ADR-006**~~ — ✅ oba rozstrzygnięte 2026-08-18.

**Wszystkie dwanaście punktów zostało rozstrzygniętych 2026-08-18.** Kontrakt nie ma elementów w statusie `PROPOSED`, rejestr wymagań nie ma pozycji `BLOCKED`, walidator zgłasza zero ostrzeżeń. Od tego momentu krok zerowy jest zamknięty i agenci mogą pracować nad dowolnym modułem — pod warunkiem że kolejne zmiany kontraktu przechodzą przez okno kontraktowe.

Po każdej decyzji: aktualizacja `contracts/*.contract.mjs` przez `contract-steward` w otwartym oknie, potem `node tools/kk-codegen.mjs`, potem `node tools/kk-validate.mjs --strict`.
