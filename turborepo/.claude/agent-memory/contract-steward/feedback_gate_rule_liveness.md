---
name: gate-rule-liveness
description: Każda nowa reguła kk-validate wchodzi razem ze STAŁĄ mutacją w kk-selftest; dowód doraźny w piaskownicy się nie liczy, a regułę projektuj szeroko, nie pod jeden klucz
metadata:
  type: feedback
---

Trzy rzeczy, które Michal potwierdził przy `FLD-GATE-HARDEN` (2026-08-21):

1. **Nowa reguła walidatora = nowa, stała mutacja w `tools/kk-selftest.mjs` w tym samym ticketcie.**
   Nie „udowodnię doraźnie w piaskownicy i pokażę wyjście".
2. **Zakres reguły projektuj ogólnie, nie pod bieżący przypadek.** Przy R28 miałem wybór: sprawdzać tylko
   `meters` (jedyny wtedy problematyczny skalar) albo wszystkie z `MEASURE_SCALARS`. Michal wybrał wszystkie
   i poprosił o uzasadnienie wyboru w raporcie.
3. **Dowodem żywotności jest dosłowne wyjście walidatora dla zmutowanego kontraktu, nie licznik `n/n`.**
   Michal wprost poprosił, żeby zobaczyć, którą regułę zapala każda nowa mutacja i z jakim komunikatem.

**Why:** dowód doraźny znika razem z katalogiem tymczasowym, a reguła zostaje bez strażnika — dokładnie ten
scenariusz, przed którym broni `kk-selftest`. Reguła zawężona do jednego klucza umiera po cichu w dniu dodania
progu w innej jednostce (bramka nadal świeci na zielono, więc nikt jej nie odnowi). Licznik `39/39` rośnie także
wtedy, gdy mutacja zapala regułę przypadkiem, przy okazji łamiąc coś innego — dopiero komunikat to rozstrzyga.

**How to apply:** dotyczy każdej zmiany w `tools/kk-validate.mjs`. Jeżeli człowiek podaje docelową liczbę mutacji
(„finalnie 39"), traktuj ją jako ograniczenie — nie dorzucaj mutacji ponad plan bez pytania, nawet kuszących
przypadków brzegowych; pokaż je zamiast tego jako sondę w raporcie. Jeżeli w podsumowaniu zgłaszasz decyzję
„nie moją do podjęcia", spodziewaj się, że wróci jako osobne WO — formułuj ją tak, żeby dało się ją podjąć
bez dopytywania. Powiązane: [[blocked-status-semantics]].
