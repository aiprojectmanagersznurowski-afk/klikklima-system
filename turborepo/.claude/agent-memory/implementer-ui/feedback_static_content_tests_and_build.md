---
name: feedback-static-content-tests-and-build
description: This repo tests UI files via source-text regex (no jsdom/tsx in vitest include), and a passing test suite does not guarantee a working next build
metadata:
  type: feedback
---

Root `vitest.config.mts` in this repo has `include: ['**/*.test.ts']` — no `.tsx`, no jsdom, no
`@/*` alias — so components using client-only libs (react-markdown, etc.) are never actually
rendered in tests. Instead, tests like `docs-markdown-static.test.ts` read the component's
source file with `readFileSync` and assert on regex patterns (import statements, JSX prop
shapes like `remarkPlugins={[remarkGfm]}`, `components = {...}` keys, absence of hex colors).

**Why:** test-author writes these as a deliberate substitute for real component rendering,
given the test-infra limits. It means the "contract" for a UI file is often literally the
regex in the test — read it closely before writing the file, since e.g. a regex like
`components\s*:[^,}]{0,400}className` requires `className` to appear within 400 chars *after*
each key like `table:`/`td:`, not just somewhere in the file.

**How to apply:** for any new `implementer-ui` task with a `*-static.test.ts` companion,
read the test file in full first and match its regexes exactly (import phrasing, prop
placement, proximity constraints) rather than just satisfying the "spirit" of the requirement.

Separately: a green vitest suite + `tsc --noEmit` + `next lint` do NOT catch client components
that import server-only modules (e.g. anything touching `node:fs`) — that only fails at real
`npm run build` time with an opaque Turbopack "chunking context does not support external
modules" error. Always run the real build as a last verification step for any new/edited
`"use client"` file, per [[project-docs-browser-ui]].
