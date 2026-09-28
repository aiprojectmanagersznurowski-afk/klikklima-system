import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../src/app/api/field/availability/self/route';

// @REQ: FLD-API-LAYER
// Testy integracyjne endpointu referencyjnego /api/field/availability/self

const mockVerifyFieldActor = vi.fn();
const mockExecuteWithIdempotency = vi.fn();
const mockRecordAccessDenied = vi.fn();
const mockExecuteSetSelfAvailability = vi.fn();
const mockExecuteGetEffectiveAvailability = vi.fn();

vi.mock('../src/lib/field-api/actor', () => ({
  verifyFieldActor: (...args: unknown[]) => mockVerifyFieldActor(...args),
}));

vi.mock('../src/lib/field-api/idempotency', () => ({
  executeWithIdempotency: (...args: unknown[]) => mockExecuteWithIdempotency(...args),
}));

vi.mock('../src/lib/field-api/security-event', () => ({
  recordAccessDenied: (...args: unknown[]) => mockRecordAccessDenied(...args),
}));

vi.mock('../src/lib/domain/availability', () => ({
  executeSetSelfAvailability: (...args: unknown[]) => mockExecuteSetSelfAvailability(...args),
  executeGetEffectiveAvailability: (...args: unknown[]) => mockExecuteGetEffectiveAvailability(...args),
}));

describe('FLD-API-LAYER: Route Handler /api/field/availability/self', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/field/availability/self', () => {
    it('zwraca 401 Unauthorized, gdy brak autoryzacji aktora', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: 'Brak nagłówka autoryzacyjnego',
      });

      const req = new Request('http://localhost:3000/api/field/availability/self');
      const response = await GET(req);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ success: false, error: 'Brak nagłówka autoryzacyjnego' });
      expect(mockExecuteGetEffectiveAvailability).not.toHaveBeenCalled();
    });

    it('zwraca 200 OK z danymi dostępności dla uwierzytelnionego audytora', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'auditor@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-1',
        },
      });

      mockExecuteGetEffectiveAvailability.mockResolvedValueOnce({
        success: true,
        isAvailable: true,
        rules: [],
      });

      const req = new Request('http://localhost:3000/api/field/availability/self?from=2026-09-01&to=2026-09-30');
      const response = await GET(req);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        success: true,
        isAvailable: true,
        rules: [],
      });
      expect(mockExecuteGetEffectiveAvailability).toHaveBeenCalledWith({
        email: 'auditor@klikklima.pl',
        role: 'audytor',
        entityId: 'aud-1',
      }, expect.any(Object));
    });

    // @REQ: FLD-API-LAYER (retro-audyt ŚR-3/M3: bramka can() w GET musi realnie odmawiać,
    // nie tylko istnieć w kodzie — najbezpieczniejsza interpretacja: rola bez read w macierzy
    // RBAC dostaje odmowę domyślną, nie dane)
    it('rola bez uprawnienia read w macierzy RBAC dostaje 403 w GET, bez wywołania odczytu dostępności', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'anonymous_role@klikklima.pl',
          role: 'nieznany',
          entityId: 'unk-1',
        },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self');
      const response = await GET(req);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(mockExecuteGetEffectiveAvailability).not.toHaveBeenCalled();
      expect(mockRecordAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
        actorEmail: 'anonymous_role@klikklima.pl',
        actorRole: 'nieznany',
        attemptedCapability: 'read',
      }));
    });

    // @REQ: FLD-API-LAYER (retro-audyt ŚR-3/M6: tożsamość aktora MUSI pochodzić z tokenu
    // zweryfikowanego przez verifyFieldActor, a nie z nagłówka kontrolowanego przez klienta)
    it('fałszywy nagłówek X-Actor-Email jest ignorowany — odczyt dostępności używa tożsamości z tokenu', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'auditor@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-1',
        },
      });

      mockExecuteGetEffectiveAvailability.mockResolvedValueOnce({
        success: true,
        isAvailable: true,
        rules: [],
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        headers: { 'X-Actor-Email': 'attacker@evil.pl' },
      });
      await GET(req);

      expect(mockExecuteGetEffectiveAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'auditor@klikklima.pl' }),
        expect.any(Object)
      );
    });
  });

  describe('POST /api/field/availability/self', () => {
    it('zwraca 401 Unauthorized bez dotykania idempotencji, gdy brak autoryzacji', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: 'Nieprawidłowy token',
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: false }),
      });

      const response = await POST(req);

      expect(response.status).toBe(401);
      expect(mockExecuteWithIdempotency).not.toHaveBeenCalled();
      expect(mockExecuteSetSelfAvailability).not.toHaveBeenCalled();
    });

    it('zwraca 400 Bad Request, gdy treść żądania jest niepoprawna (np. brak pola isAvailable)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'auditor@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-1',
        },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-1',
        },
        body: JSON.stringify({ invalidField: 123 }),
      });

      const response = await POST(req);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('isAvailable');
      expect(mockExecuteWithIdempotency).not.toHaveBeenCalled();
    });

    it('odmowa uprawnień roli skutkuje kodem 403, błędem domenowym i logiem w security_events', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'anonymous_role@klikklima.pl',
          role: 'nieznany',
          entityId: 'unk-1',
        },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-2',
        },
        body: JSON.stringify({ isAvailable: false }),
      });

      const response = await POST(req);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(mockRecordAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
        actorEmail: 'anonymous_role@klikklima.pl',
        actorRole: 'nieznany',
        resource: 'availability_declarations',
        attemptedCapability: 'update',
      }));
    });

    it('poprawny zapis przez audytora deleguje do idempotencji i zwraca 200 OK', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'auditor@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-1',
        },
      });

      mockExecuteWithIdempotency.mockResolvedValueOnce({
        status: 200,
        body: { success: true, isAvailable: true },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-3',
        },
        body: JSON.stringify({ isAvailable: true }),
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ success: true, isAvailable: true });
      expect(mockExecuteWithIdempotency).toHaveBeenCalledWith(expect.objectContaining({
        idempotencyKey: 'idemp-3',
        actorEmail: 'auditor@klikklima.pl',
        endpoint: '/api/field/availability/self',
      }));
    });

    // @REQ: FLD-API-LAYER (retro-audyt ŚR-3/M2: bramka RBAC musi wykonać się PRZED
    // executeWithIdempotency — autoryzacja po efekcie ubocznym pozwoliłaby zużyć cudzy klucz
    // idempotencji nawet przy ostatecznej odmowie)
    it('rola dyspozytora (bez update w macierzy RBAC) dostaje 403 w POST, a klucz idempotencji NIE zostaje zużyty', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'dyspozytor@klikklima.pl',
          role: 'dyspozytor',
          entityId: 'disp-1',
        },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-dyspozytor-1',
        },
        body: JSON.stringify({ isAvailable: true }),
      });

      const response = await POST(req);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(mockExecuteWithIdempotency).not.toHaveBeenCalled();
      expect(mockExecuteSetSelfAvailability).not.toHaveBeenCalled();
      expect(mockRecordAccessDenied).toHaveBeenCalledWith(expect.objectContaining({
        actorEmail: 'dyspozytor@klikklima.pl',
        actorRole: 'dyspozytor',
        attemptedCapability: 'update',
      }));
    });

    // @REQ: FLD-API-LAYER (retro-audyt ŚR-3/M6: tożsamość aktora MUSI pochodzić z tokenu
    // zweryfikowanego przez verifyFieldActor, a nie z nagłówka kontrolowanego przez klienta)
    it('fałszywy nagłówek X-Actor-Email jest ignorowany — zapis deleguje do idempotencji z tożsamością z tokenu', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'auditor@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-1',
        },
      });

      mockExecuteWithIdempotency.mockResolvedValueOnce({
        status: 200,
        body: { success: true, isAvailable: true },
      });

      const req = new Request('http://localhost:3000/api/field/availability/self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-spoof-1',
          'X-Actor-Email': 'attacker@evil.pl',
        },
        body: JSON.stringify({ isAvailable: true }),
      });

      await POST(req);

      expect(mockExecuteWithIdempotency).toHaveBeenCalledWith(expect.objectContaining({
        actorEmail: 'auditor@klikklima.pl',
      }));
    });
  });
});
