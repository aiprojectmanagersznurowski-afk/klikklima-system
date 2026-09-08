import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

/**
 * CRM-LEAD-UPDATE-ADMIN-DISPATCHER — druga z dwoch akcji objetych tym wymaganiem.
 *
 * `updateLeadData(leadId, data)` w
 * `apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts` nadpisuje dane kontaktowe
 * klienta, adres i estymowana wycene leada. Dzis nie ma ZADNEGO sprawdzenia roli ani
 * ZADNEGO testu. Macierz: `leads.update = ['admin', 'dyspozytor']` — bramka roli DOKLADA
 * SIE przed cala akcja, w tym przed galezia tworzaca nowy rekord klienta/adresu, gdy
 * lead ich jeszcze nie ma (kryterium kontraktu: odrzucone wywolanie nie moze zostawic
 * po sobie osieroconego rekordu klienta ani adresu).
 *
 * Wzorzec 1:1 z crews-admin-gates.test.ts i zaktualizowanym leads-auditor-pool.test.ts
 * (ten sam plik produkcyjny, ta sama macierz `leads.update`). `actorRole` WYLACZNIE z
 * `getCurrentActorRole()` (`../src/utils/supabase/server`), nigdy z parametru wywolania.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej — leady, klienci, adresy),
 * next/cache (revalidatePath wymaga kontekstu zadania Next.js) i
 * ../src/utils/supabase/server (getCurrentActorRole). Modele Prisma po polsku (leady,
 * klienci, adresy) — dlug KK-NAMING-BASELINE, ADR-002 zamrozony.
 */

const {
  leadFindUniqueMock,
  leadUpdateMock,
  klientFindUniqueMock,
  klientUpdateMock,
  klientCreateMock,
  adresUpdateMock,
  adresCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  klientFindUniqueMock: vi.fn(),
  klientUpdateMock: vi.fn(),
  klientCreateMock: vi.fn(),
  adresUpdateMock: vi.fn(),
  adresCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findUnique: leadFindUniqueMock,
      update: leadUpdateMock,
    },
    klienci: {
      findUnique: klientFindUniqueMock,
      update: klientUpdateMock,
      create: klientCreateMock,
    },
    adresy: {
      update: adresUpdateMock,
      create: adresCreateMock,
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

const { updateLeadData } = await import('../src/app/(dashboard)/leads/[id]/actions');

const UNAUTHORIZED_ROLES = ['audytor', 'monter'] as const;

const SAMPLE_DATA = {
  name: 'Jan Kowalski',
  phone: '600000000',
  email: 'jan@example.com',
  address: 'Warszawa, ul. Testowa 1',
  estimatedQuote: '12000',
};

const LEAD_WITH_CLIENT = {
  id: 'lead-1',
  klient_id: 'klient-1',
  adres_id: 'adres-1',
  klient: { id: 'klient-1' },
  adres: { id: 'adres-1' },
};

const LEAD_WITHOUT_CLIENT = {
  id: 'lead-2',
  klient_id: null,
  adres_id: null,
  klient: null,
  adres: null,
};

describe('updateLeadData - bramka roli (CRM-LEAD-UPDATE-ADMIN-DISPATCHER)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    klientFindUniqueMock.mockReset();
    klientUpdateMock.mockReset();
    klientCreateMock.mockReset();
    adresUpdateMock.mockReset();
    adresCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kryterium 1 kontraktu: audytor/monter odrzucony PRZED jakimkolwiek zapytaniem do
  // Prismy — takze zapytaniem odczytujacym (leadFindUniqueMock).
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona przed jakimkolwiek zapytaniem do Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'update')).toBe('no');

      const result = await updateLeadData('lead-1', SAMPLE_DATA);

      expect(leadFindUniqueMock).not.toHaveBeenCalled();
      expect(klientUpdateMock).not.toHaveBeenCalled();
      expect(klientCreateMock).not.toHaveBeenCalled();
      expect(adresUpdateMock).not.toHaveBeenCalled();
      expect(adresCreateMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Kryterium 4 kontraktu: fail-closed, brak roli.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kryterium 4 kontraktu: blad samego zapytania o role konczy sie odmowa, nie
  // nieobslugowanym wyjatkiem — dzisiejsze cialo akcji jest w try/catch zwracajacym
  // blad zapisu, wiec bramka musi stac przed nim albo miec wlasna obsluge.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kryterium: bramka pokrywa CALA akcje, laczenie z galezia tworzaca nowy rekord
  // klienta i adresu — odrzucone wywolanie nie moze zostawic osieroconego rekordu.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('rola bez leads.update na leadzie BEZ przypietego klienta nie tworzy osieroconych rekordow', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    leadFindUniqueMock.mockResolvedValue(LEAD_WITHOUT_CLIENT);

    const result = await updateLeadData('lead-2', SAMPLE_DATA);

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(klientCreateMock).not.toHaveBeenCalled();
    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kryterium 3 kontraktu: kontrola pozytywna OSOBNO dla admin i OSOBNO dla dyspozytor.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('admin - dozwolony, wywolanie konczy sie zapisem leada z istniejacym klientem/adresem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindUniqueMock.mockResolvedValue(LEAD_WITH_CLIENT);
    klientUpdateMock.mockResolvedValue({});
    adresUpdateMock.mockResolvedValue({});
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('dyspozytor - dozwolony, wywolanie konczy sie zapisem leada z istniejacym klientem/adresem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindUniqueMock.mockResolvedValue(LEAD_WITH_CLIENT);
    klientUpdateMock.mockResolvedValue({});
    adresUpdateMock.mockResolvedValue({});
    leadUpdateMock.mockResolvedValue({});

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Kontrola pozytywna kontraktu (wzorem crews-admin-gates.test.ts) — dowod, ze
  // macierz RBAC faktycznie przyznaje leads.update adminowi i dyspozytorowi razem.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('kontrola pozytywna kontraktu - admin i dyspozytor maja update na leads w macierzy RBAC', () => {
    expect(can('admin', 'leads', 'update')).toBe('yes');
    expect(can('dyspozytor', 'leads', 'update')).toBe('yes');
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);
  });

  // Odmowa ma jawny, odroznialny ksztalt — nie wyjatek, nie cichy sukces.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });

  // Luka 1 (weryfikacja contract-stewarda wobec pelnej listy acceptance
  // CRM-LEAD-UPDATE-ADMIN-DISPATCHER, 2026-09-08): `getCurrentActorRole()` jest
  // dzis wolane WEWNATRZ `try` calego ciala `updateLeadData`, bez wlasnego
  // `catch` — wyjatek z odczytu roli trafia do wspolnego `catch` na koncu
  // funkcji i zwraca komunikat bledu ZAPISU ("Nie udalo sie zapisac danych."),
  // a nie jawna odmowe uprawnien ("Brak uprawnien do edycji leada."), jak przy
  // zwyklym `access !== 'yes'`. Test wyzej ("blad zapytania o role daje
  // odmowe...") sprawdza tylko KSZTALT (`success: false`) i JUZ przechodzi —
  // nie lapie tej luki. Ten test sprawdza dokladna TRESC komunikatu, wzorem
  // poprawnego wzorca w `getLeadDetail` (osobny try/catch WYLACZNIE wokol
  // odczytu roli, w TYM SAMYM pliku produkcyjnym).
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('Luka 1 — blad zapytania o role daje TEN SAM komunikat odmowy co brak uprawnien, nie komunikat bledu zapisu', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad sesji/bazy'));

    const result = await updateLeadData('lead-1', SAMPLE_DATA);

    expect(result).toEqual({ success: false, error: 'Brak uprawnień do edycji leada.' });
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });
});
