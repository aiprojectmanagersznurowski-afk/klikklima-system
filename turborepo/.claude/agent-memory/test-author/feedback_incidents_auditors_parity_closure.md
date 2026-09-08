---
name: feedback_incidents_auditors_parity_closure
description: Wzorzec domykania luk parity między dwoma równolegle rozwijanymi WO na tym samym wzorcu (CRM-DELETE-ADMIN-ONLY-*), z dowodem mutacyjnym transactionMock
metadata:
  type: feedback
---

Gdy review jednego WO (np. CRM-DELETE-ADMIN-ONLY-AUDITORS) dostaje mocniejszy wariant testu
niż równoległy WO na tym samym wzorcu (CRM-DELETE-ADMIN-ONLY-INCIDENTS), zadanie "dorównaj"
sprowadza się do trzech niezależnych punktów, nie jednego:

1. **RLS AC.4 (DISABLE ROW LEVEL SECURITY globalny skan)** — jeśli plik incydentu ma inny
   kształt helperów (`listAllMigrationFiles()` + `readMigrationByName()` zamiast gotowego
   `readAllMigrations()`), dopisz brakujący helper zamiast zmieniać istniejące funkcje —
   oba pliki mogą mieć różny wewnętrzny kształt kodu przy identycznym efekcie testu.

2. **Krucha asercja na dosłowny kształt sygnatury propsów** — rozbij na dwie luźniejsze
   asercje (destrukturyzacja zawiera pole X / typ zawiera `pole: Typ`), nigdy nie próbuj
   dopasować całej sygnatury jednym regexem z dokładną interpunkcją.

3. **Whitelist PERMISSIONS może już istnieć, ale brakować może `transactionMock` /
   `prisma.$transaction` mock niewywołanego przy odmowie** — to DWIE różne, niezależne
   luki z tego samego wzorca `auditors-delete.test.ts` AC1.4. Sprawdź obie osobno, nie
   zakładaj że brak jednej implikuje brak drugiej.

Dowód mutacyjny dla `transactionMock` w harnessie (`.claude/agent-memory/test-author/feedback_mutation_verification_pattern.md`):
mutant, który wstrzykuje `await prisma.$transaction(async () => {});` TUŻ PRZED gate'em roli
(zamiast usuwać cały gate), zabija WYŁĄCZNIE nową asercję `transactionMock).not.toHaveBeenCalled()`
w każdym z 5 przypadków odmowy, zostawiając `incidentDeleteMock`/`result.success` bez zmian —
to precyzyjny dowód, że ta jedna asercja niesie realne pokrycie ("odrzucone PRZED otwarciem
transakcji", nie tylko "delete nie wywołane wewnątrz niej"). Mutant usuwający cały gate
(`skip-role-gate`) zabija 6/10 testów naraz — dobry jako kontrola ogólna, ale nie izoluje
konkretnej nowej asercji.

Powiązane: [[feedback_three_layer_coverage_closure]], [[feedback_mutation_verification_pattern]].
