import { z } from 'zod';
import { crewSchema } from '../schema';

/**
 * CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN (errata A-2): granica
 * zodResolver output -> FormData wydzielona z `AddCrewModal.tsx`, analogicznie
 * do `buildAuditorFormData` (patrz `tests/add-crew-modal-formdata-boundary.test.ts`).
 *
 * `CrewFormValues` to typ WYNIKU resolvera (`z.output`).
 */
export type CrewFormValues = z.output<typeof crewSchema>;

const DATE_FIELDS = new Set(['fgaz_valid_until', 'sep_valid_until']);

export function buildCrewFormData(values: CrewFormValues): FormData {
  const data = new FormData();

  Object.entries(values).forEach(([key, val]) => {
    if (typeof val === 'boolean') {
      data.append(key, val ? 'true' : 'false');
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
