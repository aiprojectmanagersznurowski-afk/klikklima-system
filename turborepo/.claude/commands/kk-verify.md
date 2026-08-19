---
description: Uruchamia pełną bramkę weryfikacyjną i tłumaczy wynik
argument-hint: "[--fast|--full]"
allowed-tools: Bash, Read, Grep, Glob, Agent(e2e-runner)
---

# Bramka weryfikacyjna

Uruchom `bash scripts/verify.sh ${ARGUMENTS:---full}`.

Jeżeli wyjście jest długie, deleguj przebieg do subagenta `e2e-runner` i przyjmij od niego wyłącznie zwięzłą diagnozę.

Zaraportuj mi w tej kolejności:
1. **Które etapy bramki padły** (kontrakt / mutacje / dryf / lint / typy / testy / identyfikowalność).
2. **Unikalne przyczyny**, nie listę objawów.
3. Rekomendację: czy to jest wina implementacji, testu, kontraktu, czy infrastruktury lokalnej.

Nie naprawiaj niczego w tej komendzie. Diagnoza i tyle.
