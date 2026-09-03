---
name: review-ui-batch-sticky-and-untested-pure-fn
description: Two recurring UI-batch defects found 2026-09-03 - sticky-column z-index ties across thead/tbody stacking contexts, and new pure functions shipped without unit tests despite an established test-per-pure-fn convention in the same file.
metadata:
  type: project
---

Reviewed a 13-file UI/UX batch in `apps/b2b-web` (dashboard KPIs, compact pagination, sticky action columns, F-Gaz validation loosening, nav "coming soon" badges, row-click navigation). Two findings worth remembering as patterns to check again:

1. **Sticky corner z-index ties are not "higher header, lower body" — they're equal, which loses the tie to DOM order.**
   `installations-client.tsx` / `logistics-client.tsx`: header `<tr>` has `sticky top-0 z-10`, header's own "Akcje" `<th>` was bumped to `z-20`, but the **body** sticky `<td>` is `z-10` — same value as the header **row** (not lower than it). Per CSS stacking rules, a `z-index` set on a `<th>` only wins ties among siblings *inside* the already-established `<tr>` stacking context; it does not "export" upward to compete with a `<td>` in a different row's context. The real comparison that matters at the top level is header-`<tr>` (z=10) vs body-`<td>` (z=10) — a tie, resolved by DOM order, and `<tbody>` paints after `<thead>`, so the body's sticky corner cell can paint over the sticky header at the intersection during simultaneous horizontal+vertical scroll. Correct fix: give the header row (or its corner cell) a z-index that is *unambiguously* higher than the body's sticky cell (e.g. header z=30, body z=20), not "bump only the leaf `<th>`, leave the row same as body."
   `leads-client.tsx` (same batch, same review) didn't add *any* z-index to either its sticky corner `<th>` or `<td>` — so the sticky technique is inconsistent across the three tables the batch touched, which is itself worth flagging even before judging correctness of any single one.
   **How to apply:** whenever reviewing sticky-table-column diffs, don't just check that z-index numbers exist — trace which DOM elements they're actually attached to and reason about which two elements are literally compared (nearest positioned ancestors), not just "does a bigger number appear somewhere in the diff." Ask for a live scroll test (Playwright screenshot at scroll-x=max, scroll-y=max) rather than trusting a code-only diff.

2. **New pure functions in a file with an existing test-per-pure-fn convention shipped with zero tests.**
   `pagination-state.ts` already has `getPaginationState` with a thorough test file (`customers-pagination-controls.test.ts`, edge cases: totalPages 0/1, page 1, last page, href construction). The same commit added `getCompactPageNumbers` (ellipsis algorithm, several branches: totalPages<=7, boundary clamping, left/right ellipsis toggling) right next to it, with the same "pure function, easily testable" framing in its own doc comment — but no test file/section was added anywhere in the repo. `node tools/kk-trace.mjs` / `vitest run` don't catch this because it's UI-only and not tied to a registered contract requirement.
   **How to apply:** when a diff adds a pure function beside an already-tested sibling of the same shape (same file, same "no UI imports, testable in isolation" doc-comment convention), missing tests for the new one is a real gap worth a MAJOR, not just a style nit — the absence is conspicuous precisely because the adjacent code proves the team knows how to test this shape of function.

See also [[review-mutation-testing-checklist]], [[gate-blindspot-next-build]].
