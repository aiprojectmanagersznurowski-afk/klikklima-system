---
name: gate-blindspot-next-build
description: Bramka repo (kk-validate/codegen/trace/vitest/tsc) nie wykrywa błędów kompilacji Next.js — recenzja zmian w app/ musi uruchomić `npx next build`
metadata:
  type: project
---

Zielone `node tools/kk-validate.mjs`, `kk-codegen --check`, `kk-trace`, `npx vitest run` i `npx tsc --noEmit`
NIE dowodzą, że aplikacja się buduje. Żaden z tych kroków nie uruchamia transformacji Next.js.

**Why:** Vitest importuje moduł `"use server"` jako zwykły ESM — dyrektywa nie ma znaczenia, więc
synchroniczny eksport z `actions.ts` działa w teście. Podczas `next build` transformacja `"use server"`
zostawia w module wyłącznie eksporty `async`; każdy inny znika, a import po stronie klienta wywala się
błędem „Export X doesn't exist in target module". `tsc` też tego nie widzi, bo typowo wszystko się zgadza.
Złapane w recenzji WO SRV-SOURCE-OF-TRUTH-SERVICES-VIEW: `export function daysUntilService` w
`services/actions.ts` — 626/626 testów zielonych, `tsc` czysty, `next build` exit 1.

**How to apply:** Przy recenzji jakiejkolwiek zmiany w `apps/b2b-web/src/app/**` uruchom
`npx next build` w katalogu aplikacji i sprawdź kod wyjścia (uwaga: `| tail` maskuje exit code — użyj
przekierowania do pliku i `echo $?`). Szczególnie gdy diff dodaje eksport do pliku z `"use server"`
albo nowy import w komponencie `"use client"`.

**Druga dziura w tej samej rodzinie:** `apps/b2b-web/package.json` nie ma skryptu `typecheck`/`check-types`,
a `scripts/verify.sh:92` woła typy jako `optional "Typy" "has typecheck"`. Skutek: `npx tsc --noEmit -p
apps/b2b-web/tsconfig.json` może być CZERWONY, a `verify.sh` i tak przejdzie. Uruchamiaj tsc na tym projekcie
ręcznie przy każdej recenzji zmian w b2b-web (samo `npx tsc --noEmit` z roota wypisuje tylko help — trzeba `-p`).

Powiązane: [[review-mutation-testing-checklist]]
