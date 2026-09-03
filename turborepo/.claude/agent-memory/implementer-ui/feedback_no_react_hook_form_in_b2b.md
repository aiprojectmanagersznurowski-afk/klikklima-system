---
name: feedback-no-react-hook-form-in-b2b
description: RESOLVED — react-hook-form + zodResolver was missing as of 2026-08-20, is now installed and the established pattern for every form dialog in apps/b2b-web
metadata:
  type: feedback
---

**AKTUALIZACJA:** ten wpis opisywał stan sprzed dodania zależności. Od anonimizacji klienta (`CRM-CLIENT-ANONYMIZE-RODO`) i wszystkich formularzy uzasadnienia w `SEC-AUDIT-LOG-DELETE` (obie fale), `react-hook-form`, `@hookform/resolvers` i `zod` są w `package.json` `apps/b2b-web` i aktywnie używane — potwierdzone m.in. w `customers/customers-client.tsx` (`AnonymizeClientModal`), `components/delete-justification-dialog.tsx`, `customers/create-customer-dialog.tsx`.

**Wzorzec ustalony**: `react-hook-form` + `zodResolver(sharedSchema)`, gdzie `sharedSchema` jest eksportowany z osobnego pliku obok akcji serwerowej (np. `create-customer-schema.ts`, `delete-justification-schema.ts`) i importowany zarówno przez formularz, jak i przez Server Action — jedno źródło walidacji, nie duplikat. Nowe dialogi formularzy mają kopiować ten wzorzec wprost, nie budować ad hoc `useState`.

**Why:** poprzednia notatka radziła obejście (`useState` na cały obiekt formularza) jako pragmatyczny substytut, dopóki zależność nie zostanie dodana. Zależność już jest — obejście nie ma dziś zastosowania, poza bardzo trywialnymi przypadkami bez walidacji.

Powiązane: [[project_crm_safe_record_actions]] (gdzie ograniczenie zostało pierwotnie odnotowane).
