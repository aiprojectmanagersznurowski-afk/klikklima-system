/**
 * KONTRAKT: Katalog powiadomień (SMS/Email/Push).
 * Źródło: docs/architecture/notification_definitions.md + b2b_funnel_process.md + complaints_process.md
 *
 * UWAGA — KOLIZJA ID NAPRAWIONA TUTAJ:
 * complaints_process.md używa N1..N4 dla reklamacji, podczas gdy notification_definitions.md
 * używa N1..N4 dla lejka, a reklamacje ma pod N15..N18. Kanonem jest notification_definitions.md.
 * complaints_process.md musi zostać przenumerowany (patrz ADR-003). Bez tego dwa różne szablony
 * dzielą jeden klucz i agent wyśle klientowi złą treść.
 */

export const CHANNELS = ['SMS', 'EMAIL', 'PUSH'];
export const RECIPIENTS = ['CLIENT', 'DISPATCHER', 'AUDITOR', 'CREW', 'ADMIN'];
export const DOMAINS = ['FUNNEL', 'SERVICE', 'INCIDENT', 'INTERNAL'];

/**
 * bind.kind:
 *  'TRANSITION' — wyzwalane przejściem stanu (bind.transition = id z funnel.contract.mjs)
 *  'CRON'       — harmonogram (bind.schedule opisuje regułę)
 *  'GEO'        — Field App: „Wyruszam" / wejście w promień
 *  'WEBHOOK'    — zewnętrzny callback
 *  'DOMAIN'     — zdarzenie domenowe poza lejkiem (serwisy, usterki)
 */
export const NOTIFICATIONS = [
  // ---- Lejek ----
  { id: 'N1',  domain: 'FUNNEL', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T01' }, vars: ['first_name', 'order_number'], templateKey: 'funnel.auditor_assigned', status: 'STABLE' },
  { id: 'N2',  domain: 'FUNNEL', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'CRON', schedule: '24h_before_audit' }, vars: ['first_name', 'time', 'address', 'link'], templateKey: 'funnel.audit_reminder_24h', status: 'STABLE' },
  { id: 'N3',  domain: 'FUNNEL', channels: ['SMS'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'auditor_en_route' }, vars: ['first_name', 'eta'], templateKey: 'funnel.auditor_en_route', status: 'STABLE' },
  { id: 'N4',  domain: 'FUNNEL', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T02' }, vars: ['first_name', 'link', 'total_price'], templateKey: 'funnel.quote_ready', status: 'STABLE' },
  { id: 'N5',  domain: 'FUNNEL', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T06' }, vars: ['first_name', 'tracking_id'], templateKey: 'funnel.shipped', status: 'STABLE' },
  { id: 'N6',  domain: 'FUNNEL', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'CRON', schedule: '24h_before_installation' }, vars: ['first_name', 'time', 'address', 'link'], templateKey: 'funnel.install_reminder_24h', status: 'STABLE' },
  { id: 'N7',  domain: 'FUNNEL', channels: ['SMS'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'crew_en_route' }, vars: ['first_name', 'eta'], templateKey: 'funnel.crew_en_route', status: 'STABLE' },
  { id: 'N8',  domain: 'FUNNEL', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T09' }, vars: ['first_name', 'order_number'], attachments: ['warranty_card', 'handover_protocol', 'invoice'], templateKey: 'funnel.install_completed', status: 'STABLE' },
  { id: 'N8a', domain: 'FUNNEL', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T17' }, vars: ['first_name', 'order_number', 'link'], attachments: ['invoice_phase_1'], templateKey: 'funnel.install_phase1_completed', status: 'STABLE', note: 'ADR-005: etap I zamknięty. Załącznik z fakturą za etap I, link do rezerwacji etapu II. ZAWĘŻENIE 2026-09-16 (WO FNL-2PHASE-BOOKING-MECHANICS, decyzja Michała D3, analogiczne do usunięcia do:issuePhaseOneInvoice z T17): dopóki FNL-2PHASE-INVOICE jest odłożone, N8a wysyłane jest BEZ załącznika invoice_phase_1 — faktury nie ma czym wygenerować, tabela invoices nie istnieje. Pole attachments ZOSTAJE, bo jest nośnikiem kryterium 2 wymagania FNL-2PHASE-INVOICE; jego usunięcie skasowałoby jedyny zapis tej zależności w katalogu i jest osobną decyzją. Jedyny `link` jest w tym zakresie linkiem DO REZERWACJI ETAPU II, nie do płatności — rozdzielenie na booking_link i payment_link należy do FNL-2PHASE-INVOICE.' },

  { id: 'N_REJECT',   domain: 'FUNNEL', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T04' }, vars: ['first_name', 'link', 'order_number'], templateKey: 'funnel.quote_expired', status: 'STABLE' },
  { id: 'N_ROLLBACK', domain: 'FUNNEL', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'TRANSITION', transition: 'T10|T11|T12|T13' }, vars: ['first_name', 'link', 'order_number'], templateKey: 'funnel.rollback_rebook', status: 'STABLE' },

  // ---- Serwisy ----
  { id: 'N10', domain: 'SERVICE', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'CRON', schedule: 'x_days_before_service' }, vars: ['first_name', 'link', 'date'], templateKey: 'service.reminder', status: 'STABLE' },
  { id: 'N11', domain: 'SERVICE', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'DOMAIN', event: 'service_technician_assigned' }, vars: ['first_name', 'order_number'], templateKey: 'service.technician_assigned', status: 'STABLE' },
  { id: 'N12', domain: 'SERVICE', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'CRON', schedule: '24h_before_service' }, vars: ['first_name', 'time', 'link'], templateKey: 'service.reminder_24h', status: 'STABLE' },
  { id: 'N13', domain: 'SERVICE', channels: ['SMS'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'technician_en_route' }, vars: ['first_name', 'eta'], templateKey: 'service.technician_en_route', status: 'STABLE' },
  { id: 'N14', domain: 'SERVICE', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'DOMAIN', event: 'service_completed' }, vars: ['first_name', 'order_number'], attachments: ['handover_protocol', 'invoice'], templateKey: 'service.completed', status: 'STABLE' },

  // ---- Usterki / reklamacje (kanoniczne ID: N15..N18) ----
  { id: 'N15', domain: 'INCIDENT', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'DOMAIN', event: 'incident_received' }, vars: ['first_name', 'link', 'order_number'], templateKey: 'incident.received', status: 'STABLE' },
  { id: 'N16', domain: 'INCIDENT', channels: ['SMS', 'EMAIL'], recipient: 'CLIENT', bind: { kind: 'DOMAIN', event: 'incident_technician_assigned' }, vars: ['first_name', 'order_number'], templateKey: 'incident.technician_assigned', status: 'STABLE' },
  { id: 'N17', domain: 'INCIDENT', channels: ['SMS'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'incident_technician_en_route' }, vars: ['first_name', 'eta'], templateKey: 'incident.technician_en_route', status: 'STABLE' },
  { id: 'N18', domain: 'INCIDENT', channels: ['EMAIL'], recipient: 'CLIENT', bind: { kind: 'DOMAIN', event: 'incident_repaired' }, vars: ['first_name', 'order_number'], attachments: ['handover_protocol', 'invoice_if_out_of_warranty'], templateKey: 'incident.repaired', status: 'STABLE' },

  // ---- Wewnętrzne ----
  { id: 'I1', domain: 'INTERNAL', channels: ['EMAIL'], recipient: 'DISPATCHER', bind: { kind: 'DOMAIN', event: 'lead_created' }, vars: ['order_number', 'first_name', 'address'], templateKey: 'internal.new_lead', status: 'STABLE' },
  { id: 'I2', domain: 'INTERNAL', channels: ['SMS', 'EMAIL'], recipient: 'DISPATCHER', bind: { kind: 'TRANSITION', transition: 'T03' }, vars: ['first_name', 'order_number', 'total_price'], templateKey: 'internal.quote_accepted', status: 'STABLE' },
  { id: 'I3', domain: 'INTERNAL', channels: ['SMS'], recipient: 'CREW', bind: { kind: 'TRANSITION', transition: 'T05' }, vars: ['address', 'date', 'time'], templateKey: 'internal.crew_task_assigned', status: 'STABLE' },
  { id: 'I4', domain: 'INTERNAL', channels: ['EMAIL'], recipient: 'DISPATCHER', bind: { kind: 'TRANSITION', transition: 'T10|T11|T12|T13' }, vars: ['order_number', 'first_name'], templateKey: 'internal.rollback', status: 'STABLE' },

  // LUKA: sequence diagram w b2b_funnel_process.md pokazuje `S-->>A: [Push] Nowe zlecenie audytu`,
  // ale notification_definitions.md nie ma takiego wpisu. Bez niego audytor nie wie o przypisaniu.
  { id: 'I5', domain: 'INTERNAL', channels: ['PUSH'], recipient: 'AUDITOR', bind: { kind: 'TRANSITION', transition: 'T01' }, vars: ['order_number', 'address', 'date'], templateKey: 'internal.auditor_task_assigned', status: 'STABLE', note: 'ADR-006 rozstrzygnięte 2026-08-18. Push do aplikacji audytora przy przypisaniu leada (T01).' },

  // LUKA: CRM §5 i §6 wymagają alertu 30 dni przed wygaśnięciem F-Gaz/SEP — brak w słowniku.
  { id: 'I6', domain: 'INTERNAL', channels: ['EMAIL'], recipient: 'ADMIN', bind: { kind: 'CRON', schedule: '30d_before_cert_expiry' }, vars: ['assignee', 'certificate_type', 'valid_until'], templateKey: 'internal.cert_expiring', status: 'STABLE', note: 'ADR-006 rozstrzygnięte 2026-08-18. Cron 30 dni przed wygaśnięciem F-Gaz lub SEP, osobno dla każdej osoby.' },

  // LUKA: CRM §4 wymaga natychmiastowego PUSH do dyspozytora dla usterki krytycznej.
  { id: 'I7', domain: 'INTERNAL', channels: ['PUSH'], recipient: 'DISPATCHER', bind: { kind: 'DOMAIN', event: 'incident_critical_created' }, vars: ['order_number', 'first_name', 'address'], templateKey: 'internal.incident_critical', status: 'STABLE', note: 'ADR-006 rozstrzygnięte 2026-08-18. Push do dyspozytora natychmiast po zgłoszeniu usterki krytycznej — start zegara SLA 48h.' },
];

/** Parametryzacja kolejki (notification_queue). Źródło: b2b_app_requirements.md Epic 4. */
export const QUEUE_POLICY = {
  sendWindow: { SMS: { from: '08:00', to: '18:00' }, EMAIL: { from: '00:00', to: '23:59' }, PUSH: { from: '00:00', to: '23:59' } },
  timezone: 'Europe/Warsaw',
  maxAttempts: 5,
  backoff: 'exponential',
  backoffBaseSeconds: 60,
  deadLetterAfterAttempts: 5,
  requiresIdempotencyKey: true,
  note: 'ADR-007 rozstrzygnięte 2026-08-18: notification_queue ma attempts, last_error, next_attempt_at, dead_lettered_at oraz unikalny idempotency_key. Status DEAD_LETTER jest osobny od ERROR.',
};
