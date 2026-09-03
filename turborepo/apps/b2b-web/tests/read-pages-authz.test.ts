import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC9 (customers/crews/auditors), AC10
 * (installations/services/incidents), D3 (bramka strony = `notFound()`, kopia
 * `settings/page.tsx`/`leads/page.tsx`).
 *
 * Żadna z sześciu stron dziś (2026-09-02) NIE sprawdza roli w ogóle — RED z asercji
 * (`notFoundMock` nigdy nie jest wołane, `getXxxMock` zawsze jest wołane niezależnie
 * od roli), nie z brakującego eksportu (`export default` istnieje we wszystkich
 * sześciu plikach).
 *
 * D3, kształt bramki:
 *   - `customers`, `crews`, `auditors`: `can(role, <zasób>, 'read') !== 'yes'` -> notFound().
 *   - `installations`, `services`, `incidents`: `access === 'no'` -> notFound();
 *     `'yes'` i `'own'` (monter) renderują.
 *
 * KRYTYCZNE (wzorem `settings-page-authz.test.ts`, punkt 2 komentarza nagłówkowego
 * tamtego pliku): `vi.mock('next/navigation', ...)` podmienia `notFound` na
 * `vi.fn()`, który NIE RZUCA — implementacja MUSI mieć jawny `return` po `notFound()`,
 * inaczej wykonanie w tym środowisku testowym poleci dalej do zapytania (podczas gdy
 * prawdziwy `next/navigation` przerwałby wykonanie). Test dowodzi tego samego
 * kryterium co tam: `getXxxMock` NIE WOŁANE dla roli odrzuconej.
 *
 * `@/utils/supabase/server` (alias, używany dziś przez `crews/page.tsx` i
 * `auditors/page.tsx`) NIE jest skonfigurowany w `vitest.config.mts` (guard-paths
 * blokuje test-authorowi edycję tego pliku) — `vi.mock()` przechwytuje bare
 * specyfikator PRZED próbą jego rozwiązania (ten sam mechanizm udokumentowany w
 * `lead-detail-page-pool-spread.test.ts`), więc mockujemy OBIE formy specyfikatora
 * (`../src/utils/supabase/server` — realna ścieżka, i `@/utils/supabase/server` —
 * alias wirtualny) tym samym mockiem, żeby test nie zależał od tego, KTÓRY styl
 * importu implementer-server wybierze dla stron, które dziś w ogóle go nie mają
 * (`installations`/`services`/`incidents`).
 *
 * Client components (`*-client.tsx`) są mockowane W CAŁOŚCI — importują
 * `lucide-react`/`@/components/ui/*`, których alias `@/*` nie jest skonfigurowany.
 *
 * DOPISANE (audyt bezpieczeństwa, BLOCKER): `/customers/[id]/page.tsx`
 * (`Customer360Page`) czyta `prisma.klienci.findUnique` z pełnym PII (adresy,
 * leady -> instalacje/logistyka, serwisy, usterki) BEZ ŻADNEJ bramki roli — jedyny
 * `notFound()` istniejący dziś (2026-09-02) dotyczy nieistniejącego rekordu, nie
 * uprawnień. Łańcuch ataku: `audytor` ma `leads:own` -> `getLeadDetail` zwraca
 * `include: { klient: true }` (UUID klienta) -> wejście na `/customers/<uuid>`
 * ujawnia całą kartotekę, w tym klientów spoza jego zakresu. Bramka docelowa
 * IDENTYCZNA jak w naprawionym w tej turze `customers/page.tsx` (wzorzec powyżej):
 * `can(role, 'clients', 'read') !== 'yes' -> notFound(); return;` PRZED
 * `findUnique`. RED tutaj wynika z ASERCJI (strona istnieje, `findUnique` woła się
 * niezależnie od roli, `notFoundMock` nigdy nie jest wołany dla ról odrzuconych) —
 * nie z brakującego importu.
 */

const {
  getCurrentActorRoleMock,
  getCurrentUserMock,
  notFoundMock,
  getCustomersMock,
  getCrewsMock,
  getAuditorsMock,
  getInstallationsMock,
  getUpcomingServicesMock,
  getIncidentsMock,
  signStoragePathsMock,
  CustomersClientMock,
  CrewsClientMock,
  AuditorsClientMock,
  InstallationsClientMock,
  ServicesClientMock,
  IncidentsClientMock,
  klienciFindUniqueMock,
  Customer360TabsMock,
} = vi.hoisted(() => ({
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  notFoundMock: vi.fn(),
  getCustomersMock: vi.fn(),
  getCrewsMock: vi.fn(),
  getAuditorsMock: vi.fn(),
  getInstallationsMock: vi.fn(),
  getUpcomingServicesMock: vi.fn(),
  getIncidentsMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
  CustomersClientMock: vi.fn(),
  CrewsClientMock: vi.fn(),
  AuditorsClientMock: vi.fn(),
  InstallationsClientMock: vi.fn(),
  ServicesClientMock: vi.fn(),
  IncidentsClientMock: vi.fn(),
  klienciFindUniqueMock: vi.fn(),
  Customer360TabsMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    klienci: {
      findUnique: klienciFindUniqueMock,
    },
  },
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock('@/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: vi.fn(),
}));
vi.mock('@/lib/storage/signed-urls', () => ({
  signStoragePaths: signStoragePathsMock,
}));
// `customers/[id]/page.tsx` importuje `@/components/ui/button` BEZPOŚREDNIO (nie
// tylko przez client component) — alias `@/*` nie jest skonfigurowany w root
// `vitest.config.mts` (patrz komentarz nagłówkowy o `@/lib/storage/signed-urls`
// powyżej, ten sam mechanizm: `vi.mock()` przechwytuje bare specyfikator PRZED
// próbą jego rozwiązania). Stub minimalny, bez logiki — strona samego przycisku
// nie testuje.
vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => props,
}));
// `customers/[id]/page.tsx` importuje TAKŻE `@/lib/format-date` (audyt spójności
// wizualnej) — z tego samego powodu co `@/components/ui/button` powyżej (alias `@/*`
// nierozwiązywalny bez konfiguracji w root `vitest.config.mts`). Ten plik testuje
// wyłącznie bramkę roli (`notFound()` przed `findUnique`), nie format wyświetlanych
// dat, więc mock powtarza prawdziwą sygnaturę bez logiki formatowania.
vi.mock('@/lib/format-date', () => ({
  formatDate: vi.fn(() => 'formatted-date'),
}));

vi.mock('../src/app/(dashboard)/customers/actions', () => ({
  getCustomers: getCustomersMock,
}));
vi.mock('../src/app/(dashboard)/customers/customers-client', () => ({
  CustomersClient: CustomersClientMock,
}));

vi.mock('../src/app/(dashboard)/crews/actions', () => ({
  getCrews: getCrewsMock,
}));
vi.mock('../src/app/(dashboard)/crews/crews-client', () => ({
  CrewsClient: CrewsClientMock,
}));

vi.mock('../src/app/(dashboard)/auditors/actions', () => ({
  getAuditors: getAuditorsMock,
}));
vi.mock('../src/app/(dashboard)/auditors/auditors-client', () => ({
  AuditorsClient: AuditorsClientMock,
}));

vi.mock('../src/app/(dashboard)/installations/actions', () => ({
  getInstallations: getInstallationsMock,
}));
vi.mock('../src/app/(dashboard)/installations/installations-client', () => ({
  InstallationsClient: InstallationsClientMock,
}));

vi.mock('../src/app/(dashboard)/services/actions', () => ({
  getUpcomingServices: getUpcomingServicesMock,
}));
vi.mock('../src/app/(dashboard)/services/services-client', () => ({
  ServicesClient: ServicesClientMock,
}));

vi.mock('../src/app/(dashboard)/incidents/actions', () => ({
  getIncidents: getIncidentsMock,
}));
vi.mock('../src/app/(dashboard)/incidents/incidents-client', () => ({
  IncidentsClient: IncidentsClientMock,
}));

vi.mock('../src/app/(dashboard)/customers/[id]/tabs-client', () => ({
  Customer360Tabs: Customer360TabsMock,
}));

const CustomersPage = (await import('../src/app/(dashboard)/customers/page')).default;
const CustomerDetailPage = (await import('../src/app/(dashboard)/customers/[id]/page')).default;
const CrewsPage = (await import('../src/app/(dashboard)/crews/page')).default;
const AuditorsPage = (await import('../src/app/(dashboard)/auditors/page')).default;
const InstallationsPage = (await import('../src/app/(dashboard)/installations/page')).default;
const ServicesPage = (await import('../src/app/(dashboard)/services/page')).default;
const IncidentsPage = (await import('../src/app/(dashboard)/incidents/page')).default;

beforeEach(() => {
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
  notFoundMock.mockReset();
  getCustomersMock.mockReset();
  getCrewsMock.mockReset();
  getAuditorsMock.mockReset();
  getInstallationsMock.mockReset();
  getUpcomingServicesMock.mockReset();
  getIncidentsMock.mockReset();
  signStoragePathsMock.mockReset();
  CustomersClientMock.mockReset();
  CrewsClientMock.mockReset();
  AuditorsClientMock.mockReset();
  InstallationsClientMock.mockReset();
  ServicesClientMock.mockReset();
  IncidentsClientMock.mockReset();
  klienciFindUniqueMock.mockReset();
  Customer360TabsMock.mockReset();

  getCurrentUserMock.mockResolvedValue({ data: { user: null } });
  signStoragePathsMock.mockResolvedValue({});
});

const DENIED_YES_ONLY = (resource: string) => ROLES.filter((r) => can(r, resource, 'read') !== 'yes');
const NO_ACCESS = (resource: string) => ROLES.filter((r) => can(r, resource, 'read') === 'no');
const RENDERABLE = (resource: string) => ROLES.filter((r) => can(r, resource, 'read') !== 'no');

// @REQ: SEC-AUTHZ-B2B-READS
describe('CustomersPage - AC9 (clients.read = admin/dyspozytor)', () => {
  it.each(DENIED_YES_ONLY('clients'))('rola %s odrzucona przez notFound(), getCustomers() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = CustomersPage({ searchParams: Promise.resolve({}) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getCustomersMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = CustomersPage({ searchParams: Promise.resolve({}) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getCustomersMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('getCurrentActorRole() rzuca - odrzucony przez notFound(), nie 500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd roli'));

    const call = CustomersPage({ searchParams: Promise.resolve({}) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getCustomersMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'dyspozytor'] as const)('rola %s - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getCustomersMock.mockResolvedValue({ customers: [], totalPages: 0 });

    const result = await CustomersPage({ searchParams: Promise.resolve({}) });

    expect(getCustomersMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: CustomersClientMock });
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('CustomerDetailPage (/customers/[id]) - BLOCKER SEC-READ-GATES: bramka roli PRZED odczytem PII', () => {
  it.each(DENIED_YES_ONLY('clients'))(
    'rola %s odrzucona przez notFound(), prisma.klienci.findUnique NIE wołane (PII nie wycieka)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const call = CustomerDetailPage({ params: Promise.resolve({ id: 'customer-1' }) });
      await expect(call).resolves.not.toBeInstanceOf(Error);

      expect(klienciFindUniqueMock).not.toHaveBeenCalled();
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    },
  );

  it('brak roli (null) odrzucony przez notFound(), findUnique NIE wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = CustomerDetailPage({ params: Promise.resolve({ id: 'customer-1' }) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(klienciFindUniqueMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('getCurrentActorRole() rzuca - odrzucony przez notFound(), nie 500, findUnique NIE wołane', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd roli'));

    const call = CustomerDetailPage({ params: Promise.resolve({ id: 'customer-1' }) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(klienciFindUniqueMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'dyspozytor'] as const)(
    'rola %s - render przechodzi, notFound() NIE wołane, findUnique wołane dokładnie raz (zachowanie bez zmian)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      klienciFindUniqueMock.mockResolvedValue({
        id: 'customer-1',
        imie_i_nazwisko: 'Jan Kowalski',
        email: null,
        telefon: null,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await CustomerDetailPage({ params: Promise.resolve({ id: 'customer-1' }) });

      expect(klienciFindUniqueMock).toHaveBeenCalledTimes(1);
      expect(notFoundMock).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    },
  );

  // Regresja: rekord nieistniejący nadal daje notFound() dla roli DOZWOLONEJ —
  // bramka roli nie może zastąpić istniejącego sprawdzenia `!customer`.
  it('rola admin, klient nie istnieje - notFound() wołane PO findUnique (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    klienciFindUniqueMock.mockResolvedValue(null);

    const call = CustomerDetailPage({ params: Promise.resolve({ id: 'nieistniejacy' }) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(klienciFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('CrewsPage - AC9 (crews.read = admin/dyspozytor)', () => {
  it.each(DENIED_YES_ONLY('crews'))('rola %s odrzucona przez notFound(), getCrews() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = CrewsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getCrewsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = CrewsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getCrewsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'dyspozytor'] as const)('rola %s - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getCrewsMock.mockResolvedValue([]);

    const result = await CrewsPage();

    expect(getCrewsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: CrewsClientMock });
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('AuditorsPage - AC9 (auditors.read = admin/dyspozytor)', () => {
  it.each(DENIED_YES_ONLY('auditors'))('rola %s odrzucona przez notFound(), getAuditors() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = AuditorsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getAuditorsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = AuditorsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getAuditorsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(['admin', 'dyspozytor'] as const)('rola %s - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getAuditorsMock.mockResolvedValue([]);

    const result = await AuditorsPage();

    expect(getAuditorsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: AuditorsClientMock });
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('InstallationsPage - AC10 (installations.read: yes=admin/dyspozytor, own=monter, no=audytor)', () => {
  it.each(NO_ACCESS('installations'))('rola %s (no) odrzucona przez notFound(), getInstallations() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = InstallationsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getInstallationsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = InstallationsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getInstallationsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('getCurrentActorRole() rzuca - odrzucony przez notFound(), nie 500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd roli'));

    const call = InstallationsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getInstallationsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(RENDERABLE('installations'))('rola %s (yes/own) - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getInstallationsMock.mockResolvedValue([]);

    const result = await InstallationsPage();

    expect(getInstallationsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: InstallationsClientMock });
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('ServicesPage - AC10 (services.read: yes=admin/dyspozytor, own=monter, no=audytor)', () => {
  it.each(NO_ACCESS('services'))('rola %s (no) odrzucona przez notFound(), getUpcomingServices() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = ServicesPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getUpcomingServicesMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = ServicesPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getUpcomingServicesMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(RENDERABLE('services'))('rola %s (yes/own) - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getUpcomingServicesMock.mockResolvedValue([]);

    const result = await ServicesPage();

    expect(getUpcomingServicesMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: ServicesClientMock });
  });
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('IncidentsPage - AC10 (incidents.read: yes=admin/dyspozytor, own=monter, no=audytor)', () => {
  it.each(NO_ACCESS('incidents'))('rola %s (no) odrzucona przez notFound(), getIncidents() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const call = IncidentsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getIncidentsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('brak roli (null) odrzucony przez notFound()', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = IncidentsPage();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(getIncidentsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(RENDERABLE('incidents'))('rola %s (yes/own) - render przechodzi, notFound() NIE wołane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getIncidentsMock.mockResolvedValue([]);

    const result = await IncidentsPage();

    expect(getIncidentsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: IncidentsClientMock });
  });
});
