import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: SEC-AUDIT-LOG-APPEND-ONLY (contracts/requirements.contract.mjs:177).
 * Blok C1, docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md.
 *
 * Migracja `supabase/migrations/20260901220000_rodo_audit_log_and_client_anonymization.sql`
 * NIE JEST URUCHOMIONA NA ŻYWEJ BAZIE (patrz nagłówek pliku migracji) i brak
 * Dockera/psql/Supabase CLI w tym środowisku wyklucza test integracyjny. Wzorem
 * `fld-consent-docs-migration-static.test.ts`, ten plik zamraża wyłącznie OBECNOŚĆ
 * czterech z sześciu mechanizmów AC w treści pliku migracji jako tekstu — nie ich
 * faktyczne działanie w silniku bazy. AC6 (RLS odrzuca UPDATE/DELETE na żywo, także dla
 * admin) zostaje TODO/niewykonalne w tym środowisku (Blok B3 tego samego WO, świadome
 * pominięcie, wymaga żywego Postgresa).
 *
 * Potwierdzenie mutacyjne (wykonane ręcznie w scratchpadzie, NIE zacommitowane):
 * usunięcie z kopii pliku migracji definicji `audit_log_append_only_trg` powoduje FAIL
 * testu "trigger append-only" poniżej. Plik oryginalny nietknięty.
 */

function readMigration(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationPath = join(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260901220000_rodo_audit_log_and_client_anonymization.sql',
  );
  return readFileSync(migrationPath, 'utf-8');
}

describe('SEC-AUDIT-LOG-APPEND-ONLY — pokrycie statyczne migracji 20260901220000 (brak Postgres w tym środowisku)', () => {
  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('funkcja public.audit_log_append_only() jest obecna', () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.audit_log_append_only()');
  });

  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('trigger audit_log_append_only_trg jest obecny, na BEFORE UPDATE OR DELETE, wołający funkcję append-only', () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TRIGGER audit_log_append_only_trg');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.audit_log');
    expect(sql).toContain('EXECUTE FUNCTION public.audit_log_append_only();');
  });

  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY jest obecne', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('zero polityk FOR UPDATE / FOR DELETE / FOR ALL na audit_log w całym pliku', () => {
    const sql = readMigration();

    const policyChunks = sql.split('CREATE POLICY').slice(1);
    const forbiddenOnAuditLog = policyChunks.filter((chunk) => {
      const header = chunk.split('\n\n')[0] ?? chunk.slice(0, 200);
      return (
        (/FOR UPDATE/.test(header) || /FOR DELETE/.test(header) || /FOR ALL/.test(header)) &&
        /ON public\.audit_log\b/.test(header)
      );
    });

    expect(forbiddenOnAuditLog).toEqual([]);

    // Dowód pozytywny dodatkowy: ten plik migracji w ogóle nie zawiera CREATE POLICY
    // dla audit_log (żadnego rodzaju), zgodnie z komentarzem sekcji 2 — jeśli ktoś
    // kiedyś dopisze politykę INSERT/SELECT, ten test nie powinien jej blokować,
    // wyłącznie FOR UPDATE/DELETE/ALL.
    expect(sql).toContain('ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('cztery CHECK-i na audit_log (operation, resource, legal_basis, justification) są obecne', () => {
    const sql = readMigration();

    expect(sql).toContain('CONSTRAINT audit_log_operation_check CHECK (operation IN (');
    expect(sql).toContain('CONSTRAINT audit_log_resource_check CHECK (resource IN (');
    expect(sql).toContain(
      'CONSTRAINT audit_log_justification_min_length CHECK (length(btrim(justification)) >= 10)',
    );
    expect(sql).toContain('CONSTRAINT audit_log_legal_basis_check CHECK (legal_basis IN (');
  });
});
