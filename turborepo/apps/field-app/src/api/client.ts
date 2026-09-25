import type { FieldJob, DocumentConsentStatus } from '../types';

export interface FieldApiClientConfig {
  baseUrl?: string;
  getToken: () => string | null;
}

export class FieldApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(config: FieldApiClientConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.getToken = config.getToken;
  }

  private getHeaders(idempotencyKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  async getOwnJobs(): Promise<{ success: boolean; jobs?: FieldJob[]; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/field/jobs/own`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async getOwnJobDetail(jobId: string): Promise<{ success: boolean; job?: FieldJob; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/field/jobs/own/${jobId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async getConsents(): Promise<{
    success: boolean;
    allAccepted?: boolean;
    documents?: DocumentConsentStatus[];
    error?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/field/consents`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async acceptConsent(
    versionId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; consentId?: string; acceptedAt?: string; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/field/consents/accept`, {
      method: 'POST',
      headers: this.getHeaders(idempotencyKey),
      body: JSON.stringify({ versionId }),
    });
    return res.json();
  }

  async startJob(jobId: string): Promise<{
    success: boolean;
    jobId?: string;
    startedAt?: string;
    error?: string;
    missingDocuments?: string[];
  }> {
    const res = await fetch(`${this.baseUrl}/api/field/jobs/own/${jobId}/start`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return res.json();
  }
}
