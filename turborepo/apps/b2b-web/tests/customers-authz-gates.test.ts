import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `customers/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, findings #1 i #2).
 *
 * Zadna z dwoch funkcji ponizej nie sprawdza dzis roli w ogole — kazda mutuje baze
 * dla dowolnego zalogowanego konta. Wzorzec bramki 1:1 z `deleteLeadAction`
 * (`leads/actions.ts:490`, patrz `leads-delete-admin-only.test.ts`).
 *
 * deleteCustomerAction — bramka `can(role, 'clients', 'delete') === 'yes'`
 * (`contracts/rbac.contract.mjs:29` -> wylacznie `admin`).
 *
 * addCustomerAddress — bramka `can(role, 'clients', 'update') === 'yes'`
 * (decyzja D1(a) z WO: adres jako czesc agregatu klienta, NIE nowy zasob RBAC —
 * `contracts/rbac.contract.mjs:29` -> `['admin', 'dyspozytor']`).
 *
 * Zestawy rol dozwolonych/niedozwolonych sa wyliczone DYNAMICZNIE z `can()` i `ROLES`
 * z @klikklima/contracts, nie wpisane jako literaly — zeby przyszla zmiana macierzy
 * automatycznie przesunela ktora rola idzie do ktorego kosza, zamiast cicho psuc test.
 *
 * Sygnatura docelowa (edge case z WO, "Odmowa odroznialna od sukcesu"): obie funkcje
 * dzis zwracaja `void`, po naprawie musza zwracac `{ success: boolean; error?: string }` —
 * inaczej UI (`customers-client.tsx:28`, `.../tabs-client.tsx:35`) nie odroznia odmowy
 * od sukcesu i przeladowuje strone z komunikatem "usunieto" nawet po odmowie.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej), next/cache (revalidatePath
 * wymaga kontekstu zadania Next.js) i ../src/utils/supabase/server (getCurrentActorRole
 * wola next/headers cookies(), ktore poza kontekstem zadania rzuca).
 */

const {
  klientDeleteMock,
  adresCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  klientDeleteMock: vi.fn(),
  adresCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    klienci: {
      delete: klientDeleteMock,
    },
    adresy: {
      create: adresCreateMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { deleteCustomerAction, addCustomerAddress } = await import(
  '../src/app/(dashboard)/customers/actions'
);

const DELETE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'clients', 'delete') === 'yes');
const DELETE_DENIED_ROLES = ROLES.filter((r) => can(r, 'clients', 'delete') !== 'yes');
const UPDATE_ALLOWED_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') === 'yes');
const UPDATE_DENIED_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') !== 'yes');

describe('deleteCustomerAction — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    klientDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DELETE_DENIED_ROLES)(
    'rola %s jest odrzucona, mutacja usunięcia klienta nie jest wywołana',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'clients', 'delete')).not.toBe('yes');

      const result = await deleteCustomerAction('klient-1');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(klientDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteCustomerAction('klient-1');

    expect(klientDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteCustomerAction('klient-1');

    expect(klientDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DELETE_ALLOWED_ROLES)(
    'rola %s jest dozwolona, delete faktycznie wywolane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      klientDeleteMock.mockResolvedValue({});

      const result = await deleteCustomerAction('klient-1');

      expect(result).toEqual({ success: true });
      expect(klientDeleteMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'klient-1' } }),
      );
    },
  );

  // Kontrola pozytywna kontraktu — dowod na dzisiejszy ksztalt macierzy RBAC.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — wylacznie admin ma delete na clients w macierzy RBAC', () => {
    expect(PERMISSIONS.clients.delete).toEqual(['admin']);
    expect(can('dyspozytor', 'clients', 'delete')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteCustomerAction('klient-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('addCustomerAddress — bramka roli (SEC-AUTHZ-B2B-MUTATIONS, decyzja D1(a))', () => {
  beforeEach(() => {
    adresCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_DENIED_ROLES)(
    'rola %s jest odrzucona, mutacja dodania adresu nie jest wywołana',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'clients', 'update')).not.toBe('yes');

      const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(adresCreateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3) — dyspozytor ma
  // clients.update, ale NIE ma clients.delete (odroznione powyzej), wiec ten test
  // pilnuje, zeby naprawa oparta przez pomylke na 'delete' nie zamknela dyspozytorowi
  // tez i tej sciezki.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(UPDATE_ALLOWED_ROLES)(
    'rola %s jest dozwolona, create faktycznie wywolane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      adresCreateMock.mockResolvedValue({});

      const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

      expect(result).toEqual({ success: true });
      expect(adresCreateMock).toHaveBeenCalledWith({
        data: { klient_id: 'klient-1', ulica_miasto: 'Warszawa, ul. Testowa 1' },
      });
    },
  );

  // Kontrola pozytywna kontraktu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — admin i dyspozytor maja update na clients w macierzy RBAC', () => {
    expect(PERMISSIONS.clients.update).toEqual(['admin', 'dyspozytor']);
    expect(can('audytor', 'clients', 'update')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

/**
 * BATCH-MEDIUM-LOW-CLEANUP — Punkt 18: `getCurrentActorRole()` jest dzis WEWNATRZ
 * `try` obejmujacego mutacje, wiec gdy rzuci wyjatek, uzytkownik dostaje generyczny
 * komunikat "Nie udało się..." zamiast odmowy uprawnien. Wzorzec docelowy:
 * `leads/actions.ts` (returnToFunnel/archiveLost), gdzie bramka jest przed `try`.
 */
describe('customers/actions.ts — Punkt 18: fail-closed przed try (BATCH-MEDIUM-LOW-CLEANUP)', () => {
  beforeEach(() => {
    klientDeleteMock.mockReset();
    adresCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('deleteCustomerAction: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero wywolan mutacji usunięcia klienta', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await deleteCustomerAction('klient-1');

    expect(klientDeleteMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('addCustomerAddress: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero wywolan mutacji dodania adresu', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await addCustomerAddress('klient-1', 'Warszawa, ul. Testowa 1');

    expect(adresCreateMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });
});
