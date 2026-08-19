---
name: contract-write-blocker
description: Historyczna blokada zapisu do contracts/ przez guard-paths — NAPRAWIONA 2026-08-19; hook czyta teraz rolę z payloadu
metadata:
  type: project
---

**Status: ROZWIĄZANE 2026-08-19.** Notatka zostaje jako zapis przyczyny i naprawy, nie jako ostrzeżenie o stanie bieżącym.

Objaw (ticket B2C-REQS, dwa spalone okna): zapis do `contracts/` był blokowany **mimo otwartego okna kontraktowego i poprawnej roli agenta**.

Mechanizm: `.claude/settings.json` rejestruje `PreToolUse: Edit|Write|NotebookEdit` → `guard-paths.mjs main-thread`. Hook z frontmattera agenta jest **dodatkowy, nie zastępczy** — obie instancje muszą przepuścić zapis, a kontrola nr 1 odrzucała ścieżkę kontraktową dla każdej roli różnej od `contract-steward`. Instancja z `settings.json` zawsze podawała `main-thread`, więc bramka była zepsuta na zamknięcie: steward nie mógł zapisać kontraktu nigdy.

Naprawa (człowiek naniósł ręcznie): `guard-paths.mjs` ustala rolę efektywną z payloadu hooka, z argv jako fallbackiem —
`const role = input?.agent_type || input?.agent_name || process.argv[2] || 'unknown';`
Instancja z `settings.json` ocenia więc subagenta jako subagenta, a wątek główny nadal jako `main-thread`. Do `agentWriteScopes['contract-steward']` dopisano `'tools/'`, bo podpięcie nowego kontraktu wymaga edycji `kk-validate.mjs` i `kk-codegen.mjs`.

Zweryfikowane po naprawie: `kk-selftest` 36/36, a próbny zapis wątku głównego do `contracts/` przy **otwartym** oknie nadal kończy się `exit 2`. Bramka została naprawiona, nie rozluźniona.

**Why:** odruch „usuń hooka z settings.json", o który łatwo poprosić, zamieniłby bramkę zepsutą na zamknięcie w zepsutą na otwarcie — wątek główny straciłby kontrolę nr 1 (kto pisze po kontraktach) oraz kontrole 2 i 3 (zakaz edycji testów przez implementera). Rozwiązaniem było doprecyzowanie roli, nie zdjęcie kontroli.

**How to apply:** jeżeli kiedykolwiek znowu zobaczysz `[guard-paths / main-thread] ZABLOKOWANO` na swoim zapisie, sprawdź, czy powyższa linia z `input?.agent_type` nadal jest w `guard-paths.mjs` — regresja tego pliku przywraca dokładnie ten objaw. Nie obchodź blokady Bashem: przygotuj zmianę w piaskownicy i oddaj człowiekowi gotowy materiał. Powiązane: [[sandbox-contract-dry-run]].
