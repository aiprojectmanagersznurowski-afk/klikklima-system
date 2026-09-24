import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * BLOCKER 4 (recenzja 2026-09-24): `saveSoftLead` (apps/b2c-web/app/actions/leads.ts)
 * jest Server Action PUBLICZNĄ (strona lądowania B2C, brak sesji, brak roli) i zapisuje
 * kluczem `service_role`, bez ŻADNEGO schematu Zod — `partialData: any` trafia do
 * insertu wprost z klienta. Ten plik dowodzi braku walidacji (dziś RED) i pokrywa
 * dodatkowo B2C-SOFT-LEAD-CONSENT (zgoda ze wskazaniem KONKRETNEJ wersji dokumentu,
 * zarejestrowane w kontrakcie 2026-09-24) oraz M8 (jednorazowość zapisu po stronie
 * serwera, nie tylko `sessionStorage` na kliencie).
 *
 * Mockowanie: ten sam wzorzec co `soft-lead.test.ts` w tym katalogu — mock całego
 * pakietu `@supabase/supabase-js`, bo `leads.ts` buduje własnego klienta przez
 * `createClient()` wewnątrz `getAdminClient()`, nie przez `@/lib/supabaseClient`.
 *
 * Dług nazewniczy (ADR-002): pole `dane_kontaktowe`/`dane_cząstkowe` i tabela
 * `soft_leady` to polskie nazwy — źródło prawdy to dzisiejszy kod `leads.ts`
 * (ten sam dług, ten sam komentarz jak w `saveLead.test.ts` i `soft-lead.test.ts`
 * w tym katalogu), nie słownik docelowy ADR-002.
 */

const { mockInsert, mockFrom, writeCalls } = vi.hoisted(() => {
  const writeCalls: Array<{ method: 'insert' | 'upsert'; table: string; rows: unknown[] }> = [];

  const mockInsert = vi.fn((rows: unknown[]) => {
    writeCalls.push({ method: 'insert', table: 'soft_leady', rows });
    return Promise.resolve({ data: rows, error: null });
  });
  const mockUpsert = vi.fn((rows: unknown[]) => {
    writeCalls.push({ method: 'upsert', table: 'soft_leady', rows });
    return Promise.resolve({ data: rows, error: null });
  });

  const mockFrom = vi.fn().mockImplementation(() => ({
    insert: mockInsert,
    upsert: mockUpsert,
  }));

  return { mockInsert, mockFrom, writeCalls };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

const { saveSoftLead } = await import('../../app/actions/leads');

describe('B2C-SOFT-LEAD — walidacja serwerowa przed zapisem (BLOCKER 4, brak Zod dziś)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeCalls.length = 0;
  });

  // @REQ: B2C-SOFT-LEAD
  it('numer telefonu, który nie przechodzi walidacji (regex ExitIntentModal.tsx:39), jest odrzucony PRZED zapisem', async () => {
    // "abc" nie przechodzi /^(?:\+?48)?\d{9}$/ po oczyszczeniu ze spacji/nawiasów —
    // dokładnie ta walidacja, którą ExitIntentModal robi WYŁĄCZNIE po stronie klienta
    // (ExitIntentModal.tsx:39-42). Server Action wywołana z pominięciem UI musi
    // powtórzyć tę walidację, bo dziś nic jej nie broni na serwerze.
    const invalidPhone = 'abc';

    const result = await saveSoftLead(invalidPhone, { location: 'Mieszkanie' });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD
  it('partialData spoza oczekiwanego kształtu (zagnieżdżona funkcja) jest odrzucone PRZED zapisem', async () => {
    const maliciousPartialData = {
      location: 'Mieszkanie',
      // Pole spoza oczekiwanego kształtu: funkcja zamiast wartości domenowej. Bez
      // schematu Zod dzisiejszy kod wstawia to wprost do bazy przez service_role.
      exploit: () => {
        throw new Error('nie powinno się nigdy wykonać');
      },
    };

    const result = await saveSoftLead('500100200', maliciousPartialData);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe('B2C-SOFT-LEAD-CONSENT — soft lead bez wskazania KONKRETNEJ wersji dokumentu prawnego jest odrzucony', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeCalls.length = 0;
  });

  // @REQ: B2C-SOFT-LEAD-CONSENT
  it('zapis bez zgody (żadnego odwołania do legal_document_versions) nie tworzy wiersza w soft_leady', async () => {
    // Wywołanie z pominięciem interfejsu, bez znacznika zgody — wzorem B2C-CONSENT-RODO.
    // Dzisiejsza sygnatura `saveSoftLead(contactInfo, partialData)` nie przyjmuje ani nie
    // wymaga żadnej zgody, więc to wywołanie dziś przechodzi i zapisuje — to jest RED.
    const result = await saveSoftLead('600100200', { location: 'Dom' });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD-CONSENT
  it('zgoda wskazująca wersję dokumentu jako sam numer/tekst (nie klucz obcy do legal_document_versions) nie wystarcza', async () => {
    // Numer wersji jako tekst NIE wystarcza (wzorzec B2C-CONSENT-RODO, bez odstępstw) —
    // musi być wskazanie klucza obcego, którego baza może odrzucić dla nieistniejącej
    // wersji. Przekazanie samej wartości tekstowej powinno być odrzucone identycznie
    // jak brak zgody, a nie potraktowane jako poprawne wskazanie wersji.
    const partialDataWithTextOnlyConsent = {
      location: 'Dom',
      consentDocumentVersion: '1.0', // tekst, nie FK do legal_document_versions
    };

    const result = await saveSoftLead('700100200', partialDataWithTextOnlyConsent);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe('M8 — jednorazowość zapisu exit intent jest po stronie serwera, nie tylko w sessionStorage klienta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeCalls.length = 0;
  });

  // @REQ: B2C-SOFT-LEAD
  it('drugie wywołanie saveSoftLead z tym samym numerem telefonu nie tworzy drugiego wiersza', async () => {
    const phone = '500999888';

    await saveSoftLead(phone, { location: 'Mieszkanie' });
    await saveSoftLead(phone, { location: 'Mieszkanie' });

    // Asercja na WARUNEK UNIKALNOŚCI w argumentach wywołania do Supabase (upsert z
    // onConflict albo sprawdzenie istniejącego wiersza przed insertem), nie na
    // zwrotce atrapy — liczymy realne operacje zapisu dla TEGO numeru, niezależnie
    // od tego, którą metodą (insert/upsert) implementacja finalnie to zrobi.
    const writesForThisPhone = writeCalls.filter((call) =>
      call.rows.some(
        (row) => (row as { dane_kontaktowe?: string }).dane_kontaktowe === phone,
      ),
    );

    expect(writesForThisPhone.length).toBe(1);
  });
});
