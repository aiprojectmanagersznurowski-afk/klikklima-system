import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md — TC-G2.
 * Wymagania: `CAL-VISIT-DURATION-BASKETS` i `CAL-TRAVEL-BUFFER` (obie TODO).
 *
 * Bramka: `apps/b2b-web/src/app/(dashboard)/settings/calendar/page.tsx` (Server Component)
 * NIE ISTNIEJE jeszcze (WO, "Brakuje" — trasa /settings/calendar nie ma pliku). RED
 * oczekiwany: błąd modułu na imporcie poniżej.
 *
 * Wzorzec kopiowany 1:1 z `settings-page-authz.test.ts` (ten sam kształt: Server Component
 * async, `notFound()` z jawnym `return;`, `SettingsClient`-owy komponent kliencki mockowany
 * jako cały moduł, żeby uniknąć importu nierozwiązywalnego aliasu `@/*` w tym środowisku
 * testowym — patrz feedback_react_ui_test_infra_limits w pamięci agenta).
 *
 * Bramka strony wg WO: `getCurrentActorRole()` → `can(actorRole,'visit_duration_baskets','read') !== 'yes'`
 * → `notFound()`, PRZED `prisma.visitDurationBasket.findMany` i `prisma.system_config.findUnique`.
 * `read` dla `visit_duration_baskets` jest przyznane WSZYSTKIM czterem rolom w kontrakcie —
 * to jest świadome (WO: "actorRole trafia do klienta tylko po to, żeby wyszarzyć kontrolki dla
 * nie-admina — bramką wiążącą jest serwer", czyli edycja jest ograniczona w Server Actions,
 * a sam WIDOK strony jest współdzielony). Testy odmowy tego pliku dlatego używają roli, której
 * KONTRAKT nie przyznaje 'read' na 'visit_duration_baskets' — a to jest DOWÓD, że dziś (2026-09-15)
 * WSZYSTKIE cztery role mają read = brak takiej roli w systemie. Test odmowy pokrywa więc
 * wyłącznie fail-closed na braku roli / błędzie odczytu roli — kontrola pozytywna kontraktu
 * jest w scheduling-config-visit-duration-baskets.test.ts.
 */

const {
  visitDurationBasketFindManyMock,
  systemConfigFindUniqueMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  notFoundMock,
  redirectMock,
  CalendarSettingsClientMock,
} = vi.hoisted(() => ({
  visitDurationBasketFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
  CalendarSettingsClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findMany: visitDurationBasketFindManyMock },
    system_config: { findUnique: systemConfigFindUniqueMock },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock('../src/app/(dashboard)/settings/calendar/CalendarSettingsClient', () => ({
  CalendarSettingsClient: CalendarSettingsClientMock,
}));

const CalendarSettingsScreen = (await import('../src/app/(dashboard)/settings/calendar/page')).default;

const NO_READ_ROLE_STAND_IN = 'brak-roli-bez-read' as const;

beforeEach(() => {
  visitDurationBasketFindManyMock.mockReset();
  systemConfigFindUniqueMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
  notFoundMock.mockReset();
  redirectMock.mockReset();
  CalendarSettingsClientMock.mockReset();
  getCurrentActorRoleMock.mockResolvedValue('admin');
  visitDurationBasketFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue({ konfiguracja: { travel_buffer_minutes: 60 } });
});

describe('CalendarSettingsScreen — TC-G2 (bramka RBAC na /settings/calendar, notFound przed zapytaniem)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-G2 — brak roli (null, np. brak sesji) jest odrzucone PRZED jakimkolwiek zapytaniem Prismy', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = CalendarSettingsScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(visitDurationBasketFindManyMock).not.toHaveBeenCalled();
    expect(systemConfigFindUniqueMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: CAL-TRAVEL-BUFFER
  it('TC-G2 — błąd zapytania o rolę daje notFound(), nie nieobsłużony wyjątek/500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const call = CalendarSettingsScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(visitDurationBasketFindManyMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-G2 — admin przechodzi bramkę i otrzymuje wynik findMany PEŁNEJ listy (także isActive: false)', async () => {
    const basketsFixture = [
      { id: 'b-1', code: 'AUDIT', isActive: true },
      { id: 'b-2', code: 'SERVICE', isActive: false },
    ];
    visitDurationBasketFindManyMock.mockResolvedValue(basketsFixture);

    const result = await CalendarSettingsScreen();

    expect(visitDurationBasketFindManyMock).toHaveBeenCalledTimes(1);
    // Lista MUSI zawierać koszyk wycofany (isActive: false) — administrator musi móc
    // przywrócić wycofany koszyk (WO, "Sekcja 1").
    const call = visitDurationBasketFindManyMock.mock.calls[0][0];
    expect(call?.where?.isActive).not.toBe(true);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: CalendarSettingsClientMock });
  });

  // Kontrola: rola string nieznana kontraktowi (nie jedna z czterech) musi zachowywać się
  // jak brak dostępu, nie jak przepuszczenie — fail-closed nie zależy od tego, KTÓRA rola
  // dostaje odmowę, tylko od tego, że can() zwraca cokolwiek innego niż 'yes'.
  // @REQ: CAL-TRAVEL-BUFFER
  it(`TC-G2 — rola spoza ROLES (kontrakt) jest odrzucona identycznie jak brak roli`, async () => {
    getCurrentActorRoleMock.mockResolvedValue(NO_READ_ROLE_STAND_IN);

    const call = CalendarSettingsScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(visitDurationBasketFindManyMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
