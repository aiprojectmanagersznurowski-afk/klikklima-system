import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16.
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, status TODO).
 *
 * `leads/[id]/page.tsx` jest Server Component (funkcja async bez hooków Reacta) — wywołujemy ją
 * bezpośrednio, tak jak `lead-detail-page-pool-spread.test.ts` (SEC-ASSIGNMENT-POOL-MINIMIZE),
 * i przeszukujemy zwrócone drzewo `React.createElement(...)` po elemencie zamockowanego
 * `<CreateBookingDialog>` — to jest jedyny sposób dowiedzenia kształtu propsów bez pełnego
 * renderu (alias `@/*` i jsdom nie są skonfigurowane w root `vitest.config.mts`, patrz
 * `booking-basket-select-logic.test.ts` tego samego zestawu).
 *
 * KONTRAKT Z IMPLEMENTER-UI (WO, "Kształt zmiany"): `leads/[id]/page.tsx` czyta
 * `prisma.visitDurationBasket.findMany()` (RAW — wszystkie koszyki, aktywne i wycofane,
 * dokładnie jak `settings/calendar/page.tsx` przekazuje RAW `baskets` do
 * `CalendarSettingsClient` i filtrowanie/grupowanie dzieje się w kliencie, nie w Server
 * Component) i przekazuje wynik propsem `baskets` do NOWEGO
 * `apps/b2b-web/src/app/(dashboard)/leads/[id]/create-booking-dialog.tsx`, obok `leadId` i
 * `subject: { kind: "LEAD", leadId: lead.id }`. Ten plik NIE zakłada, czy filtrowanie po puli
 * dzieje się w `page.tsx` czy w komponencie — to jest wykonalne dowodem osobnym
 * (`booking-basket-select-logic.test.ts`, `selectableBaskets`), niezależnie od tego, gdzie
 * zostanie wywołane. R-1 (WO, "Ryzyka i nieznane") jest świadomie POZA zakresem tego pliku:
 * ten test dowodzi wyłącznie, że KOMPLET koszyków z bazy dociera bez utraty do propsów
 * `<CreateBookingDialog>` — nie dowodzi, JAK `page.tsx`/komponent wybiera pulę AUDITOR dla
 * leada. Rozstrzygnięcie R-1 nie jest wymagane, żeby ten test miał sens.
 *
 * Mockowane zależności — dokładnie ten sam zestaw co `lead-detail-page-pool-spread.test.ts`
 * (ten sam plik page.tsx), plus nowy mock `./create-booking-dialog`.
 */

const {
  leadFindUniqueMock,
  getAuditorsMock,
  signStoragePathsMock,
  AssignAuditorMock,
  CreateBookingDialogMock,
  visitDurationBasketFindManyMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  getAuditorsMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
  AssignAuditorMock: vi.fn(() => null),
  CreateBookingDialogMock: vi.fn(() => null),
  visitDurationBasketFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: leadFindUniqueMock },
    visitDurationBasket: { findMany: visitDurationBasketFindManyMock },
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
// Punkt integracji wskazany przez WO ("Kształt zmiany") — moduł jeszcze nie istnieje, mock
// całego modułu przechwytuje `.type` w drzewie elementów, dokładnie jak `AssignAuditorMock`.
vi.mock('../src/app/(dashboard)/leads/[id]/create-booking-dialog', () => ({
  CreateBookingDialog: CreateBookingDialogMock,
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
  { id: 'b-incident', code: 'INCIDENT', labelPl: 'Usterka (naprawa)', pool: 'CREW', durationMinutes: 120, isActive: true, sortOrder: 30 },
  { id: 'b-install-small', code: 'INSTALL_SMALL', labelPl: 'Montaż mały', pool: 'CREW', durationMinutes: 240, isActive: true, sortOrder: 40 },
  { id: 'b-install-standard', code: 'INSTALL_STANDARD', labelPl: 'Montaż standardowy', pool: 'CREW', durationMinutes: 480, isActive: true, sortOrder: 50 },
  { id: 'b-phase-1', code: 'INSTALL_PHASE_1', labelPl: 'Montaż — faza 1', pool: 'CREW', durationMinutes: 480, isActive: true, sortOrder: 60 },
  { id: 'b-withdrawn', code: 'INSTALL_PHASE_2', labelPl: 'Montaż — faza 2', pool: 'CREW', durationMinutes: 240, isActive: false, sortOrder: 70 },
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

async function createBookingDialogProps(id = 'lead-1'): Promise<Record<string, unknown>> {
  const result = await callPage(id);
  const element = findElementByType(result, CreateBookingDialogMock);
  if (!element) {
    throw new Error(
      '<CreateBookingDialog> nie znaleziony w drzewie zwróconym przez LeadDetailsPage — komponent nie jest jeszcze zintegrowany (WO, "Kształt zmiany").',
    );
  }
  return element.props;
}

describe('leads/[id]/page.tsx — integracja <CreateBookingDialog> (FLD-QUOTE-BASKET-SELECT)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    getAuditorsMock.mockReset();
    signStoragePathsMock.mockReset();
    AssignAuditorMock.mockClear();
    CreateBookingDialogMock.mockClear();
    visitDurationBasketFindManyMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    createClientMock.mockReset();

    leadFindUniqueMock.mockResolvedValue(LEAD_FIXTURE);
    getAuditorsMock.mockResolvedValue([]);
    signStoragePathsMock.mockResolvedValue({});
    visitDurationBasketFindManyMock.mockResolvedValue(SEVEN_BASKETS);
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('AC2/AC7 (dane wejściowe) — <CreateBookingDialog> dostaje propsem `baskets` KOMPLET wierszy z findMany, także wycofane (filtrowanie jest zadaniem warstwy niżej, nie page.tsx)', async () => {
    const props = await createBookingDialogProps();
    expect(props.baskets).toEqual(SEVEN_BASKETS);
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('<CreateBookingDialog> dostaje `leadId` równe id leada z URL, nie z formularza', async () => {
    const props = await createBookingDialogProps('lead-1');
    expect(props.leadId).toBe('lead-1');
  });

  // AC1 (część "subject"): rezerwacja tworzona z karty leada musi nosić `subject.kind: "LEAD"`
  // wskazujący TEN konkretny lead, żeby `createBooking` mógł rozwiązać `subject` (WO, kontrakt
  // istniejącego `createBookingAction`, `bookingSubjectSchema`).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('<CreateBookingDialog> dostaje `subject` typu {kind: "LEAD", leadId}', async () => {
    const props = await createBookingDialogProps('lead-1');
    expect(props.subject).toEqual({ kind: 'LEAD', leadId: 'lead-1' });
  });

  // Przypadek pusty (WO, przypadek brzegowy 3): findMany() zwraca tablicę pustą (baza bez
  // koszyków w ogóle) — page.tsx nie ma prawa podstawić żadnej wartości domyślnej/awaryjnej.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('przypadek pusty — findMany() zwraca [] i props.baskets to [] (bez wartości domyślnej podstawionej przez page.tsx)', async () => {
    visitDurationBasketFindManyMock.mockResolvedValue([]);
    const props = await createBookingDialogProps();
    expect(props.baskets).toEqual([]);
  });

  // Uprawnienia (WO, przypadek brzegowy 8 / AC9): dla roli bez `bookings.create` page.tsx
  // przekazuje `actorRole`, tak jak robi dla <AssignAuditor> (leads.update) — bramka WIĄŻĄCA
  // jest w Server Action (create-booking.test.ts, AC-A12), ta asercja dowodzi wyłącznie, że
  // komponent MA z czego samodzielnie wyliczyć widoczność przycisku (WO, AC9, "nie dostaje
  // ekranu ani przycisku"). Ograniczone do `admin`/`dyspozytor` (leads.read === 'yes', gałąź
  // bez `own`) — dokładnie ten sam wybór co `lead-detail-page-pool-spread.test.ts`: role
  // `audytor` (gałąź 'own', dodatkowe `createClient().auth.getUser()`) i `monter` (leads.read
  // === 'no' -> notFound()) testują inną warstwę (`getLeadDetail`), już pokrytą przez
  // `leads-detail-scope.test.ts` — tu wprowadzałyby zły RED z niewłaściwego powodu.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it.each(['admin', 'dyspozytor'])('<CreateBookingDialog> dostaje `actorRole` (rola %s) do samodzielnej bramki widoczności przycisku', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const props = await createBookingDialogProps();
    expect(props.actorRole).toBe(role);
  });
});
