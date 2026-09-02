---
name: project-customer-card-ungated
description: Karta klienta /customers/[id] czyta Prismę wprost w page.tsx bez can() — pełne PII dla każdej zalogowanej roli; luka poza zakresem WO SEC-READ-GATES (stan na 2026-09-02)
metadata:
  type: project
---

`apps/b2b-web/src/app/(dashboard)/customers/[id]/page.tsx` renderuje `prisma.klienci.findUnique`
z `adresy`, `leady`, `instalacje`, `logistyka_zamowienia`, `serwisy`, `usterki_incidents` — bez
żadnej bramki roli. WO `SEC-READ-GATES` zamknęło LISTĘ `/customers`, ale nie tę stronę (skaner
`kk-authz-gate` patrzy tylko na `actions.ts`, a to bezpośredni odczyt w `page.tsx`).

**Why:** ścieżka jest łańcuchowalna: audytor ma `leads:own`, `getLeadDetail` zwraca
`include: { klient: true }`, czyli UUID klienta — a mając UUID wchodzi na kartę i widzi komplet PII
klienta wraz z historią spoza własnych leadów. To obejście `SEC-RLS-AUDITOR-SCOPE` przez stronę,
nie przez join.

**How to apply:** przy każdym kolejnym audycie odczytów sprawdź, czy strona nadal jest niezabramkowana
(gate: `can(role,'clients','read') === 'yes'` przed `findUnique`), i czy zakres skanera objął
`page.tsx`, nie tylko `actions.ts`. Powiązane: [[project-auditor-scope-unimplemented]].
