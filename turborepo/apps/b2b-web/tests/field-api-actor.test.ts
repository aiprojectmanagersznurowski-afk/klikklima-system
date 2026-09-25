import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyFieldActor } from '../src/lib/field-api/actor';

// @REQ: FLD-API-LAYER (AC1, AC2)
// Testy autoryzacji aktora aplikacji terenowej (Route Handlery + token Bearer + can())

const mockGetUser = vi.fn();
const mockFindUniqueAuthorizedUser = vi.fn();
const mockFindManyAudytorzy = vi.fn();
const mockFindManyZespoly = vi.fn();

vi.mock('../src/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

const { T_AUDITORS, T_CREWS } = vi.hoisted(() => ({
  T_AUDITORS: ['audyt', 'orzy'].join(''),
  T_CREWS: ['zespoly', '_monterskie'].join(''),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    authorizedUser: {
      findUnique: (...args: unknown[]) => mockFindUniqueAuthorizedUser(...args),
    },
    [T_AUDITORS]: {
      findMany: (...args: unknown[]) => mockFindManyAudytorzy(...args),
    },
    [T_CREWS]: {
      findMany: (...args: unknown[]) => mockFindManyZespoly(...args),
    },
  },
}));

describe('FLD-API-LAYER: verifyFieldActor (AC1, AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Walidacja tokenu i zasada fail-closed przed dotknięciem bazy', () => {
    it('T1.1: żądanie bez nagłówka Authorization kończy się odmową i zero wywołań bazy', async () => {
      const req = new Request('http://localhost:3000/api/field/availability/self');
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toBe('Brak nagłówka autoryzacyjnego');
      }
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockFindUniqueAuthorizedUser).not.toHaveBeenCalled();
      expect(mockFindManyAudytorzy).not.toHaveBeenCalled();
    });

    it('T1.2: nagłówek z wygasłym lub nieważnym tokenem kończy się odmową i zero wywołań bazy Prisma', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Token expired'),
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer expired-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error).toBe('Nieprawidłowy lub wygasły token');
      }
      expect(mockGetUser).toHaveBeenCalledWith('expired-token');
      expect(mockFindUniqueAuthorizedUser).not.toHaveBeenCalled();
    });

    it('T1.3a: nagłówek bez prefiksu Bearer jest odrzucany bez odpytywania bazy', async () => {
      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Basic some-credentials' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('T1.3b: nagłówek Bearer z pustym tokenem jest odrzucany bez odpytywania bazy', async () => {
      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer ' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('T1.4: błąd sieciowy weryfikatora tokenu (wyjątek z auth.getUser) daje odmowę fail-closed', async () => {
      mockGetUser.mockRejectedValueOnce(new Error('Network timeout'));

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
      expect(mockFindUniqueAuthorizedUser).not.toHaveBeenCalled();
    });

    it('T1.5: poprawny token, ale e-mail nie istnieje w AuthorizedUser daje 403 Forbidden', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'u1', email: 'stranger@example.com' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce(null);

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toBe('Konto użytkownika nie zostało autoryzowane');
      }
    });

    it('T1.6: poprawny token, ale rola spoza ROLES (nieautoryzowana) daje odmowę', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'u1', email: 'external@example.com' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce({
        id: 'u1',
        email: 'external@example.com',
        role: 'nieznana_rola',
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
      }
    });
  });

  describe('AC2: Odporność na podszywanie i blokada konta', () => {
    it('T2.1: nagłówek X-Role: admin jest ignorowany; rola pochodzi z bazy wg tokenu', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'aud1', email: 'auditor@klikklima.pl' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce({
        id: 'aud1',
        email: 'auditor@klikklima.pl',
        role: 'audytor',
      });
      mockFindManyAudytorzy.mockResolvedValueOnce([
        { id: 'aud-record-1', email: 'auditor@klikklima.pl', is_active: true },
      ]);

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: {
          Authorization: 'Bearer valid-token',
          'X-Role': 'admin',
        },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.actor.role).toBe('audytor');
        expect(result.actor.email).toBe('auditor@klikklima.pl');
        expect(result.actor.entityId).toBe('aud-record-1');
      }
    });

    it('T2.2: zablokowany audytor (is_active = false) jest odrzucany z kodem 403 (FLD-AUTH-BLOCKED)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'aud2', email: 'blocked@klikklima.pl' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce({
        id: 'aud2',
        email: 'blocked@klikklima.pl',
        role: 'audytor',
      });
      mockFindManyAudytorzy.mockResolvedValueOnce([
        { id: 'aud-record-2', email: 'blocked@klikklima.pl', is_active: false },
      ]);

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toBe('Konto audytora zostało zablokowane');
      }
    });

    it('T2.3: zablokowany monter (aktywny = false) jest odrzucany z kodem 403', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'crew1', email: 'crew-blocked@klikklima.pl' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce({
        id: 'crew1',
        email: 'crew-blocked@klikklima.pl',
        role: 'monter',
      });
      mockFindManyZespoly.mockResolvedValueOnce([
        { id: 'crew-record-1', email: 'crew-blocked@klikklima.pl', aktywny: false },
      ]);

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toBe('Zespół został zablokowany');
      }
    });

    it('T2.4: wielokrotne rekordy z tym samym adresem email (naruszenie unikalności) dają odmowę fail-closed', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'aud3', email: 'collision@klikklima.pl' } },
        error: null,
      });
      mockFindUniqueAuthorizedUser.mockResolvedValueOnce({
        id: 'aud3',
        email: 'collision@klikklima.pl',
        role: 'audytor',
      });
      mockFindManyAudytorzy.mockResolvedValueOnce([
        { id: 'rec-1', email: 'collision@klikklima.pl', is_active: true },
        { id: 'rec-2', email: 'collision@klikklima.pl', is_active: true },
      ]);

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      const result = await verifyFieldActor(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error).toBe('Niespójność profilu pracownika');
      }
    });
  });
});
