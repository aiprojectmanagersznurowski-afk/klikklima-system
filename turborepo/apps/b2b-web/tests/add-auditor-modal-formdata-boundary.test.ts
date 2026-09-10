import { describe, it, expect } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * REVIEW: BLOCKER + MAJOR na granicy modal->FormData, WO
 * docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md (Zod refaktor).
 *
 * WYBOR PODEJSCIA TESTOWEGO (udokumentowany zgodnie z instrukcja WO):
 * Pelny render `AddAuditorModal` przez `react-dom/client` + jsdom byl
 * pierwszym podejsciem (jsdom, @testing-library/react i user-event zostaly
 * juz dodane jako devDependencies b2b-web wlasnie w tym celu). Zablokowal go
 * jednak fakt infrastrukturalny: `AddAuditorModal.tsx` importuje
 * `@/components/ui/button`, a alias `@/*` z tsconfig b2b-web NIE jest
 * skonfigurowany w root `vitest.config.mts` (brak `resolve.alias` / pluginu
 * `vite-tsconfig-paths`) — Vite nie potrafi rozwiazac tego importu przy
 * transformacji modulu, NIEZALEZNIE od `vi.mock` (mocker Vitest tez musi
 * najpierw rozwiazac specyfikator, zanim podmieni modul na fabryke). Próba
 * dopisania aliasu do `vitest.config.mts` zostala ZABLOKOWANA przez
 * `guard-paths` — słusznie: test-author nie ma prawa modyfikowac
 * wspoldzielonej infrastruktury testowej calego repo "przy okazji", zeby
 * test w ogole ruszyl. To jest osobny dlug infrastrukturalny (brak alias
 * resolvera w konfiguracji Vitest dla komponentow b2b-web), do zgloszenia
 * osobno — NIE do cichego obejscia przez test-authora.
 *
 * NAPRAWA TEST-DEFECT (ta rewizja): poprzednia wersja tego pliku ODTWARZALA
 * predykat/logike budowy FormData INLINE w tescie (`String(values.x)`,
 * `val !== undefined && val !== null`) i asercjonowala go na sobie samym —
 * gdy `implementer-ui` naprawil prawdziwy kod w `AddAuditorModal.tsx`
 * (JSON.stringify dla marek, '' zamiast pomijania klucza dla wyczyszczonych
 * dat), test tego nie wykryl, bo nigdy nie wolal prawdziwego kodu produktu.
 *
 * Test wywoluje NAPRAWDE prawdziwy `zodResolver(auditorSchema)` z
 * `@hookform/resolvers/zod` (bez mocka logiki biznesowej), a NASTEPNIE
 * przekazuje jego wynik do wydzielonej, eksportowanej funkcji produktowej
 * `buildAuditorFormData`.
 *
 * WAZNE (kontrakt z implementer-ui, PLIK): funkcja MUSI zostac wydzielona do
 * WLASNEGO modulu `apps/b2b-web/src/app/(dashboard)/auditors/components/
 * buildAuditorFormData.ts` (NIE zostawiona/dopisana wewnatrz
 * `AddAuditorModal.tsx`). Powod: `AddAuditorModal.tsx` importuje
 * `@/components/ui/button`, ktorego alias `@/*` nie jest skonfigurowany w
 * root `vitest.config.mts` (ten sam problem infrastrukturalny opisany wyzej
 * dla pelnego renderu) — import calego pliku modala w tescie zawsze
 * eksploduje na etapie rozwiazywania modulow (`Cannot find package
 * '@/components/ui/button'`), zanim dojdzie do jakiejkolwiek asercji. To
 * jest ZLY RED (blad rozwiazywania modulu, nie brakujacy eksport/asercja).
 * Wydzielenie logiki budowy FormData do osobnego pliku bez importow UI
 * eliminuje ten problem u zrodla i jest jedynym sposobem, zeby test mogl w
 * ogole dojsc do assercji. `AddAuditorModal.tsx` ma nadal importowac
 * `buildAuditorFormData` z tego nowego pliku i uzywac go w `onSubmit`.
 *
 * Sygnatura: `buildAuditorFormData(values: AuditorFormValues): FormData`,
 * gdzie `AuditorFormValues = z.output<typeof auditorSchema>` — typ WYNIKU
 * resolvera, ktory dzis komponent przekazuje do `onSubmit`.
 *
 * Dzisiejszy RED: plik `buildAuditorFormData.ts` jeszcze nie istnieje —
 * import padnie na braku modulu (`Cannot find module
 * '.../buildAuditorFormData'`). To jest poprawny RED (brak funkcji
 * domenowej / nieistniejacy, ale zaplanowany plik) — analogiczny do braku
 * eksportu, nie literowka ani zly import istniejacej infrastruktury.
 */

const { buildAuditorFormData } = await import(
  '../src/app/(dashboard)/auditors/components/buildAuditorFormData'
);
const { auditorSchema } = await import('../src/app/(dashboard)/auditors/schema');

// Symuluje DOKLADNIE to, co react-hook-form robi wewnatrz `handleSubmit`:
// woła skonfigurowany resolver z surowymi wartosciami formularza (stringi z
// pol <input>) i dostaje z powrotem `values` — TO jest obiekt przekazywany
// do `onSubmit` w komponencie (AddAuditorModal.tsx:153), a stad do
// `buildAuditorFormData`.
async function resolveFormValues(rawValues: Record<string, unknown>) {
  const resolver = zodResolver(auditorSchema);
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
  // to jest zawsze z.output<typeof auditorSchema> (potwierdzone w review).
  return result.values as ReturnType<typeof auditorSchema.parse>;
}

const RAW_FORM_DEFAULTS = {
  imie_i_nazwisko: 'Jan Kowalski',
  telefon: '',
  email: '',
  adres: '',
  nazwa_firmy: '',
  nip: '',
  certyfikat_fgaz: '',
  fgaz_valid_until: '',
  sep_valid_until: '',
  doswiadczenie_hvac_lata: '',
  uprawnienia_sep: false,
  preferowane_marki: '[]',
  kod_pocztowy_bazowy: '',
  promien_dzialania_km: '',
  iban: '',
};

describe('AddAuditorModal — granica zodResolver output -> FormData (BLOCKER)', () => {
  it('BLOCKER: buildAuditorFormData zapisuje preferowane_marki jako poprawny JSON odpowiadajacy wybranym markom', async () => {
    const values = await resolveFormValues({
      ...RAW_FORM_DEFAULTS,
      preferowane_marki: JSON.stringify(['Daikin', 'LG']),
    });

    const formData = buildAuditorFormData(values);

    expect(JSON.parse(formData.get('preferowane_marki') as string)).toEqual(['Daikin', 'LG']);
  });
});

describe('AddAuditorModal — czyszczenie daty w edycji (MAJOR, regresja errata A-2)', () => {
  it('MAJOR: wyczyszczenie fgaz_valid_until w formularzu edycji musi wystawic pusty klucz w FormData', async () => {
    const values = await resolveFormValues({
      ...RAW_FORM_DEFAULTS,
      fgaz_valid_until: '',
    });

    const formData = buildAuditorFormData(values);

    expect(formData.has('fgaz_valid_until')).toBe(true);
    expect(formData.get('fgaz_valid_until')).toBe('');
  });

  it('MAJOR: to samo dla sep_valid_until', async () => {
    const values = await resolveFormValues({
      ...RAW_FORM_DEFAULTS,
      sep_valid_until: '',
    });

    const formData = buildAuditorFormData(values);

    expect(formData.has('sep_valid_until')).toBe(true);
    expect(formData.get('sep_valid_until')).toBe('');
  });
});
