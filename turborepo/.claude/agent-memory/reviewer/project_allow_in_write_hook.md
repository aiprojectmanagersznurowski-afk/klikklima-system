---
name: allow-in-write-hook-decision
description: Reguły adr002-pl-* są celowo wyłączone w hooku zapisu przez pole allowInWriteHook — decyzja człowieka, nie sabotaż bramki
metadata:
  type: project
---

`tools/kk.config.mjs` ma na regułach `adr002-pl-tables` / `adr002-pl-columns` pole `allowInWriteHook: true`,
a `.claude/hooks/guard-forbidden.mjs` je respektuje. Efekt: hook **zapisu** nie blokuje już plików
z polskimi nazwami tabel (`leady`, `audytorzy`, `zespoly_monterskie`) w CAŁYM repo.

**Why:** decyzja człowieka z 2026-08-20 (WO `CRM-SAFE-RECORD-ACTIONS`, sekcja „Decyzje człowieka"),
podjęta po tym, jak `contract-steward` i `test-author` trzykrotnie utknęli na tej samej blokadzie przy
zmianach czysto addytywnych. Dług `KK-NAMING-BASELINE` jest zamrożony — tabele naprawdę nazywają się
po polsku, więc blokowanie każdego zapisu do `apps/b2b-web` nie dawało żadnego sygnału.

**How to apply:** widząc `M .claude/hooks/guard-forbidden.mjs` albo `M tools/kk.config.mjs` z tym polem,
nie kwalifikuj tego automatycznie jako obejścia bramki. Zweryfikuj natomiast dwie rzeczy, bo tylko one
trzymają dług w ryzach: (1) `allowInWriteHook` czyta WYŁĄCZNIE `guard-forbidden.mjs` — nie
`tools/kk-naming.mjs` ani `tools/guard-core.mjs`; (2) `node tools/kk-naming.mjs --check-baseline` nadal
wychodzi zielony i to on jest jedyną realną bramką ADR-002. Jeżeli którakolwiek z tych dwóch rzeczy
przestanie być prawdą — to już jest BLOCKER.
