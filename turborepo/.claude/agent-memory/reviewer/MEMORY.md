# Pamięć agenta: reviewer

- [Świadomie czerwony booking-validation.spec.ts](project_known_red_e2e.md) — czerwień E2E sprzed WO B2C-TRIAGE-DISQUALIFY; nie kwalifikuj jako regresji.
- [allowInWriteHook w guard-forbidden](project_allow_in_write_hook.md) — celowe wyłączenie reguł adr002-pl-* w hooku zapisu; co zweryfikować, zanim to zgłosisz.
- [Dowód przez mutację, nie przez lekturę](feedback_mutation_proof_required.md) — jak sprawdzać, czy asercja ma zęby; pułapka niekonfigurowanego mocka; klasyfikacja mutantów.
- [Bramki can() bez pokrycia testami](project_can_gate_untested.md) — systemowa, przedistniejąca luka linkage kod↔kontrakt; MAJOR, nie BLOCKER.
- [Baseline nazewnictwa rośnie z każdym nowym kodem](project_naming_baseline_grows.md) — czerwone kk-naming na legacy `audytorzy`/`zespoly_monterskie` to nie defekt.
- [Bramka nie widzi next build](gate-blindspot-next-build.md) — zielony vitest+tsc nie dowodzi, że aplikacja się buduje; przy zmianach w app/ uruchom `npx next build`.
- [Mutacyjna weryfikacja testów](review-mutation-testing-checklist.md) — co mutować, żeby wykryć false-green; testy statyczne na treści .tsx są typową dziurą.
- [kk-authz-gate nie widzi helperów z `tx`](gate-blindspot-authz-tx-helpers.md) — AUTHZ-EXEMPT to martwy tekst; dowód „to endpoint" daje server-reference-manifest.json, nie grep w chunku.
- [FOR UPDATE na leady bez testu](project-rollback-read-committed-race.md) — blokada w rollbackLogisticsOrder jest w kodzie, ale mutanty M1/M4 przeżywają wszystkie 633 testy.
- [Harness mutacyjny w scratchpadzie](reviewer-mutation-harness-scratchpad.md) — jak mutować kod bez prawa zapisu do repo: vitest .mjs config + alias na kopię modułu.
- [Sticky z-index ties i nietestowane czyste funkcje](review-ui-batch-sticky-and-untested-pure-fn.md) — jak realnie ocenić konflikt z-index nagłówek/ciało tabeli i kiedy brak testu obok testowanego bliźniaka to MAJOR.
- [Audyt spójności wizualnej b2b-web — kontekst](project_ui_consistency_audit_b2b.md) — wspólne prymitywy StatusPill/shortId/EMPTY_VALUE/--radius-control, gdzie zwykle chowa się dryf.
- [Technika recenzji wielobatchowej](feedback_cross_batch_consistency_checks.md) — grep wspólnego wzorca przez wszystkie dotknięte pliki naraz, nie czytanie diffów osobno.
- [SEC-AUDIT-LOG-MANUAL-STATUS Fala A — przeszła czysto](project_sec_audit_log_manual_status_wave_a.md) — dlaczego klasyfikator nieużywany w archiveLost/returnToFunnel jest OK; co inaczej sprawdzić w Fali B/C.
- [Fałszywy test TOCTOU (mockResolvedValueOnce)](feedback_toctou_mock_sequencing.md) — testy współbieżności oparte na kolejności mocków przechodzą nawet bez FOR UPDATE w kodzie; zawsze sprawdź produkcyjny SELECT ... FOR UPDATE, nie ufaj deklaracji testu.
