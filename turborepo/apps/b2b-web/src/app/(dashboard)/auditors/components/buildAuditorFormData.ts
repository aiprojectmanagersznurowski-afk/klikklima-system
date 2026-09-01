import { z } from 'zod';
import { auditorSchema } from '../schema';

/**
 * CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN (errata A-2): granica
 * zodResolver output -> FormData wydzielona z `AddAuditorModal.tsx`, żeby
 * dało się ją przetestować bez importowania komponentów UI (patrz
 * `tests/add-auditor-modal-formdata-boundary.test.ts`).
 *
 * `AuditorFormValues` to typ WYNIKU resolvera (`z.output`), czyli dokładnie
 * to, co react-hook-form przekazuje do `onSubmit`.
 */
export type AuditorFormValues = z.output<typeof auditorSchema>;

const DATE_FIELDS = new Set(['fgaz_valid_until', 'sep_valid_until']);

export function buildAuditorFormData(values: AuditorFormValues): FormData {
  const data = new FormData();

  Object.entries(values).forEach(([key, val]) => {
    if (typeof val === 'boolean') {
      data.append(key, val ? 'true' : 'false');
    } else if (key === 'preferowane_marki') {
      data.append(key, JSON.stringify(val ?? []));
    } else if (val === null) {
      if (DATE_FIELDS.has(key)) {
        data.append(key, '');
      }
    } else if (val !== undefined) {
      data.append(key, String(val));
    }
  });

  return data;
}
