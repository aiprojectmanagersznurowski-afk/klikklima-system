// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const ROLES = ["admin", "dyspozytor", "audytor", "monter"] as const;
export type Role = (typeof ROLES)[number];

export type Capability = 'read' | 'create' | 'update' | 'delete' | 'assign';

export const PERMISSIONS: Record<string, Partial<Record<Capability, string[]>>> = {
  clients: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"] },
  leads: { read: ["admin","dyspozytor","audytor:own"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"], assign: ["admin"] },
  quotes: { read: ["admin","dyspozytor","audytor:own"], create: ["audytor","admin"], update: ["audytor:own","admin"], delete: ["admin"] },
  installations: { read: ["admin","dyspozytor","monter:own"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor","monter:own"], delete: ["admin"] },
  services: { read: ["admin","dyspozytor","monter:own"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor","monter:own"], delete: ["admin"] },
  incidents: { read: ["admin","dyspozytor","monter:own"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor","monter:own"], delete: ["admin"] },
  auditors: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  crews: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  shipments: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"] },
  notification_queue: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin","dyspozytor"], delete: ["admin"] },
  message_templates: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  authorized_users: { read: ["admin"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  audit_log: { read: ["admin"], create: ["admin"], update: [], delete: [] },
  bookings: { read: ["admin","dyspozytor","audytor:own","monter:own"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"], assign: ["admin","dyspozytor"] },
  absences: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"] },
  regions: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  documents: { read: ["admin","dyspozytor","audytor:own","monter:own"], create: ["admin","dyspozytor","audytor","monter"], update: ["admin"], delete: ["admin"] },
  invoices: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  contact_log: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: [], delete: ["admin"] },
  notes: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"] },
  vehicles: { read: ["admin","dyspozytor"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  soft_leads: { read: ["admin","dyspozytor"], create: ["admin","dyspozytor"], update: ["admin","dyspozytor"], delete: ["admin"] },
  availability_declarations: { read: ["admin","dyspozytor","audytor:own","monter:own"], create: ["admin","audytor:own","monter:own"], update: ["admin","audytor:own","monter:own"], delete: ["admin"] },
  legal_document_versions: { read: ["admin","dyspozytor","audytor","monter"], create: ["admin"], update: ["admin"], delete: ["admin"] },
  employee_consents: { read: ["admin","audytor:own","monter:own"], create: ["audytor","monter"], update: [], delete: [] },
  availability_rules: { read: ["admin","dyspozytor","audytor:own","monter:own"], create: ["admin","audytor:own","monter:own"], update: ["admin","audytor:own","monter:own"], delete: ["admin"] },
  visit_duration_baskets: { read: ["admin","dyspozytor","audytor","monter"], create: ["admin"], update: ["admin"], delete: ["admin"] },
};

export const DELETE_POLICIES = [
  {
    "entity": "clients",
    "strategy": "ANONYMIZE_OR_SET_NULL",
    "rationale": "RODO bez utraty historii finansowej montażu.",
    "cascades": []
  },
  {
    "entity": "leads",
    "strategy": "CASCADE",
    "rationale": "Duplikat/błąd systemowy — encje zależne w trakcie tworzenia idą w kaskadzie.",
    "cascades": [
      "quotes",
      "shipments"
    ]
  },
  {
    "entity": "auditors",
    "strategy": "BLOCK_UNTIL_REASSIGNED",
    "rationale": "Wymusza przepięcie wiszących leadów.",
    "cascades": []
  },
  {
    "entity": "crews",
    "strategy": "BLOCK_UNTIL_REASSIGNED",
    "rationale": "Wymusza przepięcie aktywnych instalacji.",
    "cascades": []
  }
] as const;

/**
 * Wymogi audytowe (ADR-008). Jedyne źródło dozwolonych wartości `operation`
 * i `legalBasis` — waliduj z tej stałej, nie z listy zakodowanej w Server Action.
 */
export const AUDIT_REQUIREMENTS = {
  "appendOnly": true,
  "mustLog": [
    "delete",
    "anonymize",
    "role_change",
    "contract_override",
    "manual_status_change",
    "notification_resend",
    "field_update"
  ],
  "legalBases": [
    "RODO_ERASURE_REQUEST",
    "OPERATIONAL_ERROR",
    "DUPLICATE",
    "COURT_ORDER",
    "OTHER"
  ],
  "requiresJustification": true,
  "retentionDays": 1825,
  "status": "STABLE"
} as const;

export type AuditOperation = (typeof AUDIT_REQUIREMENTS.mustLog)[number];
export type AuditLegalBasis = (typeof AUDIT_REQUIREMENTS.legalBases)[number];

/** `audytor:own` oznacza dostęp wyłącznie do własnych rekordów — sprawdź to w RLS, nie tylko tutaj. */
export function can(role: Role, resource: string, capability: Capability): 'no' | 'yes' | 'own' {
  const entry = PERMISSIONS[resource]?.[capability] ?? [];
  if (entry.includes(role)) return 'yes';
  if (entry.includes(`${role}:own`)) return 'own';
  return 'no';
}
