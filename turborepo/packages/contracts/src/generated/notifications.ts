// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const NOTIFICATION_IDS = ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N8a", "N_REJECT", "N_ROLLBACK", "N10", "N11", "N12", "N13", "N14", "N15", "N16", "N17", "N18", "I1", "I2", "I3", "I4", "I5", "I6", "I7"] as const;
export type NotificationId = (typeof NOTIFICATION_IDS)[number];

export interface NotificationDef {
  id: NotificationId;
  domain: 'FUNNEL' | 'SERVICE' | 'INCIDENT' | 'INTERNAL';
  channels: ('SMS' | 'EMAIL' | 'PUSH')[];
  recipient: 'CLIENT' | 'DISPATCHER' | 'AUDITOR' | 'CREW' | 'ADMIN';
  bind: { kind: string; transition?: string; schedule?: string; event?: string };
  vars: string[];
  attachments?: string[];
  templateKey: string;
  status: 'STABLE' | 'PROPOSED';
}

export const NOTIFICATIONS: readonly NotificationDef[] = [
  { id: "N1", domain: "FUNNEL", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T01"}, vars: ["first_name","order_number"], templateKey: "funnel.auditor_assigned", status: "STABLE" },
  { id: "N2", domain: "FUNNEL", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"CRON","schedule":"24h_before_audit"}, vars: ["first_name","time","address","link"], templateKey: "funnel.audit_reminder_24h", status: "STABLE" },
  { id: "N3", domain: "FUNNEL", channels: ["SMS"], recipient: "CLIENT", bind: {"kind":"GEO","event":"auditor_en_route"}, vars: ["first_name","eta"], templateKey: "funnel.auditor_en_route", status: "STABLE" },
  { id: "N4", domain: "FUNNEL", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T02"}, vars: ["first_name","link","total_price"], templateKey: "funnel.quote_ready", status: "STABLE" },
  { id: "N5", domain: "FUNNEL", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T06"}, vars: ["first_name","tracking_id"], templateKey: "funnel.shipped", status: "STABLE" },
  { id: "N6", domain: "FUNNEL", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"CRON","schedule":"24h_before_installation"}, vars: ["first_name","time","address","link"], templateKey: "funnel.install_reminder_24h", status: "STABLE" },
  { id: "N7", domain: "FUNNEL", channels: ["SMS"], recipient: "CLIENT", bind: {"kind":"GEO","event":"crew_en_route"}, vars: ["first_name","eta"], templateKey: "funnel.crew_en_route", status: "STABLE" },
  { id: "N8", domain: "FUNNEL", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T09"}, vars: ["first_name","order_number"], attachments: ["warranty_card","handover_protocol","invoice"], templateKey: "funnel.install_completed", status: "STABLE" },
  { id: "N8a", domain: "FUNNEL", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T17"}, vars: ["first_name","order_number","link"], templateKey: "funnel.install_phase1_completed", status: "STABLE" },
  { id: "N_REJECT", domain: "FUNNEL", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T04"}, vars: ["first_name","link","order_number"], templateKey: "funnel.quote_expired", status: "STABLE" },
  { id: "N_ROLLBACK", domain: "FUNNEL", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"TRANSITION","transition":"T10|T11|T12|T13"}, vars: ["first_name","link","order_number"], templateKey: "funnel.rollback_rebook", status: "STABLE" },
  { id: "N10", domain: "SERVICE", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"CRON","schedule":"x_days_before_service"}, vars: ["first_name","link","date"], templateKey: "service.reminder", status: "STABLE" },
  { id: "N11", domain: "SERVICE", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"DOMAIN","event":"service_technician_assigned"}, vars: ["first_name","order_number"], templateKey: "service.technician_assigned", status: "STABLE" },
  { id: "N12", domain: "SERVICE", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"CRON","schedule":"24h_before_service"}, vars: ["first_name","time","link"], templateKey: "service.reminder_24h", status: "STABLE" },
  { id: "N13", domain: "SERVICE", channels: ["SMS"], recipient: "CLIENT", bind: {"kind":"GEO","event":"technician_en_route"}, vars: ["first_name","eta"], templateKey: "service.technician_en_route", status: "STABLE" },
  { id: "N14", domain: "SERVICE", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"DOMAIN","event":"service_completed"}, vars: ["first_name","order_number"], attachments: ["handover_protocol","invoice"], templateKey: "service.completed", status: "STABLE" },
  { id: "N15", domain: "INCIDENT", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"DOMAIN","event":"incident_received"}, vars: ["first_name","link","order_number"], templateKey: "incident.received", status: "STABLE" },
  { id: "N16", domain: "INCIDENT", channels: ["SMS","EMAIL"], recipient: "CLIENT", bind: {"kind":"DOMAIN","event":"incident_technician_assigned"}, vars: ["first_name","order_number"], templateKey: "incident.technician_assigned", status: "STABLE" },
  { id: "N17", domain: "INCIDENT", channels: ["SMS"], recipient: "CLIENT", bind: {"kind":"GEO","event":"incident_technician_en_route"}, vars: ["first_name","eta"], templateKey: "incident.technician_en_route", status: "STABLE" },
  { id: "N18", domain: "INCIDENT", channels: ["EMAIL"], recipient: "CLIENT", bind: {"kind":"DOMAIN","event":"incident_repaired"}, vars: ["first_name","order_number"], attachments: ["handover_protocol","invoice_if_out_of_warranty"], templateKey: "incident.repaired", status: "STABLE" },
  { id: "I1", domain: "INTERNAL", channels: ["EMAIL"], recipient: "DISPATCHER", bind: {"kind":"DOMAIN","event":"lead_created"}, vars: ["order_number","first_name","address"], templateKey: "internal.new_lead", status: "STABLE" },
  { id: "I2", domain: "INTERNAL", channels: ["SMS","EMAIL"], recipient: "DISPATCHER", bind: {"kind":"TRANSITION","transition":"T03"}, vars: ["first_name","order_number","total_price"], templateKey: "internal.quote_accepted", status: "STABLE" },
  { id: "I3", domain: "INTERNAL", channels: ["SMS"], recipient: "CREW", bind: {"kind":"TRANSITION","transition":"T05"}, vars: ["address","date","time"], templateKey: "internal.crew_task_assigned", status: "STABLE" },
  { id: "I4", domain: "INTERNAL", channels: ["EMAIL"], recipient: "DISPATCHER", bind: {"kind":"TRANSITION","transition":"T10|T11|T12|T13"}, vars: ["order_number","first_name"], templateKey: "internal.rollback", status: "STABLE" },
  { id: "I5", domain: "INTERNAL", channels: ["PUSH"], recipient: "AUDITOR", bind: {"kind":"TRANSITION","transition":"T01"}, vars: ["order_number","address","date"], templateKey: "internal.auditor_task_assigned", status: "STABLE" },
  { id: "I6", domain: "INTERNAL", channels: ["EMAIL"], recipient: "ADMIN", bind: {"kind":"CRON","schedule":"30d_before_cert_expiry"}, vars: ["assignee","certificate_type","valid_until"], templateKey: "internal.cert_expiring", status: "STABLE" },
  { id: "I7", domain: "INTERNAL", channels: ["PUSH"], recipient: "DISPATCHER", bind: {"kind":"DOMAIN","event":"incident_critical_created"}, vars: ["order_number","first_name","address"], templateKey: "internal.incident_critical", status: "STABLE" },
] as const;

export const QUEUE_POLICY = {
  "sendWindow": {
    "SMS": {
      "from": "08:00",
      "to": "18:00"
    },
    "EMAIL": {
      "from": "00:00",
      "to": "23:59"
    },
    "PUSH": {
      "from": "00:00",
      "to": "23:59"
    }
  },
  "timezone": "Europe/Warsaw",
  "maxAttempts": 5,
  "backoff": "exponential",
  "backoffBaseSeconds": 60,
  "deadLetterAfterAttempts": 5,
  "requiresIdempotencyKey": true,
  "statuses": [
    "PENDING",
    "SENDING",
    "SENT",
    "ERROR",
    "DEAD_LETTER"
  ],
  "claimTransition": {
    "from": "PENDING",
    "to": "SENDING",
    "req": [
      "NTF-QUEUE-CLAIM"
    ]
  },
  "persistsRenderedBody": true,
  "templateSource": "message_templates",
  "note": "ADR-007 rozstrzygnięte 2026-08-18: notification_queue ma attempts, last_error, next_attempt_at, dead_lettered_at oraz unikalny idempotency_key. Status DEAD_LETTER jest osobny od ERROR. ROZSZERZENIE 2026-09-24 (decyzje Michała): (1) słownik statusów przeniesiony z migracji do kontraktu i rozszerzony o SENDING — stan przejęcia wiersza, bez którego dwa równoległe zamiatacze wysyłają ten sam SMS dwa razy (NTF-QUEUE-CLAIM); (2) wiersz kolejki zapisuje WYRENDEROWANĄ treść i wersję szablonu w chwili kolejkowania (NTF-QUEUE-RENDERED-BODY), bo po przeniesieniu szablonów do edytowalnej tabeli message_templates treści nie da się już odtworzyć z gita; (3) szablony mieszkają w bazie, nie w stałej TypeScript (NTF-TEMPLATE-STORE). Zamiatacz kolejki jest zdarzeniowo NIEZALEŻNY od kolejkowania — wysyłkę wyzwala pg_cron po stronie Supabase (NTF-DISPATCH-CRON), bo okno 08:00-18:00, ponowienia z narastającym odstępem i zakaz wołania zewnętrznego API w transakcji biznesowej to trzy powody, dla których zdarzenie domenowe nie wystarcza."
} as const;

export function notificationsForTransition(transitionId: string): NotificationDef[] {
  return NOTIFICATIONS.filter((n) => n.bind.kind === 'TRANSITION' && String(n.bind.transition).split('|').includes(transitionId));
}

export function byId(id: NotificationId): NotificationDef {
  const found = NOTIFICATIONS.find((n) => n.id === id);
  if (!found) throw new Error(`Nieznane powiadomienie: ${id}`);
  return found;
}
