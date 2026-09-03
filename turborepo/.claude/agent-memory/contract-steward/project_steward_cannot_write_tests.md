---
name: steward-cannot-write-tests
description: guard-paths blokuje contract-steward na apps/b2b-web/tests/ — statyczne testy zamrażające migracje są zadaniem test-author, mimo istniejącego precedensu w historii
metadata:
  type: project
---

`guard-paths.mjs` ogranicza zakres zapisu roli `contract-steward` do: `contracts/`,
`packages/contracts/`, `packages/database/prisma/`, `supabase/migrations/`,
`docs/architecture/generated/`, `.claude/state/`, `tools/`, `.claude/agent-memory/`.
`apps/b2b-web/tests/` **nie jest** na tej liście — próba zapisu kończy się `exit 2`.

**Why:** reguła w hooku, która blokuje edycję testów, jest w kodzie napisana wąsko
(`role.startsWith('implementer')`), więc czytając sam ten fragment można błędnie uznać,
że steward ma wolną rękę. Rozstrzyga wcześniejsza, ogólna reguła zakresu ról — i to ona
zatrzymuje zapis. Dodatkowo `apps/b2b-web/tests/security-migrations-static.test.ts`
istnieje i zawiera dokładnie taki test zamrażający migracje (commit `6a43a21`), co jest
mylącym precedensem: obecność pliku nie dowodzi, że steward miał prawo go napisać.

**How to apply:** pisząc migrację, która ma dostać test statyczny zamrażający treść
(`CREATE ...` obecne, blok strażniczy obecny), nie planuj tego testu jako własnej pracy.
Zgłoś go jako zadanie dla `test-author` i idź dalej z commitem samej migracji.
Nie obchodź hooka. Nie dopisuj też tagów `@REQ` — patrz [[retroactive-req-trace-red]]
i [[requirement-status-drift]]: tag przy teście statycznym treści pliku zrobiłby
z `kk-trace` fałszywą zieleń, bo zamraża intencję, a nie kryteria akceptacji.
