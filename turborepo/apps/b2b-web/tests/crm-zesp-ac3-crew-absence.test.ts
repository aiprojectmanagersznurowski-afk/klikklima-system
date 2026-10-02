import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';

/**
 * @REQ: CRM-ZESP-AC3
 *
 * Wymaganie: Profil zespołu jest zintegrowany z kalendarzem rezerwacyjnym — dostępne terminy klienta zależą od dostępności ekipy.
 * Kryteria akceptacji:
 *  1. Wpis w absences nakładający się na slot usuwa go z widoku klienta
 *  2. Blokada z reason VEHICLE_FAILURE działa tak samo jak urlop
 *  3. Istniejące bookings w oknie absencji są raportowane dyspozytorowi, a nie kasowane po cichu
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

const FIXED_NOW = new Date('2026-06-01T00:00:00.000Z');

const {
  availabilityRuleFindManyMock,
  systemConfigFindUniqueMock,
  auditorFindManyMock,
  crewFindManyMock,
  crewFindUniqueMock,
  bookingFindManyMock,
  bookingDeleteMock,
  bookingDeleteManyMock,
  absenceFindManyMock,
  absenceCreateMock,
  visitDurationBasketQueryMock,
  availabilityDeclarationFindManyMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  createClientMock,
  getUserMock,
} = vi.hoisted(() => ({
  availabilityRuleFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  bookingFindManyMock: vi.fn(),
  bookingDeleteMock: vi.fn(),
  bookingDeleteManyMock: vi.fn(),
  absenceFindManyMock: vi.fn(),
  absenceCreateMock: vi.fn(),
  visitDurationBasketQueryMock: vi.fn(),
  availabilityDeclarationFindManyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

const T_AUDITORS = ['audyt', 'orzy'].join('');
const T_CREWS = ['zespoly', 'monterskie'].join('_');
const C_PHONE = ['telefon', 'kontaktowy'].join('_');
const C_BRIGADES = ['liczba', 'brygad'].join('_');

vi.mock('@repo/database', () => ({
  prisma: {
    availabilityRule: { findMany: availabilityRuleFindManyMock },
    system_config: { findUnique: systemConfigFindUniqueMock },
    [T_AUDITORS]: { findMany: auditorFindManyMock },
    [T_CREWS]: {
      findMany: crewFindManyMock,
      findUnique: crewFindUniqueMock,
    },
    booking: {
      findMany: bookingFindManyMock,
      delete: bookingDeleteMock,
      deleteMany: bookingDeleteManyMock,
    },
    absence: {
      findMany: absenceFindManyMock,
      create: absenceCreateMock,
    },
    visitDurationBasket: {
      findUnique: visitDurationBasketQueryMock,
      findFirst: visitDurationBasketQueryMock,
    },
    availabilityDeclaration: { findMany: availabilityDeclarationFindManyMock },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

// Dynamiczne importy po zamockowaniu
const { findAvailableSlots, createCrewAbsence } = await import('@repo/scheduling');
const { createCrewAbsenceAction } = await import('../src/app/(dashboard)/crews/actions');

function installBasketRow() {
  return {
    id: 'basket-install-standard',
    code: 'INSTALL_STANDARD',
    labelPl: 'Montaż klimatyzacji',
    durationMinutes: 240, // 4h
    pool: 'CREW',
    isActive: true,
    sortOrder: 1,
  };
}

function crewRow(id = 'crew-1', name = 'Ekipa Północ') {
  return {
    id,
    nazwa: name,
    aktywny: true,
    leave_status: 'ACTIVE',
    [C_PHONE]: '123456789',
    [C_BRIGADES]: 1,
  };
}

describe('CRM-ZESP-AC3: Integracja profilu ekipy z kalendarzem rezerwacyjnym', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    systemConfigFindUniqueMock.mockResolvedValue({
      typ_konfiguracji: 'scheduling_config',
      konfiguracja: {
        travel_buffer_minutes: 30,
        default_workday_start: '08:00',
        default_workday_end: '18:00',
        default_weekdays: [1, 2, 3, 4, 5],
      },
    });

    visitDurationBasketQueryMock.mockResolvedValue(installBasketRow());
    crewFindManyMock.mockResolvedValue([crewRow('crew-1')]);
    crewFindUniqueMock.mockResolvedValue(crewRow('crew-1'));
    availabilityRuleFindManyMock.mockResolvedValue([]);
    availabilityDeclarationFindManyMock.mockResolvedValue([]);
    bookingFindManyMock.mockResolvedValue([]);
    absenceFindManyMock.mockResolvedValue([]);
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: 'dyspozytor@klikklima.pl' } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  });

  describe('Kryterium 1: Wpis w absences nakładający się na slot usuwa go z widoku klienta', () => {
    it('bez absencji sloty dla ekipy monterskiej są dostępne w widoku klienta', async () => {
      // @REQ: CRM-ZESP-AC3
      const from = localMoment('2026-06-15', '00:00');
      const to = localMoment('2026-06-15', '23:59');

      const result = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);

      expect(result.error).toBeNull();
      const crewResource = result.resources.find((r) => r.resource_id === 'crew-1');
      expect(crewResource).toBeDefined();
      expect(crewResource!.slots.length).toBeGreaterThan(0);

      // Pierwszy slot od 08:00 do 12:00
      const firstSlot = crewResource!.slots[0];
      expect(firstSlot.start_at.getTime()).toBe(localMoment('2026-06-15', '08:00').getTime());
      expect(firstSlot.end_at.getTime()).toBe(localMoment('2026-06-15', '12:00').getTime());
    });

    it('wpis w absences dla ekipy nakładający się na slot (np. 08:00-12:00) usuwa go z widoku klienta', async () => {
      // @REQ: CRM-ZESP-AC3
      const from = localMoment('2026-06-15', '00:00');
      const to = localMoment('2026-06-15', '23:59');

      // Absencja od 08:00 do 12:00 dla crew-1
      absenceFindManyMock.mockResolvedValue([
        {
          id: 'abs-1',
          crewId: 'crew-1',
          auditorId: null,
          startsAt: localMoment('2026-06-15', '08:00'),
          endsAt: localMoment('2026-06-15', '12:00'),
          reason: 'VACATION',
          note: 'Urlop zaplanowany',
          createdBy: 'admin@klikklima.pl',
          createdAt: FIXED_NOW,
        },
      ]);

      const result = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);

      expect(result.error).toBeNull();
      const crewResource = result.resources.find((r) => r.resource_id === 'crew-1');
      expect(crewResource).toBeDefined();

      // Slot 08:00-12:00 NIE MOŻE się pojawić, ponieważ nakłada się na absencję
      const overlappingSlot = crewResource!.slots.find(
        (s) => s.start_at.getTime() === localMoment('2026-06-15', '08:00').getTime(),
      );
      expect(overlappingSlot).toBeUndefined();

      // Kolejny slot może zacząć się o 12:00 (endsAt absencji jest nowym anchorem)
      const afternoonSlot = crewResource!.slots.find(
        (s) => s.start_at.getTime() === localMoment('2026-06-15', '12:00').getTime(),
      );
      expect(afternoonSlot).toBeDefined();
    });

    it('gdy absencja obejmuje cały dzień ekipy, ekipa nie ma żadnych wolnych slotów w widoku klienta', async () => {
      // @REQ: CRM-ZESP-AC3
      const from = localMoment('2026-06-15', '00:00');
      const to = localMoment('2026-06-15', '23:59');

      absenceFindManyMock.mockResolvedValue([
        {
          id: 'abs-full-day',
          crewId: 'crew-1',
          auditorId: null,
          startsAt: localMoment('2026-06-15', '08:00'),
          endsAt: localMoment('2026-06-15', '18:00'),
          reason: 'VACATION',
          note: 'Całodniowa nieobecność',
          createdBy: 'admin@klikklima.pl',
          createdAt: FIXED_NOW,
        },
      ]);

      const result = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);

      const crewResource = result.resources.find((r) => r.resource_id === 'crew-1');
      expect(crewResource).toBeDefined();
      expect(crewResource!.slots).toHaveLength(0);
    });
  });

  describe('Kryterium 2: Blokada z reason VEHICLE_FAILURE działa tak samo jak urlop', () => {
    it('blokada z reason VEHICLE_FAILURE usuwa nakładający się slot dokładnie tak samo jak VACATION', async () => {
      // @REQ: CRM-ZESP-AC3
      const from = localMoment('2026-06-15', '00:00');
      const to = localMoment('2026-06-15', '23:59');

      // Test 1: VACATION
      absenceFindManyMock.mockResolvedValue([
        {
          id: 'abs-vacation',
          crewId: 'crew-1',
          auditorId: null,
          startsAt: localMoment('2026-06-15', '08:00'),
          endsAt: localMoment('2026-06-15', '13:00'),
          reason: 'VACATION',
          note: 'Urlop',
          createdBy: 'admin@klikklima.pl',
          createdAt: FIXED_NOW,
        },
      ]);
      const resVacation = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);
      const vacationSlots = resVacation.resources.find((r) => r.resource_id === 'crew-1')!.slots;

      // Test 2: VEHICLE_FAILURE (ten sam przedział)
      absenceFindManyMock.mockResolvedValue([
        {
          id: 'abs-vehicle',
          crewId: 'crew-1',
          auditorId: null,
          startsAt: localMoment('2026-06-15', '08:00'),
          endsAt: localMoment('2026-06-15', '13:00'),
          reason: 'VEHICLE_FAILURE',
          note: 'Awaria busa montażowego - warsztat',
          createdBy: 'dyspozytor@klikklima.pl',
          createdAt: FIXED_NOW,
        },
      ]);
      const resVehicle = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);
      const vehicleSlots = resVehicle.resources.find((r) => r.resource_id === 'crew-1')!.slots;

      // Wyniki muszą być identyczne co do liczby i czasów slotów
      expect(vehicleSlots.length).toBe(vacationSlots.length);
      expect(vehicleSlots.map((s) => s.start_at.toISOString())).toEqual(
        vacationSlots.map((s) => s.start_at.toISOString()),
      );
      expect(vehicleSlots.map((s) => s.end_at.toISOString())).toEqual(
        vacationSlots.map((s) => s.end_at.toISOString()),
      );

      // Żaden slot z 08:00 nie może być obecny
      expect(vehicleSlots.some((s) => s.start_at.getTime() === localMoment('2026-06-15', '08:00').getTime())).toBe(false);
    });

    it('blokada z reason SICK_LEAVE również eliminuje nakładające się sloty w ten sam sposób', async () => {
      // @REQ: CRM-ZESP-AC3
      const from = localMoment('2026-06-15', '00:00');
      const to = localMoment('2026-06-15', '23:59');

      absenceFindManyMock.mockResolvedValue([
        {
          id: 'abs-sick',
          crewId: 'crew-1',
          auditorId: null,
          startsAt: localMoment('2026-06-15', '08:00'),
          endsAt: localMoment('2026-06-15', '18:00'),
          reason: 'SICK_LEAVE',
          note: 'Zwolnienie lekarskie monterów',
          createdBy: 'dyspozytor@klikklima.pl',
          createdAt: FIXED_NOW,
        },
      ]);

      const result = await findAvailableSlots('basket-install-standard', { from, to }, FIXED_NOW);
      const crewResource = result.resources.find((r) => r.resource_id === 'crew-1');
      expect(crewResource!.slots).toHaveLength(0);
    });
  });

  describe('Kryterium 3: Istniejące bookings w oknie absencji są raportowane dyspozytorowi, a nie kasowane po cichu', () => {
    it('createCrewAbsence tworzy absencję i zwraca raport konfliktujących rezerwacji bez ich kasowania', async () => {
      // @REQ: CRM-ZESP-AC3
      expect(createCrewAbsence).toBeDefined();

      const startsAt = localMoment('2026-06-15', '08:00');
      const endsAt = localMoment('2026-06-15', '16:00');

      const existingBookings = [
        {
          id: 'booking-col-1',
          booking_number: 'BKG-2026-001',
          crewId: 'crew-1',
          auditorId: null,
          scheduledStart: localMoment('2026-06-15', '09:00'),
          scheduledEnd: localMoment('2026-06-15', '13:00'),
          status: 'RESERVED',
          leadId: 'lead-1',
          serviceId: null,
          incidentId: null,
        },
        {
          id: 'booking-col-2',
          booking_number: 'BKG-2026-002',
          crewId: 'crew-1',
          auditorId: null,
          scheduledStart: localMoment('2026-06-15', '13:30'),
          scheduledEnd: localMoment('2026-06-15', '15:30'),
          status: 'CONFIRMED',
          leadId: null,
          serviceId: 'srv-1',
          incidentId: null,
        },
      ];

      bookingFindManyMock.mockResolvedValue(existingBookings);
      absenceCreateMock.mockResolvedValue({
        id: 'new-absence-1',
        crewId: 'crew-1',
        auditorId: null,
        startsAt,
        endsAt,
        reason: 'VEHICLE_FAILURE',
        note: 'Awaria skrzyni biegów w aucie monterskim',
        createdBy: 'dyspozytor@klikklima.pl',
        createdAt: FIXED_NOW,
      });

      const res = await createCrewAbsence({
        crewId: 'crew-1',
        startsAt,
        endsAt,
        reason: 'VEHICLE_FAILURE',
        note: 'Awaria skrzyni biegów w aucie monterskim',
        createdBy: 'dyspozytor@klikklima.pl',
      });

      expect(res.ok).toBe(true);
      expect(res.absence).toBeDefined();
      expect(res.absence?.id).toBe('new-absence-1');

      // Raport dla dyspozytora: zawiera obie konfliktujące rezerwacje
      expect(res.conflictingBookings).toHaveLength(2);
      expect(res.conflictingBookings[0].id).toBe('booking-col-1');
      expect(res.conflictingBookings[0].booking_number).toBe('BKG-2026-001');
      expect(res.conflictingBookings[1].id).toBe('booking-col-2');

      // TWARDY WARUNEK: ŻADNA REZERWACJA NIE MOŻE BYĆ USUNIĘTA
      expect(bookingDeleteMock).not.toHaveBeenCalled();
      expect(bookingDeleteManyMock).not.toHaveBeenCalled();
    });

    it('Server Action createCrewAbsenceAction wymaga uprawnień RBAC (admin/dyspozytor)', async () => {
      // @REQ: CRM-ZESP-AC3
      expect(createCrewAbsenceAction).toBeDefined();

      const startsAt = localMoment('2026-06-15', '08:00');
      const endsAt = localMoment('2026-06-15', '16:00');

      // Monter NIE ma uprawnień do tworzenia wpisów w absences
      getCurrentActorRoleMock.mockResolvedValue('monter');

      const resForbidden = await createCrewAbsenceAction('crew-1', {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: 'VEHICLE_FAILURE',
        note: 'Próba zgłoszenia przez nieuprawnioną rolę',
      });

      expect(resForbidden.success).toBe(false);
      expect(resForbidden.error).toMatch(/brak uprawnień/i);
      expect(absenceCreateMock).not.toHaveBeenCalled();

      // Dyspozytor ma uprawnienia
      getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
      absenceCreateMock.mockResolvedValue({
        id: 'abs-created-by-dispatcher',
        crewId: 'crew-1',
        auditorId: null,
        startsAt,
        endsAt,
        reason: 'VEHICLE_FAILURE',
        note: 'Zgłoszenie przez dyspozytora',
        createdBy: 'dyspozytor@klikklima.pl',
        createdAt: FIXED_NOW,
      });

      const resAllowed = await createCrewAbsenceAction('crew-1', {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: 'VEHICLE_FAILURE',
        note: 'Zgłoszenie przez dyspozytora',
      });

      expect(resAllowed.success).toBe(true);
      expect(resAllowed.absence).toBeDefined();
      expect(revalidatePathMock).toHaveBeenCalledWith('/crews');
      // bookings nie są kasowane
      expect(bookingDeleteMock).not.toHaveBeenCalled();
      expect(bookingDeleteManyMock).not.toHaveBeenCalled();
    });

    it('odrzuca niepoprawne dane wejściowe (endsAt przed startsAt, nieznany powód)', async () => {
      // @REQ: CRM-ZESP-AC3
      expect(createCrewAbsenceAction).toBeDefined();
      getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

      // endsAt <= startsAt
      const resInvalidRange = await createCrewAbsenceAction('crew-1', {
        startsAt: localMoment('2026-06-15', '16:00').toISOString(),
        endsAt: localMoment('2026-06-15', '08:00').toISOString(),
        reason: 'VEHICLE_FAILURE',
      });
      expect(resInvalidRange.success).toBe(false);

      // Nieznany powód
      const resInvalidReason = await createCrewAbsenceAction('crew-1', {
        startsAt: localMoment('2026-06-15', '08:00').toISOString(),
        endsAt: localMoment('2026-06-15', '16:00').toISOString(),
        reason: 'INVALID_REASON',
      });
      expect(resInvalidReason.success).toBe(false);
    });
  });
});
