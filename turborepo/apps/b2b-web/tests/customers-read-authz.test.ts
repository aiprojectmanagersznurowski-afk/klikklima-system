import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC1, D2 (kształt odmowy), D4 (skaner).
 *
 * `getCustomers()` (`customers/actions.ts:26`) dziś (2026-09-02) NIE sprawdza roli w
 * ogóle — każdy zalogowany użytkownik (w tym `audytor`/`monter`, którzy nie mają
 * `clients.read` w `MATRIX`) dostaje pełną, spaginowaną listę klientów WRAZ Z PII
 * (e-mail, telefon — patrz `CustomerSummary`). RED tutaj musi wynikać z ASERCJI
 * (funkcja `getCustomers` już istnieje i jest eksportowana), nie z brakującego
 * importu.
 *
 * D2 (WO): kształt odmowy zostaje `{ customers: [], totalPages: 0 }` — TEN SAM typ,
 * który funkcja zwraca dziś dla przypadku pustego. `totalPages: 0` MUSI pochodzić z
 * odmowy, nie z `prisma.klienci.count()` niewywołanego zapytania (przypadek brzegowy
 * #8 WO: "odmowa nie może zwracać totalPages policzonego z pełnej tabeli").
 *
 * Zestaw ról dozwolonych/odrzuconych wyliczony z `ROLES` + `can()` (wzorzec
 * SEC-AUTHZ-B2B-MUTATIONS / leads-get-auditors-authz-gate.test.ts), nie wpisany na
 * sztywno — inaczej test mógłby milcząco przestać pokrywać macierz po jej zmianie.
 *
 * Mockujemy `@repo/database` (`prisma.klienci.findMany`/`.count` — dowód przez ZERO
 * wywołań dla ról bez uprawnień, wzorem `leads-get-auditors-authz-gate.test.ts`) i
 * `../src/utils/supabase/server` (`getCurrentActorRole`).
 */

const { findManyMock, countMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    klienci: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { getCustomers } = await import('../src/app/(dashboard)/customers/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'clients', 'read') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'clients', 'read') !== 'yes');

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
  getCurrentActorRoleMock.mockReset();
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('getCustomers() - bramka roli PRZED zapytaniem (clients.read = admin/dyspozytor, SEC-READ-GATES AC1)', () => {
  // Kontrola pozytywna kontraktu: dowód, że macierz faktycznie wyklucza audytor/monter
  // z clients.read — bez tego cała bateria mogłaby przechodzić dla bramki sprawdzającej
  // złą zdolność.
  it('kontrola pozytywna kontraktu - macierz RBAC przyznaje clients.read wyłącznie admin/dyspozytor', () => {
    expect(ALLOWED_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(DENIED_ROLES.length).toBeGreaterThan(0);
    for (const role of DENIED_ROLES) {
      expect(can(role, 'clients', 'read')).not.toBe('yes');
    }
  });

  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona PRZED jakimkolwiek zapytaniem do prisma.klienci (D2: { customers: [], totalPages: 0 })',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getCustomers();

      expect(findManyMock).not.toHaveBeenCalled();
      expect(countMock).not.toHaveBeenCalled();
      expect(result).toEqual({ customers: [], totalPages: 0 });
    },
  );

  // Przypadek brzegowy #8 (WO): odmowa nie może zwracać totalPages policzonego z
  // pełnej tabeli — dowodzimy tego wprost przez brak wywołania count(), nie tylko
  // przez wartość zwróconą.
  it('odmowa nie liczy totalPages z prisma.klienci.count() (zero wycieku liczności zbioru PII)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    countMock.mockResolvedValue(999);

    const result = await getCustomers();

    expect(countMock).not.toHaveBeenCalled();
    expect(result.totalPages).toBe(0);
  });

  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, findMany/count nie są wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getCustomers();

    expect(findManyMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
    expect(result).toEqual({ customers: [], totalPages: 0 });
  });

  it('błąd zapytania o rolę (getCurrentActorRole rzuca) daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getCustomers();

    expect(findManyMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
    expect(result).toEqual({ customers: [], totalPages: 0 });
  });

  // Kontrola pozytywna OSOBNO dla admin i OSOBNO dla dyspozytor — bez tego zestaw
  // przechodzi też dla bramki błędnie zawężonej do samego admina.
  it.each(ALLOWED_ROLES)(
    'rola %s - dozwolona, findMany/count są wołane i wynik przechodzi (zachowanie bez zmian)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      findManyMock.mockResolvedValue([]);
      countMock.mockResolvedValue(0);

      const result = await getCustomers();

      expect(findManyMock).toHaveBeenCalledTimes(1);
      expect(countMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ customers: [], totalPages: 0 });
    },
  );
});
