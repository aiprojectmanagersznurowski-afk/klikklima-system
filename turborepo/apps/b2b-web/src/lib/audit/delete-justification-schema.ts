import { z } from "zod";
import { AUDIT_REQUIREMENTS } from "@klikklima/contracts";

/**
 * SEC-AUDIT-LOG-DELETE: schemat współdzielony przez wszystkie akcje `delete` panelu B2B
 * (leads, logistics — deleguje, installations, incidents, services, authorized_users).
 * Słownik podstaw prawnych pochodzi wyłącznie z kontraktu (`AUDIT_REQUIREMENTS.legalBases`).
 * Próg `10` znaków jest literałem powielającym CHECK bazy
 * `audit_log_justification_min_length` — kontrakt nie wystawia jeszcze własnego pola
 * na tę wartość. Ten sam, już zaakceptowany precedens co w
 * `apps/b2b-web/src/app/(dashboard)/customers/anonymize-client-schema.ts`
 * (`CRM-CLIENT-ANONYMIZE-RODO`), którego nie duplikuje.
 */
export const deleteJustificationSchema = z.object({
  justification: z.string().trim().min(10),
  legalBasis: z.enum(AUDIT_REQUIREMENTS.legalBases),
});

export type DeleteJustificationInput = z.infer<typeof deleteJustificationSchema>;

/**
 * Typ wyniku akcji `delete` — wydzielony jako alias, żeby sygnatura funkcji nie
 * zawierała nawiasu klamrowego typu przed właściwym ciałem funkcji (utrudniałoby
 * to statyczną analizę AC11, która balansuje nawiasy klamrowe od pierwszego `{`
 * po nazwie funkcji, żeby wyznaczyć koniec jej ciała).
 */
export type DeleteActionResult = { success: boolean; error?: string };
