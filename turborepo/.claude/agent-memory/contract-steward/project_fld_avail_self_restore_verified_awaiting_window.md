---
name: fld-avail-self-restore-verified-awaiting-window
description: FLD-AVAIL-SELF i FLD-AVAIL-RESTORE domknięte na DONE 2026-09-15 (13/13 AC) — historia weryfikacji, dla wglądu, nie do powtórzenia
metadata:
  type: project
---

ZAMKNIĘTE 2026-09-15 — oba wymagania mają dziś `status: 'DONE'` w `contracts/requirements.contract.mjs`.
Ten wpis to zapis, JAK doszło do domknięcia (przydatny, jeśli ktoś zapyta "skąd te 13/13"),
nie aktywne zadanie. Poprzednia próba domknięcia w tej samej turze padła na wygasłym oknie
kontraktowym (agent skończył `status:'DONE'` + zapis notatek, ale przed `kk-codegen`/commitem) —
dokończone ręcznie przez orkiestratora po ponownym otwarciu okna, bez powtarzania weryfikacji AC.

Stan dowodu (gdyby okno się otwarło, wystarczy przepisać `status` na `DONE` + `note`):
- 50/50 testów zielonych w `availability-self-declaration`, `availability-pool-filter`,
  `availability-restore`, `sec-email-unique-identity-gate`; dodatkowo 44/44 w rodzeństwie
  (`leads-auditor-pool`, `auditors-toggle-active`, `middleware-auditor-blocked`, `crews-admin-gates`).
- Kod produkcyjny istnieje realnie: `setSelfAvailabilityAction` w `auditors/actions.ts` i
  `crews/actions.ts` (bramka `actorRole !== 'audytor'/'monter'` + `can(...)==='own'`, tożsamość po
  e-mailu z sesji, upsert na `availabilityDeclaration`), filtr fail-open w `leads/actions.ts`.
- ŻYWA baza (introspekcja 2026-09-15) potwierdza AC1 i RESTORE AC3 mocniej niż atrapy:
  `availability_declarations` ma dokładnie 6 kolumn (bez kopii „poprzedniej wartości"),
  CHECK `availability_declarations_one_owner` = `num_nonnulls(auditor_id, crew_id) = 1`,
  UNIQUE na `auditor_id` i `crew_id`, a `audytorzy`/`zespoly_monterskie` nie mają ŻADNEJ kolumny
  dostępności (tylko `is_active`/`aktywny` + `leave_status`).
- RESTORE AC5 (`updated_at` to znacznik techniczny) dowiedziony NEGATYWNIE: zero konsumentów
  czytających `availability_declarations.updated_at` w `apps/` i `packages/`. To dowód z dnia
  weryfikacji — przy pierwszym kodzie liczącym granicę doby roboczej trzeba go powtórzyć.
- Dwa kryteria mają pokrycie pod tagiem rodzeństwa, nie pod własnym ID (wzorzec znany):
  filtr `is_active` w puli → `leads-auditor-pool.test.ts` (`@REQ: CRM-AUDYT-AC1`), bramka logowania
  zablokowanego audytora → `middleware-auditor-blocked.test.ts`.

**Why:** pełny przegląd 13 kryteriów wraz z introspekcją żywej bazy kosztował całą turę; gdyby
zginął, następna tura z otwartym oknem zaczęłaby od zera albo — gorzej — domknęła status bez dowodu.

**How to apply:** po otwarciu okna przepisz `status: 'TODO'` → `'DONE'` w obu wpisach z `note`
zawierającą powyższe dowody, potem `kk-validate` + `kk-selftest` + `kk-codegen`. Zanim to zrobisz,
przebiegnij testy jeszcze raz — zielone sprzed dni nie są dowodem na dziś
([[fld-avail-weekly-rules-ac-wider-than-wo]] w korpusie z korzenia, patrz
[[memory-corpus-lives-at-repo-root]]).
