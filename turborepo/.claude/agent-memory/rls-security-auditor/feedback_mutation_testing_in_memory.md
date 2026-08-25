---
name: feedback-mutation-testing-in-memory
description: Jak robić testy mutacyjne Server Action BEZ zapisu do repo — przepis (typescript transpileModule + new Function) i lista mutantów, które musi zabić każda bateria testów bramki roli
metadata:
  type: feedback
---

Testy mutacyjne bramki autoryzacyjnej wykonuj **w pamięci**, nigdy przez podmianę pliku
produkcyjnego (nawet „z przywróceniem z kopii"). Patrz [[feedback-audit-execution-constraints]].

**Why:** wynik jest identyczny, a drzewo robocze użytkownika zostaje nietknięte. Mutacja pliku
w repo to zapis poza zakresem roli, a przy przerwanym przebiegu zostawia podatny kod na dysku.
Zweryfikowane 2026-08-25 na SEC-AUTHZ-USER-MGMT: 11 mutantów, wynik zgodny z `npx vitest run`
(baseline 0/17 padających = 17/17 zielonych w vitest).

**How to apply — przepis (`tsx` NIE jest zainstalowany lokalnie, `typescript` TAK):**
`node --input-type=module --eval "$(cat <<'EOF' … EOF)"` (heredoc z cudzysłowem = brak escapowania;
wewnątrz używaj template literals, nie `\"`), a w skrypcie:
1. `ts.transpileModule(readFileSync('packages/contracts/src/generated/rbac.ts'))` →
   `await import('data:text/javascript;base64,' + …)` = PRAWDZIWE `can()`/`ROLES`/`PERMISSIONS`.
2. Wczytaj prawdziwy `actions.ts`, podmień fragment stringiem (**rzuć wyjątkiem, jeśli wzorzec
   nie został znaleziony** — cicha mutacja no-op udaje „test zabił mutanta").
3. Usuń `"use server"` i linie `import`, zamień `export async function` → `async function`,
   przetranspiluj, wstrzyknij zależności przez `new Function('prisma','revalidatePath','can',
   'ROLES','getCurrentActorRole', js + 'return { … }')`.
4. Przepisz asercje z prawdziwego pliku testowego i **zwaliduj harness baseline'em** — musi dać
   zero padnięć, inaczej mierzysz swój harness, nie kod.
5. Owiń `can` w szpiega liczącego wywołania — to jedyny sposób, żeby odróżnić „bramka odmówiła"
   od „bramka w ogóle nie zapytała macierzy".

**Minimalna lista mutantów dla bramki roli** (i czego dowodzi każdy):
- usunięcie całej bramki (osobno: z wywołaniem `getCurrentActorRole` i bez) — czy testy nazwane
  „bramka" łapią eskalację, czy tylko `null`;
- usunięcie walidacji danych (np. `ROLES.includes`) — osobno od bramki uprawnień;
- **osłabienie do samego `!actorRole`** — najważniejszy. Zabija go WYŁĄCZNIE test, który
  przepuszcza rolę uwierzytelnioną, ale nieuprawnioną (`dyspozytor`/`audytor`/`monter`).
  Zestaw testujący tylko `null`/`undefined` jest na to ślepy i przechodzi na kodzie, który
  nigdy nie woła `can()`;
- podmiana `capability` w obrębie tej samej listy ról (`create` → `read` przy
  `authorized_users`) — mutant **równoważny**, żaden test go nie zabije i to nie jest defekt
  testów, tylko własność macierzy. Odnotuj jako ryzyko szczątkowe, nie jako blokadę;
- podmiana `resource` (`authorized_users` → `leads`) — łapie tylko ta rola, która ma szersze
  uprawnienia na podmienionym zasobie;
- przesunięcie zapytania Prismy PRZED bramkę — dowodzi, że asercje „`findUnique` nie został
  wywołany" realnie pilnują kolejności, a nie są ozdobą.
