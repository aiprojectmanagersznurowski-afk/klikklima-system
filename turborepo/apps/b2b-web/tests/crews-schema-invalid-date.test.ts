import { describe, it, expect } from 'vitest';

/**
 * REVIEW: BLOCKER + 2 MAJOR na granicy modal->FormData, WO
 * docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md (Zod refaktor).
 *
 * MAJOR #2 (crews/schema.ts:28-32 wg raportu reviewera) — analogiczny defekt
 * jak w auditors/schema.ts: `emptyToNullDate` nie sprawdza czy `new Date(v)`
 * dalo poprawna date. Patrz auditors-schema-invalid-date.test.ts (ta sama
 * sesja) po pelne uzasadnienie.
 */

const { crewSchema } = await import('../src/app/(dashboard)/crews/schema');

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
    nazwa: 'Ekipa Warszawa Południe',
    telefon_kontaktowy: '600100200',
    email: 'ekipa.waw@example.com',
    nip: '1234567890',
    koordynator_imie_nazwisko: 'Jan Kowalski',
    certyfikat_fgaz: 'FGAZ-2026-001',
    uprawnienia_sep: 'true',
    kod_pocztowy_bazowy: '02-100',
    promien_dzialania_km: '50',
    liczba_brygad: '3',
    posiada_wiertnice: 'true',
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

describe('crewSchema — Invalid Date nie moze przejsc walidacji (MAJOR, reviewer)', () => {
  it('fgaz_valid_until = "nie-data" jest ODRZUCANE, nie ciche Invalid Date', () => {
    const result = crewSchema.safeParse({
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
    const result = crewSchema.safeParse({
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
