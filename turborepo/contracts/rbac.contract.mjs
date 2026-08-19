/**
 * KONTRAKT: Role, uprawnienia i zasady RODO.
 * Źródła: b2b_app_requirements.md (Epic 5), database_model.md (§4), b2b_crm_specifications.md (globalne „Usuń")
 *
 * Zasada nadrzędna: DELETE w każdym widoku CRM = wyłącznie rola `admin`,
 * egzekwowane w TRZECH warstwach (UI, Server Action, RLS). Test kontraktowy sprawdza wszystkie trzy.
 */

export const ROLES = ['admin', 'dyspozytor', 'audytor', 'monter'];

export const RESOURCES = [
  'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
  'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates', 'authorized_users', 'audit_log',
  // ── ADR-012 (2026-08-18) ──
  'bookings', 'absences', 'regions', 'documents', 'invoices', 'contact_log', 'notes', 'vehicles', 'soft_leads',
];

/** capability: read | create | update | delete | assign */
export const MATRIX = [
  { resource: 'clients',            read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'leads',              read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin'] },
  { resource: 'quotes',             read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['audytor', 'admin'],    update: ['audytor:own', 'admin'], delete: ['admin'] },
  { resource: 'installations',      read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'services',           read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'incidents',          read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'auditors',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'crews',              read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'shipments',          read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'notification_queue', read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'message_templates',  read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'authorized_users',   read: ['admin'],                                   create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },
  // ── ADR-012: zasoby dodane 2026-08-18 ──
  // Klient rezerwuje termin przez publiczny link z tokenem, a nie jako rola w RBAC — nie ma konta
  // w authorized_users. Ta ścieżka jest osobnym, wąskim endpointem z własnym guardem, nie wpisem w macierzy.
  { resource: 'bookings',           read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin', 'dyspozytor'] },
  { resource: 'absences',           read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'regions',            read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'documents',          read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor', 'audytor', 'monter'], update: ['admin'], delete: ['admin'] },
  { resource: 'invoices',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'contact_log',        read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: [],                      delete: ['admin'] },
  { resource: 'notes',              read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'vehicles',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'soft_leads',         read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
];

/** Polityki kluczy obcych przy usuwaniu — database_model.md §4.2 */
export const DELETE_POLICIES = [
  { entity: 'clients',   strategy: 'ANONYMIZE_OR_SET_NULL', rationale: 'RODO bez utraty historii finansowej montażu.', cascades: [] },
  { entity: 'leads',     strategy: 'CASCADE',               rationale: 'Duplikat/błąd systemowy — encje zależne w trakcie tworzenia idą w kaskadzie.', cascades: ['quotes', 'shipments'] },
  { entity: 'auditors',  strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie wiszących leadów.', cascades: [] },
  { entity: 'crews',     strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie aktywnych instalacji.', cascades: [] },
];

/**
 * Wymogi audytowe (ADR-008, rozstrzygnięte 2026-08-18).
 * Tabela audit_log jest append-only — RLS odrzuca UPDATE i DELETE dla wszystkich ról,
 * łącznie z admin. Rejestr, który administrator może poprawić, nie jest dowodem niczego.
 */
export const AUDIT_REQUIREMENTS = {
  appendOnly: true,
  mustLog: ['delete', 'anonymize', 'role_change', 'contract_override', 'manual_status_change', 'notification_resend'],
  legalBases: ['RODO_ERASURE_REQUEST', 'OPERATIONAL_ERROR', 'DUPLICATE', 'COURT_ORDER', 'OTHER'],
  requiresJustification: true,
  retentionDays: 1825,
  status: 'STABLE',
};
