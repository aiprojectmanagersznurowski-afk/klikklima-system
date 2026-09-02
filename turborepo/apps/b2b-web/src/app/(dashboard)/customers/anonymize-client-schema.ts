import { z } from "zod";
import { AUDIT_REQUIREMENTS } from "@klikklima/contracts";

/**
 * CRM-CLIENT-ANONYMIZE-RODO (AC10): schemat dzielony przez formularz
 * (`zodResolver`) w `customers-client.tsx`. Próg 10 znaków i słownik
 * podstaw prawnych pochodzą wyłącznie z kontraktu (`AUDIT_REQUIREMENTS`) —
 * zero literałów duplikujących `../../../../packages/contracts/src/rbac.contract.mjs`.
 */
export const anonymizeClientSchema = z.object({
  justification: z.string().trim().min(10),
  legalBasis: z.enum(AUDIT_REQUIREMENTS.legalBases),
});

export type AnonymizeClientFormValues = z.infer<typeof anonymizeClientSchema>;

/**
 * Placeholder wpisywany w miejsce danych klienta po anonimizacji (RODO).
 * Współdzielony przez `actions.ts` (zapis do bazy) i `customers-client.tsx`
 * (optymistyczna aktualizacja UI), żeby oba miejsca nie rozjeżdżały się
 * przy ewentualnej zmianie treści.
 */
export const ANONYMIZED_NAME_PLACEHOLDER = 'Klient usunięty';
