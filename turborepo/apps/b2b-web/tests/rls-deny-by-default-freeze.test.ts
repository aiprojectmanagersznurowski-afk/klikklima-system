import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: SEC-RLS-AUDITOR-SCOPE (contracts/requirements.contract.mjs) — AC10,
 * punkt 13 z docs/workorders/BATCH-MEDIUM-LOW-CLEANUP.md.
 *
 * Migracja `supabase/migrations/20260824185845_security_enable_rls_baseline.sql`
 * włącza RLS na `klienci`, `leady`, `adresy` z JEDYNĄ polityką: INSERT dla roli
 * `anon` (przepływ B2C Triage → saveLead). Żadna z tych trzech tabel nie ma
 * polityki SELECT — to jest stan pożądany (deny-by-default), nie luka.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny na żywym
 * Postgresie jest tu niewykonalny. Jedynym wykonalnym testem jest ASERCJA
 * STATYCZNA nad treścią pliku migracji jako tekstu — zamrożenie tego, co dziś
 * jest poprawnym stanem, żeby przyszła zmiana (np. dopisanie permisywnej
 * polityki SELECT) nie przeszła bez zauważenia.
 *
 * Potwierdzenie mutacyjne (wykonane ręcznie, NIE zacommitowane): dopisanie
 *   CREATE POLICY "tmp" ON public.leady FOR SELECT TO anon USING (true);
 * do pliku migracji powoduje FAIL testu AC13.2b poniżej (liczba wystąpień
 * `FOR SELECT` przy `leady` przechodzi z 0 na 1). Plik przywrócony do stanu
 * z git po weryfikacji.
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
    '20260824185845_security_enable_rls_baseline.sql',
  );
  return readFileSync(migrationPath, 'utf-8');
}

describe('RLS deny-by-default zamrożone na leady/klienci/adresy (SEC-RLS-AUDITOR-SCOPE, punkt 13)', () => {
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.1a: leady — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.1b: leady — zero wystąpień CREATE POLICY ... FOR SELECT na tej tabeli', () => {
    const sql = readMigration();
    // Blok policy dla `leady` w tym pliku ma dokładnie jedną politykę (INSERT anon).
    // Wycinamy blok od `ALTER TABLE public.leady ENABLE` do końca tego bloku (następna
    // pusta linia po CREATE POLICY), żeby nie złapać przypadkiem innej tabeli.
    const bloc = sql.slice(sql.indexOf('ALTER TABLE public.leady ENABLE ROW LEVEL SECURITY;'));
    const nextSectionIdx = bloc.indexOf('\n\n\n');
    const leadyBlock = nextSectionIdx === -1 ? bloc : bloc.slice(0, nextSectionIdx);

    expect(leadyBlock).toContain('FOR INSERT TO anon WITH CHECK (true);');
    expect((leadyBlock.match(/FOR SELECT/g) ?? []).length).toBe(0);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.2a: klienci — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.klienci ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.2b: klienci — zero wystąpień CREATE POLICY ... FOR SELECT na tej tabeli', () => {
    const sql = readMigration();
    const bloc = sql.slice(sql.indexOf('ALTER TABLE public.klienci ENABLE ROW LEVEL SECURITY;'));
    const nextSectionIdx = bloc.indexOf('\n\n\n');
    const klienciBlock = nextSectionIdx === -1 ? bloc : bloc.slice(0, nextSectionIdx);

    expect(klienciBlock).toContain('FOR INSERT TO anon WITH CHECK (true);');
    expect((klienciBlock.match(/FOR SELECT/g) ?? []).length).toBe(0);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.2c: adresy — ENABLE ROW LEVEL SECURITY jest obecne w migracji', () => {
    const sql = readMigration();
    expect(sql).toContain('ALTER TABLE public.adresy ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.2d: adresy — zero wystąpień CREATE POLICY ... FOR SELECT na tej tabeli', () => {
    const sql = readMigration();
    const bloc = sql.slice(sql.indexOf('ALTER TABLE public.adresy ENABLE ROW LEVEL SECURITY;'));
    const nextSectionIdx = bloc.indexOf('\n\n\n');
    const adresyBlock = nextSectionIdx === -1 ? bloc : bloc.slice(0, nextSectionIdx);

    expect(adresyBlock).toContain('FOR INSERT TO anon WITH CHECK (true);');
    expect((adresyBlock.match(/FOR SELECT/g) ?? []).length).toBe(0);
  });

  // Blok A3 (docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md): CRM-DELETE-ADMIN-ONLY-CLIENTS
  // wymaga usunięcia klientów WYŁĄCZNIE przez akcję serwerową bramkowaną `can(role,
  // 'clients','delete')` (patrz customers-anonymize-rodo.test.ts / customers-anonymize-ui.test.ts).
  // Żaden z testów AC13.x powyżej nie sprawdza tego wprost: liczą wyłącznie `FOR SELECT`.
  // Polityka `FOR DELETE`/`FOR ALL` na `klienci` dopisana do bloku sekcji 3 przeszłaby
  // wszystkie asercje AC13.2b/AC13.3 bez zauważenia — to jest realna luka w warstwie RLS,
  // zamykana dopiero tym testem.
  // @REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS
  it('AC-A3: public.klienci — zero polityk FOR DELETE / FOR ALL w bloku tabeli i w całym pliku', () => {
    const sql = readMigration();

    // Część 1: sam blok `klienci` (od jego ENABLE do kolejnego ALTER TABLE innej tabeli).
    const startMarker = 'ALTER TABLE public.klienci ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);
    const afterStart = sql.slice(startIdx + startMarker.length);
    const nextAlterIdx = afterStart.indexOf('ALTER TABLE');
    const klienciOnlyBlock = nextAlterIdx === -1 ? afterStart : afterStart.slice(0, nextAlterIdx);

    expect((klienciOnlyBlock.match(/FOR DELETE/g) ?? []).length).toBe(0);
    expect((klienciOnlyBlock.match(/FOR ALL/g) ?? []).length).toBe(0);

    // Część 2: w CAŁYM pliku żadna polityka FOR DELETE/FOR ALL nie wskazuje public.klienci,
    // niezależnie od tego, w którym miejscu pliku zostałaby dopisana.
    const policyChunks = sql.split('CREATE POLICY').slice(1);
    const deleteOrAllOnKlienci = policyChunks.filter((chunk) => {
      const header = chunk.split('\n\n')[0] ?? chunk.slice(0, 200);
      return (
        (/FOR DELETE/.test(header) || /FOR ALL/.test(header)) &&
        /ON public\.klienci\b/.test(header)
      );
    });

    expect(deleteOrAllOnKlienci).toEqual([]);
  });

  // Dowód globalny, dodatkowy do pociętych bloków powyżej: w CAŁYM pliku migracji
  // liczba polityk `FOR SELECT` jest znana i skończona (bramka logowania +
  // katalog publiczny) — żadna z nich nie dotyczy leady/klienci/adresy. To zamyka
  // lukę, w której ktoś dopisałby politykę SELECT w zupełnie innym miejscu pliku,
  // poza blokiem danej tabeli.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC13.3 (dowód żywotności — dowód pośredni w RED): w całym pliku SELECT występuje wyłącznie dla AuthorizedUser, audytorzy, indoor_units, outdoor_units, cennik_uslug', () => {
    const sql = readMigration();
    const selectPolicyBlocks = sql
      .split('CREATE POLICY')
      .slice(1)
      .filter((chunk) => /FOR SELECT/.test(chunk.split('\n\n')[0] ?? chunk.slice(0, 200)));

    const allowedTables = [
      'public."AuthorizedUser"',
      'public.audytorzy',
      'public.indoor_units',
      'public.outdoor_units',
      'public.cennik_uslug',
    ];

    for (const chunk of selectPolicyBlocks) {
      const onTableMatch = chunk.match(/ON (public\.(?:"[^"]+"|[a-z_]+))/);
      expect(onTableMatch).not.toBeNull();
      expect(allowedTables).toContain(onTableMatch?.[1]);
    }

    // I explicite: żadna z trzech tabel zamrażanych tym plikiem nie występuje wśród
    // tabel z polityką SELECT.
    const forbidden = ['public.leady', 'public.klienci', 'public.adresy'];
    for (const chunk of selectPolicyBlocks) {
      const onTableMatch = chunk.match(/ON (public\.(?:"[^"]+"|[a-z_]+))/);
      expect(forbidden).not.toContain(onTableMatch?.[1]);
    }
  });
});
