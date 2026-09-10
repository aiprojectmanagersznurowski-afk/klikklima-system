import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md, sekcja "Punkty 1, 5, 6, 7, 8 —
 * jeden refaktor: walidacja Zod po stronie serwera" (D1-D6, AC1.1-AC1.5).
 *
 * FAZA RED. Modul `apps/b2b-web/src/app/(dashboard)/auditors/schema.ts` NIE
 * istnieje jeszcze — import ponizej musi dzis rzucic blad rozwiazywania modulu
 * ("Failed to resolve import" / "Cannot find module"), co jest oczekiwanym,
 * poprawnym RED na tym etapie (brak eksportu funkcji/modulu domenowego, nie
 * literowka w istniejacym imporcie).
 *
 * D1 (WO): jeden schemat Zod eksportowany z auditors/schema.ts, uzywany
 * ZARAZEM przez modal (zodResolver) i przez createAuditorAction/
 * updateAuditorAction. Test importuje TEN schemat wprost (nie duplikuje go)
 * i wola go bezposrednio (`schema.safeParse`) ORAZ przez akcje — to jest
 * dowod AC1.5 (ten sam komplet wejsc odrzucany identycznie w obu miejscach).
 *
 * Zaden test tutaj nie tworzy nowego wymagania @REQ — walidacja Zod jako taka
 * nie ma dzis wlasnego ID w rejestrze (planowane w Grupie B), zgodnie z
 * instrukcja WO. Testy NIE sa tagowane @REQ.
 */

const {
  auditorCreateMock,
  auditorUpdateMock,
  auditorFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  auditorCreateMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      create: auditorCreateMock,
      update: auditorUpdateMock,
      findUnique: auditorFindUniqueMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

// D1: schemat wspoldzielony miedzy modalem i akcja. Nazwa eksportu zalozona
// jako `auditorSchema` — jesli implementer wybierze inna nazwe, to jest
// TEST-DEFECT do zgloszenia, nie cicha naprawa importu w tym pliku.
const { auditorSchema } = await import('../src/app/(dashboard)/auditors/schema');
const { createAuditorAction, updateAuditorAction } = await import(
  '../src/app/(dashboard)/auditors/actions'
);

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
    promien_dzialania_km: '50',
    iban: 'PL61109010140000071219812874',
    zdjecie_url: 'audytorzy/aud-1-123456.jpg',
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

describe('auditors/schema.ts — walidacja Zod wspoldzielona z Server Action', () => {
  beforeEach(() => {
    auditorCreateMock.mockReset();
    auditorUpdateMock.mockReset();
    auditorFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // AC1.1: e-mail niepoprawny -> odmowa wskazujaca pole email, zero wywolan create.
  it('AC1.1: email "nie-email" odrzucony przez schemat wskazuje pole email', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      email: 'nie-email',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path.includes('email'));
      expect(emailIssue).toBeDefined();
    }
  });

  it('AC1.1: createAuditorAction z email "nie-email" odmawia i nie woła prisma.audytorzy.create', async () => {
    const data = buildFullFormData({ email: 'nie-email' });

    const result = await createAuditorAction(data);

    expect(auditorCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/email/i);
  });

  // AC1.2: doswiadczenie_hvac_lata: "abc" -> odmowa wskazujaca pole, nie ogolny komunikat.
  it('AC1.2: doswiadczenie_hvac_lata "abc" odrzucony przez schemat wskazuje pole', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      doswiadczenie_hvac_lata: 'abc',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('doswiadczenie_hvac_lata'));
      expect(issue).toBeDefined();
    }
  });

  it('AC1.2: createAuditorAction z doswiadczenie_hvac_lata "abc" wskazuje pole, nie ogolny komunikat', async () => {
    const data = buildFullFormData({ doswiadczenie_hvac_lata: 'abc' });

    const result = await createAuditorAction(data);

    expect(auditorCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.error).not.toMatch(/Nie udało się utworzyć/);
    expect(result?.error).toMatch(/doswiadczenie_hvac_lata|doświadczeni/i);
  });

  // AC1.3: preferowane_marki = "[1,2]" (elementy nie-string) -> odmowa PRZED zapytaniem Prisma.
  it('AC1.3: preferowane_marki "[1,2]" odrzucony przez schemat', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      preferowane_marki: '[1,2]',
    });

    expect(result.success).toBe(false);
  });

  it('AC1.3: createAuditorAction z preferowane_marki "[1,2]" odmawia, zero wywolan Prisma', async () => {
    const data = buildFullFormData({ preferowane_marki: '[1,2]' });

    const result = await createAuditorAction(data);

    expect(auditorCreateMock).not.toHaveBeenCalled();
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // AC1.4: preferowane_marki = "{}" (nie tablica) -> ta sama klasa odmowy.
  it('AC1.4: preferowane_marki "{}" odrzucony przez schemat (nie tablica)', () => {
    const result = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      preferowane_marki: '{}',
    });

    expect(result.success).toBe(false);
  });

  it('AC1.4: createAuditorAction z preferowane_marki "{}" odmawia, zero wywolan Prisma', async () => {
    const data = buildFullFormData({ preferowane_marki: '{}' });

    const result = await createAuditorAction(data);

    expect(auditorCreateMock).not.toHaveBeenCalled();
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // AC1.5: modal i akcja odrzucaja TEN SAM komplet wejsc — dowod przez wspolny import.
  it('AC1.5: schemat uzywany bezposrednio i przez updateAuditorAction odrzuca ten sam niepoprawny wpis', async () => {
    const invalidPayload = { ...formDataToObject(buildFullFormData()), email: 'nie-email' };

    const direct = auditorSchema.safeParse(invalidPayload);
    expect(direct.success).toBe(false);

    const formData = buildFullFormData({ email: 'nie-email' });
    const viaAction = await updateAuditorAction('aud-1', formData);

    expect(auditorUpdateMock).not.toHaveBeenCalled();
    expect(viaAction?.success).toBe(false);
  });

  // Przypadek brzegowy: puste FormData -> jedna odmowa z lista brakujacych pol.
  it('puste FormData daje jedna odmowe z lista brakujacych pol, zero zapytan do bazy', async () => {
    const result = await createAuditorAction(new FormData());

    expect(auditorCreateMock).not.toHaveBeenCalled();
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
  });

  // Przypadek brzegowy: is_active wstrzykniete atakujaco w FormData -> ignorowane
  // (schemat `strict`, nie przepisywane do payloadu Prisma).
  it('is_active wstrzykniete w FormData jest ignorowane, nie trafia do payloadu Prisma', async () => {
    auditorCreateMock.mockResolvedValue({ id: 'aud-new' });
    const data = buildFullFormData();
    data.append('is_active', 'false');

    await createAuditorAction(data);

    const callArgs = auditorCreateMock.mock.calls[0]?.[0];
    expect(callArgs?.data).not.toHaveProperty('is_active');
  });

  // Przypadek brzegowy: data w przeszlosci nadal dozwolona, brak gornego limitu roku.
  it('data w przeszlosci w fgaz_valid_until jest dozwolona przez schemat (bez gornego limitu roku)', () => {
    const past = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      fgaz_valid_until: '2020-01-01',
    });
    const farFuture = auditorSchema.safeParse({
      ...formDataToObject(buildFullFormData()),
      fgaz_valid_until: '2099-01-01',
    });

    expect(past.success).toBe(true);
    expect(farFuture.success).toBe(true);
  });
});
