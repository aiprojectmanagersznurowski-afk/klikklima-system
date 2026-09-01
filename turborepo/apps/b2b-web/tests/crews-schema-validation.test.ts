import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md, sekcja "Punkty 1, 5, 6, 7, 8 —
 * jeden refaktor: walidacja Zod po stronie serwera" (D1-D6, AC5.1, przypadki brzegowe).
 *
 * FAZA RED. Modul `apps/b2b-web/src/app/(dashboard)/crews/schema.ts` NIE istnieje
 * jeszcze — import ponizej musi dzis rzucic blad rozwiazywania modulu, co jest
 * oczekiwanym, poprawnym RED (brak modulu domenowego).
 *
 * D2 (WO): createCrewAction/updateCrewAction przechodza z krotkich angielskich
 * kluczy FormData na nazwy kolumn Prisma snake_case (zespoly_monterskie) — patrz
 * Krok A tej tury, gdzie crews-kartoteka.test.ts zostal juz przepiety na te
 * konwencje. Ten plik testuje WYLACZNIE warstwe walidacji Zod (AC5.1: stary klucz
 * `fgazCert` daje odmowe "brak wymaganego pola", nie ciche pominiecie).
 *
 * Brak nowego @REQ dla samej walidacji Zod (zaplanowane w Grupie B) — testy w
 * tym pliku swiadomie NIE sa tagowane @REQ.
 */

const {
  crewCreateMock,
  crewUpdateMock,
  crewFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  crewCreateMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    zespoly_monterskie: {
      create: crewCreateMock,
      update: crewUpdateMock,
      findUnique: crewFindUniqueMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

// D1: schemat wspoldzielony, nazwa eksportu zalozona jako `crewSchema` — jesli
// implementer wybierze inna nazwe, to TEST-DEFECT do zgloszenia, nie cicha naprawa.
const { crewSchema } = await import('../src/app/(dashboard)/crews/schema');
const { createCrewAction, updateCrewAction } = await import(
  '../src/app/(dashboard)/crews/actions'
);

// 14 pol formularza po konwencji snake_case (D2) — zgodnie z Krokiem A tej tury
// (crews-kartoteka.test.ts) i kolumnami zespoly_monterskie w schema.prisma.
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

function formDataToObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    obj[key] = String(value);
  }
  return obj;
}

describe('crews/schema.ts — walidacja Zod wspoldzielona z Server Action (D2 snake_case)', () => {
  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // AC5.1: klucz w starej konwencji (fgazCert) miejsce certyfikat_fgaz daje
  // odmowe "brak wymaganego pola" (schemat go nie widzi jako wymaganego pola
  // certyfikat_fgaz jest opcjonalne — więc kluczowy dowod to: stary klucz NIE
  // przechodzi cichym pominieciem do payloadu Prisma pod nowa nazwa).
  it('AC5.1: schemat odrzuca payload zbudowany ze starej konwencji kluczy (fgazCert zamiast certyfikat_fgaz)', () => {
    const oldConventionPayload = {
      name: 'Ekipa Warszawa Południe',
      phone: '600100200',
      coordinator: 'Jan Kowalski',
      fgazCert: 'FGAZ-2026-001',
      // brak wymaganego pola `nazwa` w nowej konwencji -> odmowa
    };

    const result = crewSchema.safeParse(oldConventionPayload);

    expect(result.success).toBe(false);
    if (!result.success) {
      const nazwaIssue = result.error.issues.find((issue) => issue.path.includes('nazwa'));
      expect(nazwaIssue).toBeDefined();
    }
  });

  it('AC5.1: createCrewAction z kluczem starej konwencji fgazCert (bez nazwa) odmawia, create nie jest wolane', async () => {
    const fd = new FormData();
    fd.append('name', 'Ekipa Warszawa Południe');
    fd.append('fgazCert', 'FGAZ-2026-001');

    const result = await createCrewAction(fd);

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/nazwa|wymaga/i);
  });

  it('AC5.1: klucz starej konwencji fgazCert nie jest cicho przepisywany na certyfikat_fgaz przy poprawnym wypelnieniu nazwa', async () => {
    crewCreateMock.mockResolvedValue({ id: 'crew-new' });
    const fd = buildFullFormData();
    fd.delete('certyfikat_fgaz');
    fd.append('fgazCert', 'FGAZ-STARY-KLUCZ');

    await createCrewAction(fd);

    const callArgs = crewCreateMock.mock.calls[0]?.[0];
    // stara wartosc NIE mogla trafic do certyfikat_fgaz, bo klucz zrodlowy jest inny
    expect(callArgs?.data?.certyfikat_fgaz).not.toBe('FGAZ-STARY-KLUCZ');
  });

  // AC-E: komplet 14 pol przechodzi bez regresji.
  it('AC-E: komplet 14 pol formularza (snake_case) przechodzi walidacje schematu bez regresji', () => {
    const result = crewSchema.safeParse(formDataToObject(buildFullFormData()));

    expect(result.success).toBe(true);
  });

  it('AC-E: updateCrewAction bez podania fgaz_valid_until/sep_valid_until nie zeruje istniejacych dat (formData.has() nadal chroni)', async () => {
    crewFindUniqueMock.mockResolvedValue({
      id: 'crew-1',
      nazwa: 'Ekipa Warszawa Południe',
      fgaz_valid_until: new Date('2026-01-01T00:00:00.000Z'),
      sep_valid_until: new Date('2026-01-01T00:00:00.000Z'),
    });
    crewUpdateMock.mockResolvedValue({});

    const fd = buildFullFormData();
    fd.delete('fgaz_valid_until');
    fd.delete('sep_valid_until');

    await updateCrewAction('crew-1', fd);

    const call = crewUpdateMock.mock.calls.at(-1)?.[0];
    if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'fgaz_valid_until')) {
      expect(call.data.fgaz_valid_until).not.toBeNull();
    }
  });

  // Przypadek brzegowy: puste FormData -> jedna odmowa z lista brakujacych pol.
  it('puste FormData daje jedna odmowe z lista brakujacych pol, zero zapytan do bazy', async () => {
    const result = await createCrewAction(new FormData());

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
  });

  // Przypadek brzegowy: is_active/leave_status wstrzykniete atakujaco -> ignorowane
  // (schemat `strict`, crews nie zna tych kolumn jako pol formularza).
  it('is_active i leave_status wstrzykniete w FormData sa ignorowane, nie trafiaja do payloadu Prisma', async () => {
    crewCreateMock.mockResolvedValue({ id: 'crew-new' });
    const fd = buildFullFormData();
    fd.append('is_active', 'false');
    fd.append('leave_status', 'ON_LEAVE');

    await createCrewAction(fd);

    const callArgs = crewCreateMock.mock.calls[0]?.[0];
    expect(callArgs?.data).not.toHaveProperty('is_active');
    expect(callArgs?.data).not.toHaveProperty('leave_status');
  });

  // Przypadek brzegowy: data w przeszlosci nadal dozwolona, brak gornego limitu roku.
  it('data w przeszlosci w fgaz_valid_until jest dozwolona przez schemat (bez gornego limitu roku)', () => {
    const past = crewSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      fgaz_valid_until: '2020-01-01',
    });
    const farFuture = crewSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      fgaz_valid_until: '2099-01-01',
    });

    expect(past.success).toBe(true);
    expect(farFuture.success).toBe(true);
  });

  // Pola liczbowe: promien_dzialania_km "abc" -> odmowa wskazujaca pole, nie
  // ogolny komunikat "Nie udało się zapisać zmian ekipy."
  it('promien_dzialania_km "abc" odrzucony przez schemat wskazuje pole', () => {
    const result = crewSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      promien_dzialania_km: 'abc',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('promien_dzialania_km'));
      expect(issue).toBeDefined();
    }
  });

  it('updateCrewAction z promien_dzialania_km "abc" wskazuje pole, nie ogolny komunikat', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', nazwa: 'Ekipa' });
    const fd = buildFullFormData({ promien_dzialania_km: 'abc' });

    const result = await updateCrewAction('crew-1', fd);

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.error).not.toMatch(/Nie udało się zapisać zmian ekipy\./);
  });
});
