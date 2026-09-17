---
name: project-docs-browser-ui
description: UI part of the /dokumentacja doc-browser feature — react-markdown table styling, nav item gating pattern, client/server fs split
metadata:
  type: project
---

Built the UI half of the `/dokumentacja` doc browser (2026-09-17): `doc-markdown.tsx`
(react-markdown v10 + remark-gfm table rendering) and `docs-list-client.tsx` (category-grouped
list), plus a role-gated "Dokumentacja" nav item in `apps/b2b-web/src/app/(dashboard)/layout.tsx`.

**Why:** implementer-server split `docs-catalog.ts` (touches `node:fs`, server-only) from
`docs-categories.ts` (pure data: `DOC_CATEGORIES`) specifically so client components could
import labels without pulling `node:fs` into the browser bundle. Importing `docs-catalog.ts`
from a `"use client"` file breaks `npm run build` with "the chunking context does not support
external modules (request: node:fs)" — invisible in vitest/tsc, only surfaces in a real
`next build`. **How to apply:** whenever a data module is split like this for
client/server bundling reasons, always import from the *categories/labels* file in client
components, never the one with fs/db access, and always verify with a real `npm run build`,
not just tests + tsc.

Nav item gating pattern (mirrors `isScheduleNavItemVisible` / `/me/schedule` in the same
`layout.tsx`): a pure predicate `isDocsNavItemVisible(role)` in `lib/<feature>/nav-visibility.ts`,
called from `layout.tsx` to conditionally build a `NavItem` and splice it into the `items` array
passed to `SidebarNavigation`. Static tests grep `layout.tsx` source for the import string and
check that `isDocsNavItemVisible(` appears within ~600 chars *before* the `/href` string literal
— so keep the nav item construction (`const item = show ? {...href...} : null`) close together,
don't separate the predicate call from the href literal by unrelated code.

See also [[feedback_test_regex_quirks]] for a related note on how static content-matching tests
in this repo are structured (relevant to any future `implementer-ui` work reading `*-static.test.ts`
files before writing the file they assert on).
