import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getOwnJobs } from '../src/app/api/field/jobs/own/route';
import { GET as getOwnJobDetail } from '../src/app/api/field/jobs/own/[id]/route';
import type { FieldActorRole } from '../src/lib/field-api/types';

// @REQ: FLD-JOBS-OWN
// @REQ: CRM-KLI-AC2
// Testy weryfikujące zawężenie listy zleceń w terenie do własnych pracownika oraz minimalizację danych klienta.

const mockVerifyFieldActor = vi.fn();
const mockRecordAccessDenied = vi.fn();
const mockExecuteGetOwnJobs = vi.fn();
const mockExecuteGetOwnJobDetail = vi.fn();

vi.mock('../src/lib/field-api/actor', () => ({
  verifyFieldActor: (...args: unknown[]) => mockVerifyFieldActor(...args),
}));

vi.mock('../src/lib/field-api/security-event', () => ({
  recordAccessDenied: (...args: unknown[]) => mockRecordAccessDenied(...args),
}));

vi.mock('../src/lib/domain/jobs', () => ({
  executeGetOwnJobs: (...args: unknown[]) => mockExecuteGetOwnJobs(...args),
  executeGetOwnJobDetail: (...args: unknown[]) => mockExecuteGetOwnJobDetail(...args),
}));

describe('FLD-JOBS-OWN & CRM-KLI-AC2: /api/field/jobs/own', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/field/jobs/own — lista własnych zleceń', () => {
    it('zwraca 401 Unauthorized, gdy brak autoryzacji tokenu', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: 'Nieprawidłowy lub wygasły token',
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own');
      const res = await getOwnJobs(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ success: false, error: 'Nieprawidłowy lub wygasły token' });
      expect(mockExecuteGetOwnJobs).not.toHaveBeenCalled();
    });

    it('zwraca 403 Forbidden, gdy rola nie ma prawa do odczytu zasobu (np. rola spoza macierzy lub brak uprawnień)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'unknown@klikklima.pl',
          role: 'klient' as unknown as FieldActorRole,
          entityId: 'client-1',
          isActive: true,
        },
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own');
      const res = await getOwnJobs(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(mockRecordAccessDenied).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedCapability: 'read',
          endpoint: '/api/field/jobs/own',
        })
      );
      expect(mockExecuteGetOwnJobs).not.toHaveBeenCalled();
    });

    it('zwraca 200 OK z listą zleceń audytora zawężoną do własnych (auditorId === entityId)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'audytor1@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-uuid-1',
          isActive: true,
        },
      });

      const ownJobs = [
        {
          id: 'lead-1',
          projectNumber: 'L-000001',
          status: 'AUDIT_SCHEDULED',
          scheduledAt: '2026-09-27T10:00:00Z',
          address: {
            ulicaMiasto: 'ul. Marszałkowska 10, Warszawa',
            latitude: 52.23,
            longitude: 21.01,
          },
          client: {
            imieINazwisko: 'Jan Kowalski',
            telefon: '+48500600700',
          },
        },
      ];

      mockExecuteGetOwnJobs.mockResolvedValueOnce({
        success: true,
        jobs: ownJobs,
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own');
      const res = await getOwnJobs(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobs).toHaveLength(1);
      expect(json.jobs[0].id).toBe('lead-1');
      expect(mockExecuteGetOwnJobs).toHaveBeenCalledWith({
        email: 'audytor1@klikklima.pl',
        role: 'audytor',
        entityId: 'aud-uuid-1',
        isActive: true,
      });
    });

    it('zwraca 200 OK z listą zleceń montera zawężoną do własnych (crewId === entityId)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter1@klikklima.pl',
          role: 'monter',
          entityId: 'crew-uuid-1',
          isActive: true,
        },
      });

      const ownInstallations = [
        {
          id: 'inst-1',
          installationNumber: 'I-000001',
          status: 'PLANNED',
          scheduledAt: '2026-09-28T08:00:00Z',
          address: {
            ulicaMiasto: 'ul. Długa 5, Kraków',
            latitude: 50.06,
            longitude: 19.94,
          },
          client: {
            imieINazwisko: 'Anna Nowak',
            telefon: '+48600700800',
          },
        },
      ];

      mockExecuteGetOwnJobs.mockResolvedValueOnce({
        success: true,
        jobs: ownInstallations,
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own');
      const res = await getOwnJobs(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobs).toHaveLength(1);
      expect(json.jobs[0].installationNumber).toBe('I-000001');
    });

    it('zwraca pustą listę (jobs: []), gdy pracownik nie ma przypisanych zleceń (dla cudzych zleceń brak wyników)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'audytor_bez_zlecen@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-uuid-pusty',
          isActive: true,
        },
      });

      mockExecuteGetOwnJobs.mockResolvedValueOnce({
        success: true,
        jobs: [],
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own');
      const res = await getOwnJobs(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobs).toEqual([]);
    });
  });

  describe('GET /api/field/jobs/own/[id] — odczyt pojedynczego zlecenia i ochrona przed enumeracją', () => {
    it('zwraca 404/403 fail-closed z identycznym komunikatem dla zlecenia cudzego lub nieistniejącego', async () => {
      mockVerifyFieldActor.mockResolvedValue({
        success: true,
        actor: {
          email: 'audytor1@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-uuid-1',
          isActive: true,
        },
      });

      mockExecuteGetOwnJobDetail.mockResolvedValue({
        success: false,
        error: 'Nie znaleziono zlecenia lub brak dostępu',
        notFound: true,
      });

      const reqOther = new Request('http://localhost:3000/api/field/jobs/own/cudze-id');
      const resOther = await getOwnJobDetail(reqOther, { params: Promise.resolve({ id: 'cudze-id' }) });

      const reqNonExist = new Request('http://localhost:3000/api/field/jobs/own/nieistniejace-id');
      const resNonExist = await getOwnJobDetail(reqNonExist, { params: Promise.resolve({ id: 'nieistniejace-id' }) });

      expect(resOther.status).toBe(404);
      expect(resNonExist.status).toBe(404);

      const jsonOther = await resOther.json();
      const jsonNonExist = await resNonExist.json();

      expect(jsonOther.error).toBe('Nie znaleziono zlecenia lub brak dostępu');
      expect(jsonNonExist.error).toBe('Nie znaleziono zlecenia lub brak dostępu');
      expect(jsonOther).toEqual(jsonNonExist);
    });

    it('CRM-KLI-AC2: odczyt szczegółów zlecenia własnego zwraca wyłącznie imię i nazwisko, telefon i adres klienta (brak e-maila, notatek, finansów)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'audytor1@klikklima.pl',
          role: 'audytor',
          entityId: 'aud-uuid-1',
          isActive: true,
        },
      });

      const jobDetail = {
        id: 'lead-1',
        projectNumber: 'L-000001',
        status: 'AUDIT_SCHEDULED',
        scheduledAt: '2026-09-27T10:00:00Z',
        address: {
          ulicaMiasto: 'ul. Marszałkowska 10, Warszawa',
          latitude: 52.23,
          longitude: 21.01,
        },
        client: {
          imieINazwisko: 'Jan Kowalski',
          telefon: '+48500600700',
          adres: 'ul. Marszałkowska 10, Warszawa',
        },
      };

      mockExecuteGetOwnJobDetail.mockResolvedValueOnce({
        success: true,
        job: jobDetail,
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own/lead-1');
      const res = await getOwnJobDetail(req, { params: Promise.resolve({ id: 'lead-1' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.job).toBeDefined();

      const clientKeys = Object.keys(json.job.client).sort();
      expect(clientKeys).toEqual(['adres', 'imieINazwisko', 'telefon'].sort());

      // Jawne sprawdzenie braku wrażliwych pól klienta
      const clientRecord = json.job.client as Record<string, unknown>;
      expect(clientRecord.email).toBeUndefined();
      expect(clientRecord.notatki).toBeUndefined();
      expect(clientRecord.financialData).toBeUndefined();
      expect(clientRecord.history).toBeUndefined();
    });
  });
});
