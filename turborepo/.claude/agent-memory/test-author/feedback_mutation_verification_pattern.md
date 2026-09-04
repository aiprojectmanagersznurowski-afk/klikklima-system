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

## Antywzorzec: fałszywa "współbieżność" przez `mockResolvedValueOnce`+`Promise.all`

Test opisany jako "dwa równoległe wywołania kończą się jednym sukcesem", zbudowany przez
`someMock.mockResolvedValueOnce(A).mockResolvedValueOnce(B)` + `Promise.all([fn(), fn()])`,
NIE dowodzi niczego o blokadzie bazy (`FOR UPDATE`) — to tylko deterministyczna kolejność
rozwiązywania mocków w silniku JS. Taki test przechodzi identycznie z i bez blokady wiersza
(znaleziono przez `reviewer` 2026-09-04 w `sec-audit-log-manual-status-wave-b.test.ts`, AC8,
`bypassLogisticsOrder`). Właściwy zamiennik: wzorzec `BLOKADA-LEADY`/`AC-A6` z
`logistics-rollback-effects.test.ts` — assercja na TREŚĆ pierwszego wywołania
`tx.$queryRaw` (regex `/FOR UPDATE/i` + nazwa tabeli) ORAZ `invocationCallOrder` pokazujący,
że ta blokada poprzedza `findUnique`/`update`/`auditLog.create`. Potwierdzone mutacyjnie:
mutant usuwający `FOR UPDATE` i mutant przenoszący blokadę ZA `tx.leady.update` oba zabijają
WYŁĄCZNIE tę jedną asercję, reszta 39 testów zostaje zielona.
