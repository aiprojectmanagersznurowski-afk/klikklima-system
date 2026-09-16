import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16.
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, status TODO).
 *
 * Kontynuacja domykania (contract-steward, 2026-09-16, "dziura 2"): AC1 wymaga, żeby "wycena
 * historyczna, która [koszyk] używa, musi dalej poprawnie wyświetlać jego etykietę" — w repo
 * nie istniał żaden widok listy/szczegółu rezerwacji dla leada, więc `findBasketById`
 * (`basket-select.ts`) miało zero konsumentów. Ten plik dowodzi propsów NOWEGO Server
 * Component-owego dociągnięcia (`leads/[id]/page.tsx`) + NOWEGO komponentu
 * `apps/b2b-web/src/app/(dashboard)/leads/[id]/lead-bookings-list.tsx`, wzorem
 * `lead-create-booking-dialog-props.test.ts` (ten sam plik `page.tsx`, ten sam sposób
 * wywołania funkcji async bez hooków i przeszukania drzewa `React.createElement(...)`).
 *
 * KONTRAKT Z IMPLEMENTER-UI (WO, "Kształt zmiany", dziura 2): `page.tsx` woła
 * `prisma.booking.findMany({ where: { leadId: id } })` (pole Prisma `leadId`, `schema.prisma`
 * `model Booking`), mapuje każdy wiersz na `{ id, scheduledStart, basketId }` (`basketId` =
 * `visitBasketId` z wiersza — Prisma zwraca camelCase pole zmapowane z `visit_basket_id`) i
 * przekazuje wynik propsem `bookings`, obok `baskets` (KOMPLET, ten sam co dostaje
 * `<CreateBookingDialog>`), do `<LeadBookingsList>`. Etykieta koszyka NIE jest zapisywana na
 * rezerwacji ani wyliczana w `page.tsx` — komponent sam znajduje ją przez `findBasketById`
 * (dowiedzione osobno w `lead-bookings-list-static.test.ts`).
 *
 * Mockowane zależności — dokładnie ten sam zestaw co `lead-create-booking-dialog-props.test.ts`
 * (ten sam plik `page.tsx`), plus `booking.findMany` w `@repo/database` i nowy mock
 * `./lead-bookings-list`.
 */

const {
  leadFindUniqueMock,
  getAuditorsMock,
  signStoragePathsMock,
  AssignAuditorMock,
  CreateBookingDialogMock,
  LeadBookingsListMock,
  visitDurationBasketFindManyMock,
  bookingFindManyMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  getAuditorsMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
  AssignAuditorMock: vi.fn(() => null),
  CreateBookingDialogMock: vi.fn(() => null),
  LeadBookingsListMock: vi.fn(() => null),
  visitDurationBasketFindManyMock: vi.fn(),
  bookingFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: leadFindUniqueMock },
    visitDurationBasket: { findMany: visitDurationBasketFindManyMock },
    booking: { findMany: bookingFindManyMock },
  },
}));
vi.mock('../src/app/(dashboard)/leads/actions', () => ({
  getAuditors: getAuditorsMock,
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
vi.mock('@/lib/storage/signed-urls', () => ({
  signStoragePaths: signStoragePathsMock,
}));
vi.mock('@/components/ui/button', () => ({ Button: () => null }));
vi.mock('@/components/ui/status-pill', () => ({ StatusPill: () => null }));
vi.mock('@/lib/format-date', () => ({ formatDate: vi.fn(() => 'formatted-date') }));
vi.mock('@/lib/format-status', () => ({ formatLeadStatus: vi.fn((s: unknown) => s) }));
vi.mock('@/lib/empty-value', () => ({ EMPTY_VALUE: '—' }));
vi.mock('../src/app/(dashboard)/leads/[id]/assign-auditor', () => ({
  AssignAuditor: AssignAuditorMock,
}));
vi.mock('../src/app/(dashboard)/leads/[id]/edit-lead-modal', () => ({
  EditLeadModal: () => null,
}));
vi.mock('../src/app/(dashboard)/leads/[id]/delete-lead-button', () => ({
  DeleteLeadButton: () => null,
}));
vi.mock('../src/app/(dashboard)/leads/leads-client', () => ({
  LEAD_STATUS_TONE: {},
}));
vi.mock('../src/app/(dashboard)/leads/[id]/create-booking-dialog', () => ({
  CreateBookingDialog: CreateBookingDialogMock,
}));
// Punkt integracji tej tury — moduł jeszcze nie istnieje (dziura 2). Mock całego modułu
// przechwytuje `.type` w drzewie elementów, dokładnie jak `CreateBookingDialogMock`.
vi.mock('../src/app/(dashboard)/leads/[id]/lead-bookings-list', () => ({
  LeadBookingsList: LeadBookingsListMock,
}));

const LeadDetailsPage = (await import('../src/app/(dashboard)/leads/[id]/page')).default;

const LEAD_FIXTURE = {
  id: 'lead-1',
  created_at: new Date('2026-08-20T10:00:00Z'),
  klient: null,
  adres: null,
  status: 'NEW_LEAD',
  data_rezerwacji: null,
  odpowiedzi_triage: null,
  estymowana_wycena: null,
  audytor_id: null,
};

const SEVEN_BASKETS = [
  { id: 'b-audit', code: 'AUDIT', labelPl: 'Audyt', pool: 'AUDITOR', durationMinutes: 120, isActive: true, sortOrder: 10 },
  { id: 'b-service', code: 'SERVICE', labelPl: 'Serwis (przegląd okresowy)', pool: 'CREW', durationMinutes: 90, isActive: true, sortOrder: 20 },
];

const TWO_BOOKING_ROWS = [
  {
    id: 'booking-1',
    scheduledStart: new Date('2026-09-20T08:00:00Z'),
    scheduledEnd: new Date('2026-09-20T10:00:00Z'),
    visitBasketId: 'b-audit',
    leadId: 'lead-1',
  },
  {
    id: 'booking-2',
    scheduledStart: new Date('2026-09-25T08:00:00Z'),
    scheduledEnd: new Date('2026-09-25T09:30:00Z'),
    visitBasketId: 'b-service',
    leadId: 'lead-1',
  },
];

function callPage(id = 'lead-1') {
  return LeadDetailsPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  });
}

function findElementByType(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  if (React.isValidElement(node)) {
    const element = node as { type: unknown; props?: { children?: unknown } };
    if (element.type === type) {
      return node as { props: Record<string, unknown> };
    }
    return findElementByType(element.props?.children, type);
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByType(child, type);
      if (found) return found;
    }
  }
  return null;
}

async function leadBookingsListProps(id = 'lead-1'): Promise<Record<string, unknown>> {
  const result = await callPage(id);
  const element = findElementByType(result, LeadBookingsListMock);
  if (!element) {
    throw new Error(
      '<LeadBookingsList> nie znaleziony w drzewie zwróconym przez LeadDetailsPage — komponent nie jest jeszcze zintegrowany (dziura 2, FLD-QUOTE-BASKET-SELECT).',
    );
  }
  return element.props;
}

describe('leads/[id]/page.tsx — integracja <LeadBookingsList> (FLD-QUOTE-BASKET-SELECT, dziura 2)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    getAuditorsMock.mockReset();
    signStoragePathsMock.mockReset();
    AssignAuditorMock.mockClear();
    CreateBookingDialogMock.mockClear();
    LeadBookingsListMock.mockClear();
    visitDurationBasketFindManyMock.mockReset();
    bookingFindManyMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    createClientMock.mockReset();

    leadFindUniqueMock.mockResolvedValue(LEAD_FIXTURE);
    getAuditorsMock.mockResolvedValue([]);
    signStoragePathsMock.mockResolvedValue({});
    visitDurationBasketFindManyMock.mockResolvedValue(SEVEN_BASKETS);
    bookingFindManyMock.mockResolvedValue(TWO_BOOKING_ROWS);
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('page.tsx woła prisma.booking.findMany z where: { leadId } dla TEGO leada z URL', async () => {
    await callPage('lead-1');
    expect(bookingFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ leadId: 'lead-1' }) }),
    );
  });

  // AC1 (druga połowa, dziura 2): wiersze z findMany docierają do <LeadBookingsList> zmapowane
  // na kontrakt {id, scheduledStart, basketId} — `basketId` pochodzi z `visitBasketId`
  // (Prisma), nigdy z etykiety zapisanej gdzie indziej.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('<LeadBookingsList> dostaje propsem `bookings` zmapowane na {id, scheduledStart, basketId}', async () => {
    const props = await leadBookingsListProps();
    expect(props.bookings).toEqual([
      { id: 'booking-1', scheduledStart: TWO_BOOKING_ROWS[0].scheduledStart, basketId: 'b-audit' },
      { id: 'booking-2', scheduledStart: TWO_BOOKING_ROWS[1].scheduledStart, basketId: 'b-service' },
    ]);
  });

  // <LeadBookingsList> musi dostać KOMPLET koszyków (ten sam co <CreateBookingDialog>) — żeby
  // móc znaleźć etykietę koszyka WYCOFANEGO użytego w rezerwacji historycznej (AC1, "wycena
  // historyczna... musi dalej poprawnie wyświetlać jego etykietę"; `findBasketById` ignoruje
  // `isActive`, patrz `basket-select.ts`).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('<LeadBookingsList> dostaje propsem `baskets` KOMPLET wierszy (także wycofane), ten sam zestaw co <CreateBookingDialog>', async () => {
    const props = await leadBookingsListProps();
    expect(props.baskets).toEqual(SEVEN_BASKETS);
  });

  // Przypadek pusty (WO, przypadek brzegowy 3 wzorem dziury 1): findMany() rezerwacji zwraca
  // [] (lead bez żadnej rezerwacji) — page.tsx nie ma prawa podstawić żadnej wartości
  // domyślnej/awaryjnej inaczej niż [].
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek pusty — booking.findMany() zwraca [] i props.bookings to [] (bez rekordu-atrapy)', async () => {
    bookingFindManyMock.mockResolvedValue([]);
    const props = await leadBookingsListProps();
    expect(props.bookings).toEqual([]);
  });
});
