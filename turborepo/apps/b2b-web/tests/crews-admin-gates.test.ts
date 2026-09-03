import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * Dwa wymagania, jeden plik produkcyjny: apps/b2b-web/src/app/(dashboard)/crews/actions.ts
 * (WO ad-hoc, bez pliku w docs/workorders/ — obie reguły pochodzą wprost z
 * contracts/requirements.contract.mjs, status TODO):
 *
 *   1. CRM-DELETE-ADMIN-ONLY (globalna, 7 widoków CRM — ten plik pokrywa WYŁĄCZNIE
 *      crews; pozostałych 6 widoków zostaje TODO, poza zakresem tej tury).
 *   2. CRM-CREW-UPDATE-ADMIN-ONLY (świeże, wąskie: updateCrewAvatar).
 *
 * Wzorzec 1:1 z apps/b2b-web/tests/auditors-delete.test.ts (deleteAuditorAction) i
 * apps/b2b-web/tests/settings-authorized-users.test.ts (SEC-AUTHZ-USER-MGMT, ten sam
 * wzorzec błędu, inny zasób — WO tej tury nazywa to wprost). `actorRole` WYŁĄCZNIE z
 * `getCurrentActorRole()` (`../src/utils/supabase/server` z perspektywy tego pliku,
 * `../../../utils/supabase/server` z perspektywy produkcji — ta sama głębokość co
 * auditors/actions.ts), nigdy z parametru wywołania. Decyzję podejmuje wyłącznie
 * `can(actorRole, 'crews', capability)` z WYGENEROWANEGO kontraktu
 * (contracts/rbac.contract.mjs: crews.delete = ['admin'], crews.update = ['admin']) —
 * zero literału `role === 'admin'` w kodzie akcji.
 *
 * Kształt zakładany dla implementera (decyzja test-authora, uzasadnienie w opisie
 * na końcu odpowiedzi, nie tutaj):
 *   deleteCrewAction(id: string): Promise<{
 *     success: boolean; error?: string;
 *     blockingInstallations?: { id: string; status: string }[];
 *   }>
 *   updateCrewAvatar(crewId: string, path: string): Promise<{ success: boolean; error?: string }>
 *
 * Statusy blokujące usunięcie ekipy (PLANNED, IN_PROGRESS) są literałami stringowymi w
 * tym pliku, tak jak HANGING_LEAD_STATUSES w auditors-delete.test.ts — InstallationStatus
 * jest enumem Prisma (packages/database/prisma/schema.prisma), a nie eksportem
 * @klikklima/contracts, więc reguła "zero literałów" (progi SLA, stany lejka, ID
 * powiadomień) go nie obejmuje: nie ma z czego go zaimportować bez naruszenia granicy
 * "kontrakt = maszyna stanów lejka/SLA/RBAC/powiadomienia", nie "każdy enum bazy".
 *
 * Mockujemy @repo/database (brak żywej instancji testowej), next/cache (revalidatePath
 * wymaga kontekstu żądania Next.js) i ../src/utils/supabase/server (getCurrentActorRole
 * woła next/headers cookies(), które poza kontekstem żądania rzuca) — identyczny wzorzec
 * jak w auditors-delete.test.ts. `createClient` NIE jest mockowany: ani deleteCrewAction
 * ani updateCrewAvatar go nie używają (to setSelfAvailabilityAction w tym samym pliku),
 * dokładnie tak jak deleteAuditorAction/toggleAuditorActiveAction go pomijają.
 *
 * MECHANICZNA AKTUALIZACJA (WO SEC-AUDIT-LOG-DELETE, Fala B): `deleteCrewAction`
 * przyjmuje odtąd DRUGI argument, `input: { justification, legalBasis }`, i przed
 * transakcją pobiera `actorEmail` przez `createClient().auth.getUser()` — mockujemy
 * odtąd WYŁĄCZNIE `prisma.$transaction` (wzorem `services-authz-gates.test.ts` i
 * `sec-audit-log-delete-wave-b.test.ts`, które testują tę samą funkcję pod kątem
 * samego wpisu audytowego — ten opis `describe` zostaje wąski i dowodzi WYŁĄCZNIE
 * bramki roli i blokady BLOCK_UNTIL_REASSIGNED, tak jak przed tą turą).
 * `updateCrewAvatar` NIE zmienił sygnatury w tej fali, więc jego `describe` niżej
 * zostaje bez zmian.
 *
 * Świadome ograniczenia (odnotowane, nie pominięte milcząco):
 * - Warstwa UI (ukrycie przycisku "Usuń"/kontrolki wgrywania zdjęcia dla ról nie-admin)
 *   i warstwa RLS są OSOBNE od bramki Server Action i testowane gdzie indziej — sam
 *   kontrakt CRM-CREW-UPDATE-ADMIN-ONLY to zapisuje wprost ("stanowi warstwę osobną").
 *   RLS dla `zespoly_monterskie` nie ma tu żadnego znaczenia: Prisma go omija (pułapka 1,
 *   CLAUDE.md) — B2B panel nie jest chroniony przez bazę, jedyną granicą jest ten plik.
 * - Kryterium #3 kontraktu CRM-CREW-UPDATE-ADMIN-ONLY (`can(...) !== 'no'` przepuściłby
 *   przyszły wariant `:own`) NIE ma dziś bezpośredniego testu: `crews.update` w
 *   contracts/rbac.contract.mjs ma wyłącznie `['admin']`, żaden wariant `:own` nie
 *   istnieje, więc nie da się zaobserwować różnicy między `=== 'yes'` a `!== 'no'` bez
 *   zmiany samego kontraktu (poza zakresem roli test-author — kontrakty edytuje wyłącznie
 *   contract-steward). Odnotowane jawnie zamiast pominięte milcząco, wzorem podobnych
 *   ograniczeń w availability-restore.test.ts (updated_at) i
 *   settings-authorized-users.test.ts (błąd zapytania wewnątrz getCurrentActorRole).
 */

const {
  crewFindUniqueMock,
  crewDeleteMock,
  crewUpdateMock,
  auditLogCreateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  crewFindUniqueMock: vi.fn(),
  crewDeleteMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

// `updateCrewAvatar` woła `prisma.zespoly_monterskie.update` bezpośrednio (sygnatura
// niezmieniona tą falą), a `deleteCrewAction` odtąd woła WYŁĄCZNIE
// `prisma.$transaction` (patrz komentarz nagłówkowy) — oba kształty mockowania
// współistnieją w tym samym module, bo oba punkty zapisu żyją w tym samym pliku
// produkcyjnym.
vi.mock('@repo/database', () => ({
  prisma: {
    zespoly_monterskie: {
      findUnique: crewFindUniqueMock,
      delete: crewDeleteMock,
      update: crewUpdateMock,
    },
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — `updateCrewAvatar` nie
// testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser`
// dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { deleteCrewAction, updateCrewAvatar } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_INPUT = {
  justification: 'Duplikat rekordu ekipy utworzony przez pomylke operatora.',
  legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
};

// Statusy "aktywne" wg contracts/rbac.contract.mjs DELETE_POLICIES.crews
// (strategy: BLOCK_UNTIL_REASSIGNED) — literały wg InstallationStatus (Prisma enum,
// nie eksport @klikklima/contracts, patrz komentarz na górze pliku).
const PLANNED_INSTALLATION = { id: 'inst-1', status: 'PLANNED' };
const IN_PROGRESS_INSTALLATION = { id: 'inst-2', status: 'IN_PROGRESS' };
const COMPLETED_INSTALLATION = { id: 'inst-3', status: 'COMPLETED' };
const CANCELLED_INSTALLATION = { id: 'inst-4', status: 'CANCELLED' };

describe('deleteCrewAction — bramka roli i blokada aktywnych instalacji (CRM-DELETE-ADMIN-ONLY)', () => {
  beforeEach(() => {
    crewFindUniqueMock.mockReset();
    crewDeleteMock.mockReset();
    crewUpdateMock.mockReset();
    auditLogCreateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        zespoly_monterskie: { findUnique: crewFindUniqueMock, delete: crewDeleteMock },
        auditLog: { create: auditLogCreateMock },
      }),
    );
  });

  // Kryterium 1 (WO): dyspozytor/audytor/monter wywołujący bezpośrednio -> odmowa PRZED
  // jakimkolwiek zapytaniem do Prismy — ani findUnique, ani delete nie są wołane.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona po stronie serwera, zanim powstanie jakiekolwiek zapytanie do Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'crews', 'delete')).toBe('no');

      const result = await deleteCrewAction('crew-1', VALID_INPUT);

      // Kolejność asercji jest celowa: dowód braku zapytania do Prismy jest tym,
      // co ta reguła faktycznie zabezpiecza, więc raportuje się jako pierwszy —
      // kształt wyniku (result?.success) jest drugorzędny wobec samej bramki.
      expect(crewFindUniqueMock).not.toHaveBeenCalled();
      expect(crewDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Kryterium 2 (WO): fail-closed, brak roli.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(crewDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kryterium 2 (WO): fail-closed, błąd samego zapytania o rolę — odmowa musi być
  // wynikiem domenowym, nie nieobsłużonym wyjątkiem (wzorem
  // settings-authorized-users.test.ts).
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(crewDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kryterium 3 (WO): admin — sukces, gdy brak blokujących instalacji.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin — sukces, gdy ekipa nie ma żadnych blokujących instalacji', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', instalacje: [] });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(crewDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'crew-1' } }));
  });

  // Kryterium 4 (WO): admin z instalacją PLANNED -> odmowa, delete NIE wywołane.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin — instalacja w statusie PLANNED blokuje usunięcie, delete nie jest wywołane', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', instalacje: [PLANNED_INSTALLATION] });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(crewDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.blockingInstallations?.map((i: { id: string }) => i.id)).toEqual(['inst-1']);
  });

  // Kryterium 4 (WO): to samo dla IN_PROGRESS.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin — instalacja w statusie IN_PROGRESS blokuje usunięcie, delete nie jest wywołane', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', instalacje: [IN_PROGRESS_INSTALLATION] });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(crewDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.blockingInstallations?.map((i: { id: string }) => i.id)).toEqual(['inst-2']);
  });

  // Kryterium 5 (WO): COMPLETED/CANCELLED są terminalne i NIE blokują — usunięcie
  // przechodzi. Podwójna rola jako "przypadek maksymalny": kilka nieblokujących
  // instalacji naraz.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin — instalacje WYŁĄCZNIE COMPLETED/CANCELLED nie blokują usunięcia', async () => {
    crewFindUniqueMock.mockResolvedValue({
      id: 'crew-1',
      instalacje: [COMPLETED_INSTALLATION, CANCELLED_INSTALLATION],
    });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(crewDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'crew-1' } }));
  });

  // Przypadek maksymalny (WO globalne, "Zawsze dopisujesz"): mieszanka blokujących i
  // nieblokujących instalacji naraz — tylko blokujące trafiają do wyniku.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin — mieszanka statusów: tylko PLANNED/IN_PROGRESS trafiają do blockingInstallations', async () => {
    crewFindUniqueMock.mockResolvedValue({
      id: 'crew-1',
      instalacje: [
        PLANNED_INSTALLATION,
        COMPLETED_INSTALLATION,
        IN_PROGRESS_INSTALLATION,
        CANCELLED_INSTALLATION,
      ],
    });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(crewDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(result?.blockingInstallations?.map((i: { id: string }) => i.id).sort()).toEqual([
      'inst-1',
      'inst-2',
    ]);
  });

  // Kryterium 6 (WO): kontrola pozytywna dla samej bramki roli, izolowana od logiki
  // blokady instalacji (wzorem "kontrola pozytywna" w auditors-delete.test.ts i
  // settings-authorized-users.test.ts) — dowód, że macierz RBAC faktycznie przyznaje
  // adminowi delete, żeby bramka nie "przechodziła" z niewłaściwego powodu (odrzucając
  // wszystkich).
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('kontrola pozytywna kontraktu — admin ma delete na crews w macierzy RBAC', () => {
    expect(can('admin', 'crews', 'delete')).toBe('yes');
    expect(PERMISSIONS.crews.delete).toEqual(['admin']);
  });

  // Współbieżność (WO globalne, "Zawsze dopisujesz" + wzorzec deleteAuditorAction):
  // sprawdzenie blokujących instalacji i DELETE muszą siedzieć w JEDNEJ transakcji —
  // sprawdzenie w JS przed osobnym delete nie wystarcza (dwie równoległe próby
  // przepięcia ostatniej instalacji i usunięcia ekipy nie mogą się zazębić).
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('sprawdzenie blokujących instalacji i DELETE dzieją się w jednej transakcji', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', instalacje: [] });

    await deleteCrewAction('crew-1', VALID_INPUT);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Przypadek pusty (WO globalne): ekipa bez żadnych instalacji w ogóle (pole puste,
  // nie tylko brak blokujących) usuwa się bez błędu.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('przypadek pusty — ekipa bez żadnych instalacji usuwa się bez błędu', async () => {
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', instalacje: [] });

    const result = await deleteCrewAction('crew-1', VALID_INPUT);

    expect(result?.success).toBe(true);
    expect(result?.blockingInstallations ?? []).toEqual([]);
  });
});

describe('updateCrewAvatar — bramka roli, wyłącznie admin (CRM-CREW-UPDATE-ADMIN-ONLY)', () => {
  beforeEach(() => {
    crewFindUniqueMock.mockReset();
    crewDeleteMock.mockReset();
    crewUpdateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kryterium 1 kontraktu: dyspozytor/audytor/monter -> odmowa PRZED
  // prisma.zespoly_monterskie.update — test dowodzi, że update NIE zostało wywołane,
  // a nie tylko że wartość się nie zmieniła (dokładny cytat kryterium kontraktu).
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona po stronie serwera przed jakimkolwiek zapisem',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'crews', 'update')).toBe('no');

      const result = await updateCrewAvatar('crew-1', 'zespoly/crew-1/avatar.jpg');

      // Kolejność celowa (jak w deleteCrewAction powyżej): dowód braku zapisu jest
      // pierwszy, kształt wyniku drugorzędny wobec samej bramki.
      expect(crewUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Kryterium 3 kontraktu: fail-closed, brak roli.
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateCrewAvatar('crew-1', 'zespoly/crew-1/avatar.jpg');

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kryterium 3 kontraktu: błąd samego zapytania o rolę kończy się odmową, nie
  // nieobsłużonym wyjątkiem (cytat wprost z kontraktu; wzorem
  // settings-authorized-users.test.ts).
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await updateCrewAvatar('crew-1', 'zespoly/crew-1/avatar.jpg');

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kryterium 4 kontraktu: admin — sukces, wynik jawnie sygnalizuje powodzenie (nowa
  // sygnatura zwracana, nie void — dziś updateCrewAvatar zwraca void, więc `result`
  // jest `undefined` i to porównanie pada, dokładnie zamierzony RED, wzorem
  // SetSelfAvailabilityResult w tym samym pliku produkcyjnym).
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('admin — sukces, wynik jawnie potwierdza zapisanie zdjęcia (nie void)', async () => {
    crewUpdateMock.mockResolvedValue({ id: 'crew-1', zdjecie_url: 'zespoly/crew-1/avatar.jpg' });

    const result = await updateCrewAvatar('crew-1', 'zespoly/crew-1/avatar.jpg');

    expect(result).toEqual({ success: true });
    expect(crewUpdateMock).toHaveBeenCalledWith({
      where: { id: 'crew-1' },
      data: { zdjecie_url: 'zespoly/crew-1/avatar.jpg' },
    });
  });

  // Kryterium 5 kontraktu: odmowa ma jawny, odróżnialny kształt — nie wyjątek, nie
  // cichy brak efektu. Dowód: result jest obiektem z success === false, a nie
  // undefined/throw (dziś, przed naprawą, `result` jest `undefined`, bo akcja zwraca
  // void — porównanie z kształtem obiektu pada, poprawny RED).
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('odmowa ma jawny, odróżnialny kształt (obiekt z success:false), nie cichy void ani wyjątek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await updateCrewAvatar('crew-1', 'zespoly/crew-1/avatar.jpg');

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });

  // Kontrola pozytywna kontraktu (wzorem deleteCrewAction powyżej i
  // settings-authorized-users.test.ts) — dowód, że macierz RBAC faktycznie przyznaje
  // adminowi update na crews, żeby bramka nie "przechodziła" odrzucając wszystkich.
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('kontrola pozytywna kontraktu — admin ma update na crews w macierzy RBAC', () => {
    expect(can('admin', 'crews', 'update')).toBe('yes');
    expect(PERMISSIONS.crews.update).toEqual(['admin']);
  });

  // Przypadek pusty (WO globalne): ścieżka pusty string — akcja dziś (i po naprawie)
  // nadal nie waliduje KSZTAŁTU ścieżki (kryterium kontraktu wprost wyklucza to z
  // zakresu), więc jedyne, co ten test dowodzi, to że sama bramka roli nie jest
  // omijana pustym argumentem. Nie jest to test walidacji wejścia (poza zakresem).
  // @REQ: CRM-CREW-UPDATE-ADMIN-ONLY
  it('przypadek pusty — pusta ścieżka nie omija bramki roli dla nieuprawnionej roli', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await updateCrewAvatar('crew-1', '');

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });
});
