---
name: select-open-tag-arrow-pitfall
description: naive indexOf('>') to find a JSX opening tag's end breaks when an attribute contains an arrow function (=>)
metadata:
  type: feedback
---

When writing static-parse test helpers that extract a JSX opening tag (e.g. `<select ...>`) by slicing from `<tagname` to the next `>`, a naive `content.indexOf('>', tagStart)` will match the `>` inside an arrow function attribute like `onChange={(e) => setX(...)}` and truncate the tag before real attributes (e.g. before `onChange` itself), silently producing a tag string that's missing content — assertions on the missing part then always fail (or worse, always pass if checking absence).

**Why:** discovered while adding mutation-killing assertions for `value={role}` / `onChange={... setRole(}` on a `<select>` in `apps/b2b-web/tests/settings-add-user-role-picker.test.ts` — reviewer flagged surviving mutants M4/M5, and the first attempt at an `onChange` assertion failed even against the real, correctly-wired source because the tag was truncated at the `=>` inside the onChange handler, not at the tag's real closing `>`.

**How to apply:** when extracting a JSX opening tag by brace/bracket scanning in these read-file-as-text tests, use a small scanner that finds the first `>` NOT preceded by `=` (`content[i] === '>' && content[i-1] !== '='`), not a plain `indexOf('>')`. Applies to [[feedback_mutation_verification_pattern]]-style static assertions on any JSX tag whose attributes may contain arrow functions.
