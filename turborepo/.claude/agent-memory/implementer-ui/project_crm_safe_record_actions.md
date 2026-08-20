---
name: project-crm-safe-record-actions
description: Status and deferred scope of WO CRM-SAFE-RECORD-ACTIONS as of the implementer-ui GREEN 3/3 turn (2026-08-20)
metadata:
  type: project
---

WO `docs/workorders/CRM-SAFE-RECORD-ACTIONS.md` reached GREEN iteration 3/3 (the last allowed) on 2026-08-20. Server layer (`apps/b2b-web/src/app/(dashboard)/leads/actions.ts`, `.../auditors/actions.ts`) was already complete and reviewed before this turn; this turn's job was wiring the UI only.

**What shipped (UI layer, this turn):**
- `apps/b2b-web/src/app/(dashboard)/leads/return-to-funnel-dialog.tsx` — "Zwróć do obiegu" dialog implementing D2's two-path stale-quote flow (`acknowledgeStaleQuote` / `refreshQuote` + new price).
- `apps/b2b-web/src/app/(dashboard)/leads/archive-lost-dialog.tsx` — "Archiwizuj (Lost)" dialog, reason picker sourced from `LOST_REASONS`/`LOST_REASON_PL` in `@klikklima/contracts`, mandatory note for reasons where `lostReasonRequiresNote` is true.
- `leads-client.tsx` wired both dialogs into the row `DropdownMenu`, gated on `can(actorRole, "leads", "update"/"delete")` from `@klikklima/contracts` rbac — `actorRole` now passed down from `leads/page.tsx` via `getCurrentActorRole()`.
- `auditors-client.tsx` — "Zawieś/Odblokuj Konto" item moved inside the existing `isAdmin` gate (previously only "Usuń" was gated; this was the MINOR from REVIEW #2 mentioned in the WO's edge-case #4).

**Deliberately deferred (not built this turn):** `CRM-ZESP-AC2`/E4 crew-assignment UI. Confirmed via file search that `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx` (Karta 360) has no crew/logistics section at all — the only E4-adjacent UI is the generic "Ekipa przydzielona → Logistyka" status-advance button in `leads-client.tsx`, which does NOT call the already-built `getCrews(installationDate)`/`assignCrewToLead(leadId, crewId)` server actions. Building this from scratch was explicitly out of scope for this turn per the coordinator's instructions (bigger than "add a button" — needs a whole new UI surface). Should become its own WO.

**Why this matters for future turns:** if a future WO references "the crew assignment dialog" or similar E4 UI, it does not exist yet — check current files before assuming it was built in this WO.
