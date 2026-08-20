---
name: blocked-status-semantics
description: Przyjęta semantyka statusu BLOCKED w rejestrze wymagań i świadomie zaakceptowany koszt 7 stałych ostrzeżeń R16-proposed
metadata:
  type: project
---

Przy WO `FLD-CONTRACT-BASE` (2026-08-21) ustaliliśmy roboczo, że `status: 'BLOCKED'` w `contracts/requirements.contract.mjs`
znaczy **„wymaganie poprawne, ale niewykonalne przed powstaniem `apps/field-app` (faza 3) albo przed rozstrzygnięciem
odnotowanym w jego własnych kryteriach"** — nie „czeka na ADR". Siedem wymagań `FLD-*` weszło z tym statusem;
`FLD-GEO-COORDS` dostało `TODO`, bo realizuje je WO-D.

**Why:** repozytorium nie miało dla `BLOCKED` żadnej ustalonej semantyki — R11 tylko akceptuje tę wartość, a `kk-trace`
używa jej wyłącznie do wyłączenia wymagania z ostrzeżenia „HIGH RISK bez żadnego testu". Wybór `BLOCKED` zamiast `TODO`
był świadomy: `TODO` dorzuciłoby sześć stałych alarmów HIGH-risk do raportu, który już ma ich ~25 i przez to jest coraz
mniej czytany.

**Koszt, o którym trzeba pamiętać:** każde `BLOCKED` generuje ostrzeżenie `R16-proposed`. Liczba ostrzeżeń
`kk-validate` wzrosła z 0 do 7 i taka zostanie do fazy 3. Dziś to nieszkodliwe — **żadna bramka nie uruchamia
`kk-validate --strict`** (sprawdzone: `scripts/verify.sh`, `.github/workflows/kk-gate.yml`, `.githooks/pre-commit`,
`package.json`). Dodanie `--strict` do którejkolwiek z nich zapali je wszystkie na czerwono.

**How to apply:** jeżeli człowiek zażąda „zero ostrzeżeń" albo zechce podpiąć `--strict`, nie kasuj statusów `BLOCKED`
ani nie zmieniaj ich na `TODO` bez rozmowy — to jest wybór między szumem w raporcie pokrycia a szumem w walidatorze,
a nie usterka. Jeżeli człowiek rozumie `BLOCKED` inaczej niż powyżej, siedem statusów `FLD-*` trzeba przeliczyć razem,
nie po jednym. Powiązane: [[contract-write-blocker]].
