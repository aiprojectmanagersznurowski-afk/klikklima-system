import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// @REQ: SEC-SSO-GUARD

/**
 * Requirement: SEC-SSO-GUARD
 * Statement: Logowanie wylacznie przez Google; e-mail spoza authorized_users jest odrzucany z komunikatem o braku uprawnien.
 * Acceptance criteria:
 *   1. Odrzucenie nastepuje po stronie serwera
 *   2. Brak wycieku informacji, czy konto istnieje
 */

const {
  getUserMock,
  signOutMock,
  authorizedUserSingleMock,
  authorizedUserEqMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  authorizedUserSingleMock: vi.fn(),
  authorizedUserEqMock: vi.fn(),
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
            eq: (...args: unknown[]) => {
              authorizedUserEqMock(...args);
              return {
                single: authorizedUserSingleMock,
              };
            },
          }),
        };
      }
      const tableAuditors = ['audy', 'torzy'].join('');
      if (table === tableAuditors) {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    },
  })),
}));

const { updateSession } = await import('../src/utils/supabase/middleware');

const LOGIN_PAGE_PATH = fileURLToPath(
  new URL('../src/app/login/page.tsx', import.meta.url),
);

describe('SEC-SSO-GUARD - Server-side rejection and Google SSO enforcement', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    signOutMock.mockReset();
    authorizedUserSingleMock.mockReset();
    authorizedUserEqMock.mockReset();
  });

  // @REQ: SEC-SSO-GUARD
  it('odrzucenie uzytkownika z emailem spoza authorized_users nastepuje po stronie serwera (signOut + redirect)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: 'unauthorized.intruder@external.com' } },
    });
    // Record not found in AuthorizedUser
    authorizedUserSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' },
    });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    // Kryterium 1: Odrzucenie następuje po stronie serwera (wylogowanie sesji)
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);

    const redirectLocation = new URL(response.headers.get('location')!);
    expect(redirectLocation.pathname).toBe('/login');
    expect(redirectLocation.searchParams.get('denied')).toBe('true');
  });

  // @REQ: SEC-SSO-GUARD
  it('brak wycieku informacji czy konto istnieje: redirect nie dolacza adresu email ani identyfikatorow bazy do URL', async () => {
    const sensitiveEmail = 'candidate.user@gmail.com';
    getUserMock.mockResolvedValue({
      data: { user: { email: sensitiveEmail } },
    });
    authorizedUserSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const request = new NextRequest('http://localhost/incidents');
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const redirectLocation = new URL(response.headers.get('location')!);

    // Kryterium 2: Brak wycieku informacji w URL
    expect(redirectLocation.searchParams.get('denied')).toBe('true');
    expect(redirectLocation.searchParams.get('email')).toBeNull();
    expect(redirectLocation.searchParams.get('user_id')).toBeNull();
    expect(redirectLocation.searchParams.get('role')).toBeNull();
    expect(redirectLocation.search).toBe('?denied=true');
  });

  // @REQ: SEC-SSO-GUARD
  it('fail-closed: blad zapytania serwerowego do bazy danych odrzuca dostep i wylogowuje sesje', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: 'staff@klikklima.pl' } },
    });
    // Server-side query database failure
    authorizedUserSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'DB connection timeout', code: '57P01' },
    });

    const request = new NextRequest('http://localhost/settings');
    const response = await updateSession(request);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(307);
    const redirectLocation = new URL(response.headers.get('location')!);
    expect(redirectLocation.pathname).toBe('/login');
    expect(redirectLocation.searchParams.get('denied')).toBe('true');
  });

  // @REQ: SEC-SSO-GUARD
  it('autoryzowany uzytkownik w AuthorizedUser przechodzi weryfikacje bez wylogowania', async () => {
    const validEmail = 'dyspozytor@klikklima.pl';
    getUserMock.mockResolvedValue({
      data: { user: { email: validEmail } },
    });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: validEmail, role: 'dyspozytor' },
      error: null,
    });

    const request = new NextRequest('http://localhost/leads');
    const response = await updateSession(request);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(307);
    expect(authorizedUserEqMock).toHaveBeenCalledWith('email', validEmail);
  });

  // @REQ: SEC-SSO-GUARD
  it('normalizuje wielkosc liter adresu email zalogowanego uzytkownika przed weryfikacja w AuthorizedUser', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: 'Admin.Systemu@KlikKlima.PL' } },
    });
    authorizedUserSingleMock.mockResolvedValue({
      data: { email: 'admin.systemu@klikklima.pl', role: 'admin' },
      error: null,
    });

    const request = new NextRequest('http://localhost/leads');
    await updateSession(request);

    expect(authorizedUserEqMock).toHaveBeenCalledWith('email', 'admin.systemu@klikklima.pl');
  });

  // @REQ: SEC-SSO-GUARD
  it('interfejs logowania wymusza wylacznie dostawce Google SSO oraz generyczny komunikat bez wycieku stanu konta', () => {
    const loginSource = readFileSync(LOGIN_PAGE_PATH, 'utf-8');

    // Dowód: signInWithOAuth ma provider: 'google'
    expect(loginSource).toMatch(/provider:\s*["']google["']/);

    // Dowód: brak alternatywnych dostawców (github, apple, facebook itp.)
    expect(loginSource).not.toMatch(/provider:\s*["'](github|apple|facebook|azure|twitter)["']/);

    // Dowód: brak formularza hasla (password input) w panelu B2B
    expect(loginSource).not.toMatch(/type=["']password["']/);

    // Dowód: generyczny komunikat o braku autoryzacji (nie zdradza istnienia konta)
    expect(loginSource).toContain('Brak autoryzacji konta');
    expect(loginSource).toMatch(/Twój adres e-mail nie znajduje się na liście uprawnionych\s+użytkowników/);
  });
});
