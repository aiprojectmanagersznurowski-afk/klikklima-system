---
description: Bramka gotowości wydania — pełny scenariusz end-to-end na czystej bazie
---

<!-- WYGENEROWANE z .claude/commands/kk-release-gate.md przez tools/kk-port-antigravity.mjs — nie edytuj ręcznie. -->

# Bramka gotowości wydania

To jest sprawdzian, czy system żyje jako całość, a nie jako zbiór zielonych testów jednostkowych.
Kryteria: @docs/03-RELEASE-GATE.md

## Wykonaj po kolei i raportuj wynik każdego kroku

1. `bash scripts/verify.sh --full --clean` — bramka bez cache Turborepo.
2. `node tools/kk-trace.mjs --enforce` — każde wymaganie `IMPLEMENTING`/`DONE` ma przechodzący test.
3. Scenariusz end-to-end na świeżo zaseedowanej bazie: Triage → E1 → ... → E8, z asercjami na treści kolejki powiadomień po każdym przejściu.
4. Scenariusze wyjątkowe: bypass E5→E7, rollback z E6, wygaśnięcie wyceny po 14 dniach (czas symulowany, nie `sleep`).
5. Audyt bezpieczeństwa: `rls-security-auditor` na politykach RLS i uprawnieniach do usuwania.
6. Sprawdzenie parzystości katalogu powiadomień z tabelą szablonów.

## Werdykt

Wypisz tabelę kryteriów z `docs/03-RELEASE-GATE.md` ze statusem każdego.
**Jedno niespełnione kryterium = brak gotowości.** Nie uśredniaj, nie zaokrąglaj w górę, nie pisz „w zasadzie gotowe".
