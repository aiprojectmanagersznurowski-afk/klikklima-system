---
name: funnel-advance-status-dual-rollback-path
description: advanceLeadStatus i rollbackLogisticsOrder to dwie żywe ścieżki UI do tego samego przejścia T10-T13; jedna nie woła efektów
metadata:
  type: project
---

`leads-client.tsx` ma przycisk „Rollback (Problem)" (widoczny dla AWAITING_CREW_ASSIGNMENT/HARDWARE_IN_WAREHOUSE/HARDWARE_IN_TRANSIT/AWAITING_INSTALLATION), który woła `advanceLeadStatus(leadId, "ROLLBACK_RESCHEDULING")` — to DRUGA, równoległa ścieżka do tych samych przejść T10-T13, obok przycisku rollbacku w panelu logistyki (`rollbackLogisticsOrder`, `logistics/actions.ts`).

`advanceLeadStatus` (`leads/actions.ts`) dopuszcza te przejścia przez swoją lokalną mapę `ALLOWED_TRANSITIONS`, ale NIGDY nie woła `releaseCrewSlot`/`suspendLogisticsSla`/`enqueueNotification` — te funkcje istnieją i są wołane wyłącznie z `logistics/actions.ts` (dodane w `LOGISTICS-SHIPPING-EFFECTS`, commity a32433c…4c90abf).

Zespół już to wie i częściowo łata objaw: `rollbackLogisticsOrder` (L375-385) ma gałąź specjalną — jeśli lead JEST JUŻ w `ROLLBACK_RESCHEDULING` (bo trafił tam inną ścieżką), i tak woła `releaseCrewSlot`/`suspendLogisticsSla` ponownie, z komentarzem wprost o „naprawie leada osieroconego przez inną ścieżkę zmiany statusu". To naprawa objawu przy NASTĘPNEJ interakcji z panelem logistyki, nie zapobieganie — do tego momentu slot jest fizycznie zajęty mimo statusu ROLLBACK_RESCHEDULING na Kanbanie.

**Why:** to jest dowód na tezę z `[[repo-drift-traps]]` — druga maszyna stanów w B2B nie jest teoretyczna, ma żywy przycisk w UI. Ważne przy każdym WO dotykającym `advanceLeadStatus`/`ALLOWED_TRANSITIONS`.

**How to apply:** przy planowaniu WO dla `FNL-ADVANCE-STATUS-CONTRACT-BOUND` (Faza 1 = tylko T10-T13, WO już napisany 2026-09-08) i przy każdym przyszłym wymaganiu dotykającym leads Kanban — sprawdź `leads-client.tsx` na obecność przycisków wywołujących `advanceLeadStatus` z targetem, który ma odpowiednik w `logistics/actions.ts`, zanim założysz że tylko jedna ścieżka istnieje.
