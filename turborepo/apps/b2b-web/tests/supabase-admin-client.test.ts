import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * WO: docs/workorders/SERVICE-ROLE-LEADS-PAGE.md
 *
 * Faza RED. `apps/b2b-web/src/utils/supabase/admin.ts` NIE ISTNIEJE jeszcze
 * (plan WO). Nie jest wymieniony wprost w tabeli "Plan plikow" jako osobny
 * plik testu, ale sekcja "Przypadki brzegowe, ktore MUSZA miec test" wymaga
 * wprost: "Brak SUPABASE_SERVICE_ROLE_KEY w srodowisku - createAdminClient()
 * rzuca jawnym bledem. Test ma potwierdzic, ze NIE nastepuje cichy fallback
 * na klucz anonimowy (blad apps/b2c-web/lib/supabaseClient.ts)." To jest
 * osobny modul od signStoragePaths, wiec dostaje osobny plik testu zamiast
 * dopisywania nie zwiazanych mockow do storage-signed-urls.test.ts.
 *
 * Mockujemy @supabase/supabase-js, zeby test nie zalezal od prawdziwej sieci
 * i zeby dalo sie sprawdzic DOKLADNIE, jakim kluczem createClient zostal
 * wywolany (albo ze nie zostal wywolany wcale).
 */

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ storage: {} })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const { createAdminClient } = await import('../src/utils/supabase/admin');

const ORIGINAL_ENV = { ...process.env };

describe('createAdminClient() - klient serwisowy bez cichego fallbacku na klucz anonimowy (SERVICE-ROLE-LEADS-PAGE)', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // Kontrola pozytywna: gdy klucz serwisowy jest ustawiony, klient powstaje
  // na jego podstawie (nie na kluczu anonimowym).
  it('gdy SUPABASE_SERVICE_ROLE_KEY jest ustawiony, createClient dostaje ten klucz', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key';

    createAdminClient();

    expect(createClientMock).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role-secret',
    );
  });

  // Przypadek brzegowy wymagany explicite przez WO: brak klucza serwisowego
  // rzuca jawnym bledem. Zero tolerancji na wzorzec z
  // apps/b2c-web/lib/supabaseClient.ts (`SERVICE_ROLE_KEY || ANON_KEY || 'placeholder_key'`).
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('brak SUPABASE_SERVICE_ROLE_KEY w srodowisku rzuca jawnym bledem zamiast cicho degradowac do klucza anonimowego', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key';

    expect(() => createAdminClient()).toThrow();
  });

  // Dowod nieobecnosci fallbacku, nie tylko obecnosci wyjatku: nawet gdyby
  // implementacja polykala blad gdzies wyzej, createClient nie moze zostac
  // wywolany z kluczem anonimowym jako drugim argumentem.
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('brak SUPABASE_SERVICE_ROLE_KEY - createClient nigdy nie jest wywolywany z kluczem anonimowym', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key';

    try {
      createAdminClient();
    } catch {
      // oczekiwane - sprawdzana jest wylacznie strona wywolania createClient ponizej
    }

    for (const call of createClientMock.mock.calls) {
      expect(call).not.toContain('anon-public-key');
    }
  });
});
