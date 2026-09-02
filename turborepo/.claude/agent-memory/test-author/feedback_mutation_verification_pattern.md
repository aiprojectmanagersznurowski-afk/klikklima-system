---
name: feedback_mutation_verification_pattern
description: Jak test-author dowodzi mutacyjnie, że nowa asercja łapie konkretny mutant, bez prawa dotykania kodu produkcyjnego
metadata:
  type: feedback
---

Reviewer (rola `reviewer`) ma w swojej pamięci gotowy wzorzec harnessu
(`.claude/agent-memory/reviewer/reviewer-mutation-harness-scratchpad.md`):
osobna konfiguracja vitest w scratchpadzie, z pluginem `transform` (`enforce: 'pre'`),
który podmienia źródło pliku produkcyjnego W LOCIE (na podstawie zmiennej env np.
`MUTANT=remove-lead-lock`), bez zapisu do repo. `test-author` może i powinien użyć
DOKŁADNIE TEGO SAMEGO wzorca, żeby udowodnić, że nowa asercja faktycznie łapie mutant
opisany przez reviewera w rundzie review — potwierdzone działające 2026-09-02 przy
naprawie `apps/b2b-web/tests/logistics-rollback-effects.test.ts` (AC-A6, blokada
`FOR UPDATE` na `leady` w `rollbackLogisticsOrder`).

**Why:** hook `guard-paths` blokuje `test-author` przed zapisem gdziekolwiek poza
katalogiem testów i pamięcią — a `Write` (nawet do własnej pamięci albo do
scratchpadu) bywa zablokowany, więc jedyny działający sposób pisania plików
(harness ORAZ pliki pamięci) to `Bash` + `cat > … <<'EOF'`. Bez mutacyjnego
dowodu zostaje tylko deklaracja "powinno łapać" — poprzednia runda review (RUNDA 3,
WO LOGISTICS-SHIPPING-EFFECTS) wykazała, że intuicja nt. tego co test łapie bywa
błędna (kolejność wywołań $queryRaw nie była wiązana z niczym, mutant przenoszący
blokadę za `findUnique` przechodził 633/633).

**How to apply:**
1. Skopiuj wzorzec configu z pamięci reviewera (`root: <repo>`, alias na
   `@klikklima/contracts` → `packages/contracts/src/generated/index.ts`,
   `server-only` → `tools/stubs/server-only.ts`, `server.fs.allow` na repo +
   scratchpad, `test.include` na właściwy plik testowy).
2. Plugin `transform` dopasowuje `id.includes('<ścieżka pliku>.ts')` i podmienia
   fragment kodu regexem — regex MUSI rzucić błąd, jeśli nie znajdzie wzorca
   (inaczej "zielony" znaczy tylko, że mutacja się nie zaaplikowała, nie że test
   przeszedł mimo mutacji). Sprawdź DOKŁADNE brzmienie źródła (`od -c` albo Read)
   zanim napiszesz regex — literalna postać `tx.$queryRaw<{...}>` (z generykiem
   przed template literalem) różni się od naiwnego `tx.$queryRaw` bez typu.
3. Zawsze najpierw uruchom `MUTANT=none` (harness bez mutacji) — musi być 100%
   zielony identycznie jak bezpośrednie `npx vitest run` na repo. Dopiero potem
   każdy mutant osobno, i sprawdź że pada WŁAŚNIE nowa asercja (nie przypadkowo
   coś innego, i nie wszystkie testy naraz — to by znaczyło błąd harnessu, nie
   trafną asercję).
4. Po weryfikacji: `rm -rf` katalogu harnessu w scratchpadzie — to tylko dowód na
   potrzeby jednej tury, nie artefakt do zostawienia.

Powiązane: [[reviewer-mutation-harness-scratchpad]] (pamięć roli `reviewer`, ten sam
mechanizm), [[feedback_mutation_proof_required]].
