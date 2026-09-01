import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS + SRV-SOURCE-OF-TRUTH — pokrycie dla `services/actions.ts`.
 *
 * Ta rewizja (WO: docs/workorders/SRV-SOURCE-OF-TRUTH-SERVICES-VIEW.md, D5, AC5-AC8,
 * AC11) ZMIENIA zamierzone zachowanie `deleteServiceAction` wobec poprzedniej wersji
 * tego pliku:
 *   - `id` jest odtąd kontraktowo `serwisy.id` (UUID). Poprzednia wersja tego pliku
 *     używała fikcyjnych identyfikatorów w kształcie `'service-1'` — NIE są to
 *     poprawne UUID, więc po wdrożeniu walidacji Zod (D5) te literały same w sobie
 *     zostałyby odrzucone jeszcze przed sprawdzeniem roli. Podmieniamy je na
 *     rzeczywiste UUID-y, żeby dalej testować bramkę roli, a nie kształt walidacji
 *     (ta ma osobne testy niżej, sekcja "AC5, D5 - walidacja UUID").
 *   - Dochodzi krok `prisma.serwisy.findUnique` PRZED `delete` (D5: „walidacja Zod →
 *     sprawdzenie roli → findUnique → kontrolowany błąd, jeśli brak rekordu”), więc
 *     mock `@repo/database` musi udostępniać obie metody.
 *   - Kolejność z AC11 („żadne zapytanie Prisma przed can()”) obejmuje odtąd RÓWNIEŻ
 *     `findUnique`, nie tylko `delete`.
 *
 * Zestawy ról dozwolonych/niedozwolonych są wyliczone dynamicznie z `can()`/`ROLES`,
 * nie wpisane literalnie.
 *
 * Mockujemy @repo/database, next/cache (revalidatePath) i
 * ../src/utils/supabase/server (getCurrentActorRole).
 */

const { serviceFindUniqueMock, serviceDeleteMock, revalidatePathMock, getCurrentActorRoleMock } =
  vi.hoisted(() => ({
    serviceFindUniqueMock: vi.fn(),
    serviceDeleteMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    getCurrentActorRoleMock: vi.fn(),
  }));

vi.mock('@repo/database', () => ({
  prisma: {
    serwisy: {
      findUnique: serviceFindUniqueMock,
      delete: serviceDeleteMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { deleteServiceAction } = await import('../src/app/(dashboard)/services/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'services', 'delete') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'services', 'delete') !== 'yes');

// UUID-y realne (v4-podobne) — używane wyłącznie jako fikcyjne, jednoznacznie
// testowe identyfikatory `serwisy.id`, żeby przejść przez walidację formatu (D5).
const EXISTING_SERVICE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_EXISTING_SERVICE_ID = '22222222-2222-4222-8222-222222222222';
const NONEXISTENT_SERVICE_ID = '99999999-9999-4999-8999-999999999999';
const INSTALLATION_ID_MISUSED_AS_SERVICE_ID = '33333333-3333-4333-8333-333333333333';

const EXISTING_SERVICE_RECORD = { id: EXISTING_SERVICE_ID, instalacja_id: 'inst-1' };

describe('deleteServiceAction — bramka roli PRZED zapytaniami Prisma (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    serviceFindUniqueMock.mockReset();
    serviceDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    serviceFindUniqueMock.mockResolvedValue(EXISTING_SERVICE_RECORD);
    serviceDeleteMock.mockResolvedValue(EXISTING_SERVICE_RECORD);
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it.each(DENIED_ROLES)(
    'AC11 - rola %s jest odrzucona, ani findUnique ani delete nie sa wywolane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'services', 'delete')).not.toBe('yes');

      const result = await deleteServiceAction(EXISTING_SERVICE_ID);

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(serviceFindUniqueMock).not.toHaveBeenCalled();
      expect(serviceDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteServiceAction(EXISTING_SERVICE_ID);

    expect(serviceFindUniqueMock).not.toHaveBeenCalled();
    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteServiceAction(EXISTING_SERVICE_ID);

    expect(serviceFindUniqueMock).not.toHaveBeenCalled();
    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it.each(ALLOWED_ROLES)('rola %s jest dozwolona, delete faktycznie wywolane na serwisy.id', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await deleteServiceAction(EXISTING_SERVICE_ID);

    expect(result).toEqual({ success: true });
    expect(serviceDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXISTING_SERVICE_ID } }),
    );
  });

  // Kontrola pozytywna kontraktu — dyspozytor ma services.update, ale NIE delete,
  // wiec naprawa oparta przez pomylke na 'update' musi ten test oblac.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('kontrola pozytywna kontraktu — wylacznie admin ma delete na services w macierzy RBAC', () => {
    expect(PERMISSIONS.services.delete).toEqual(['admin']);
    expect(can('dyspozytor', 'services', 'update')).toBe('yes');
    expect(can('dyspozytor', 'services', 'delete')).toBe('no');
  });

  // Wariant 'own' nie przepuszcza — monter ma services.update = 'own', nie 'yes'.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('kontrola pozytywna kontraktu — monter ma tylko wariant own na services.update, na delete brak', () => {
    expect(can('monter', 'services', 'update')).toBe('own');
    expect(can('monter', 'services', 'delete')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteServiceAction(EXISTING_SERVICE_ID);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });

  // AC8 (WO): odmowa dla roli bez uprawnien zachodzi NIEZALEZNIE od tego, czy
  // rekord istnieje.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('AC8 - odmowa dla roli bez uprawnien zachodzi niezaleznie od istnienia rekordu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    serviceFindUniqueMock.mockResolvedValue(null);

    const result = await deleteServiceAction(NONEXISTENT_SERVICE_ID);

    expect(serviceFindUniqueMock).not.toHaveBeenCalled();
    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // AC8: komplet ról spoza `admin` (dyspozytor, monter, audytor) wraz z komunikatem.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it.each(['dyspozytor', 'monter', 'audytor'] as const)(
    'AC8 - rola %s dostaje komunikat "Brak uprawnien..." i licznik serwisy sie nie zmienia',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await deleteServiceAction(EXISTING_SERVICE_ID);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/brak uprawnie/i);
      expect(serviceDeleteMock).not.toHaveBeenCalled();
    },
  );
});

describe('deleteServiceAction — AC7: rekord nieistniejacy (np. ID instalacji podstawione przez pomylke)', () => {
  beforeEach(() => {
    serviceFindUniqueMock.mockReset();
    serviceDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('AC7 - wywolanie z ID nieistniejacym w serwisy zwraca controlled error, nie rzuca P2025', async () => {
    serviceFindUniqueMock.mockResolvedValue(null);

    const result = await deleteServiceAction(INSTALLATION_ID_MISUSED_AS_SERVICE_ID);

    expect(result).toEqual(
      expect.objectContaining({ success: false, error: expect.stringMatching(/nie istnieje/i) }),
    );
    expect(serviceDeleteMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('AC7 - kolejnosc: findUnique jest wywolane PRZED jakakolwiek proba delete', async () => {
    serviceFindUniqueMock.mockResolvedValue(null);

    await deleteServiceAction(NONEXISTENT_SERVICE_ID);

    expect(serviceFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NONEXISTENT_SERVICE_ID } }),
    );
    expect(serviceDeleteMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy WO: idempotencja usuniecia — drugie wywolanie z tym samym ID
  // zwraca kontrolowany blad, nie wyjatek, i nie kaskaduje (delete wywolane raz).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('idempotencja - drugie wywolanie deleteServiceAction z tym samym ID daje kontrolowany blad, nie wyjatek', async () => {
    serviceFindUniqueMock.mockResolvedValueOnce(EXISTING_SERVICE_RECORD);
    serviceDeleteMock.mockResolvedValueOnce(EXISTING_SERVICE_RECORD);

    const first = await deleteServiceAction(EXISTING_SERVICE_ID);
    expect(first).toEqual({ success: true });
    expect(serviceDeleteMock).toHaveBeenCalledTimes(1);

    // Drugie wywolanie: rekord juz nie istnieje.
    serviceFindUniqueMock.mockResolvedValueOnce(null);

    const second = await deleteServiceAction(EXISTING_SERVICE_ID);

    expect(second).toEqual(
      expect.objectContaining({ success: false, error: expect.stringMatching(/nie istnieje/i) }),
    );
    expect(serviceDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe('deleteServiceAction — AC5, D5: walidacja formatu UUID', () => {
  beforeEach(() => {
    serviceFindUniqueMock.mockReset();
    serviceDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it.each(['', 'nie-jest-uuidem', '../../etc/passwd', '12345', 'inst-1'])(
    'AC5/D5 - id o niepoprawnym formacie UUID (%s) jest odrzucone bez zadnego zapytania Prisma',
    async (badId) => {
      const result = await deleteServiceAction(badId);

      expect(serviceFindUniqueMock).not.toHaveBeenCalled();
      expect(serviceDeleteMock).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    },
  );

  // Kontrola pozytywna: UUID poprawny nie jest odrzucany na etapie walidacji formatu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS, SRV-SOURCE-OF-TRUTH
  it('AC5/D5 - UUID poprawny przechodzi walidacje formatu (delete faktycznie wywolane)', async () => {
    serviceFindUniqueMock.mockResolvedValue({ id: OTHER_EXISTING_SERVICE_ID, instalacja_id: null });
    serviceDeleteMock.mockResolvedValue({ id: OTHER_EXISTING_SERVICE_ID });

    const result = await deleteServiceAction(OTHER_EXISTING_SERVICE_ID);

    expect(result).toEqual({ success: true });
    expect(serviceDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OTHER_EXISTING_SERVICE_ID } }),
    );
  });
});
