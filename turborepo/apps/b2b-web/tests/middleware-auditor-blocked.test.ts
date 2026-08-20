import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md — CRM-AUDYT-AC1.5.
 *
 * AC1.5 (D1 = obie sciezki, ROZSTRZYGNIETE 2026-08-20): "Zablokowane konto audytora
 * nie przechodzi bramki autoryzacyjnej — proba dostepu konczy sie odmowa, mimo
 * poprawnych danych logowania." Dotad ten plik nie mial ZADNEGO testu (WO, Zadanie 2).
 *
 * Ten plik testuje `updateSession()` z `apps/b2b-web/src/utils/supabase/middleware.ts`
 * bezposrednio — to jedyna bramka autoryzacyjna w repo (R1: Field App poza zakresem,
 * middleware.ts to najwyzszy poziom, na ktorym AC1.5 jest dzis weryfikowalne).
 *
 * Implementacja (przeczytana przed napisaniem testu): po potwierdzeniu obecnosci
 * uzytkownika w `AuthorizedUser`, middleware dodatkowo pyta
 * `supabase.from('audytorzy').select('id').eq('email', user.email).eq('is_active', false).maybeSingle()`
 * — trafienie (blockedAuditor != null) konczy sie `signOut()` i przekierowaniem na
 * `/login?denied=true&blocked=true&email=...`. Uzytkownik, ktory NIE jest audytorem
 * (np. admin/dyspozytor) nigdy nie trafi w te galaz, bo `audytorzy.email` go nie
 * dopasuje — maybeSingle() zwroci null.
 *
 * Mockujemy '@supabase/ssr' (createServerClient) — nie mamy zywej instancji Supabase
 * w testach jednostkowych, a middleware nie przyjmuje klienta jako argumentu.
 *
 * REVIEW #2 (WO CRM-SAFE-RECORD-ACTIONS, GREEN 3/3, poprawki 2 i 3):
 *
 * 1) Poprzedni mock ignorowal argumenty `eq()` — implementacja pytajaca o zly
 *    warunek (np. `.eq('is_active', true)` zamiast `false`, albo filtr po cudzym
 *    e-mailu) przechodzilaby wszystkie testy, bo mock zwracal zawsze to, co
 *    kazano mu zwrocic, niezaleznie od argumentow. Teraz `eq()` jest `vi.fn()`,
 *    ktory zapisuje swoje argumenty przy kazdym wywolaniu (`blockedAuditorEqCalls`)
 *    — asercje w testach sprawdzaja DOKLADNIE, o co zapytano, nie tylko co
 *    zwrocono.
 *
 * 2) Dodany test na fail-open naprawiony w tej turze w middleware.ts: blad
 *    zapytania o `audytorzy` (`{ data: null, error: <cos> }`) MUSI konczyc sie
 *    odmowa dostepu (signOut + redirect), a nie cichym przepuszczeniem — kod
 *    nie wie, czy konto jest zablokowane, wiec fail-closed jest jedynym
 *    bezpiecznym zachowaniem (spojnie z `getCurrentActorRole()`).
 *
 * 3) Usuniety zduplikowany test "AC1.7" — byl bit-w-bit tym samym scenariuszem
 *    co kontrola negatywna (maybeSingle zwraca null -> przejscie). Middleware
 *    nie ma stanu, wiec odwracalnosc blokady (czy odblokowane konto naprawde
 *    znow przechodzi PO PRZELACZENIU is_active) nie jest tu weryfikowalna —
 *    to pokrywa auditors-toggle-active.test.ts na poziomie samej akcji
 *    przelaczajacej `is_active`.
 *
 * 4) NAPRAWA (zgloszenie uzytkownika, 2026-08-20, bug produkcyjny — zablokowane
 *    logowanie administratora): zapytanie o `audytorzy` uruchamialo sie dla
 *    KAZDEGO authorized_usera, niezaleznie od jego roli w `AuthorizedUser`.
 *    Jesli e-mail admina przypadkowo pasowal do jakiegokolwiek (nawet
 *    niezwiazanego, testowego) wiersza w `audytorzy` z `is_active=false`,
 *    admin dostawal falszywa blokade logowania mimo poprawnego wpisu w
 *    `AuthorizedUser`. Fix: zapytanie o `audytorzy` uruchamia sie teraz TYLKO
 *    gdy `authorizedUser.role === 'audytor'` (pole `role` rozszerzone w
 *    zapytaniu `AuthorizedUser` z `select('email')` na
 *    `select('email, role')`). Trzy istniejace testy ponizej zakladaly rolе
 *    `'audytor'` niejawnie (mock nie zwracal `role` w ogole) — po naprawie
 *    musza deklarowac ja jawnie, inaczej przestalyby testowac galaz, ktora
 *    deklaruja (`role` byloby `undefined`, warunek `=== 'audytor'` bylby
 *    zawsze falszywy, zapytanie o `audytorzy` nigdy by sie nie wykonalo).
 *    Nowy test ponizej jest dokladna regresja zgloszonego buga: uzytkownik
 *    z rola INNA niz `'audytor'`, ktorego e-mail PRZYPADKIEM pasuje do
 *    zablokowanego wiersza w `audytorzy`, mimo to przechodzi bramke, bo
 *    zapytanie o `audytorzy` w ogole sie nie wykonuje dla nie-audytorow.
 */

const {
  getUserMock,
  signOutMock,
  authorizedUserSingleMock,
  blockedAuditorMaybeSingleMock,
  blockedAuditorEqMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  authorizedUserSingleMock: vi.fn(),
  blockedAuditorMaybeSingleMock: vi.fn(),
  blockedAuditorEqMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
    from(table: string) {
      if (table === 'AuthorizedUser') {
        return {
          select: () => ({
            eq: () => ({
              single: authorizedUserSingleMock,
            }),
          }),
        };
      }
      if (table === 'audytorzy') {
        return {
          select: () => ({
            eq: (...args: unknown[]) => {
              blockedAuditorEqMock(...args);
              return {
                eq: (...args2: unknown[]) => {
                  blockedAuditorEqMock(...args2);
                  return {
                    maybeSingle: blockedAuditorMaybeSingleMock,
                  };
                },
              };
            },
          }),
        };
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    },
  })),
}));

const { updateSession } = await import('../src/utils/supabase/middleware');

const AUTHENTICATED_USER = { email: 'audytor.zablokowany@klikklima.pl' };

describe('updateSession - blokada logowania zablokowanego audytora (CRM-AUDYT-AC1.5)', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    signOutMock.mockReset();
    authorizedUserSingleMock.mockReset();
    blockedAuditorMaybeSingleMock.mockReset();
    blockedAuditorEqMock.mockReset();
  });

  // @REQ: CRM-AUDYT-AC1
  it('AC1.5 - audytor z is_active=false jest odrzucony mimo poprawnych danych logowania', async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: AUTHENTICATED_USER.email, role: 'audytor' },
    });
    blockedAuditorMaybeSingleMock.mockResolvedValue({ data: { id: 'aud-1' } });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    expect(signOutMock).toHaveBeenCalled();
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('denied')).toBe('true');
    expect(location.searchParams.get('blocked')).toBe('true');
    // Dowod, ze bramka pyta o WLASCIWY warunek, nie tylko ze cos zwraca (REVIEW #2):
    // pierwsze .eq() musi filtrowac po e-mailu ZALOGOWANEGO uzytkownika, drugie
    // po is_active=false (blokada), nie po dowolnym innym polu/wartosci.
    expect(blockedAuditorEqMock).toHaveBeenNthCalledWith(1, 'email', AUTHENTICATED_USER.email);
    expect(blockedAuditorEqMock).toHaveBeenNthCalledWith(2, 'is_active', false);
  });

  // Kontrola negatywna: uzytkownik autoryzowany, ktory NIE jest zablokowanym
  // audytorem (maybeSingle -> brak trafienia), przechodzi bramke normalnie —
  // inaczej filtr AC1.5 blokowalby kazdego, nie tylko zablokowane konta.
  // @REQ: CRM-AUDYT-AC1
  it('kontrola negatywna - autoryzowany uzytkownik bez blokady przechodzi bramke', async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: AUTHENTICATED_USER.email, role: 'audytor' },
    });
    blockedAuditorMaybeSingleMock.mockResolvedValue({ data: null });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(307);
    expect(blockedAuditorEqMock).toHaveBeenNthCalledWith(1, 'email', AUTHENTICATED_USER.email);
    expect(blockedAuditorEqMock).toHaveBeenNthCalledWith(2, 'is_active', false);
  });

  // REVIEW #2 (usunieta duplikacja): trzeci test tego pliku byl wczesniej oznaczony
  // jako "AC1.7 - odwracalnosc" i byl bit-w-bit tym samym scenariuszem co kontrola
  // negatywna powyzej (maybeSingle -> brak trafienia -> przejscie). Middleware nie
  // ma wlasnego stanu — nie odczytuje "przed" i "po" odblokowaniu w jednym teście,
  // tylko odpytuje baze w danej chwili, wiec nie da sie tu sensownie zweryfikowac
  // odwracalnosci PRZELACZENIA is_active (to wymaga dwoch wywolan
  // toggleAuditorActiveAction, nie dwoch wywolan bramki z tym samym mockiem).
  // AC1.7 (odwracalnosc blokady) jest pokryte na poziomie samej akcji przelaczajacej
  // w auditors-toggle-active.test.ts.

  // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): fail-closed naprawiony w
  // middleware.ts — blad zapytania o audytorzy (nie wiadomo, czy konto jest
  // zablokowane) MUSI konczyc sie odmowa dostepu, nie cichym przepuszczeniem.
  // @REQ: CRM-AUDYT-AC1
  it('fail-closed - blad zapytania o blokade audytora konczy sie odmowa dostepu, nie przejsciem', async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: AUTHENTICATED_USER.email, role: 'audytor' },
    });
    blockedAuditorMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'connection reset', code: 'PGRST000' },
    });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    expect(signOutMock).toHaveBeenCalled();
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('denied')).toBe('true');
    expect(location.searchParams.get('blocked')).toBe('true');
  });

  // Regresja buga produkcyjnego (2026-08-20): admin (rola != 'audytor'), ktorego
  // e-mail PRZYPADKIEM pasuje do zablokowanego wiersza w `audytorzy` (rekord
  // niezwiazany z jego faktyczna rola), musi przejsc bramke — zapytanie o
  // `audytorzy` nie moze sie w ogole wykonac dla nie-audytorow. Asercja
  // sprawdza nie tylko wynik (brak signOut), ale i to, ze galaz faktycznie
  // sie nie uruchomila (blockedAuditorEqMock/blockedAuditorMaybeSingleMock
  // niewywolane) — inaczej test przeszedlby przypadkiem, gdyby ktos znow
  // uruchomil zapytanie, ale z warunkiem, ktory akurat nie trafil.
  // @REQ: CRM-AUDYT-AC1
  it('admin z e-mailem pasujacym do zablokowanego audytora przechodzi bramke, bo zapytanie o audytorzy nie uruchamia sie dla nie-audytorow', async () => {
    getUserMock.mockResolvedValue({ data: { user: AUTHENTICATED_USER } });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: AUTHENTICATED_USER.email, role: 'admin' },
    });
    blockedAuditorMaybeSingleMock.mockResolvedValue({ data: { id: 'aud-1' } });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(307);
    expect(blockedAuditorEqMock).not.toHaveBeenCalled();
    expect(blockedAuditorMaybeSingleMock).not.toHaveBeenCalled();
  });
});
