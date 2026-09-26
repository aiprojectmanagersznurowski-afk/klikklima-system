import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getJobChecklist, POST as postJobChecklist } from '../src/app/api/field/jobs/own/[id]/checklist/route';
import { POST as postJobHandover } from '../src/app/api/field/jobs/own/[id]/handover/route';
import type { FieldActorRole } from '../src/lib/field-api/types';

// @REQ: FLD-CHECKLIST-PREINSTALL
// @REQ: FLD-HANDOVER-PROTOCOL
// Testy dla ścieżki wykonawczej montera: checklista przedmontażowa oraz protokół zdawczo-odbiorczy.

const mockVerifyFieldActor = vi.fn();
const mockRecordAccessDenied = vi.fn();
const mockGetInstallationChecklist = vi.fn();
const mockUpdateInstallationChecklist = vi.fn();
const mockSubmitHandoverProtocol = vi.fn();

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

vi.mock('../src/lib/domain/install-path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/domain/install-path')>();
  return {
    ...actual,
    getInstallationChecklist: (...args: unknown[]) => mockGetInstallationChecklist(...args),
    updateInstallationChecklist: (...args: unknown[]) => mockUpdateInstallationChecklist(...args),
    submitHandoverProtocol: (...args: unknown[]) => mockSubmitHandoverProtocol(...args),
  };
});

describe('FLD-CHECKLIST-PREINSTALL: /api/field/jobs/own/[id]/checklist', () => {
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
      status: 401,
      error: 'Brak tokenu autoryzacji',
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/checklist');
    const res = await getJobChecklist(req, { params: Promise.resolve({ id: 'inst-1' }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('GET zwraca listę pozycji checklisty ze słownika dla zlecenia', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    mockGetInstallationChecklist.mockResolvedValueOnce({
      success: true,
      checklist: [
        { id: 'SITE_PROTECTION', label: 'Zabezpieczenie miejsca prac', checked: false, checkedAt: null, workerEmail: null },
      ],
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/checklist');
    const res = await getJobChecklist(req, { params: Promise.resolve({ id: 'inst-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.checklist).toBeDefined();
    expect(json.checklist[0].id).toBe('SITE_PROTECTION');
  });

  it('POST zwraca 400, gdy brak nagłówka Idempotency-Key', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ id: 'SITE_PROTECTION', checked: true }] }),
    });

    const res = await postJobChecklist(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Idempotency-Key');
  });

  it('POST zapisuje odhaczone pozycje z przypisaniem pracownika i znacznika czasu', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    mockUpdateInstallationChecklist.mockResolvedValueOnce({
      success: true,
      checklist: [
        {
          id: 'SITE_PROTECTION',
          label: 'Zabezpieczenie miejsca prac',
          checked: true,
          checkedAt: '2026-09-26T10:00:00.000Z',
          workerEmail: 'monter@klikklima.pl',
        },
      ],
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/checklist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-chk-123',
      },
      body: JSON.stringify({
        items: [{ id: 'SITE_PROTECTION', checked: true }],
      }),
    });

    const res = await postJobChecklist(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.checklist[0].checked).toBe(true);
    expect(json.checklist[0].workerEmail).toBe('monter@klikklima.pl');
  });
});

describe('FLD-HANDOVER-PROTOCOL: /api/field/jobs/own/[id]/handover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validMonterActor = {
    email: 'monter@klikklima.pl',
    role: 'monter' as FieldActorRole,
    entityId: 'crew-1',
    isActive: true,
  };

  const validProtocolPayload = {
    nitrogen_test_bar: 35.0,
    vacuum_test_mbar: 0.65,
    test_duration_min: 45,
    client_trained: true,
    outdoor_unit: {
      model: 'RXM35R',
      serial_number: 'SN-OUT-998877',
    },
    indoor_units: [
      {
        index: 1,
        model: 'FTXM35R',
        serial_number: 'SN-IN-112233',
      },
    ],
  };

  it('POST zwraca 400, gdy brak nagłówka Idempotency-Key', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validProtocolPayload),
    });

    const res = await postJobHandover(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Idempotency-Key');
  });

  it('POST zwraca 400, gdy parametry próby ciśnienia lub próżni są nieprawidłowe (<= 0)', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    const invalidPayload = {
      ...validProtocolPayload,
      nitrogen_test_bar: -5,
    };

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/handover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-hnd-1',
      },
      body: JSON.stringify(invalidPayload),
    });

    const res = await postJobHandover(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Parametry prób ciśnienia i próżni muszą być dodatnimi liczbami');
  });

  it('POST zwraca 400, gdy brak potwierdzenia przeprowadzenia instruktażu klienta', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    const noTrainingPayload = {
      ...validProtocolPayload,
      client_trained: false,
    };

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/handover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-hnd-2',
      },
      body: JSON.stringify(noTrainingPayload),
    });

    const res = await postJobHandover(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('instruktaż');
  });

  it('POST zwraca 400, gdy format numeru seryjnego jest nieprawidłowy', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    const invalidSerialPayload = {
      ...validProtocolPayload,
      outdoor_unit: {
        model: 'RXM35R',
        serial_number: '12', // zbyt krótki numer seryjny
      },
    };

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/handover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-hnd-3',
      },
      body: JSON.stringify(invalidSerialPayload),
    });

    const res = await postJobHandover(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('numer seryjny');
  });

  it('POST tworzy protokół zdawczo-odbiorczy i zwraca identyfikator protokołu', async () => {
    mockVerifyFieldActor.mockResolvedValueOnce({
      success: true,
      actor: validMonterActor,
    });

    mockSubmitHandoverProtocol.mockResolvedValueOnce({
      success: true,
      protocolId: 'doc-handover-123',
    });

    const req = new Request('http://localhost:3000/api/field/jobs/own/inst-1/handover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp-hnd-4',
      },
      body: JSON.stringify(validProtocolPayload),
    });

    const res = await postJobHandover(req, { params: Promise.resolve({ id: 'inst-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.protocolId).toBe('doc-handover-123');
  });
});
