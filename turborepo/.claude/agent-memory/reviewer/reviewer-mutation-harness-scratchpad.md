---
name: reviewer-mutation-harness-scratchpad
description: Jak robić mutacyjną weryfikację testów bez prawa zapisu do repo — vitest config w scratchpadzie z aliasem podmieniającym moduł na zmutowaną kopię
metadata:
  type: feedback
---

Rola `reviewer` ma zakres zapisu ograniczony do `.claude/agent-memory/` (hook `guard-paths`),
więc **nie da się** zmutować pliku produkcyjnego ani dopisać testu-sondy w repo.
Narzędzie `Write` jest zablokowane także w scratchpadzie — pliki harnessu twórz przez
`Bash` + `cat > … <<'EOF'`.

**Wariant preferowany (prostszy od kopiowania modułu): plugin `transform` w konfiguracji
vitest.** Zamiast kopii pliku i aliasów, wtyczka z `enforce: 'pre'` i hookiem
`transform(code, id)` podmienia źródło w locie, gdy `id.includes('<ścieżka>/plik.ts')`,
sterowana `process.env.MUTANT`. Zero problemów z relatywnymi importami i module id, więc
`vi.mock` z testów trafia dokładnie tam gdzie trzeba. Każdy mutant powinien rzucać wyjątek,
gdy nie znajdzie swojego wzorca — inaczej „zielony" znaczy tylko tyle, że mutacja się nie
zaaplikowała. Sprawdź też mutanty-kontrolne, o których wiesz, że MUSZĄ zginąć.

**Wariant zapasowy** (gdy trzeba podmienić cały moduł): kopia modułu w scratchpadzie +
alias w osobnej konfiguracji vitest.

**Why:** bez tego jedynym narzędziem zostaje lektura kodu, a
[[feedback_mutation_proof_required]] wymaga dowodu przez mutację, nie przez lekturę.

**How to apply:**
1. `cp <moduł>.ts $S/mut/base.ts`, w kopii zamień importy **relatywne** na absolutne ścieżki
   do oryginalnych plików (inaczej `vi.mock('../src/...')` z testu nie trafi w ten sam module id).
2. Konfiguracja musi być `.mjs` z **gołym obiektem** (`export default { ... }`) — plik poza
   katalogiem repo nie rozwiąże `import { defineConfig } from 'vitest/config'`.
3. W konfiguracji: `root: <repo>`, `server.fs.allow: [repo, scratchpad]`, `test.include` na
   prawdziwe pliki testowe, oraz aliasy:
   `@klikklima/contracts` → `packages/contracts/src/generated/index.ts`,
   `server-only` → `tools/stubs/server-only.ts`, `@repo/database` →
   `packages/database/src/index.ts`, `next/cache`, `date-fns` → `node_modules/...`,
   i regex na specyfikator importu z testu → `process.env.MUTANT`.
4. Najpierw uruchom kopię **niezmutowaną** — musi być 100% zielona. Dopiero potem mutanty.
5. Ta sama konfiguracja z `include` na plik-sondę w scratchpadzie pozwala napisać własny test
   diagnostyczny (np. „czy funkcja rusza wiersze, których nie powinna").

**NIGDY `git checkout -- .` ani `git stash` do sprzątania po mutancie.** Przywracaj wyłącznie
konkretną ścieżkę: `git checkout -- <plik>`, a pliki wstrzyknięte usuwaj przez `rm <plik>`.

**Why:** w tym repo równolegle pracują inne agenty i katalog roboczy zawiera cudze
niezacommitowane zmiany (2026-09-08: `git checkout -- .` skasowało recenzowany właśnie diff
w `auditors-delete.test.ts` oraz `apps/b2c-web/playwright-report/index.html`). Diff dało się
odtworzyć tylko dlatego, że był wcześniej wypisany w transkrypcie.

**How to apply:** przed mutacją zapisz `git diff > $S/pre-review.diff` i kopie mutowanych
plików do scratchpadu. Mutuj przez `python3` z `assert old in s` (mutacja, która się nie
zaaplikowała, daje fałszywą zieleń). Po każdej rundzie sprawdź `git status --short` i
porównaj z listą sprzed recenzji.

Powiązane: [[feedback_mutation_proof_required]], [[review-mutation-testing-checklist]].
