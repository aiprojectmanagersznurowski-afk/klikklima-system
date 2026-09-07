import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLES } from '@klikklima/contracts';

/**
 * Wymaganie: SEC-AUTHZ-DEFAULT-ROLE (contracts/requirements.contract.mjs:480-492).
 * docs/workorders/SEC-AUTHZ-DEFAULT-ROLE.md, AC1 i AC3.
 *
 * Migracja `supabase/migrations/20260907173000_security_authorized_user_role_no_default.sql`
 * NIE JEST URUCHOMIONA NA ŻYWEJ BAZIE (patrz nagłówek pliku migracji) — brak Dockera/psql/
 * Supabase CLI w tym środowisku wyklucza test integracyjny wykonujący realny INSERT. Wzorem
 * `sec-audit-log-append-only-migration-static.test.ts`, ten plik zamraża wyłącznie TREŚĆ
 * `schema.prisma` (AC1) i pliku migracji (AC3) jako tekstu — nie ich faktyczne działanie
 * w silniku bazy. AC4 (weryfikacja żywej bazy) jest już zamknięte wcześniej w tej sesji,
 * poza zakresem tego testu. AC2 (nieregresja `addAuthorizedUser`) jest pokryte przez
 * istniejący `settings-authorized-users.test.ts`, nie duplikujemy go tutaj.
 *
 * Lista czterech ról jest importowana z `@klikklima/contracts` (wygenerowane z
 * `contracts/rbac.contract.mjs`), NIE hardkodowana — jeśli `ROLES` się kiedyś zmieni,
 * ten test wykryje niespójność między kontraktem JS i treścią CHECK w pliku SQL jako
 * FAIL, a nie przejdzie milcząco.
 */

function readSchema(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(__dirname, '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma');
  return readFileSync(schemaPath, 'utf-8');
}

function readMigration(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationPath = join(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260907173000_security_authorized_user_role_no_default.sql',
  );
  return readFileSync(migrationPath, 'utf-8');
}

/** Wycina treść bloku `model AuthorizedUser { ... }` z pliku schema.prisma. */
function extractAuthorizedUserModel(schema: string): string {
  const start = schema.indexOf('model AuthorizedUser {');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = schema.indexOf('}', start);
  expect(end).toBeGreaterThan(start);
  return schema.slice(start, end + 1);
}

describe('SEC-AUTHZ-DEFAULT-ROLE — pokrycie statyczne schema.prisma i migracji 20260907173000 (brak Postgres w tym środowisku)', () => {
  // @REQ: SEC-AUTHZ-DEFAULT-ROLE
  it('AC1: model AuthorizedUser istnieje i jego pole role nie zawiera żadnego @default', () => {
    const schema = readSchema();
    const model = extractAuthorizedUserModel(schema);

    const roleLine = model
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('role '));

    expect(roleLine).toBeDefined();
    expect(roleLine).not.toContain('@default');
    // Dowód pozytywny: pole role wciąż jest obecne i wciąż typu String (bez `?`, czyli NOT NULL).
    expect(roleLine).toMatch(/^role\s+String\s*$/);
  });

  // @REQ: SEC-AUTHZ-DEFAULT-ROLE
  it('AC1: cały model AuthorizedUser nie zawiera literału @default("admin")', () => {
    const schema = readSchema();
    const model = extractAuthorizedUserModel(schema);

    expect(model).not.toContain('@default("admin")');
  });

  // @REQ: SEC-AUTHZ-DEFAULT-ROLE
  it('AC3: migracja zawiera ALTER COLUMN role DROP DEFAULT na tabeli AuthorizedUser', () => {
    const sql = readMigration();

    expect(sql).toContain('ALTER TABLE public."AuthorizedUser" ALTER COLUMN role DROP DEFAULT;');
  });

  // @REQ: SEC-AUTHZ-DEFAULT-ROLE
  it('AC3: migracja zawiera CHECK authorized_user_role_check z dokładnie czterema wartościami z ROLES kontraktu', () => {
    const sql = readMigration();

    expect(sql).toContain('CONSTRAINT authorized_user_role_check');

    // Wycinamy definicję CHECK-a: od nazwy constraintu do zamykającego `);` tej klauzuli.
    const checkStart = sql.indexOf('CHECK (role IN (', sql.indexOf('CONSTRAINT authorized_user_role_check'));
    expect(checkStart).toBeGreaterThanOrEqual(0);
    const checkEnd = sql.indexOf(');', checkStart);
    expect(checkEnd).toBeGreaterThan(checkStart);
    const checkClause = sql.slice(checkStart, checkEnd);

    // ROLES importowane z @klikklima/contracts (wygenerowane z contracts/rbac.contract.mjs) —
    // jeśli lista ról się zmieni, ten test wykryje dryf między kontraktem JS a treścią SQL.
    expect(ROLES).toHaveLength(4);
    for (const role of ROLES) {
      expect(checkClause).toContain(`'${role}'`);
    }

    // Dowód, że w klauzuli nie ma NIC więcej niż te cztery wartości: liczba wystąpień
    // apostrofowanych literałów w klauzuli równa się dokładnie liczbie ról z kontraktu.
    const literalMatches = checkClause.match(/'[a-z_]+'/g) ?? [];
    expect(literalMatches).toHaveLength(ROLES.length);
  });

  // @REQ: SEC-AUTHZ-DEFAULT-ROLE
  it('AC3: migracja jest jawnie oznaczona jako NIEZAAPLIKOWANA na żywej bazie', () => {
    const sql = readMigration();

    expect(sql).toContain('TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE');
  });
});
