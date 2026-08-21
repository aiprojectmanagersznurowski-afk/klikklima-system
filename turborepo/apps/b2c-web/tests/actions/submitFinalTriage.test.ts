import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/B2C-LEAD-GEO-PERSIST.md — sekcja "Znalezisko, które zmienia treść
 * zadania" + R2.
 *
 * `submitFinalTriage` (apps/b2c-web/app/actions/leads.ts:33-99) wstawia do `adresy`
 * kolumny `lat`/`lng`. Człowiek potwierdził (2026-08-21, wklejone w tym zadaniu): tabela
 * `adresy` w Supabase NIE MA kolumn o tych nazwach — jedyne poprawne nazwy to
 * `latitude`/`longitude` (schema.prisma:63-64, migracja 75da8c5). `submitFinalTriage`
 * nie ma dziś żadnego wywołania z UI (`grep` po `apps/b2c-web`: zero trafień poza
 * definicją) — to martwy kod, ale kod, który wywaliłby się przy pierwszym użyciu.
 *
 * Ten test celowo NIE rozstrzyga, co implementer zrobi z `leads.ts` (WO: "Wybór należy
 * do implementera") — przechodzi w OBU poprawnych wariantach:
 *   (a) `submitFinalTriage` przestaje być eksportowane (usunięte jako martwy kod), lub
 *   (b) zostaje, ale insert na `adresy` używa `latitude`/`longitude`, nie `lat`/`lng`.
 * Pada dziś, bo dzisiejszy kod to wariant (c): eksportowane I używa złych nazw kolumn.
 *
 * Mockowanie: `leads.ts` NIE korzysta z `@/lib/supabaseClient` — buduje własnego klienta
 * przez `createClient` z `@supabase/supabase-js` wewnątrz `getAdminClient()`, wołanego od
 * nowa przy każdym imporcie funkcji. Mockujemy więc cały pakiet `@supabase/supabase-js`;
 * zakres mocka jest per plik testowy (Vitest izoluje graf modułów między plikami), więc
 * nie wpływa na `saveLead.test.ts`, który mockuje inny moduł (`@/lib/supabaseClient`).
 */

const {
  fromSpy,
  leadyInsertSpy,
  klienciInsertSpy,
  adresyInsertSpy,
  leadyUpdateSpy,
} = vi.hoisted(() => {
  const leadyInsertSpy = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'lead-test-1' }, error: null })),
    })),
  }));

  const klienciInsertSpy = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'klient-test-1' }, error: null })),
    })),
  }));

  // Typ argumentu jawny: bez niego vi.fn() wnioskuje pustą krotkę parametrów, a odczyt
  // mock.calls[0][0] w asercjach nie przechodzi typecheku (TS2493 na pustej krotce).
  const adresyInsertSpy = vi.fn(async (_rows?: unknown) => ({ error: null }));

  const leadyUpdateSpy = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));

  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'leady':
        return { insert: leadyInsertSpy, update: leadyUpdateSpy };
      case 'klienci':
        return { insert: klienciInsertSpy };
      case 'adresy':
        return { insert: adresyInsertSpy };
      default:
        throw new Error(
          `submitFinalTriage.test: nieoczekiwana tabela "${table}" — dopisz obsługę w mocku zanim rozszerzysz test.`,
        );
    }
  });

  return { fromSpy, leadyInsertSpy, klienciInsertSpy, adresyInsertSpy, leadyUpdateSpy };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromSpy }),
}));

const leadsModule = await import('../../app/actions/leads');

describe('submitFinalTriage (leads.ts) — kolumny adresy zamrożone jako defekt (WO B2C-LEAD-GEO-PERSIST)', () => {
  beforeEach(() => {
    fromSpy.mockClear();
    leadyInsertSpy.mockClear();
    klienciInsertSpy.mockClear();
    adresyInsertSpy.mockClear();
    leadyUpdateSpy.mockClear();
  });

  // @REQ: FLD-GEO-COORDS
  it('albo funkcja jest usunięta, albo insert na adresy używa latitude/longitude — nigdy lat/lng', async () => {
    if (typeof leadsModule.submitFinalTriage !== 'function') {
      // Wariant (a): martwy kod usunięty. Poprawny stan — nic więcej do sprawdzenia.
      expect(leadsModule.submitFinalTriage).toBeUndefined();
      return;
    }

    // Wariant (b) — funkcja zostaje, ale MUSI pisać do realnie istniejących kolumn.
    await leadsModule.submitFinalTriage(
      { sciezka_koncowa: 'Path_Expert' },
      { name: 'Jan Kowalski', phone: '500600700', email: 'jan.kowalski@example.com' },
      { fullAddress: 'Marszałkowska 1, Warszawa', lat: 52.2296756, lng: 21.0122287 },
    );

    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    const insertedRows = adresyInsertSpy.mock.calls[0]?.[0];
    const insertedRow = (Array.isArray(insertedRows) ? insertedRows[0] : insertedRows) as Record<
      string,
      unknown
    >;

    // Kolumn o tych nazwach nie ma w żadnym schemacie w repozytorium (WO, R2) — insert
    // pod nimi odpowiada dziś `addressError` na żywej bazie, nie sukcesowi.
    expect(insertedRow).not.toHaveProperty('lat');
    expect(insertedRow).not.toHaveProperty('lng');

    // A skoro nie `lat`/`lng`, to muszą być `latitude`/`longitude` z tymi samymi wartościami
    // (nie samo zniknięcie pól — realne zachowanie utraciłoby współrzędne po cichu).
    expect(insertedRow.latitude).toBe(52.2296756);
    expect(insertedRow.longitude).toBe(21.0122287);
  });
});
