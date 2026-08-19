---
description: Pełna pętla RED→GREEN→VERIFY→REVIEW dla zaakceptowanego Work Order
argument-hint: "[REQ-ID]"
allowed-tools: Read, Grep, Glob, Bash, Agent(test-author, implementer-server, implementer-ui, notification-architect, e2e-runner, reviewer, rls-security-auditor)
disable-model-invocation: true
---

# Pętla wykonawcza dla: $ARGUMENTS

Work Order: @docs/workorders/$ARGUMENTS.md

Prowadzisz pętlę jako orkiestrator. Sam nie piszesz kodu ani testów — od tego są subagenci. Twoim zadaniem jest pilnowanie **bramek** i zatrzymanie się we właściwym momencie.

## Faza 1 — RED (test-author)

Deleguj do `test-author`. Wymagaj w podsumowaniu **dosłownych komunikatów błędów**.

**BRAMKA RED — nie przechodź dalej, dopóki wszystkie warunki nie są spełnione:**
- każdy nowy test pada,
- pada na asercji lub braku funkcji domenowej — nie na literówce, składni ani nieistniejącej ścieżce,
- każdy test ma znacznik `@REQ:` wskazujący na istniejące wymaganie (`node tools/kk-trace.mjs` nie zgłasza nieznanych znaczników).

Jeżeli test przechodzi od razu: to nie jest sukces, to jest błąd testu. Odeślij do poprawy.

## Faza 2 — GREEN (implementer-server / implementer-ui / notification-architect)

Wybierz implementera po charakterze zadania. Przy zmianach w powiadomieniach zawsze `notification-architect`.

Limit: **3 iteracje**. Po trzeciej nieudanej zatrzymaj pętlę, zbierz diagnozy i wróć do mnie. Nie próbuj czwarty raz „trochę inaczej".

Jeżeli implementer zgłosi `TEST-DEFECT` — **nie każ mu poprawiać testu**. Zatrzymaj się, pokaż mi jego uzasadnienie i poczekaj na decyzję.

## Faza 3 — VERIFY (podwójna weryfikacja)

```
bash scripts/verify.sh --full
```
Bramka jest zielona dopiero, gdy przechodzą: walidacja kontraktu, test mutacyjny bramki, brak dryfu codegenu, lint, typy, testy jednostkowe, testy kontraktowe, identyfikowalność. Przy dużym wyjściu deleguj przebieg do `e2e-runner`, żeby nie zasypać kontekstu.

## Faza 4 — REVIEW (równolegle)

Uruchom jednocześnie:
- `reviewer` — zgodność z Work Order, kontraktem i standardami, **uczciwość testów**,
- `rls-security-auditor` — jeżeli zmiana dotyka danych osobowych, ról, usuwania lub polityk bazy.

Jeden `BLOCKER` → wracasz do fazy GREEN (liczy się jako iteracja).

## Zakończenie

Przedstaw mi: co zrobiono, które kryteria akceptacji są pokryte przez który test, wynik bramki, werdykty recenzentów, ryzyka rezydualne. Zaproponuj treść commita. **Nie commituj i nie twórz PR bez mojej zgody.**

Aktualizuj `.claude/state/current-workorder.json` (`phase`, `iteration`) po każdej fazie.
