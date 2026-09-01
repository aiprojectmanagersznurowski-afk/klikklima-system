# Pamięć agenta: reviewer

- [Świadomie czerwony booking-validation.spec.ts](project_known_red_e2e.md) — czerwień E2E sprzed WO B2C-TRIAGE-DISQUALIFY; nie kwalifikuj jako regresji.
- [allowInWriteHook w guard-forbidden](project_allow_in_write_hook.md) — celowe wyłączenie reguł adr002-pl-* w hooku zapisu; co zweryfikować, zanim to zgłosisz.
- [Dowód przez mutację, nie przez lekturę](feedback_mutation_proof_required.md) — jak sprawdzać, czy asercja ma zęby; pułapka niekonfigurowanego mocka; klasyfikacja mutantów.
- [Bramki can() bez pokrycia testami](project_can_gate_untested.md) — systemowa, przedistniejąca luka linkage kod↔kontrakt; MAJOR, nie BLOCKER.
- [Baseline nazewnictwa rośnie z każdym nowym kodem](project_naming_baseline_grows.md) — czerwone kk-naming na legacy `audytorzy`/`zespoly_monterskie` to nie defekt.
- [Bramka nie widzi next build](gate-blindspot-next-build.md) — zielony vitest+tsc nie dowodzi, że aplikacja się buduje; przy zmianach w app/ uruchom `npx next build`.
- [Mutacyjna weryfikacja testów](review-mutation-testing-checklist.md) — co mutować, żeby wykryć false-green; testy statyczne na treści .tsx są typową dziurą.
