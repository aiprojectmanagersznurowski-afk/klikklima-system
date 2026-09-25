export interface AnonymizationResult {
  success: boolean;
  clientAnonymized: boolean;
  addressesAnonymizedCount: number;
  error?: string;
}

export interface CustomerRodoSubject {
  id: string;
  clientNumber: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  isAnonymized: boolean;
  anonymizedAt: string | null;
  createdAt: string;
}

export interface CustomerRodoAddress {
  id: string;
  address: string | null;
  isAnonymized: boolean;
  createdAt: string;
}

export interface CustomerRodoProject {
  id: string;
  projectNumber: string | null;
  status: string | null;
  createdAt: string;
}

export interface CustomerRodoInstallation {
  id: string;
  status: string | null;
  scheduledDate: string | null;
}

export interface CustomerRodoService {
  id: string;
  issueDescription: string | null;
  status: string | null;
  serviceDate: string | null;
}

export interface CustomerRodoIncident {
  id: string;
  issueDescription: string | null;
  status: string | null;
  createdAt: string;
}

export interface CustomerRodoExport {
  exportedAt: string;
  subject: CustomerRodoSubject;
  addresses: CustomerRodoAddress[];
  projects: CustomerRodoProject[];
  installations: CustomerRodoInstallation[];
  services: CustomerRodoService[];
  incidents: CustomerRodoIncident[];
}

export interface PrivacyMetrics {
  totalClients: number;
  anonymizedClients: number;
  activeClients: number;
  totalAnonymizationEvents: number;
  retentionDays: number;
}
