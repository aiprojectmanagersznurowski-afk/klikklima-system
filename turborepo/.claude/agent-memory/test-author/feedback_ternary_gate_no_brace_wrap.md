---
name: feedback_ternary_gate_no_brace_wrap
description: JSX conditional gates inside a ternary's else-branch are written as `canX && (` without a leading `{`, unlike sibling gates in normal JSX flow which use `{canX && (` — regex assertions must not assume the brace is always present.
metadata:
  type: feedback
---

W `assign-auditor.tsx` dwa przyciski są bramkowane tą samą zmienną `canUpdateLead`,
ale różną składnią: przycisk "Zmień" (w normalnym przepływie JSX, wewnątrz `<div>`)
jest owinięty `{canUpdateLead && (...)}` — z jawnym `{`. Przycisk "Przypisz audytora"
(w gałęzi `else` ternara `isEditing ? (...) : (...)`) jest owinięty samym
`canUpdateLead && (...)` — BEZ dodatkowego `{`, bo już jest wewnątrz wyrażenia JS.

**Why:** naiwna asercja skopiowana z pierwszego przycisku (wymagająca `\{\s*canUpdateLead...`)
nie dopasuje się do drugiego przycisku mimo poprawnej bramki — dałaby fałszywy negatyw
(zły RED) albo zmusiłaby do rozluźnienia regexu w sposób, który przypadkiem nie łapie
mutanta. Reviewer znalazł ten dokładny przypadek: test miał tylko asercję dla "Zmień",
drugi przycisk nie był w ogóle sprawdzony — mutacja usuwająca bramkę z drugiego
przycisku przeżywała 10/10.

**How to apply:** przy pisaniu statycznej asercji "przycisk jest owinięty bramką RBAC"
dla komponentu z wieloma kontrolkami pod tą samą zmienną `canX`, (1) sprawdź KAŻDE
wystąpienie akcji/przycisku osobno, nie tylko pierwsze trafienie regexu na wspólny
callback; (2) użyj regexu tolerującego opcjonalny `{` na początku: `/\{?\s*canX\s*&&\s*\(\s*$/`,
bo pozycja w drzewie JSX (zwykły przepływ vs gałąź ternara) zmienia wymaganą składnię.
Zweryfikowane mutacyjnie 2026-09-08 w `leads-detail-edit-ui-gate.test.ts`
(CRM-LEAD-UPDATE-ADMIN-DISPATCHER) — mutant usuwający `canUpdateLead &&` z drugiego
przycisku pada dokładnie na nowej asercji, reszta zostaje zielona.

Powiązane: [[feedback_select_open_tag_arrow_pitfall]], [[feedback_mutation_verification_pattern]].
