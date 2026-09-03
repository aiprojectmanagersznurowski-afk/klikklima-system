---
name: audit-reporting-style
description: Jak Michal chce dostawać wyniki audytu bezpieczeństwa — dowód wykonania, zero naciąganych ryzyk
metadata:
  type: feedback
---

Raport z audytu ma zawierać: (a) werdykt `KRYTYCZNE/WYSOKIE/ŚREDNIE/NISKIE`, (b) każde znalezisko z `plik:linia` albo wynikiem realnie wykonanego polecenia, (c) jawną listę rzeczy **sprawdzonych i czystych**. Jeśli nic nie znaleziono — powiedzieć to wprost, nie awansować błahostki do „ryzyka".

**Why:** Polityka/gate, której nikt nie wykonał, to komentarz, nie zabezpieczenie. Michal odrzuca oceny „z lektury" i naciągane znaleziska, bo zaszumiają realne luki.

**How to apply:** Zanim zgłosisz cokolwiek — uruchom `npx tsc --noEmit` i odpowiedni `npx vitest run` z katalogu `apps/b2b-web` i wklej wynik. Rozdziel „defekt bezpieczeństwa" od „niedokończona fala WO" (np. niezmigrowane wywołania w UI) — to nie to samo. Patrz [[audit-log-live-state]].

**Pułapka locum:** ta notatka i [[audit-log-live-state]] zostały raz zapisane w złym miejscu (`apps/b2b-web/.claude/agent-memory/` zamiast katalogu głównego repo) — sprawdzaj `pwd` przed zapisem.
