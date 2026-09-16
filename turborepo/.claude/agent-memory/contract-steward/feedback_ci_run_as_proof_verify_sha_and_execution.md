---
name: ci-run-as-proof-verify-sha-and-execution
description: Zielony przebieg CI jako dowód domknięcia — sprawdź SAM headSha, conclusion każdego joba I log potwierdzający, że test faktycznie się wykonał, nie został pominięty
metadata:
  type: feedback
---

Gdy warunkiem domknięcia wymagania jest „zielony przebieg testu w CI", nie przyjmuj cudzego opisu przebiegu — zweryfikuj trzy rzeczy osobno, własnymi komendami.

**Why:** zielony job to za mało. Może odpowiadać STARSZEMU commitowi (sprzed poprawki), a suite może być zielona dlatego, że test został pominięty, odfiltrowany wzorcem plików albo w ogóle się nie zaimportował. Dokładnie te dwa tryby porażki powołały do życia kryterium „termin w przeszłości" w [[project_cal_slot_engine_done]]: lukę ujawnił dopiero PIERWSZY prawdziwy przebieg na żywym Postgresie, a wcześniejsze zielone bramki oparte na `tsc` i atrapach jej nie widziały.

**How to apply:** przed zmianą statusu na `DONE`:
1. `gh run view <id> --json headSha,headBranch` i porównaj pełny SHA z `git log -1 --format=%H`. Jeśli warunek powrotu wskazywał konkretny commit z poprawką — potwierdź `git merge-base --is-ancestor <poprawka> <headSha>`.
2. `gh run view <id> --json jobs --jq '.jobs[] | {name, conclusion}'` — KAŻDY job `success`, ze szczególnym naciskiem na ten uruchamiający itesty.
3. `gh run view <id> --log --job=<databaseId>` i wygrep nazwę pliku testu plus podsumowanie `Tests N passed` — szukasz dowodu WYKONANIA (`✓ plik (N tests)`, zero `skipped`), nie samego braku błędu. Potem sprawdź w pliku, że interesujący przypadek brzegowy fizycznie w nim jest i mieści się w policzonych N.

Dowód z wykonania na żywej bazie stoi WYŻEJ niż `tsc`, przegląd kodu i testy na atrapie ([[feedback_mock_cannot_prove_db_constraint]]). Odnotuj w `note` numer przebiegu i pełny SHA — przyszły odczyt rejestru ma rozpoznać, że to mocniejszy rodzaj dowodu. Odwrotny kierunek tej samej zasady: [[feedback_ci_itest_run_invalidates_tsc_closures]].
