import type { IncidentSlaStatus } from "./sla"

export type { IncidentSlaStatus }

export type IncidentSummary = {
  id: string;
  numer_zgloszenia: string | null;
  klient_id?: string | null;
  klient_name: string;
  klient_telefon?: string | null;
  instalacja_id?: string | null;
  instalacja_model?: string | null;
  opis_usterki: string;
  priorytet: string;
  status: string;
  created_at: Date;
  zespol_id?: string | null;
  zespol_name: string | null;
  zdjecia_url?: string[];
  sla?: IncidentSlaStatus;
};

export type IncidentClientOption = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  installations: {
    id: string;
    label: string;
  }[];
};

export type IncidentCrewOption = {
  id: string;
  name: string;
};

export type CreateIncidentInput = {
  client_id: string;
  installation_id?: string | null;
  priority?: "NISKI" | "ŚREDNI" | "WYSOKI" | "KRYTYCZNY";
  description: string;
  photo_urls?: string[];
};
