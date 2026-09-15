---
name: ci-itest-run-invalidates-tsc-closures
description: Pierwszy prawdziwy przebieg itestów w CI unieważnia domknięcia oparte o "tsc czysty + wzorzec strukturalny" — traktuj je jako warunkowe, nie ostateczne
metadata:
  type: feedback
---

Domknięcie wymagania na podstawie „`tsc --noEmit` czysty + identyczny wzorzec strukturalny jak test zweryfikowany na żywo" jest **warunkowe**. Gdy itesty po raz pierwszy naprawdę się uruchomią (CI z Dockerem), spodziewaj się, że część takich domknięć upadnie — i cofnij status, zamiast dopisywać wyjaśnienie do `note`.

**Why:** 2026-09-15, GitHub Actions run `34937766843` (PR #1) — pierwszy przebieg itestów na żywym Postgresie. `CAL-SLOT-ENGINE` (`DONE` od 2026-09-10, 55 zielonych testów na atrapie) okazał się przepuszczać rezerwację terminu, który już minął. Atrapy podawały czasy z fikstur, więc „przeszłość" nigdy nie była przeszłością. Dług tego typu jest jawnie zapisany w `note` przy `FLD-BOOKING-ATOMIC-ASSIGN` i `FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT` — te wpisy są następnymi kandydatami do upadku.

**How to apply:**
- Zlecenie „CI ujawniło lukę w wymaganiu ze statusem `DONE`" rozstrzygaj na korzyść **cofnięcia statusu na `TODO`**, gdy test już istnieje i jest czerwony, a naprawa nastąpi w tej samej turze. Nowe ID zakładaj tylko wtedy, gdy kryterium jest OSOBNĄ funkcjonalnością i nie ma kto go naprawić teraz — patrz [[feedback_closing_requirement_with_residual_debt]].
- W `note` zapisz WPROST, że status został cofnięty, z jakiego przebiegu CI i co jest warunkiem powrotu. Cofnięcie bez śladu wygląda później jak pomyłka rejestracji.
- Zanim zaufasz zleceniu mówiącemu „nigdzie nie ma sprawdzenia X" — przeczytaj całe pliki i zrób grep. Premisa bywa prawdziwa, ale dowód należy do Ciebie ([[feedback_verify_premise_before_baseline]]).
- `guard-paths` blokuje stewardowi zapis do scratchpada. Długi komunikat commita podawaj przez `git commit -F - <<'EOF'`, nie przez `$(cat <<EOF)` — nawiasy w treści (np. `now()`) wywalają podstawienie basha.
