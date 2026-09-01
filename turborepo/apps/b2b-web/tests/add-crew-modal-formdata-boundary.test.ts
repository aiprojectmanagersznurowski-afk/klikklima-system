import { describe, it, expect } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * REVIEW: MAJOR na granicy modal->FormData, WO
 * docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md (Zod refaktor).
 *
 * Analogia AddAuditorModal — patrz add-auditor-modal-formdata-boundary.test.ts
 * (ta sama sesja) po pelne uzasadnienie wyboru podejscia (bez pelnego
 * renderu — `AddCrewModal.tsx` tez importuje `@/components/ui/button`, ten
 * sam brak aliasu w root `vitest.config.mts`, ta sama bramka `guard-paths`)
 * oraz po uzasadnienie naprawy TEST-DEFECT (poprzednia wersja odtwarzala
 * predykat inline zamiast wolac prawdziwy kod produktu).
 *
 * Test woła prawdziwy `zodResolver(crewSchema)`, a wynik przekazuje do
 * wydzielonej, eksportowanej funkcji produktowej `buildCrewFormData`.
 *
 * WAZNE (kontrakt z implementer-ui, PLIK): tak jak w AddAuditorModal, funkcja
 * MUSI zostac wydzielona do WLASNEGO modulu
 * `apps/b2b-web/src/app/(dashboard)/crews/components/buildCrewFormData.ts`
 * (NIE zostawiona wewnatrz `AddCrewModal.tsx`) — z tego samego powodu:
 * `AddCrewModal.tsx` importuje `@/components/ui/button`, ktorego alias nie
 * jest skonfigurowany w root `vitest.config.mts`, wiec import calego pliku
 * modala zawsze eksploduje na etapie rozwiazywania modulow (zly RED),
 * zanim dojdzie do asercji. `AddCrewModal.tsx` ma importowac
 * `buildCrewFormData` z tego nowego pliku i uzywac go w `onSubmit`.
 *
 * Sygnatura: `buildCrewFormData(values: CrewFormValues): FormData`, gdzie
 * `CrewFormValues = z.output<typeof crewSchema>`.
 *
 * Dzisiejszy RED: plik `buildCrewFormData.ts` jeszcze nie istnieje — import
 * padnie na braku modulu (poprawny RED, brak funkcji domenowej / plik
 * jeszcze niezaimplementowany, nie literowka ani zly import istniejacej
 * infrastruktury).
 */

const { buildCrewFormData } = await import(
  '../src/app/(dashboard)/crews/components/buildCrewFormData'
);
const { crewSchema } = await import('../src/app/(dashboard)/crews/schema');

async function resolveFormValues(rawValues: Record<string, unknown>) {
  const resolver = zodResolver(crewSchema);
  const result = await resolver(
    rawValues,
    undefined,
    { fields: {}, shouldUseNativeValidation: false, criteriaMode: 'firstError' } as never,
  );
  if (Object.keys(result.errors).length > 0) {
    throw new Error(
      `zodResolver odrzucil wejscie testowe (nie powinien): ${JSON.stringify(result.errors)}`,
    );
  }
  // Dynamiczny import + generyczny resolver gubia precyzyjny typ - w runtime
  // to jest zawsze z.output<typeof crewSchema> (potwierdzone w review).
  return result.values as ReturnType<typeof crewSchema.parse>;
}

const RAW_FORM_DEFAULTS = {
  nazwa: 'Ekipa Warszawa Południe',
  telefon_kontaktowy: '',
  email: '',
  nip: '',
  koordynator_imie_nazwisko: '',
  certyfikat_fgaz: '',
  fgaz_valid_until: '',
  uprawnienia_sep: false,
  sep_valid_until: '',
  kod_pocztowy_bazowy: '',
  promien_dzialania_km: '',
  liczba_brygad: '1',
  posiada_wiertnice: false,
  iban: '',
};

describe('AddCrewModal — czyszczenie daty w edycji (MAJOR, regresja errata A-2)', () => {
  it('MAJOR: wyczyszczenie fgaz_valid_until w formularzu edycji musi wystawic pusty klucz w FormData', async () => {
    const values = await resolveFormValues({
      ...RAW_FORM_DEFAULTS,
      fgaz_valid_until: '',
    });

    const formData = buildCrewFormData(values);

    expect(formData.has('fgaz_valid_until')).toBe(true);
    expect(formData.get('fgaz_valid_until')).toBe('');
  });

  it('MAJOR: to samo dla sep_valid_until', async () => {
    const values = await resolveFormValues({
      ...RAW_FORM_DEFAULTS,
      sep_valid_until: '',
    });

    const formData = buildCrewFormData(values);

    expect(formData.has('sep_valid_until')).toBe(true);
    expect(formData.get('sep_valid_until')).toBe('');
  });
});
