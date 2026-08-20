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
