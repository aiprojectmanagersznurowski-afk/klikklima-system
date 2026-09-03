---
name: project_ui_consistency_audit_b2b
description: Ongoing multi-batch visual-consistency audit of apps/b2b-web (buttons, tables, status pills) — where past reviews found real cross-batch drift
metadata:
  type: project
---

The b2b-web panel underwent a multi-round "audyt spójności wizualnej" (buttons + tables), split across a foundation
batch, 6 per-view batches, 2 server-side fixup batches, and a test-mock repair batch. New shared primitives:
`src/components/ui/status-pill.tsx` (`StatusPill`, tones `neutral|info|warning|danger`, deliberately no green/success
tone — CLAUDE.md forbids green SLA alerts), `src/lib/format-id.ts` (`shortId`), `src/lib/empty-value.ts`
(`EMPTY_VALUE = "—"`), and a unified `--radius-control: 10px` for all `Button` sizes.

**Why this matters for review:** because the work was parallelized per-view, the failure mode is not bugs within a
single file but *drift between* files that are supposed to follow the same pattern (sticky-column z-index values,
clickable-row click-guard logic, EMPTY_VALUE/shortId adoption). Diffing one file in isolation will not catch this —
you have to grep the same pattern across all table client components side by side.

**How to apply:** when reviewing a follow-up batch in this area, grep for `sticky top-0` / `sticky right-0` across
all `*-client.tsx` table components and diff the z-index values (established convention: header row `z-30`, body
sticky action column `z-20`) rather than trusting each file's own internal consistency. Also grep for bare `"-"`,
`"Brak ..."`, `"Nie ustalono"`, `.substring(0, 8)` even in files that already import `EMPTY_VALUE`/`shortId` —
in the 2026-09-03 review, `leads-client.tsx` imported and used `EMPTY_VALUE` correctly in most places but left one
bare `"-"` literal a few lines away in the same file (fixed same day). See [[feedback_cross_batch_consistency_checks]].

**Zgłoszone, nierozstrzygnięte przy tej turze** (nie blokowały commita, czekają na decyzję/kolejną turę):
- Zielone `CheckCircle2` w dropdown menu akcji (`installations-client.tsx`, `logistics-client.tsx`) — pre-existing,
  poza zakresem tego audytu (ikona akcji, nie status), ale technicznie zielony kolor w panelu.
- `{/* @ts-ignore */}` w `leads/[id]/edit-lead-modal.tsx` — pre-existing, zakazane przez CLAUDE.md, do osobnego
  sprzątania.
- Jednolity styl aktywny menu (pozycja główna = podpozycja, rozróżnienie tylko przez wcięcie) — to ŚWIADOMA
  decyzja z audytu ("jeden styl aktywności dla obu poziomów"), nie przeoczenie — potwierdzone.
