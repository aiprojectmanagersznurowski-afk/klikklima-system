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
- **Asymetria flag aktywności:** `audytorzy.is_active` kontra `zespoly_monterskie.aktywny`. Bramka logowania czyta tylko pierwszą; drugiej nie czyta nic w celach autoryzacji.
- **`contracts/rbac.contract.mjs` nie zna kolumn, tylko zasoby.** Każde `audytor:own` w `update` na `auditors` daje pracownikowi dostęp również do `is_active`. Planując pole edytowalne przez pracownika, pytaj, czy nie musi mieszkać w osobnej encji.
