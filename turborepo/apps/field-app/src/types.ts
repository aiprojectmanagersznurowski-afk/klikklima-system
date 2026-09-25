export type FieldRole = 'audytor' | 'monter';

export interface MinimizedClientContact {
  imieINazwisko: string;
  telefon: string;
  adres: string;
}

export interface FieldJob {
  id: string;
  projectNumber?: string;
  installationNumber?: string;
  status: string;
  scheduledAt: string | null;
  address: {
    ulicaMiasto: string;
    latitude: number | null;
    longitude: number | null;
  };
  client: MinimizedClientContact;
}

export interface DocumentConsentStatus {
  id: string;
  documentKind: string;
  versionNo: number;
  content: string;
  isCurrent: boolean;
  accepted: boolean;
  acceptedAt?: string;
}

export interface AuthSession {
  token: string;
  email: string;
  role: FieldRole;
  entityId: string;
}
