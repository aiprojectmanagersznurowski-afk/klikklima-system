---
name: feedback_concurrency_test_transition_premise
description: Przy pisaniu testów AC8-stylu (dwa równoległe wywołania na tym samym leadzie) zawsze weryfikuj, że druga próba na ŚWIEŻYM stanie po pierwszej jest jednoznacznie nielegalna — "wykluczające się" w warstwie biznesowej nie znaczy nielegalne w ALLOWED_TRANSITIONS
metadata:
  type: feedback
---

TEST-DEFECT zgłoszony przez `implementer-server` 2026-09-07
(`sec-audit-log-manual-status-wave-c.test.ts`, AC8, "bypass i rollback jednocześnie
z HARDWARE_IN_WAREHOUSE"): test zakładał, że dwie NAZWANE operacje biznesowe (bypass
T07 → `AWAITING_INSTALLATION`, rollback → `ROLLBACK_RESCHEDULING`) wywołane równolegle
na tym samym leadzie muszą dać dokładnie jeden sukces. W praktyce po sukcesie
pierwszej, drugi odczyt (świeży, po zwolnieniu blokady) trafia w stan
(`AWAITING_INSTALLATION`), z którego cel drugiej próby (`ROLLBACK_RESCHEDULING`, T13)
jest NIEZALEŻNYM, LEGALNYM przejściem — więc obie się udają. Diagnoza potwierdzona
debugiem przez implementera, nie zgadywana.

**Why:** "wzajemnie wykluczające się" w sensie biznesowym/nazewniczym (bypass kontra
rollback to przeciwne kierunki) nie implikuje, że `ALLOWED_TRANSITIONS[stan_po_1]` nie
zawiera drugiego celu. Trzeba sprawdzić FAKTYCZNĄ mapę przejść ze stanu, w którym lead
wyląduje po pierwszej operacji — nie tylko intuicję nazw.

**How to apply:** przy budowie testu "N równoległych wywołań, dokładnie jeden sukces":
1. Wybierz PARĘ wywołań, gdzie druga próba, wykonana na stanie PO pierwszej, celuje w
   przejście, którego `ALLOWED_TRANSITIONS[stan_po_1]` (albo `TRANSITIONS` z kontraktu)
   NIE zawiera. Najprostszy pewny wybór: TA SAMA operacja wywołana dwa razy (self-loop
   z definicji nie istnieje w mapie przejść) — tak jak istniejący test T03
   (linia ok. 528 w tym pliku) i naprawiony AC8 (linia ok. 569).
2. Zawsze dopisz komentarz mówiący wprost, że to dowód WYNIKOWY (kolejność
   `mockResolvedValueOnce`), NIE dowód istnienia blokady `FOR UPDATE` — ten dowód
   pochodzi wyłącznie z osobnego testu na `invocationCallOrder`/regex SQL (patrz
   [[feedback_mutation_verification_pattern]], sekcja "Antywzorzec"). Potwierdzone
   mutacyjnie 2026-09-07: mutant self-loop (dodanie `AWAITING_INSTALLATION` do własnej
   listy przejść) zabija WYŁĄCZNIE tę jedną asercję (56/57 zielone), a mutant
   `remove-for-update` NIE zabija jej wcale (zabija wyłącznie sąsiedni test lock-order)
   — to jest oczekiwane i poprawne, nie trzeba dostosowywać scenariusza dalej.

Powiązane: [[feedback_mutation_verification_pattern]].
