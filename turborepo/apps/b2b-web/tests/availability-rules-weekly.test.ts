import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/FLD-AVAIL-WEEKLY-RULES.md — blok A (zapis własnych reguł
 * dostępności cyklicznej). Wymaganie (contracts/requirements.contract.mjs,
 * R('FLD-AVAIL-WEEKLY-RULES', ...)): "Pracownik terenowy definiuje własną dostępność
 * cykliczną — godziny od–do dla każdego dnia tygodnia". Ten plik testuje WYŁĄCZNIE
 * kryteria AC-A1..AC-A12 (zapis). Blok B (odczyt efektywnej dostępności) i blok C (UI)
 * są poza zakresem tej tury — mają dostać osobne pliki w kolejnych iteracjach GREEN
 * (limit 3 wg CLAUDE.md).
 *
 * Fundament bazodanowy (tabela `availability_rules`, migracja
 * `20260910100000_fld_calendar_foundation.sql`) i model Prisma `AvailabilityRule` już
 * ISTNIEJĄ — to NIE jest przedmiotem tego testu (kontrakt-steward, poza zakresem WO).
 * DZIŚ NIC w `apps/` nie dotyka `availabilityRule` (zweryfikowane:
 * `grep -rn "availabilityRule" apps/` = brak wyników poza tym plikiem).
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM (nazwy i kształt wybrane przeze mnie,
 * test-author, zgodnie z poleceniem WO — jeśli implementer wybierze inny kształt, to
 * TEST-DEFECT do zgłoszenia w tej turze, nie powód do cichej zmiany testu; wzorzec tej
 * klauzuli: availability-self-declaration.test.ts):
 *
 *   `setAvailabilityRuleAction(id: string, values: { weekday: number; start_time: string;
 *      end_time: string; is_active?: boolean }): Promise<{ success: boolean; error?: string;
 *      rule?: { weekday: number; start_time: string; end_time: string; is_active: boolean } }>`
 *   — w `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` (obok istniejącego
 *   `setSelfAvailabilityAction`, ten sam wzorzec `can()` + `getCurrentActorRole()` +
 *   identyfikacja właściciela po e-mailu przez `findMany({ where: { email }, take: 2 })`)
 *   oraz symetrycznie w `apps/b2b-web/src/app/(dashboard)/crews/actions.ts`.
 *
 *   Zasób RBAC to `availability_rules` (contracts/rbac.contract.mjs, linia 120):
 *   `create`/`update` = ['admin', 'audytor:own', 'monter:own'] dla JEDNEGO zasobu obsługującego
 *   DWIE tabele — wiązanie roli z encją (audytor→audytorzy, monter→zespoly_monterskie) MUSI
 *   więc żyć w kodzie akcji, dokładnie jak przy `availability_declarations`.
 *
 *   Zapis fizyczny NIE może iść przez `prisma.availabilityRule.upsert` (WO, sekcja "Zmiana
 *   kontraktu": `resource_id` jest kolumną GENEROWANĄ, niewidoczną dla modelu Prisma, więc
 *   `upsert` nie ma celu unikalności do rozstrzygnięcia konfliktu). WO wprost preferuje
 *   wariant 1 (raw SQL z `ON CONFLICT (resource_id, weekday) DO UPDATE`, jedno zapytanie).
 *   Zakładam więc istnienie małej, czystej funkcji pomocniczej (bez walidacji Zod — walidacja
 *   jest odpowiedzialnością akcji, nie tej funkcji), którą obie akcje wywołują PO walidacji:
 *
 *   `writeAvailabilityRuleRaw(params: { auditorId: string | null; crewId: string | null;
 *      weekday: number; startTime: string; endTime: string; isActive: boolean }):
 *      Promise<{ weekday: number; start_time: string; end_time: string; is_active: boolean }>`
 *   w `apps/b2b-web/src/lib/schedule/availability-rule.ts`, zbudowana wokół
 *   `prisma.$queryRaw` (tagged template — RETURNING, nie `$executeRaw`, bo trzeba odczytać
 *   zapisany wiersz dla AC-A1) w kolejności interpolacji ZGODNEJ Z DOSŁOWNYM SQL-em z WO:
 *
 *     INSERT INTO public.availability_rules (auditor_id, crew_id, weekday, start_time, end_time, is_active)
 *     VALUES (${auditorId}, ${crewId}, ${weekday}, ${startTime}, ${endTime}, ${isActive})
 *     ON CONFLICT (resource_id, weekday) DO UPDATE SET ...
 *     RETURNING weekday, start_time, end_time, is_active
 *
 *   tzn. `prisma.$queryRaw` mockowany jako tagged-template wywołuje się jako
 *   `(stringsArray, auditorId, crewId, weekday, startTime, endTime, isActive)` — testy
 *   poniżej odczytują `mock.calls[i][1..6]` w TEJ kolejności. To jest jedyne miejsce w tym
 *   pliku, gdzie test zakłada konkretną kolejność parametrów SQL, i robi to dlatego, że WO
 *   dyktuje tę kolejność dosłownie w tekście (nie jest to wymysł test-authora).
 *
 * Ryzyko #1 z WO (brak żywego Postgresa w vitest) jest tu respektowane wprost: AC-A7 (drugi
 * zapis aktualizuje, nie duplikuje) i AC-A6 (baza odrzuca zły przedział czasu przez CHECK) są
 * dowodzone NA ATRAPIE (mock Prisma z ręcznie zaimplementowaną semantyką `ON CONFLICT`
 * i symulowanym kodem błędu Postgresa), zgodnie z tym, co WO wprost dopuszcza w sekcji
 * "Ryzyka i nieznane", punkt 1. To NIE dowodzi realnej izolacji transakcyjnej ani realnego
 * ograniczenia CHECK w Postgresie — to wymaga testu integracyjnego na żywej instancji.
 *
 * Zakres warstw: wyłącznie Server Action + mała funkcja pomocnicza (Prisma omija RLS —
 * CLAUDE.md, pułapka 1). Warstwa RLS wymaga `rls-security-auditor` i/lub żywej instancji.
 */

const {
  auditorFindManyMock,
  auditorFindUniqueMock,
  auditorUpdateMock,
  crewFindManyMock,
  crewFindUniqueMock,
  crewUpdateMock,
  availabilityRuleCreateMock,
  availabilityRuleUpdateMock,
  availabilityRuleUpsertMock,
  availabilityRuleDeleteMock,
  availabilityRuleDeleteManyMock,
  availabilityDeclarationUpsertMock,
  queryRawMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  availabilityRuleCreateMock: vi.fn(),
  availabilityRuleUpdateMock: vi.fn(),
  availabilityRuleUpsertMock: vi.fn(),
  availabilityRuleDeleteMock: vi.fn(),
  availabilityRuleDeleteManyMock: vi.fn(),
  availabilityDeclarationUpsertMock: vi.fn(),
  queryRawMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findMany: auditorFindManyMock,
      findUnique: auditorFindUniqueMock,
      update: auditorUpdateMock,
    },
    zespoly_monterskie: {
      findMany: crewFindManyMock,
      findUnique: crewFindUniqueMock,
      update: crewUpdateMock,
    },
    availabilityRule: {
      create: availabilityRuleCreateMock,
      update: availabilityRuleUpdateMock,
      upsert: availabilityRuleUpsertMock,
      delete: availabilityRuleDeleteMock,
      deleteMany: availabilityRuleDeleteManyMock,
    },
    availabilityDeclaration: {
      upsert: availabilityDeclarationUpsertMock,
    },
    $queryRaw: queryRawMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { setAvailabilityRuleAction: setAuditorRule } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { setAvailabilityRuleAction: setCrewRule } = await import(
  '../src/app/(dashboard)/crews/actions'
);
const { writeAvailabilityRuleRaw } = await import('../src/lib/schedule/availability-rule');

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';

function returningRow(weekday: number, start: string, end: string, active = true) {
  return [{ weekday, start_time: start, end_time: end, is_active: active }];
}

beforeEach(() => {
  auditorFindManyMock.mockReset();
  auditorFindUniqueMock.mockReset();
  auditorUpdateMock.mockReset();
  crewFindManyMock.mockReset();
  crewFindUniqueMock.mockReset();
  crewUpdateMock.mockReset();
  availabilityRuleCreateMock.mockReset();
  availabilityRuleUpdateMock.mockReset();
  availabilityRuleUpsertMock.mockReset();
  availabilityRuleDeleteMock.mockReset();
  availabilityRuleDeleteManyMock.mockReset();
  availabilityDeclarationUpsertMock.mockReset();
  queryRawMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });

  auditorFindManyMock.mockResolvedValue([
    { id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' },
  ]);
  crewFindManyMock.mockResolvedValue([
    { id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' },
  ]);
  queryRawMock.mockResolvedValue(returningRow(1, '08:00:00', '16:00:00', true));
});

describe('setAvailabilityRuleAction (auditors/actions.ts) — zapis własnych reguł tygodniowych (FLD-AVAIL-WEEKLY-RULES)', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A1 — audytor zapisuje regułę na własny identyfikator, odczyt zwraca dokładnie zapisane pola', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    queryRawMock.mockResolvedValueOnce(returningRow(2, '09:00:00', '17:00:00', true));

    const result = await setAuditorRule('aud-1', {
      weekday: 2,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true,
    });

    expect(result.success).toBe(true);
    expect(result.rule).toEqual({
      weekday: 2,
      start_time: '09:00:00',
      end_time: '17:00:00',
      is_active: true,
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A2 — zapis reguły na CUDZY identyfikator jest odrzucony po stronie serwera, bez ani jednego zapytania zapisującego', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    // Sesja rozwiązuje się do WŁASNEGO 'aud-1' po e-mailu, ale wywołanie podaje cudze id.
    const result = await setAuditorRule('aud-other-guy', {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
    });

    expect(result.success).toBe(false);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A3 — rola monter nie może zapisać reguły audytora (obcy zasób, nie jej encja)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

    const result = await setAuditorRule('aud-1', {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
    });

    expect(result.success).toBe(false);
    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A3 (lustro) — rola audytor nie może zapisać reguły ekipy (obcy zasób, nie jej encja)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });

    const result = await setCrewRule('crew-1', {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
    });

    expect(result.success).toBe(false);
    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A4 — dyspozytor dostaje odmowę zapisu mimo prawa read (update ma tylko admin i warianty :own)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

    const result = await setAuditorRule('aud-1', {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
    });

    expect(result.success).toBe(false);
    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it.each([[0], [8], [-1], [1.5], ['pon']])(
    'AC-A5 — weekday=%p spoza 1-7 jest odrzucony przez Zod przed dotknięciem bazy, komunikat po polsku',
    async (badWeekday) => {
      getCurrentActorRoleMock.mockResolvedValue('audytor');
      getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

      const result = await setAuditorRule('aud-1', {
        weekday: badWeekday as unknown as number,
        start_time: '08:00',
        end_time: '16:00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻa-zA-Z ]/);
      expect(auditorFindManyMock).not.toHaveBeenCalled();
      expect(queryRawMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it.each([
    ['10:00', '10:00'],
    ['10:00', '09:00'],
  ])(
    'AC-A6 (aplikacja) — end_time=%s <= start_time=%s jest odrzucone przez Zod przed zapytaniem',
    async (start, end) => {
      getCurrentActorRoleMock.mockResolvedValue('audytor');
      getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

      const result = await setAuditorRule('aud-1', {
        weekday: 1,
        start_time: start,
        end_time: end,
      });

      expect(result.success).toBe(false);
      expect(auditorFindManyMock).not.toHaveBeenCalled();
      expect(queryRawMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A6 (baza, atrapa) — pominięcie walidacji aplikacyjnej i wywołanie warstwy raw wprost nadal kończy się odrzuceniem przez CHECK availability_rules_time_order_check', async () => {
    const dbError = Object.assign(
      new Error('new row for relation "availability_rules" violates check constraint "availability_rules_time_order_check"'),
      { code: '23514', constraint: 'availability_rules_time_order_check' },
    );
    queryRawMock.mockRejectedValueOnce(dbError);

    // writeAvailabilityRuleRaw NIE robi walidacji (to zadanie Zod w akcji) — wołane tu
    // bezpośrednio, z pominięciem warstwy walidacji, żeby udowodnić, że to BAZA, a nie
    // aplikacja, jest ostateczną gwarancją porządku czasu (WO: "walidacja aplikacyjna to
    // wygoda, nie gwarancja").
    await expect(
      writeAvailabilityRuleRaw({
        auditorId: 'aud-1',
        crewId: null,
        weekday: 1,
        startTime: '10:00',
        endTime: '10:00',
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A7 — drugi zapis dla tej samej pary (pracownik, weekday) aktualizuje istniejący wiersz, nie tworzy drugiego', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

    // Atrapa symulująca semantykę `ON CONFLICT (resource_id, weekday) DO UPDATE`: jeden
    // wiersz na klucz (auditorId ?? crewId, weekday), drugi zapis nadpisuje pierwszy.
    const shadowTable = new Map<string, { weekday: number; start_time: string; end_time: string; is_active: boolean }>();
    queryRawMock.mockImplementation(
      async (
        _strings: TemplateStringsArray,
        auditorId: string | null,
        crewId: string | null,
        weekday: number,
        startTime: string,
        endTime: string,
        isActive: boolean,
      ) => {
        const key = `${auditorId ?? crewId}|${weekday}`;
        const row = { weekday, start_time: startTime, end_time: endTime, is_active: isActive };
        shadowTable.set(key, row);
        return [row];
      },
    );

    await setAuditorRule('aud-1', { weekday: 3, start_time: '08:00', end_time: '12:00' });
    await setAuditorRule('aud-1', { weekday: 3, start_time: '13:00', end_time: '18:00' });

    expect(queryRawMock).toHaveBeenCalledTimes(2);
    // Dowód, że zapis idzie WYŁĄCZNIE przez pojedynczą atomową ścieżkę raw, a nie przez
    // JS-owe "sprawdź, potem stwórz/zaktualizuj" — wariant wprost odrzucony przez WO.
    expect(availabilityRuleCreateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpdateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpsertMock).not.toHaveBeenCalled();

    const sql = (queryRawMock.mock.calls[0][0] as TemplateStringsArray).join('');
    expect(sql).toMatch(/ON CONFLICT/i);
    expect(sql).toMatch(/resource_id/);
    expect(sql).toMatch(/weekday/);
    expect(sql).toMatch(/DO UPDATE/i);

    expect(shadowTable.size).toBe(1);
    expect(shadowTable.get('aud-1|3')).toEqual({
      weekday: 3,
      start_time: '13:00',
      end_time: '18:00',
      is_active: true,
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A8 — zapis tej samej wartości dwa razy zwraca sukces oba razy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    queryRawMock.mockResolvedValue(returningRow(4, '08:00:00', '16:00:00', true));

    const first = await setAuditorRule('aud-1', { weekday: 4, start_time: '08:00', end_time: '16:00' });
    const second = await setAuditorRule('aud-1', { weekday: 4, start_time: '08:00', end_time: '16:00' });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A8 — błąd unikalności zwrócony przez warstwę raw nie wycieka na zewnątrz akcji jako surowy P2002/23505', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: 'P2002',
    });
    queryRawMock.mockRejectedValueOnce(dbError);

    const result = await setAuditorRule('aud-1', { weekday: 5, start_time: '08:00', end_time: '16:00' });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toMatch(/P2002/);
    expect(result.error).not.toMatch(/23505/);
    expect(result.error).not.toMatch(/Prisma/i);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A10 — zapis grafiku nie zmienia is_active/leave_status na rekordzie audytora, nawet gdy te pola przyjdą w tym samym żądaniu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    const row = { id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    auditorFindUniqueMock.mockResolvedValue(row);

    const before = await prismaAuditorFindUnique();
    const maliciousPayload = {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
      is_active: false,
      aktywny: false,
      leave_status: 'ON_LEAVE',
    };
    const result = await setAuditorRule('aud-1', maliciousPayload);
    const after = await prismaAuditorFindUnique();

    expect(result.success).toBe(true);
    expect(before?.is_active).toBe(true);
    expect(after?.is_active).toBe(before?.is_active);
    expect(after?.leave_status).toBe(before?.leave_status);
    expect(auditorUpdateMock).not.toHaveBeenCalled();

    function prismaAuditorFindUnique() {
      return auditorFindUniqueMock({ where: { id: 'aud-1' } });
    }
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A11 — zapis grafiku nie modyfikuje availability_declarations', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });

    await setAuditorRule('aud-1', { weekday: 1, start_time: '08:00', end_time: '16:00' });

    expect(availabilityDeclarationUpsertMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A12 — siedem zapisów (weekday 1..7) daje siedem wywołań zapisu, każde z innym weekday', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    queryRawMock.mockImplementation(
      async (_strings: TemplateStringsArray, _a: unknown, _c: unknown, weekday: number, s: string, e: string, active: boolean) => [
        { weekday, start_time: s, end_time: e, is_active: active },
      ],
    );

    for (let weekday = 1; weekday <= 7; weekday++) {
      const result = await setAuditorRule('aud-1', {
        weekday,
        start_time: '08:00',
        end_time: '16:00',
      });
      expect(result.success).toBe(true);
    }

    expect(queryRawMock).toHaveBeenCalledTimes(7);
    const writtenWeekdays = queryRawMock.mock.calls.map((call) => call[3]).sort();
    expect(writtenWeekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A12 — brak reguły dla dnia oznacza brak wywołania zapisu dla tego dnia, nie wiersz 00:00-00:00 domyślnie', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    queryRawMock.mockImplementation(
      async (_strings: TemplateStringsArray, _a: unknown, _c: unknown, weekday: number, s: string, e: string, active: boolean) => [
        { weekday, start_time: s, end_time: e, is_active: active },
      ],
    );

    // Celowo pomijamy weekday=6 (sobota) — pracownik pracuje pon-pt i niedziela.
    for (const weekday of [1, 2, 3, 4, 5, 7]) {
      await setAuditorRule('aud-1', { weekday, start_time: '08:00', end_time: '16:00' });
    }

    expect(queryRawMock).toHaveBeenCalledTimes(6);
    const writtenWeekdays = queryRawMock.mock.calls.map((call) => call[3]);
    expect(writtenWeekdays).not.toContain(6);
  });
});

describe('setAvailabilityRuleAction (crews/actions.ts) — zapis reguł tygodniowych ekipy (FLD-AVAIL-WEEKLY-RULES)', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A1 (ekipa) — monter zapisuje regułę na własny identyfikator, odczyt zwraca dokładnie zapisane pola', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    queryRawMock.mockResolvedValueOnce(returningRow(5, '07:00:00', '15:00:00', true));

    const result = await setCrewRule('crew-1', {
      weekday: 5,
      start_time: '07:00',
      end_time: '15:00',
      is_active: true,
    });

    expect(result.success).toBe(true);
    expect(result.rule).toEqual({
      weekday: 5,
      start_time: '07:00:00',
      end_time: '15:00:00',
      is_active: true,
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A2 (ekipa) — zapis reguły na CUDZY identyfikator ekipy jest odrzucony, bez ani jednego zapytania zapisującego', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });

    const result = await setCrewRule('crew-other-team', {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
    });

    expect(result.success).toBe(false);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A10 (ekipa) — zapis grafiku nie zmienia aktywny/leave_status na rekordzie ekipy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    const row = { id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    crewFindUniqueMock.mockResolvedValue(row);

    const before = await crewFindUniqueMock({ where: { id: 'crew-1' } });
    const maliciousPayload = {
      weekday: 1,
      start_time: '08:00',
      end_time: '16:00',
      aktywny: false,
      leave_status: 'ON_LEAVE',
    };
    const result = await setCrewRule('crew-1', maliciousPayload);
    const after = await crewFindUniqueMock({ where: { id: 'crew-1' } });

    expect(result.success).toBe(true);
    expect(before?.aktywny).toBe(true);
    expect(after?.aktywny).toBe(before?.aktywny);
    expect(crewUpdateMock).not.toHaveBeenCalled();
  });
});

describe('AC-A9 (statyczny) — żadna ścieżka dostępna pracownikowi nie usuwa wiersz availability_rules', () => {
  const APPS_ROOT = path.resolve(__dirname, '../../');

  function listSourceFiles(dir: string, acc: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return acc;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        listSourceFiles(full, acc);
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
        acc.push(full);
      }
    }
    return acc;
  }

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-A9 — grep po apps/ nie znajduje availabilityRule.delete ani availabilityRule.deleteMany poza kodem administracyjnym', () => {
    const files = listSourceFiles(APPS_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offenders: { file: string; match: string }[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const deleteMatch = content.match(/availabilityRule\.delete(?!Many)/);
      const deleteManyMatch = content.match(/availabilityRule\.deleteMany/);
      if (deleteMatch) offenders.push({ file, match: deleteMatch[0] });
      if (deleteManyMatch) offenders.push({ file, match: deleteManyMatch[0] });
    }

    expect(offenders).toEqual([]);
  });
});
