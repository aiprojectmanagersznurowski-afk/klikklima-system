---
name: repo-drift-traps
description: Miejsca w KlikKlima, gdzie kod i kontrakt rozjeżdżają się po cichu — sprawdzaj je przy każdym Work Orderze z domeny funnel/crm
metadata:
  type: project
---

Kod panelu B2B ma **własną, równoległą maszynę stanów** (`ALLOWED_TRANSITIONS` w `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`), niezależną od `contracts/funnel.contract.mjs`. Żaden plik w `apps/b2b-web` nie importuje `@klikklima/contracts`.

**Why:** kontrakt jest źródłem prawdy (zasada zerowa), ale nie ma dziś żadnego konsumenta po stronie B2B — więc „przejście istnieje w kontrakcie" nie znaczy „działa w aplikacji". Odkryte przy WO `CRM-SAFE-RECORD-ACTIONS` (2026-08-20): kontrakt ma T15 `QUOTE_REJECTED → AUDIT_COMPLETED`, a UI oferuje `QUOTE_REJECTED → NEW_LEAD`.

**How to apply:** pisząc WO dotyczący przejścia lejka, ZAWSZE porównaj kontrakt z `ALLOWED_TRANSITIONS` i etykietami w `leads-client.tsx`. Rozjazd wypisz jako osobny punkt — implementer inaczej „naprawi" jedną stronę i zostawi drugą.

Stałe pułapki tego repo, weryfikowane wielokrotnie:
- Prisma `enum LeadStatus` jest **uboższy** niż stany w kontrakcie (brakowało `ARCHIVED_LOST`). Sprawdzaj enum, zanim zaplanujesz przejście.
- Nie ma tabel `quotes` ani `audit_log`, mimo że kontrakt (`DELETE_POLICIES`, `AUDIT_REQUIREMENTS.mustLog`) na nie liczy.
- Server Actions w `(dashboard)/*/actions.ts` nie sprawdzają roli, a Prisma omija RLS. Każdy WO dotykający DELETE musi to wywołać jawnie.
- `apps/` zawiera tylko `b2b-web` i `b2c-web` — **Field App nie istnieje**, więc kryteria „nie loguje się do Field App" nie są testowalne end-to-end.
- `tools/kk-precommit-scan.mjs` raportuje **pierwsze** dopasowanie na plik — wcześniejsza reguła (np. `as-any`) maskuje kolejne (`service-key`). „Skaner zielony" po naprawie jednego naruszenia nie znaczy „plik czysty"; przeskanuj ponownie.
- Reguła `service-key` obejmuje wyłącznie `.tsx` pod `app|components|hooks`. Przeniesienie kodu z kluczem serwisowym do `.ts` ucisza bramkę, nie zwiększając bezpieczeństwa — w WO żądaj dowodu izolacji (`server-only`), nie samego exit 0.
- Pole `leady.lost_reason` jest przeciążone: trzyma zarówno powody ze słownika `LOST_REASONS`, jak i techniczny znacznik `AUTO_REJECT_14_DAYS` używany do filtrowania bucketu.

Powiązane: [[contract-sources-of-truth]]

Dopisane 2026-08-21 (planowanie fazy 0 Field App):
- **`tools/kk-codegen.mjs` po cichu gubi wartość progu SLA o nieznanym kształcie.** Lista skalarów (`['days','count','hourOfDay']`) jest osobna od `MEASURES` w `kk-validate.mjs`. Próg z polem spoza tej listy przechodzi walidację, a do `generated/sla.ts` trafia sam `scope`, bez liczby i bez błędu. Rozszerzając `MEASURES`, zawsze sprawdź obie listy.
- **`kk-trace.mjs` traktuje `BLOCKED` inaczej tylko w jednym miejscu**: wyłącza je z ostrzeżenia „HIGH RISK bez testu". W `violations` liczy się status `DONE`/`IMPLEMENTING` bez testu. To jedyna semantyka `BLOCKED` w repo — poza tym status nic nie znaczy.
- **`apps/b2c-web/app/actions/leads.ts` wstawia do `adresy` kolumny `lat`/`lng`, które nie istnieją** (migracja z `75da8c5` dodała `latitude`/`longitude`). `field_app_requirements.md#6.3` twierdzi, że ta ścieżka „zapisuje współrzędne" — opisuje intencję, nie skutek. Jedyne wywołanie zapisu leada z UI to `saveLead` w `Step8Booking.tsx:195`.
- **`kk-trace.mjs` dopasowuje ID wymagania w komentarzu testu, nie zasób.** Wymaganie o zakresie zbiorczym („we WSZYSTKICH 7 widokach CRM", `CRM-DELETE-ADMIN-ONLY`) pokazuje się jako ✓ pokryte po naprawieniu dwóch widoków z siedmiu. Przy każdym wymaganiu mówiącym „wszystkie/każdy", policz ścieżki w kodzie ręcznie — zielony trace nic tu nie znaczy.
- **Ta sama encja bywa kasowana z dwóch widoków.** `deleteLogisticsOrderAction` (`logistics/actions.ts`) robi `prisma.leady.delete` — obchodzi bramkę w `deleteLeadAction`. Szukając „czy DELETE jest zabezpieczony", grepuj po TABELI (`prisma.<tabela>.delete`), nie po nazwie widoku.
- **`DELETE_POLICIES.clients = ANONYMIZE_OR_SET_NULL`, a kod robi twardy `prisma.klienci.delete`**; dokument (`b2b_crm_specifications.md:32`) pisze „twarde usunięcie / usunięcie zgodne z RODO" i sam nie rozstrzyga. Stała sprzeczność — zgłaszaj jako WYMAGA DECYZJI, nie wybieraj.
- **Asymetria flag aktywności:** `audytorzy.is_active` kontra `zespoly_monterskie.aktywny`. Bramka logowania czyta tylko pierwszą; drugiej nie czyta nic w celach autoryzacji.
- **`contracts/rbac.contract.mjs` nie zna kolumn, tylko zasoby.**
 Każde `audytor:own` w `update` na `auditors` daje pracownikowi dostęp również do `is_active`. Planując pole edytowalne przez pracownika, pytaj, czy nie musi mieszkać w osobnej encji.

Dopisane 2026-08-26 (WO `SEC-AUTHZ-B2B-MUTATIONS`, po zbudowaniu `tools/kk-authz-gate.mjs`):
- **`tools/kk-authz-gate.mjs` to jedyne narzędzie odpowiadające na pytanie „czy Server Action w ogóle pyta o uprawnienia".** Uruchamiaj je na starcie każdego WO z domeny security/CRM. Ale: skanuje wyłącznie pliki o nazwie `actions.ts` pod `apps/b2b-web/src/app`, więc mutacja w Route Handlerze albo w `lib/` nie zostanie wykryta — liczba znalezisk to dolna granica. Nie dowodzi też POPRAWNOŚCI pary zasób/zdolność. Świadomie niepodpięte do `verify.sh`, dopóki dług otwarty.
- **Przegląd „po nazwach akcji z wymagania" systematycznie gubi dziury.** `leads/actions.ts` był naprawiany trzy razy i po każdej naprawie wyglądał na domknięty; skaner znalazł w nim jeszcze `updateLeadStatus` i `advanceLeadStatus`. Zawsze idź po MUTACJACH w pliku, nie po liście nazw z acceptance.
- **Pole `actor` w `contracts/funnel.contract.mjs` NIE jest źródłem autoryzacji.** To pojedyncza wartość z `ACTORS` (`CLIENT|DISPATCHER|ADMIN|AUDITOR|INSTALLER|SYSTEM`), opisuje typowego wykonawcę przejścia. Nie istnieje żadne odwzorowanie `ACTORS` → `ROLES` ani w kontraktach, ani w kodzie (zero użyć `.actor` w `apps/`). Wnioskowanie „T06 ma DISPATCHER, więc admin nie może" jest błędem — zestawy ról bierz wyłącznie z `MATRIX`.
- **`RESOURCES` nie pokrywa wszystkich tabel, do których pisze kod.** Brakuje m.in. `addresses` (tabela `adresy`), mimo że `NAMING.md:30` ma dla niej nazwę. Zanim zaplanujesz bramkę, sprawdź, czy zasób w ogóle istnieje w macierzy — inaczej implementer wymyśli mapowanie sam.
- **Kolizja `installations.update` (`monter:own`) z `leads.update` (bez montera) blokuje T09 `completeInstallation`.** `updateInstallationStatus` pisze do obu tabel w jednej akcji. Żadne miejsce w kodzie nie implementuje dziś wariantu `:own` — `can()` zwraca `'own'`, a sprawdzenia własności rekordu nie ma nigdzie. Każdy WO opierający się na `:own` musi to wywołać jako osobną pracę.
- **`installations/actions.ts:assignCrew` to homonim akcji kontraktowej T05 `assignCrew`**, którą realizuje `assignCrewToLead` w `leads/actions.ts`. Martwy kod bez wywołań. Grepując „assignCrew", rozróżniaj te dwa.
- **Widok „Serwisy Gwarancyjne" prawdopodobnie kasuje niewłaściwą encję:** `getUpcomingServices` zwraca wiersze z `instalacje` z `id: inst.id`, a `deleteServiceAction` robi `prisma.serwisy.delete({ where: { id } })` — inna tabela. Do weryfikacji.
- **Liczby wystąpień podane w treści wymagania bywają artefaktem substringu.** `SEC-LEADS-LIST-SCALARS` twierdzi, że `as Lead` występuje w `leads-client.tsx` trzykrotnie — `grep -n "as Lead"` daje trzy trafienia, ale trzecie to `as LeadStatus` (legalne, ma zostać). Każdą liczbę „występuje N razy" z acceptance weryfikuj greperem i wypisuj w WO faktyczne numery linii, inaczej implementer usunie coś potrzebnego, szukając brakującego wystąpienia.
- **Test kształtu przy mockowanej Prismie dowodzi mapowania, nie `select`-a.** Mock `findMany` zwraca to, co mu wpisano, niezależnie od `select` — więc WO na minimalizację odczytu ZAWSZE musi żądać dwóch osobnych asercji: na argument przekazany do `findMany` (co weszło do pamięci serwera) i na zwrócony obiekt (co wyszło do klienta). Dodatkowo: dopóki wynik budowany jest spreadem `...lead`, „pobrane == wysłane" i mapowanie nie jest żadną drugą linią obrony.
- **Akcje zwracające `void` maskują odmowę.** Klienty CRM (`customers-client`, `incidents-client`, `services-client`, `installations-client`, `logistics-client`) pokazują komunikat sukcesu i przeładowują stronę niezależnie od wyniku. Zmiana sygnatury na `{ success, error }` jest częścią naprawy uprawnień, nie kosmetyką — bez niej AC „odmowa odróżnialna od sukcesu" nie da się spełnić.
