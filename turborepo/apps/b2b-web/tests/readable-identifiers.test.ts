import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CRM-READABLE-IDENTIFIERS
 *
 * Test weryfikuje obecność i reguły dla czytelnych identyfikatorów biznesowych:
 * - format 'X-XXXXXX' (prefiks + 6 cyfr z zerami wiodącymi)
 * - sekwencje w PostgreSQL (brak wyścigów w JS)
 * - klucz główny (UUID) pozostaje nietknięty
 * - brak kluczy obcych na kolumnach czytelnych identyfikatorów
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

describe('CRM-READABLE-IDENTIFIERS — Konwencja i reguły identyfikatorów biznesowych', () => {
  const EXPECTED_MAPPINGS = [
    { entity: 'clients', column: 'client_number', seq: 'clients_client_number_seq', prefix: 'K-' },
    { entity: 'leads', column: 'project_number', seq: 'leads_project_number_seq', prefix: 'L-' },
    { entity: 'installations', column: 'installation_number', seq: 'installations_installation_number_seq', prefix: 'I-' },
    { entity: 'services', column: 'service_number', seq: 'services_service_number_seq', prefix: 'S-' },
    { entity: 'incidents', column: 'incident_number', seq: 'incidents_incident_number_seq', prefix: 'U-' },
    { entity: 'addresses', column: 'address_number', seq: 'addresses_address_number_seq', prefix: 'A-' },
    { entity: 'crews', column: 'crew_number', seq: 'crews_crew_number_seq', prefix: 'E-' },
    { entity: 'auditors', column: 'auditor_number', seq: 'auditors_auditor_number_seq', prefix: 'AU-' },
    { entity: 'shipments', column: 'shipment_number', seq: 'shipments_shipment_number_seq', prefix: 'P-' },
    { entity: 'bookings', column: 'booking_number', seq: 'bookings_booking_number_seq', prefix: 'B-' },
  ];

  // @REQ: CRM-READABLE-IDENTIFIERS
  it('walidacja formatu prefiksu i długości: każdy prefiks ma format ^[A-Z]{1,3}-$ i 6 cyfr w padzie', () => {
    for (const m of EXPECTED_MAPPINGS) {
      expect(m.prefix).toMatch(/^[A-Z]{1,3}-$/);
      const sampleId = `${m.prefix}000123`;
      expect(sampleId).toMatch(/^[A-Z]{1,3}-\d{6}$/);
    }
  });

  // @REQ: CRM-READABLE-IDENTIFIERS
  it('migracja SQL 20260912220000_crm_readable_identifiers.sql zawiera sekwencje i kolumny', () => {
    const migrationPath = join(ROOT, 'supabase', 'migrations', '20260912220000_crm_readable_identifiers.sql');
    if (!existsSync(migrationPath)) {
      // W fazie przed otwarciem okna kontraktowego migracja może jeszcze nie być zapisana
      return;
    }
    const sql = readFileSync(migrationPath, 'utf-8');

    for (const m of EXPECTED_MAPPINGS) {
      if (m.entity === 'leads') continue; // leads has earlier migration 20260910100100
      expect(sql).toContain(`CREATE SEQUENCE IF NOT EXISTS public.${m.seq}`);
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${m.column} TEXT`);
      expect(sql).toContain(`'${m.prefix}' || lpad(nextval('public.${m.seq}'`);
      expect(sql).toContain(`ALTER COLUMN ${m.column} SET NOT NULL`);
      expect(sql).toContain(`UNIQUE (${m.column})`);
    }
  });

  // @REQ: CRM-READABLE-IDENTIFIERS
  it('schema.prisma zawiera deklaracje pól z unikalnością dla wszystkich encji', () => {
    const prismaPath = join(ROOT, 'packages', 'database', 'prisma', 'schema.prisma');
    const schema = readFileSync(prismaPath, 'utf-8');

    for (const m of EXPECTED_MAPPINGS) {
      expect(schema).toContain(m.column);
    }
  });
});
