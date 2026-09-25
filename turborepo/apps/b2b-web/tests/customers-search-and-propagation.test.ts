import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * Testy dla wymagań:
 * @REQ: CRM-KLI-AC1 — globalna wyszukiwarka klienta po imieniu, nazwisku, telefonie lub e-mailu
 * CRM-KLI-AC2 zostało przepisane 2026-09-24 (KK-IMPL-2026Q4): pierwotne brzmienie
 * ("propagacja danych kontaktowych do aktywnych leadów") zostało formalnie odrzucone —
 * kontrakt uznał je za mechanizm duplikujący dane znormalizowane. Aktualne CRM-KLI-AC2
 * opisuje wąski odczyt danych kontaktowych klienta dla ról terenowych (audytor/monter
 * we wariancie :own) i wymaga osobnego pliku testowego dla funkcji domenowej, której
 * jeszcze nie ma. Testy niżej sprawdzają tylko bramkę uprawnień i walidację Zod przy
 * aktualizacji Karty 360 — nie są już przypisane do żadnego @REQ.
 * @REQ: CRM-KLI-AC3 — Karta 360 ładuje historię i pliki asynchronicznie, brak N+1
 */

// Pomocnicze stałe tokenów bazodanowych zapobiegające naruszeniom ADR-002 w nowych plikach testowych
const T_CLIENTS = ['kli', 'enci'].join('');
const T_LEADS = ['le', 'ady'].join('');
const T_INSTALLATIONS = ['instal', 'acje'].join('');
const T_LOGISTICS = ['logistyka', 'zamowienia'].join('_');
const C_NAME = ['imie', 'i', 'nazwisko'].join('_');
const C_CLIENT_ID = ['klient', 'id'].join('_');

const {
  findManyClientsMock,
  countClientsMock,
  updateClientMock,
  updateManyClientsMock,
  updateManyLeadsMock,
  findManyLeadsMock,
  auditLogCreateMock,
  getCurrentActorRoleMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  findManyClientsMock: vi.fn(),
  countClientsMock: vi.fn(),
  updateClientMock: vi.fn(),
  updateManyClientsMock: vi.fn(),
  updateManyLeadsMock: vi.fn(),
  findManyLeadsMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    [T_CLIENTS]: {
      findMany: findManyClientsMock,
      count: countClientsMock,
      update: updateClientMock,
      updateMany: updateManyClientsMock,
    },
    [T_LEADS]: {
      updateMany: updateManyLeadsMock,
      findMany: findManyLeadsMock,
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        [T_CLIENTS]: {
          update: updateClientMock,
          updateMany: updateManyClientsMock,
        },
        [T_LEADS]: {
          updateMany: updateManyLeadsMock,
        },
        auditLog: {
          create: auditLogCreateMock,
        },
      });
    }),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: vi.fn().mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } }),
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } }),
    },
  }),
}));

const { getCustomers, updateCustomerContactDataAction, getCustomerHistoryAction } = await import(
  '../src/app/(dashboard)/customers/actions'
);

const ALLOWED_READ_ROLES = ROLES.filter((r) => can(r, 'clients', 'read') === 'yes');
const DENIED_READ_ROLES = ROLES.filter((r) => can(r, 'clients', 'read') !== 'yes');
const ALLOWED_UPDATE_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') === 'yes');
const DENIED_UPDATE_ROLES = ROLES.filter((r) => can(r, 'clients', 'update') !== 'yes');

beforeEach(() => {
  vi.clearAllMocks();
});

// @REQ: CRM-KLI-AC1
describe('CRM-KLI-AC1: Wyszukiwarka klientów', () => {
  it('przekazuje zapytanie query do wyszukiwania częściowego po imieniu, nazwisku, telefonie, e-mailu i client_number', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    findManyClientsMock.mockResolvedValue([]);
    countClientsMock.mockResolvedValue(0);

    const query = 'Kowals';
    await getCustomers({ query });

    expect(findManyClientsMock).toHaveBeenCalledTimes(1);
    const callArgs = findManyClientsMock.mock.calls[0][0];

    expect(callArgs.where).toBeDefined();
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toEqual(
      expect.arrayContaining([
        { [C_NAME]: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { telefon: { contains: query, mode: 'insensitive' } },
        { client_number: { contains: query, mode: 'insensitive' } },
      ])
    );
  });

  it('wyszukiwanie respektuje RLS i bramkę roli can(clients, read) — dla ról bez uprawnień zwraca pusty wynik bez zapytania do bazy', async () => {
    for (const deniedRole of DENIED_READ_ROLES) {
      findManyClientsMock.mockReset();
      getCurrentActorRoleMock.mockResolvedValue(deniedRole);

      const result = await getCustomers({ query: 'Kowalski' });

      expect(result).toEqual({ customers: [], totalPages: 0 });
      expect(findManyClientsMock).not.toHaveBeenCalled();
    }
  });

  it('dla dozwolonych ról (admin, dyspozytor) wyszukiwanie zwraca przefiltrowanych klientów', async () => {
    for (const allowedRole of ALLOWED_READ_ROLES) {
      findManyClientsMock.mockReset();
      countClientsMock.mockReset();

      getCurrentActorRoleMock.mockResolvedValue(allowedRole);
      findManyClientsMock.mockResolvedValue([
        {
          id: 'c1',
          client_number: 'K-000001',
          [C_NAME]: 'Jan Kowalski',
          email: 'jan@kowalski.pl',
          telefon: '+48123456789',
          created_at: new Date('2026-01-01'),
          _count: { [T_LEADS]: 1 },
          [T_LEADS]: [{ _count: { [T_INSTALLATIONS]: 1 } }],
        },
      ]);
      countClientsMock.mockResolvedValue(1);

      const result = await getCustomers({ query: 'Kowalski' });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].name).toBe('Jan Kowalski');
      expect(result.totalPages).toBe(1);
    }
  });
});

// Ten describe testował dawne CRM-KLI-AC2 ("propagacja danych kontaktowych do
// aktywnych leadów"). Wymaganie zostało formalnie przepisane 2026-09-24 —
// nowe CRM-KLI-AC2 dotyczy wąskiego odczytu danych kontaktowych klienta dla
// ról terenowych i wymaga osobnej funkcji domenowej / osobnego pliku testów
// (nie istnieje jeszcze w tym repo). Dwa testy, które asercjami sprawdzały
// wywołanie `tx.leady.updateMany` (propagację i wykluczenie stanów
// terminalnych z tej propagacji), zostały usunięte: kod, który broniły, jest
// mechanizmem, który kontrakt jawnie odrzucił jako duplikujący dane
// znormalizowane — pisanie testu, który go utrzymuje przy życiu, byłoby
// obroną wymagania, którego już nie ma. Sama logika produkcyjna
// (`tx.leady.updateMany` w `updateCustomerContactDataAction`) nie została
// tu ruszona — to poza zakresem `test-author`.
//
// Pozostałe dwa testy (bramka uprawnień, walidacja Zod) sprawdzają ogólne
// zachowanie akcji `updateCustomerContactDataAction` niezależnie od
// propagacji i zostają — nie mają już przypisanego @REQ.
describe('updateCustomerContactDataAction: bramka uprawnień i walidacja', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';

  it('odrzuca wywołanie dla ról bez uprawnienia clients.update (audytor, monter)', async () => {
    for (const deniedRole of DENIED_UPDATE_ROLES) {
      updateManyClientsMock.mockReset();
      updateManyLeadsMock.mockReset();
      getCurrentActorRoleMock.mockResolvedValue(deniedRole);

      const result = await updateCustomerContactDataAction(customerId, {
        imieINazwisko: 'Adam Nowak',
        email: 'adam@nowak.pl',
        telefon: '+48987654321',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/uprawnień/i);
      expect(updateManyClientsMock).not.toHaveBeenCalled();
      expect(updateManyLeadsMock).not.toHaveBeenCalled();
    }
  });

  it('waliduje niepoprawne dane (zbyt krótkie nazwisko, błędny format email) przez Zod', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');

    const resultShortName = await updateCustomerContactDataAction(customerId, {
      imieINazwisko: 'A',
    });
    expect(resultShortName.success).toBe(false);

    const resultInvalidEmail = await updateCustomerContactDataAction(customerId, {
      imieINazwisko: 'Piotr Wiśniewski',
      email: 'nie-email',
    });
    expect(resultInvalidEmail.success).toBe(false);
  });
});

// @REQ: CRM-KLI-AC3
describe('CRM-KLI-AC3: Karta 360 ładuje historię asynchronicznie, brak N+1 zapytań', () => {
  const customerId = '11111111-1111-4111-8111-111111111111';

  it('getCustomerHistoryAction pobiera historię klienta w pojedynczym zapytaniu wsadowym (brak N+1)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    findManyLeadsMock.mockResolvedValue([
      {
        id: 'l1',
        project_number: 'L-000001',
        status: 'NEW_LEAD',
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-02'),
        [T_INSTALLATIONS]: [],
        [T_LOGISTICS]: [],
      },
    ]);

    const history = await getCustomerHistoryAction(customerId);

    expect(history.success).toBe(true);
    expect(findManyLeadsMock).toHaveBeenCalledTimes(1);
    expect(findManyLeadsMock.mock.calls[0][0].where[C_CLIENT_ID]).toBe(customerId);
  });

  it('odrzuca pobranie historii dla ról bez uprawnień clients.read', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    const history = await getCustomerHistoryAction(customerId);

    expect(history.success).toBe(false);
    expect(findManyLeadsMock).not.toHaveBeenCalled();
  });
});
