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

const { mockFrom, writeCalls } = vi.hoisted(() => {
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

// Wzorzec identyczny jak `validConsentDocumentVersionId` w `soft-lead.test.ts` w tym
// katalogu — Supabase jest całkowicie zamockowany, wartość służy wyłącznie do przejścia
// walidacji Zod `.uuid()` w leads.ts, żeby testy walidacji telefonu/kształtu w tym bloku
// nie odpadały wcześniej na B2C-SOFT-LEAD-CONSENT (co czyniło je martwe — zweryfikowane
// mutacją: bez tego pola usunięcie CAŁEJ walidacji telefonu nie ruszało tego testu).
const validConsentDocumentVersionId = '33333333-3333-3333-3333-333333333333';

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
    //
    // Zgoda (consentDocumentVersionId) jest tu POPRAWNA i obecna celowo — inaczej ten
    // test odpada na B2C-SOFT-LEAD-CONSENT zamiast na regexie telefonu (błędny RED).
    const invalidPhone = 'abc';

    const result = await saveSoftLead(invalidPhone, {
      location: 'Mieszkanie',
      consentDocumentVersionId: validConsentDocumentVersionId,
    });

    // Asercja na REALNY skutek (żaden zapis, żadną metodą), nie na konkretną metodę
    // Supabase — `writeCalls` (patrz wzorzec w bloku M8 niżej w tym pliku) łapie i
    // `insert`, i `upsert`, więc nie zależy od decyzji D3 (implementer-ui przełącza
    // `leads.ts` między `insert` a `upsert` równolegle z tą zmianą).
    expect(writeCalls.length).toBe(0);
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD
  it('poprawny numer telefonu z poprawną zgodą jest akceptowany (kontrola pozytywna)', async () => {
    const result = await saveSoftLead('500100200', {
      location: 'Mieszkanie',
      consentDocumentVersionId: validConsentDocumentVersionId,
    });

    expect(result.success).toBe(true);
    expect(writeCalls.length).toBe(1);
  });

  // @REQ: B2C-SOFT-LEAD
  it.each([
    ['+48 przed numerem', '+48500100201'],
    ['spacje i myślnik jako separatory', '500-100 202'],
    ['sam prefiks 48 bez plusa', '48500100203'],
  ])('numer telefonu z wariantem formatu (%s) przechodzi walidację regexu', async (_label, phoneVariant) => {
    const result = await saveSoftLead(phoneVariant, {
      location: 'Mieszkanie',
      consentDocumentVersionId: validConsentDocumentVersionId,
    });

    expect(result.success).toBe(true);
  });

  // @REQ: B2C-SOFT-LEAD
  it('numer telefonu o niewłaściwej długości (8 cyfr) jest odrzucony', async () => {
    const result = await saveSoftLead('50010020', {
      location: 'Mieszkanie',
      consentDocumentVersionId: validConsentDocumentVersionId,
    });

    expect(writeCalls.length).toBe(0);
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
      // Zgoda POPRAWNA i obecna celowo — inaczej test odpada na braku zgody, nie na
      // polu `exploit` spoza schematu (ten sam błąd jak przy walidacji telefonu wyżej).
      consentDocumentVersionId: validConsentDocumentVersionId,
    };

    const result = await saveSoftLead('500100200', maliciousPartialData);

    expect(writeCalls.length).toBe(0);
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

    expect(writeCalls.length).toBe(0);
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD-CONSENT
  it('zgoda pod BŁĘDNYM kluczem (consentDocumentVersion zamiast consentDocumentVersionId) nie wystarcza', async () => {
    // Wcześniejsza wersja tego testu padała na tym payloadzie z NIEWŁAŚCIWEGO powodu:
    // nazwa klucza `consentDocumentVersion` (bez `Id`) nie istnieje w schemacie, więc
    // to wywołanie odrzuca `.strict()` (nierozpoznany klucz) RÓWNOLEGLE z brakiem
    // wymaganego `consentDocumentVersionId` — asercja `success === false` była prawdziwa
    // niezależnie od tego, czy walidacja UUID w ogóle działa. Ten test pokrywa DOKŁADNIE
    // to zjawisko: obcy/nierozpoznany klucz w payloadzie przy poprawnej reszcie danych
    // musi zostać odrzucony przez `.strict()`.
    const partialDataWithWrongKeyName = {
      location: 'Dom',
      consentDocumentVersion: '1.0', // literówka w nazwie klucza, nie FK
    };

    const result = await saveSoftLead('700100200', partialDataWithWrongKeyName);

    expect(writeCalls.length).toBe(0);
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD-CONSENT
  it('zgoda wskazująca wersję dokumentu jako sam numer/tekst (nie UUID/klucz obcy) pod POPRAWNYM kluczem nie wystarcza', async () => {
    // Numer wersji jako tekst NIE wystarcza (wzorzec B2C-CONSENT-RODO, bez odstępstw) —
    // musi być wskazanie klucza obcego (UUID). Klucz jest tu POPRAWNY
    // (`consentDocumentVersionId`), więc to wywołanie testuje wyłącznie walidację
    // `.uuid()` w leads.ts, w izolacji od `.strict()` na nierozpoznanej nazwie klucza.
    const partialDataWithTextOnlyConsent = {
      location: 'Dom',
      consentDocumentVersionId: '1.0', // tekst, nie UUID/FK do legal_document_versions
    };

    const result = await saveSoftLead('700100201', partialDataWithTextOnlyConsent);

    expect(writeCalls.length).toBe(0);
    expect(result.success).toBe(false);
  });

  // @REQ: B2C-SOFT-LEAD-CONSENT
  it('obcy, nieznany klucz w payloadzie przy poprawnej resztcie danych (w tym poprawnej zgodzie) jest odrzucony przez .strict()', async () => {
    const partialDataWithUnknownKey = {
      location: 'Dom',
      consentDocumentVersionId: validConsentDocumentVersionId,
      nieznanePole: 'coś, czego nie ma w schemacie',
    };

    const result = await saveSoftLead('700100202', partialDataWithUnknownKey);

    expect(writeCalls.length).toBe(0);
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

    // B2C-SOFT-LEAD-CONSENT wymaga FK do legal_document_versions na KAŻDY zapis (wzorzec
    // z bloku B2C-SOFT-LEAD-CONSENT wyżej w tym pliku) — dopisane tutaj, żeby ten test
    // sprawdzał WYŁĄCZNIE dedup (M8), w izolacji od walidacji zgody.
    const consentDocumentVersionId = '22222222-2222-2222-2222-222222222222';

    await saveSoftLead(phone, { location: 'Mieszkanie', consentDocumentVersionId });
    await saveSoftLead(phone, { location: 'Mieszkanie', consentDocumentVersionId });

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
