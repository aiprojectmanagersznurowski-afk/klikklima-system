import { describe, it, expect } from 'vitest';

/**
 * REVIEW: BLOCKER + 2 MAJOR na granicy modal->FormData, WO
 * docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md (Zod refaktor).
 *
 * MAJOR #2 (schema.ts:26-30 wg raportu reviewera): `emptyToNullDate` robi
 * `new Date(v)` bez sprawdzenia poprawnosci wyniku. `new Date('nie-data')`
 * daje `Invalid Date` — instancje `Date`, dla ktorej `isNaN(getTime())` jest
 * `true` — ale sam typ `Date` przechodzi zod bez zadnej dalszej walidacji.
 * `safeParse` dzis (przed naprawa) zwraca `success: true` z niepoprawna
 * data w polu, co przecieka dalej do Prisma jako `Invalid Date` w kolumnie
 * typu `timestamp`.
 *
 * Test nie ma przypisanego @REQ — walidacja Zod jako taka nie ma dzis wpisu
 * w rejestrze wymagan (zgodnie z auditors-schema-validation.test.ts z tej
 * samej tury, ktory tez swiadomie nie taguje testow).
 */

const { auditorSchema } = await import('../src/app/(dashboard)/auditors/schema');

function formDataToObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    obj[key] = String(value);
  }
  return obj;
}

function buildFullFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    imie_i_nazwisko: 'Jan Kowalski',
    telefon: '+48123123123',
    email: 'jan.kowalski@example.com',
    adres: 'Warszawa, ul. Testowa 1',
    nazwa_firmy: 'HVAC Jan Kowalski',
    nip: '1234567890',
    certyfikat_fgaz: 'FGAZ/1/2024',
    doswiadczenie_hvac_lata: '5',
    uprawnienia_sep: 'true',
    preferowane_marki: JSON.stringify(['Daikin', 'Mitsubishi']),
    kod_pocztowy_bazowy: '00-001',
    max_promien_dojazdu_km: '50',
    iban: 'PL61109010140000071219812874',
    fgaz_valid_until: '2027-06-15',
    sep_valid_until: '2028-01-01',
  };
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.append(key, value);
  }
  return fd;
}

describe('auditorSchema — Invalid Date nie moze przejsc walidacji (MAJOR, reviewer)', () => {
  it('fgaz_valid_until = "nie-data" jest ODRZUCANE, nie ciche Invalid Date', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      fgaz_valid_until: 'nie-data',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('fgaz_valid_until'));
      expect(issue).toBeDefined();
    }
  });

  it('sep_valid_until = "nie-data" jest ODRZUCANE, nie ciche Invalid Date', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      sep_valid_until: 'nie-data',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('sep_valid_until'));
      expect(issue).toBeDefined();
    }
  });
});
