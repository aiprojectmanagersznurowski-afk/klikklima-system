---
name: precommit-absolute-debt
description: Po naprawie KK-PRECOMMIT-BASELINE pre-commit nadal blokuje 4 pliki B2B na regułach BEZ baseline (as-any, green-sla) — to jedyny pozostały powód --no-verify
metadata:
  type: project
---

Po tickecie `KK-PRECOMMIT-BASELINE` (2026-08-20) reguły `adr002-*` nie blokują już `tools/kk-precommit-scan.mjs`
(pilnuje ich krok 3, `kk-naming.mjs --check-baseline`). Zostały jednak realne naruszenia reguł ABSOLUTNYCH,
bez mechanizmu baseline, w plikach z commita `f3cfbb8`:

- `as-any` — `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx`, `.../leads/leads-client.tsx`
- `green-sla` (`text-green-500`) — `apps/b2b-web/src/app/(dashboard)/auditors/auditors-client.tsx`
- `as-any` FAŁSZYWIE DODATNI — `apps/b2b-web/tests/leads-archive-lost.test.ts:203`: fraza występuje
  w polskim komentarzu, który tłumaczy, że autor świadomie NIE użył tego rzutowania. Reguła nie odróżnia
  użycia od cytatu.

**Why:** te reguły są celowo zerotolerancyjne i nie mają baseline'u — to nie dług do zamrożenia, tylko do naprawy.
Dopóki istnieją, każdy commit dotykający tych plików wymaga `--no-verify`, co uczy pomijania bramki.

**How to apply:** jeżeli człowiek znów zgłosi, że commit wymaga `--no-verify`, sprawdź NAJPIERW czy to te
pliki — nie osłabiaj reguł absolutnych i nie dopisuj ich do `skipRules`. Naprawa `as any` należy do
implementera (typy Prisma), `text-green-500` do implementera UI, a fałszywy trafik w komentarzu to osobna
decyzja o zawężeniu regexa — wymaga zgody człowieka. Powiązane: [[contract-write-blocker]].
