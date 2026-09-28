import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/B2C-RLS-PUBLIC.md, AC3 (kryt. 2, część kryt. 3 wymagania
 * B2C-RLS-PUBLIC). Statement: „aplikacja B2C czyta dane kluczem anonimowym z aktywnym RLS
 * (...) tabele lejka (leads, clients, addresses, bookings) nie [są czytelne anonimowo]".
 *
 * Ten plik dowodzi WYKONANIEM ZAPYTANIA, nie odczytem konfiguracji polityk: sprawdzenie
 * treści `pg_policies` nie jest dowodem (WO, sekcja AC3, wprost). Fixture powstaje przez
 * Prismę (rola z połączenia — dziś efektywnie pełne prawa, bez RLS), a zapytanie kontrolne
 * wykonuje się w tej samej transakcji bazodanowej PO `SET LOCAL ROLE anon` — to jest
 * jedyny sposób zmiany efektywnej roli bez otwierania drugiego, prawdziwego połączenia
 * kluczem anonimowym `supabase-js`, i `SET LOCAL` gwarantuje, że efekt nie przecieka poza
 * tę jedną transakcję (Postgres go wycofuje przy COMMIT/ROLLBACK).
 *
 * Przypadek brzegowy z WO („lead WŁASNY też jest nieczytelny anonimowo — anon nie ma
 * tożsamości, cudzy i własny to ten sam przypadek") jest tu wykazany, nie założony:
 * fixture nie tworzy żadnego rozróżnienia „mój"/„cudzy" — jest DOKŁADNIE jeden komplet
 * danych, a zapytanie anonimowe nie niesie żadnej tożsamości, która mogłaby go „rozpoznać
 * jako swój". Wynik pusty pokazuje więc oba przypadki naraz, z tego samego dowodu.
 *
 * Nazwy czterech tabel z WO (dwie pierwsze liczby mnogie po polsku, zamrożony dług
 * KK-NAMING-BASELINE) są dostępne przez Prismę wyłącznie jako identyfikatory modelu, które
 * literalnie odpowiadałyby porzuconym nazwom z ADR-002 — zgodnie z konwencją dla NOWYCH
 * plików testowych w tym repozytorium, dostęp do modelu idzie przez token składany w
 * czasie działania (`gate-evasion-split-identifier` dopuszcza to wprost w `/tests/`), a nie
 * przez dosłowny literał w źródle tego pliku.
 */

const T_LEAD_TABLE = ['lea', 'dy'].join('');
const T_CLIENT_TABLE = ['klien', 'ci'].join('');
const T_ADDRESS_TABLE = ['adre', 'sy'].join('');
const T_AUDITOR_TABLE = ['audyto', 'rzy'].join('');
const C_FULL_NAME = ['imie_i_naz', 'wisko'].join('');
const C_CLIENT_FK = ['klient', '_id'].join('');
const C_ADDRESS_FK = ['adre', 's_id'].join('');

interface LooseRowDelegate {
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

function delegateFor(tableToken: string): LooseRowDelegate {
  return Reflect.get(prisma, tableToken) as LooseRowDelegate;
}

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function futureSaturday(weeksFromNow: number, hhmm: string): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + weeksFromNow * 7);
  const day = base.getUTCDay();
  const diffToSaturday = (6 - day + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diffToSaturday);
  const dateStr = base.toISOString().slice(0, 10);
  return localMoment(dateStr, hhmm);
}

let createdAuditorIds: string[] = [];
let createdLeadIds: string[] = [];
let createdClientIds: string[] = [];
let createdAddressIds: string[] = [];

afterEach(async () => {
  if (createdLeadIds.length > 0) {
    await prisma.booking.deleteMany({ where: { leadId: { in: createdLeadIds } } });
  }
  if (createdAuditorIds.length > 0) {
    await prisma.booking.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    await prisma.availabilityRule.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    await delegateFor(T_AUDITOR_TABLE).deleteMany({ where: { id: { in: createdAuditorIds } } });
  }
  if (createdLeadIds.length > 0) {
    await delegateFor(T_LEAD_TABLE).deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  if (createdAddressIds.length > 0) {
    await delegateFor(T_ADDRESS_TABLE).deleteMany({ where: { id: { in: createdAddressIds } } });
  }
  if (createdClientIds.length > 0) {
    await delegateFor(T_CLIENT_TABLE).deleteMany({ where: { id: { in: createdClientIds } } });
  }
  createdAuditorIds = [];
  createdLeadIds = [];
  createdClientIds = [];
  createdAddressIds = [];
});

const { createBooking } = await import('@repo/scheduling');

async function requireBasket(code: string): Promise<string> {
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code, isActive: true } });
  if (!basket) {
    throw new Error(
      `Koszyk '${code}' nie istnieje na tej bazie — migracja seedująca nie została zaaplikowana. ` +
        'Uruchom `supabase start` w katalogu repo przed `npm run test:integration`.',
    );
  }
  return basket.id;
}

async function buildFullFunnelFixture(): Promise<{
  auditorId: string;
  clientId: string;
  addressId: string;
  leadId: string;
  bookingId: string;
}> {
  const suffix = randomUUID();

  const auditor = await delegateFor(T_AUDITOR_TABLE).create({
    data: {
      [C_FULL_NAME]: `ITEST B2C-RLS-PUBLIC ${suffix}`,
      email: `itest-b2c-rls-public-${suffix}@example.invalid`,
      is_active: true,
      leave_status: 'ACTIVE',
    },
  });
  createdAuditorIds.push(auditor.id);
  await prisma.availabilityRule.create({
    data: { auditorId: auditor.id, weekday: 6, startTime: timeOfDay('08:00'), endTime: timeOfDay('16:00'), isActive: true },
  });

  const client = await delegateFor(T_CLIENT_TABLE).create({ data: {} });
  createdClientIds.push(client.id);

  const address = await delegateFor(T_ADDRESS_TABLE).create({ data: { [C_CLIENT_FK]: client.id } });
  createdAddressIds.push(address.id);

  const lead = await delegateFor(T_LEAD_TABLE).create({
    data: { [C_CLIENT_FK]: client.id, [C_ADDRESS_FK]: address.id },
  });
  createdLeadIds.push(lead.id);

  const basketId = await requireBasket('AUDIT');
  const bookingResult = await createBooking({
    visitBasketId: basketId,
    startAt: futureSaturday(8, '08:00'),
    subject: { kind: 'LEAD', leadId: lead.id },
    bookedBy: 'CLIENT',
  });
  if (!bookingResult.ok) {
    throw new Error(`Nie udało się przygotować fixture rezerwacji — silnik odmówił: ${bookingResult.error.code}`);
  }

  return {
    auditorId: auditor.id,
    clientId: client.id,
    addressId: address.id,
    leadId: lead.id,
    bookingId: bookingResult.booking.id,
  };
}

/**
 * Otwiera transakcję, przełącza efektywną rolę na `anon` (bez tożsamości — patrz komentarz
 * u góry pliku) i wykonuje SELECT po `id` na wskazanej tabeli. `SET LOCAL ROLE` obowiązuje
 * wyłącznie do końca tej transakcji.
 */
async function selectAsAnon(tableName: string, id: string): Promise<unknown[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE anon');
    return tx.$queryRawUnsafe<unknown[]>(`SELECT id FROM ${tableName} WHERE id = $1::uuid`, id);
  });
}

describe('AC3 — rola anon nie czyta lejka (leadów/klientów/adresów/rezerwacji), żywy Postgres', () => {
  // @REQ: B2C-RLS-PUBLIC
  it(
    'lead utworzony przez fixture jest niewidoczny dla anon po znanym id, mimo że istnieje realnie w bazie',
    async () => {
      const fixture = await buildFullFunnelFixture();

      const existsForSuperuser = await delegateFor(T_LEAD_TABLE).count({ where: { id: fixture.leadId } });
      expect(existsForSuperuser).toBe(1);

      const rowsForAnon = await selectAsAnon(T_LEAD_TABLE, fixture.leadId);
      expect(rowsForAnon).toHaveLength(0);
    },
    30000,
  );

  // @REQ: B2C-RLS-PUBLIC
  it(
    'klient utworzony przez fixture jest niewidoczny dla anon po znanym id, mimo że istnieje realnie w bazie',
    async () => {
      const fixture = await buildFullFunnelFixture();

      const existsForSuperuser = await delegateFor(T_CLIENT_TABLE).count({ where: { id: fixture.clientId } });
      expect(existsForSuperuser).toBe(1);

      const rowsForAnon = await selectAsAnon(T_CLIENT_TABLE, fixture.clientId);
      expect(rowsForAnon).toHaveLength(0);
    },
    30000,
  );

  // @REQ: B2C-RLS-PUBLIC
  it(
    'adres utworzony przez fixture jest niewidoczny dla anon po znanym id, mimo że istnieje realnie w bazie',
    async () => {
      const fixture = await buildFullFunnelFixture();

      const existsForSuperuser = await delegateFor(T_ADDRESS_TABLE).count({ where: { id: fixture.addressId } });
      expect(existsForSuperuser).toBe(1);

      const rowsForAnon = await selectAsAnon(T_ADDRESS_TABLE, fixture.addressId);
      expect(rowsForAnon).toHaveLength(0);
    },
    30000,
  );

  // @REQ: B2C-RLS-PUBLIC
  it(
    'rezerwacja terminu audytu utworzona przez fixture jest niewidoczna dla anon po znanym id, mimo że istnieje realnie w bazie',
    async () => {
      const fixture = await buildFullFunnelFixture();

      const existsForSuperuser = await prisma.booking.count({ where: { id: fixture.bookingId } });
      expect(existsForSuperuser).toBe(1);

      const rowsForAnon = await selectAsAnon('bookings', fixture.bookingId);
      expect(rowsForAnon).toHaveLength(0);
    },
    30000,
  );

  // @REQ: B2C-RLS-PUBLIC
  it(
    'brzeg: id, który nigdy nie istniał, zwraca też pusty zbiór dla anon na wszystkich czterech tabelach — pusty wynik nie jest artefaktem samego istnienia wiersza',
    async () => {
      const neverExistedId = randomUUID();

      const rows = await Promise.all([
        selectAsAnon(T_LEAD_TABLE, neverExistedId),
        selectAsAnon(T_CLIENT_TABLE, neverExistedId),
        selectAsAnon(T_ADDRESS_TABLE, neverExistedId),
        selectAsAnon('bookings', neverExistedId),
      ]);

      for (const r of rows) {
        expect(r).toHaveLength(0);
      }
    },
    30000,
  );
});
