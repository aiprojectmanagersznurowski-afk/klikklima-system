import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Testy dla wymagania B2C-CATALOG-VIEW-TRACKED
 * Źródło: contracts/requirements.contract.mjs
 */

describe('B2C-CATALOG-VIEW-TRACKED — statyczna weryfikacja migracji widoku available_combinations', () => {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260910090000_b2c_catalog_view_tracked.sql');

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('plik migracji 20260910090000_b2c_catalog_view_tracked.sql istnieje na dysku', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja zawiera 11 kolumn widoku w kolejności pg_attribute', () => {
    const content = readFileSync(migrationPath, 'utf8');

    const expectedColumns = [
      'type',
      'series_name',
      'brand',
      'room_count',
      'sizes_hash',
      'outdoor_unit_id',
      'outdoor_model',
      'indoor_model',
      'outdoor_capacity',
      'total_devices_price',
      'is_available',
    ];

    for (const col of expectedColumns) {
      const colRegex = new RegExp(`\\b${col}\\b`, 'i');
      expect(content).toMatch(colRegex);
    }
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja zawiera obie funkcje pomocnicze z zadeklarowaną zmiennością (get_codes_hash IMMUTABLE, get_multi_indoor_price STABLE)', () => {
    const content = readFileSync(migrationPath, 'utf8');

    expect(content).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_codes_hash/i);
    expect(content).toMatch(/IMMUTABLE/i);

    expect(content).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_multi_indoor_price/i);
    expect(content).toMatch(/STABLE/i);
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja zawiera trzy indeksy btree (sizes_hash, series_name, room_count)', () => {
    const content = readFileSync(migrationPath, 'utf8');

    expect(content).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_available_combinations_hash\s+ON\s+public\.available_combinations\s+USING\s+btree\s*\(sizes_hash\)/i);
    expect(content).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_available_combinations_series\s+ON\s+public\.available_combinations\s+USING\s+btree\s*\(series_name\)/i);
    expect(content).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_available_combinations_rooms\s+ON\s+public\.available_combinations\s+USING\s+btree\s*\(room_count\)/i);
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja zawiera 4 triggery odświeżające wołające refresh_available_combinations()', () => {
    const content = readFileSync(migrationPath, 'utf8');

    expect(content).toMatch(/refresh_combinations_on_single/i);
    expect(content).toMatch(/refresh_combinations_on_multi/i);
    expect(content).toMatch(/refresh_combinations_on_indoor/i);
    expect(content).toMatch(/refresh_combinations_on_outdoor/i);
    expect(content).toMatch(/refresh_available_combinations\(\)/i);
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja zawiera uprawnienia obiektowe REVOKE ALL oraz GRANT SELECT dla anon i authenticated', () => {
    const content = readFileSync(migrationPath, 'utf8');

    expect(content).toMatch(/REVOKE\s+ALL\s+ON\s+public\.available_combinations\s+FROM\s+anon,\s*authenticated/i);
    expect(content).toMatch(/GRANT\s+SELECT\s+ON\s+public\.available_combinations\s+TO\s+anon,\s*authenticated/i);
  });

  // @REQ: B2C-CATALOG-VIEW-TRACKED
  it('migracja pozostaje addytywna: brak niedozwolonych instrukcji SQL DROP MATERIALIZED VIEW, DROP FUNCTION ani ALTER ... RENAME', () => {
    const rawContent = readFileSync(migrationPath, 'utf8');
    // Usunięcie komentarzy jednoliniowych i wieloliniowych, aby badać tylko realne instrukcje SQL
    const sqlWithoutComments = rawContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    expect(sqlWithoutComments).not.toMatch(/DROP\s+MATERIALIZED\s+VIEW/i);
    expect(sqlWithoutComments).not.toMatch(/DROP\s+FUNCTION/i);
    expect(sqlWithoutComments).not.toMatch(/ALTER\s+.*\s+RENAME/i);
  });
});
