import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getConsentsStatus } from '../src/app/api/field/consents/route';
import { POST as acceptConsent } from '../src/app/api/field/consents/accept/route';
import { POST as startJob } from '../src/app/api/field/jobs/own/[id]/start/route';

// @REQ: FLD-CONSENT-ENFORCE
// Testy sprawdzające serwerową bramkę egzekwowania aktualnych zgód pracowniczych (regulamin/RODO)
// przed rozpoczęciem zlecenia w aplikacji terenowej.

const mockVerifyFieldActor = vi.fn();
const mockGetActorConsentsStatus = vi.fn();
const mockExecuteAcceptConsent = vi.fn();
const mockCanStartJobWithConsents = vi.fn();
const mockExecuteStartJob = vi.fn();
const mockExecuteWithIdempotency = vi.fn();

vi.mock('../src/lib/field-api/actor', () => ({
  verifyFieldActor: (...args: unknown[]) => mockVerifyFieldActor(...args),
}));

vi.mock('../src/lib/field-api/idempotency', () => ({
  executeWithIdempotency: (params: { operation: (tx?: unknown) => Promise<{ status: number; body: unknown }> }) =>
    params.operation(undefined),
}));

vi.mock('../src/lib/domain/consents', () => ({
  getActorConsentsStatus: (...args: unknown[]) => mockGetActorConsentsStatus(...args),
  executeAcceptLegalDocumentVersion: (...args: unknown[]) => mockExecuteAcceptConsent(...args),
  canStartJobWithConsents: (...args: unknown[]) => mockCanStartJobWithConsents(...args),
}));

vi.mock('../src/lib/domain/jobs', () => ({
  executeStartJob: (...args: unknown[]) => mockExecuteStartJob(...args),
}));

describe('FLD-CONSENT-ENFORCE: Egzekwowanie aktualnych zgód pracowniczych', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/field/consents — pobranie statusu zgód', () => {
    it('zwraca 401 Unauthorized, gdy brak autoryzacji', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: false,
        status: 401,
        error: 'Brak tokenu',
      });

      const req = new Request('http://localhost:3000/api/field/consents');
      const res = await getConsentsStatus(req);

      expect(res.status).toBe(401);
      expect(mockGetActorConsentsStatus).not.toHaveBeenCalled();
    });

    it('zwraca listę obowiązujących dokumentów wraz ze statusem ich akceptacji przez pracownika', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      mockGetActorConsentsStatus.mockResolvedValueOnce({
        success: true,
        allAccepted: false,
        documents: [
          {
            id: 'doc-v1',
            documentKind: 'REGULAMIN_PRACOWNICZY',
            versionNo: 2,
            content: 'Treść regulaminu v2...',
            isCurrent: true,
            accepted: true,
            acceptedAt: '2026-09-20T12:00:00Z',
          },
          {
            id: 'doc-v2',
            documentKind: 'KLAUZULA_RODO',
            versionNo: 3,
            content: 'Nowa klauzula RODO v3...',
            isCurrent: true,
            accepted: false,
          },
        ],
      });

      const req = new Request('http://localhost:3000/api/field/consents');
      const res = await getConsentsStatus(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.allAccepted).toBe(false);
      expect(json.documents).toHaveLength(2);
      expect(json.documents[1].accepted).toBe(false);
    });
  });

  describe('POST /api/field/consents/accept — akceptacja dokumentu', () => {
    it('zapisuje akceptację wersji dokumentu i zwraca sukces', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      mockExecuteAcceptConsent.mockResolvedValueOnce({
        success: true,
        consentId: 'consent-uuid-1',
        acceptedAt: '2026-09-26T10:00:00Z',
      });

      const req = new Request('http://localhost:3000/api/field/consents/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: 'doc-v2' }),
      });

      const res = await acceptConsent(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockExecuteAcceptConsent).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'monter@klikklima.pl' }),
        'doc-v2',
        undefined
      );
    });

    it('zwraca 400 Bad Request przy braku versionId w ciele żądania', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      const req = new Request('http://localhost:3000/api/field/consents/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await acceptConsent(req);
      expect(res.status).toBe(400);
      expect(mockExecuteAcceptConsent).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/field/jobs/own/[id]/start — serwerowa bramka startu zlecenia', () => {
    it('odrzuca rozpoczęcie zlecenia (403 Forbidden), gdy pracownik nie ma kompletu aktualnych zgód (allAccepted = false)', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      mockCanStartJobWithConsents.mockResolvedValueOnce({
        allowed: false,
        error: 'Brak wymaganych aktualnych zgód pracowniczych',
        missingDocuments: ['KLAUZULA_RODO'],
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own/job-1/start', {
        method: 'POST',
      });
      const res = await startJob(req, { params: Promise.resolve({ id: 'job-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Brak wymaganych aktualnych zgód pracowniczych');
      expect(json.missingDocuments).toEqual(['KLAUZULA_RODO']);
      expect(mockExecuteStartJob).not.toHaveBeenCalled();
    });

    it('pozwala na rozpoczęcie zlecenia (200 OK), gdy wszystkie obowiązujące dokumenty są zaakceptowane', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      mockCanStartJobWithConsents.mockResolvedValueOnce({
        allowed: true,
      });

      mockExecuteStartJob.mockResolvedValueOnce({
        success: true,
        jobId: 'job-1',
        startedAt: '2026-09-26T10:15:00Z',
      });

      const req = new Request('http://localhost:3000/api/field/jobs/own/job-1/start', {
        method: 'POST',
      });
      const res = await startJob(req, { params: Promise.resolve({ id: 'job-1' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.jobId).toBe('job-1');
      expect(mockExecuteStartJob).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'crew-1' }),
        'job-1'
      );
    });

    it('fail-closed: błąd odpytania o zgody kończy się odmową dostępu, a nie cichym przepuszczeniem', async () => {
      mockVerifyFieldActor.mockResolvedValueOnce({
        success: true,
        actor: {
          email: 'monter@klikklima.pl',
          role: 'monter',
          entityId: 'crew-1',
          isActive: true,
        },
      });

      mockCanStartJobWithConsents.mockRejectedValueOnce(new Error('Błąd bazy danych przy sprawdzaniu zgód'));

      const req = new Request('http://localhost:3000/api/field/jobs/own/job-1/start', {
        method: 'POST',
      });
      const res = await startJob(req, { params: Promise.resolve({ id: 'job-1' }) });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Błąd weryfikacji wymaganych zgód');
      expect(mockExecuteStartJob).not.toHaveBeenCalled();
    });
  });
});
