---
name: project-auditor-scope-unimplemented
description: SEC-RLS-AUDITOR-SCOPE (risk HIGH) nie ma implementacji w getLeads() ani pokrycia testami, a trzy inne wymagania powołują się na nie jako na „już zrobione" — nie powtarzaj tego założenia
metadata:
  type: project
---

`SEC-RLS-AUDITOR-SCOPE` (audytor widzi wyłącznie swoje leady, risk HIGH) jest na 2026-08-26
**niezaimplementowane w ścieżce listy leadów i niepokryte testem**: `node tools/kk-trace.mjs`
pokazuje je z myślnikiem (brak trafień), a `getLeads()` nie ma ani bramki roli, ani zawężenia
po audytorze w `where` — `page.tsx` czyta `getCurrentActorRole()` tylko po to, żeby przekazać
rolę do UI.

**Why:** trzy wymagania z rodziny MINIMIZE (`SEC-ASSIGNMENT-POOL-MINIMIZE`,
`SEC-LEADS-LIST-MINIMIZE`, `SEC-LEADS-LIST-SCALARS`) mają w polu `source` zdanie „Dostęp do
listy jest już poprawnie ograniczony rolą i zakresem audytora (SEC-RLS-AUDITOR-SCOPE), więc to
nie jest luka RBAC". To zdanie jest podstawą, na której obniżano im ryzyko do MEDIUM — i jest
niezweryfikowane. Prisma omija RLS, więc baza tego nie nadrobi.

**How to apply:** nie powtarzaj tej przesłanki w werdyktach. Przy każdym audycie w
`leads/actions.ts` odnotuj to jako osobne, wciąż otwarte znalezisko (nie jako blocker dla
cudzego WO, bo to zastane). Sprawdź `kk-trace` zamiast wierzyć polu `source`.
Powiązane: [[feedback-mutation-testing-in-memory]].
