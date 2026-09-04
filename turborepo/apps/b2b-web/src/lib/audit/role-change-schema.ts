import { z } from "zod";
import { ROLES } from "@klikklima/contracts";
import { deleteJustificationSchema } from "./delete-justification-schema";

/**
 * SEC-AUDIT-LOG-ROLE-CHANGE (AC15): rozszerzenie `deleteJustificationSchema` o pole `role`
 * (docelowa rola konta `authorized_users`), zamiast niezależnej definicji — `justification`
 * i `legalBasis` (w tym próg 10 znaków i słownik podstaw prawnych) pochodzą z JEDNEGO
 * miejsca, nie z kopii. Słownik ról pochodzi wyłącznie z kontraktu (`ROLES`).
 */
export const roleChangeSchema = deleteJustificationSchema.extend({
  role: z.enum(ROLES),
});

export type RoleChangeInput = z.infer<typeof roleChangeSchema>;
