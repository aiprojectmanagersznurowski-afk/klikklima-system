---
name: blocked-status-semantics
description: Przyjęta semantyka statusu BLOCKED w rejestrze wymagań, ścieżka wyjścia BLOCKED->TODO i koszt stałych ostrzeżeń R16-proposed (2026-09-03: 6)
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

**Ścieżka wyjścia (potwierdzona 2026-08-21):** `BLOCKED` schodzi do `TODO` w chwili, gdy WO dowiezie NOŚNIK wymagania
(schemat + kontrakt), nawet jeśli sama funkcja jest dopiero fazy 3 — tak wyszły `FLD-CONSENT-ACCEPT`
i `FLD-LEGAL-DOC-VERSION` przy WO `FLD-CONSENT-DOCS`. Przy takim przejściu kryteria akceptacji trzeba PRZECIĄĆ:
zostaje to, co WO faktycznie dowozi i da się przetestować dziś, a egzekwowanie z fazy 3 wychodzi do osobnego,
przyszłego ID (wzorem `FLD-AUTH-BLOCKED`, które przejęło bramkę logowania z `CRM-AUDYT-AC1`).

**Koszt, o którym trzeba pamiętać:** każde `BLOCKED` generuje ostrzeżenie `R16-proposed`. Liczba ostrzeżeń
`kk-validate` wzrosła z 0 do 7, a po WO `FLD-CONSENT-DOCS` spadła do 5. Stan zweryfikowany 2026-09-03: **6**
(FLD-GEO-UNLOCK, FLD-GEO-EN-ROUTE, FLD-GPS-RODO, FLD-AUTH-BLOCKED, FLD-CONSENT-TRIGGERS-INTEGRATION,
FLD-PHOTO-SET) — doszło `FLD-CONSENT-TRIGGERS-INTEGRATION`. Licz je na bieżąco, nie z tej notatki.
Dziś to nieszkodliwe — **żadna bramka nie uruchamia
`kk-validate --strict`** (sprawdzone: `scripts/verify.sh`, `.github/workflows/kk-gate.yml`, `.githooks/pre-commit`,
`package.json`). Dodanie `--strict` do którejkolwiek z nich zapali je wszystkie na czerwono.

**How to apply:** jeżeli człowiek zażąda „zero ostrzeżeń" albo zechce podpiąć `--strict`, nie kasuj statusów `BLOCKED`
ani nie zmieniaj ich na `TODO` bez rozmowy — to jest wybór między szumem w raporcie pokrycia a szumem w walidatorze,
a nie usterka. Jeżeli człowiek rozumie `BLOCKED` inaczej niż powyżej, siedem statusów `FLD-*` trzeba przeliczyć razem,
nie po jednym. Powiązane: [[contract-write-blocker]].
