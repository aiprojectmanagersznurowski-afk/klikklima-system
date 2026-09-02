---
name: gate-blindspot-authz-tx-helpers
description: kk-authz-gate nie widzi funkcji przyjmujących `tx`; jak dowieść czy helper naprawdę jest publicznym Server Action — server-reference-manifest.json, nie sam next build
metadata:
  type: project
---

`tools/kk-authz-gate.mjs` uznaje wywołanie za mutację tylko wtedy, gdy bazowy identyfikator
należy do zbioru `clients` = `{'prisma'}` + parametry callbacków `prisma.$transaction(...)`
**wewnątrz tej samej funkcji** (`collectTransactionClients`). Funkcja typu
`export async function foo(tx: Prisma.TransactionClient, ...)` nie zawiera własnego
`$transaction`, więc `tx.model.update()` nie jest w ogóle policzone → `mutations.length === 0`
→ `analyzeFunction` zwraca `null` i funkcja znika ze statystyk. Komentarz `// AUTHZ-EXEMPT`
nad taką funkcją nic nie robi (raport pokaże `Z wyjątkiem AUTHZ-EXEMPT: 0`).

**Jak sprawdzić, czy helper naprawdę jest publicznym endpointem (dowód, nie domysł):**
`npx next build`, potem
`node -e "const m=require('./.next/server/server-reference-manifest.json'); console.log(Object.keys(m.node).length)"`
i szukanie ID akcji. Samo `grep registerServerReference` w `.next/server/chunks/ssr/*.js`
**nie wystarcza** — Turbopack scala moduły do jednej przestrzeni, więc funkcje z modułu BEZ
`"use server"` mogą dostać `registerServerReference` w tym samym bloku co prawdziwe akcje.
Rozstrzyga dopiero obecność ID w `server-reference-manifest.json`: brak ID = router Next.js
nie zdispatchuje żądania, więc endpoint nie istnieje.

**Why:** WO LOGISTICS-SHIPPING-EFFECTS, runda 1: `releaseCrewSlot`/`suspendLogisticsSla`
eksportowane wprost z `logistics/actions.ts` (`"use server"`) — zgłoszone jako MAJOR.
Runda 2 (2026-09-02): przeniesione do `logistics/rollback-effects.ts` bez dyrektywy,
re-eksportowane z `actions.ts`. Weryfikacja: transformacja `"use server"` **wycina**
re-eksport (lista eksportów zbudowanego modułu ma tylko 6 nazw `async`), a ID helperów są
NIEOBECNE w manifeście → naprawa skuteczna, mimo że `registerServerReference` widać w chunku.
Efekt uboczny: test importujący `releaseCrewSlot` z `actions.ts` działa w vitest, ale
w produkcyjnym buildzie ten eksport nie istnieje — testuj przez moduł źródłowy.

**How to apply:** przy każdym nowym helperze z parametrem `tx` — bramka authz go nie widzi,
sprawdź ręcznie; rekomendacja to moduł bez `"use server"`, a dowód skuteczności to manifest.

Powiązane: [[gate-blindspot-next-build]], [[review-mutation-testing-checklist]],
[[reviewer-mutation-harness-scratchpad]].
