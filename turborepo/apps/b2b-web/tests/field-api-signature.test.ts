import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getJobSignature, POST as postJobSignature } from '../src/app/api/field/jobs/own/[id]/signature/route';
import type { FieldActorRole } from '../src/lib/field-api/types';

// @REQ: FLD-SIGN-DOC-FREEZE
// @REQ: FLD-SIGN-CAPTURE
// @REQ: FLD-SIGN-AUDIT-TRAIL
// @REQ: FLD-SIGN-TSA
// Testy dla podpisu elektronicznego na miejscu (On-site).

const mockVerifyFieldActor = vi.fn();
const mockRecordAccessDenied = vi.fn();
const mockGetJobDocumentForSigning = vi.fn();
const mockSaveOnsiteSignature = vi.fn();

vi.mock('../src/lib/field-api/idempotency', () => ({
  executeWithIdempotency: vi.fn(async (params: { idempotencyKey: string | null; operation: () => Promise<{ status: number; body: unknown }> }) => {
    if (!params.idempotencyKey || typeof params.idempotencyKey !== 'string' || params.idempotencyKey.trim().length === 0) {
      return {
        status: 400,
        body: { success: false, error: 'Wymagany jest nagłówek Idempotency-Key' },
      };
    }
    return await params.operation();
  }),
}));

vi.mock('../src/lib/field-api/actor', () => ({
  verifyFieldActor: (...args: unknown[]) => mockVerifyFieldActor(...args),
}));

vi.mock('../src/lib/field-api/security-event', () => ({
  recordAccessDenied: (...args: unknown[]) => mockRecordAccessDenied(...args),
}));

vi.mock('../src/lib/domain/signature', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/domain/signature')>();
  return {
    ...actual,
    getJobDocumentForSigning: (...args: unknown[]) => mockGetJobDocumentForSigning(...args),
    saveOnsiteSignature: (...args: unknown[]) => mockSaveOnsiteSignature(...args),
  };
});

describe('FLD-SIGN-DOC-FREEZE & FLD-SIGN-CAPTURE: /api/field/jobs/own/[id]/signature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validMonterActor = {
    email: 'monter@klikklima.pl',
    role: 'monter' as FieldActorRole,
    entityId: 'crew-1',
    isActive: true,
  };

  it('GET zwraca 401, gdy brak ważnego tokenu pracownika', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: false,
      reason: 'TOKEN_INVALID',
      httpStatus: 401,
      role: null,
      email: null,
      entityId: null,
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature');
    const response = await getJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('GET zwraca 404 fail-closed, gdy zlecenie nie należy do pracownika', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    mockGetJobDocumentForSigning.mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/field/jobs/own/job-foreign/signature', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await getJobSignature(request, { params: Promise.resolve({ id: 'job-foreign' }) });

    expect(response.status).toBe(404);
  });

  it('GET zwraca dane dokumentu i zamrożony contentHash przed prezentacją', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    mockGetJobDocumentForSigning.mockResolvedValueOnce({
      documentId: 'doc-123',
      documentType: 'HANDOVER_PROTOCOL',
      contentHash: 'f'.repeat(64),
      templateVersion: 'v1.0',
      isSigned: false,
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const response = await getJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.documentId).toBe('doc-123');
    expect(body.documentType).toBe('HANDOVER_PROTOCOL');
    expect(body.contentHash).toBe('f'.repeat(64));
    expect(body.templateVersion).toBe('v1.0');
    expect(body.isSigned).toBe(false);
  });

  it('POST odrzuca żądanie bez nagłówka Idempotency-Key', async () => {
    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        signatureImage: 'data:image/png;base64,valid',
      }),
    });

    const response = await postJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Idempotency-Key');
  });

  it('POST odrzuca żądanie z pustym podpisem (FLD-SIGN-CAPTURE)', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-empty-sig',
      },
      body: JSON.stringify({
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        signatureImage: '   ',
      }),
    });

    const response = await postJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Signature image cannot be empty');
  });

  it('POST odrzuca podpis, gdy documentHash nie zgadza się ze skrótem dokumentu (FLD-SIGN-DOC-FREEZE fail-closed)', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    mockSaveOnsiteSignature.mockResolvedValueOnce({
      success: false,
      code: 'DOCUMENT_HASH_MISMATCH',
      error: 'Podany skrót dokumentu nie zgadza się z zamrożoną treścią dokumentu',
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-mismatch-hash',
      },
      body: JSON.stringify({
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'tampered-hash-0000000000000000000000000000000000000000000000000000',
        signatureImage: 'data:image/png;base64,valid',
      }),
    });

    const response = await postJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe('DOCUMENT_HASH_MISMATCH');
  });

  it('POST pomyślnie zapisuje podpis na miejscu z kwalifikowanym znacznikiem TSA (FLD-SIGN-TSA & FLD-SIGN-AUDIT-TRAIL)', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    mockSaveOnsiteSignature.mockResolvedValueOnce({
      success: true,
      signature: {
        id: 'sig-999',
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        mode: 'ON_SITE',
        signedAt: '2026-09-26T10:00:00Z',
        tsaStatus: 'APPLIED',
        tsaTimestampAt: '2026-09-26T10:00:01Z',
      },
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-valid-sig',
      },
      body: JSON.stringify({
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        signatureImage: 'data:image/png;base64,valid-signature-stream',
        captureMetadata: {
          deviceModel: 'Samsung S24',
          signedAtClient: '2026-09-26T10:00:00Z',
        },
      }),
    });

    const response = await postJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.signature.id).toBe('sig-999');
    expect(body.signature.tsaStatus).toBe('APPLIED');
  });

  it('POST zapisuje podpis jako PENDING przy awarii dostawcy TSA bez blokowania operacji (FLD-SIGN-TSA offline fallback)', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      role: validMonterActor.role,
      email: validMonterActor.email,
      entityId: validMonterActor.entityId,
    });

    mockSaveOnsiteSignature.mockResolvedValueOnce({
      success: true,
      signature: {
        id: 'sig-1000',
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        mode: 'ON_SITE',
        signedAt: '2026-09-26T10:00:00Z',
        tsaStatus: 'PENDING',
        tsaTimestampAt: null,
      },
    });

    const request = new Request('http://localhost/api/field/jobs/own/job-1/signature', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-offline-tsa',
      },
      body: JSON.stringify({
        documentType: 'HANDOVER_PROTOCOL',
        documentId: 'doc-123',
        documentHash: 'f'.repeat(64),
        signatureImage: 'data:image/png;base64,valid-signature-stream',
      }),
    });

    const response = await postJobSignature(request, { params: Promise.resolve({ id: 'job-1' }) });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.signature.tsaStatus).toBe('PENDING');
    expect(body.signature.tsaTimestampAt).toBeNull();
  });
});
