import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Wymaganie: CRM-DELETE-ADMIN-ONLY-AUDITORS (contracts/requirements.contract.mjs).
 *
 * AC dla tego wymagania wymaga trzech NIEZALEŻNYCH warstw ochrony usunięcia audytora: UI
 * (przycisk "Usuń (Tylko Admin)" widoczny wyłącznie dla `admin`, patrz
 * auditors-delete-ui-gate.test.ts), Server Action (bramkowana
 * `can(role, 'auditors', 'delete')`, patrz auditors-delete.test.ts) i RLS ("bezpośredni
 * DELETE na tabeli audytorzy rolą nie-admin jest odrzucony przez bazę"). Pierwsze dwie
 * warstwy mają dedykowane testy jednostkowe/integracyjne gdzie indziej w tym pakiecie —
 * tego pliku brakowało: warstwa RLS.
 *
 * BRAK DOCKERA/PSQL/SUPABASE CLI w tym środowisku: test integracyjny wykonujący prawdziwy
 * `DELETE FROM audytorzy` jako rola `authenticated` na żywym Postgresie jest tu
 * niewykonalny (to samo ograniczenie co w leads-rls-deny-by-default.test.ts i
 * crews-rls-deny-by-default.test.ts — przeczytane jako wzorzec). Jedynym wykonalnym
 * testem jest ASERCJA STATYCZNA nad treścią plików migracji jako tekstu.
 *
 * KSZTAŁT TABELI `audytorzy` (whitelist, NIE zero polityk — w odróżnieniu od
 * `zespoly_monterskie`/`instalacje`): migracja bazowa nadaje JEDNĄ legalną politykę
 * "self read by email" (`FOR SELECT TO authenticated USING (email = auth.email())`),
 * dokładnie ten sam kształt co `leady`. Zgodnie z
 * .claude/agent-memory/reviewer/feedback_rls_freeze_test_whitelist.md: blacklista na
 * literał `FOR DELETE`/`FOR ALL` NIE wystarcza — polityka bez klauzuli `FOR` domyślnie w
 * Postgresie oznacza `FOR ALL`, a polityka bez kwalifikatora `public.` umyka regexowi
 * `ON public\.audytorzy\b`. Poniższe testy zbierają WSZYSTKIE polityki wskazujące
 * `audytorzy` w CAŁYM katalogu migracji (nie tylko w pliku bazowym — zgodnie z
 * .claude/agent-memory/test-author/feedback_three_layer_coverage_closure.md) i wymagają,
 * żeby ten zbiór miał dokładnie jeden element, o dokładnie oczekiwanej treści.
 */

function migrationsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '..', '..', '..', 'supabase', 'migrations');
}

function readBaselineMigration(): string {
  return readFileSync(join(migrationsDir(), '20260824185845_security_enable_rls_baseline.sql'), 'utf-8');
}

/** Konkatenacja treści WSZYSTKICH plików .sql w katalogu migracji, w kolejności nazw pliku. */
function readAllMigrations(): string {
  const dir = migrationsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return files.map((f) => readFileSync(join(dir, f), 'utf-8')).join('\n\n');
}

describe('RLS deny-by-default zamrożone na audytorzy (CRM-DELETE-ADMIN-ONLY-AUDITORS)', () => {
  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('AC-AUDITORS-RLS.1: audytorzy — ENABLE ROW LEVEL SECURITY jest obecne w migracji bazowej', () => {
    const sql = readBaselineMigration();
    expect(sql).toContain('ALTER TABLE public.audytorzy ENABLE ROW LEVEL SECURITY;');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('AC-AUDITORS-RLS.2: blok audytorzy w migracji bazowej — dokładnie JEDNA polityka CREATE POLICY (whitelist, nie blacklist na FOR DELETE/FOR ALL)', () => {
    const sql = readBaselineMigration();
    const startMarker = 'ALTER TABLE public.audytorzy ENABLE ROW LEVEL SECURITY;';
    const startIdx = sql.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    const afterStart = sql.slice(startIdx + startMarker.length);
    const nextSectionIdx = afterStart.indexOf('\n\n\n');
    const auditorzyBlock = nextSectionIdx === -1 ? afterStart : afterStart.slice(0, nextSectionIdx);

    // WHITELIST, nie blacklist: liczymy WSZYSTKIE `CREATE POLICY` w bloku (niezależnie od
    // tego, czy mają klauzulę `FOR` — jej brak oznacza w Postgresie domyślnie `FOR ALL`,
    // więc blacklista na literał `FOR DELETE`/`FOR ALL` nie łapie takiego mutanta) i
    // wymagamy dokładnie jednej, o dokładnie oczekiwanej treści.
    const policyCount = (auditorzyBlock.match(/CREATE POLICY/g) ?? []).length;
    expect(policyCount).toBe(1);
    expect(auditorzyBlock).toContain('FOR SELECT TO authenticated USING (email = auth.email());');
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('AC-AUDITORS-RLS.3 (dowód globalny, whitelist, WSZYSTKIE pliki migracji): w CAŁYM katalogu migracji dokładnie JEDNA polityka wskazuje audytorzy, i jest to FOR SELECT TO authenticated', () => {
    const sql = readAllMigrations();
    // Regex tolerancyjny na brak kwalifikatora `public.` — mutant `ON audytorzy FOR DELETE ...`
    // (bez `public.`), w DOWOLNYM pliku migracji, musi też zostać złapany, nie tylko
    // w pliku bazowym.
    const auditorzyPolicyPattern = /CREATE POLICY[^;]*?\bON\s+(public\.)?audytorzy\b[^;]*;/g;
    const policiesOnAuditorzy = sql.match(auditorzyPolicyPattern) ?? [];

    // Dokładnie jedna legalna polityka — każdy dodatkowy mutant (z klauzulą `FOR` lub bez,
    // z kwalifikatorem `public.` lub bez, wstrzyknięty w dowolnym pliku migracji) podnosi
    // tę liczbę z 1 do 2, niezależnie od swojej formy i lokalizacji, więc test pada.
    expect(policiesOnAuditorzy).toHaveLength(1);
    expect(policiesOnAuditorzy[0]).toMatch(/FOR SELECT\s+TO authenticated\s+USING \(email = auth\.email\(\)\)/);
  });

  // @REQ: CRM-DELETE-ADMIN-ONLY-AUDITORS
  it('AC-AUDITORS-RLS.4: zaden plik migracji nie wylacza RLS na audytorzy (DISABLE ROW LEVEL SECURITY nie wystepuje nigdzie)', () => {
    // Testy AC-AUDITORS-RLS.1-3 dowodza tylko, ze polityki sa poprawne w chwili odczytu -
    // nie chronia przed pozniejsza migracja, ktora wylaczy RLS w calosci (`ALTER TABLE ...
    // DISABLE ROW LEVEL SECURITY`), po czym CREATE POLICY staje sie martwym zapisem, a
    // tabela audytorzy jest w pelni otwarta na DELETE dla `authenticated`. Skan obejmuje
    // WSZYSTKIE pliki migracji (ten sam `readAllMigrations()`), nie tylko baseline.
    const sql = readAllMigrations();
    expect(sql).not.toMatch(/ALTER TABLE\s+(public\.)?audytorzy\s+DISABLE ROW LEVEL SECURITY/i);
  });
});
