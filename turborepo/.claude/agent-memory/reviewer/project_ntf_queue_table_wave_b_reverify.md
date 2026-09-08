---
name: project_ntf_queue_table_wave_b_reverify
description: Ponowny review enqueueNotification (rollback-effects.ts) po poprawkach — poprzedni BLOCKER/MAJOR zamknięte, mutacyjnie potwierdzone
metadata:
  type: project
---

NTF-QUEUE-TABLE Faza B, `enqueueNotification` w `apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`.
Reverify 2026-09-08: poprzednie BLOCKER (brak testu na wyłączność P2002) i MAJOR (cichy channels[0])
zamknięte i zweryfikowane mutacyjnie.

- BLOCKER zamknięty: funkcja teraz łapie `error.code === "P2002"` explicite i rzuca dalej każdy inny kod
  (test na P2003 — FK violation). Zmutowałem warunek na `if (true)` (połknięcie każdego błędu) —
  test się wywalił, więc asercja ma zęby.
- MAJOR zamknięty: pętla `for (const channel of definition.channels)` tworzy JEDEN wiersz PER KANAŁ,
  zwraca `{id,created,channel}[]`. Test AC-B4b dowodzi tego dla SHIPPED_DEF (2 kanały: SMS+EMAIL) —
  sprawdza 2 wywołania create, 2 różne kanały, 2 różne idempotencyKey.
- Idempotencja per-kanał: `idempotencyKey = "${baseKey}:${channel}"`, deterministyczna (ta sama funkcja
  wywołana ponownie z tym samym baseKey trafia w te same klucze per kanał — AC-B1 dowodzi tego na 2. wywołaniu:
  4 próby create, 2 sukces + 2 P2002).
- Duplikat na jednym kanale nie przerywa pętli — try/catch jest WEWNĄTRZ pętli per iterację, więc brakujący
  kanał nadal się tworzy nawet gdy inny już istnieje.
- MINOR (mylący komentarz AC-B2) naprawiony: test-author przepisał AC-B2 na jednokanałowe ROLLBACK_DEF
  i jawnie odsyła do AC-B4b jako dowodu wielokanałowego kształtu.
- PYTANIE R3 (recipient_address przy braku e-maila klienta) nadal otwarte, ale WO samo je odkłada do
  NTF-RETRY ("Do potwierdzenia przy NTF-RETRY") — nie jest to regresja tej fazy, tylko świadomie
  nierozstrzygnięty zakres.
- Werdykt: PRZEPUSZCZAM. Pełna bramka zielona (kk-validate, kk-codegen --check, 1371/1371 testów,
  tsc --noEmit czysty).
