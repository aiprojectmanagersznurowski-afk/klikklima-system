import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-DELETE.md — testy statyczne AC10 i AC11, oraz przypadek
 * brzegowy "CHECK bazy jako druga linia: resource='logistics' nigdy nie jest używane".
 * Wymaganie: `SEC-AUDIT-LOG-DELETE` (`contracts/requirements.contract.mjs:331`).
 *
 * Zakres AC11: WO mówi "dla PIĘCIU plików Fali A — nie sprawdzaj jeszcze auditors/crews...
 * ale Twój test dziś może już objąć cały katalog, jeśli to nie zepsuje niczego — Twoja
 * ocena, udokumentuj wybór". DECYZJA: skanuję CAŁY `apps/b2b-web/src` (nie tylko pięć plików
 * Fali A). Uzasadnienie: `auditors/actions.ts` i `crews/actions.ts` MAJĄ już `$transaction`
 * (Fala B, WO sekcja "Kontekst kodu" — `deleteAuditorAction` na `Serializable`,
 * `deleteCrewAction`), ale BEZ `auditLog.create` w środku — a to jest dokładnie shape, który
 * ta reguła ma wykrywać. Rozszerzenie zakresu dziś nie psuje nic: to dwa DODATKOWE offendery
 * spodziewane w RED (Fala B jeszcze nie istnieje), nie fałszywy negatyw. Gdy Fala B doda tam
 * `auditLog.create`, reguła i tak przejdzie bez zmian w tym pliku.
 *
 * Ograniczenie tej reguły (świadome, udokumentowane zamiast milczącego pominięcia): sprawdzenie
 * jest tekstowe (nie AST) na najmniejszym bloku `{ ... }` zawierającym wystąpienie usunięcia
 * rekordu, wyznaczonym przez balansowanie nawiasów klamrowych — nie regexem zachłannym, żeby nie
 * przeciekać do kolejnej funkcji w tym samym pliku.
 *
 * 2026-09-03 — wzmocnienie po znalezisku `rls-security-auditor` (cztery ślepe plamy w AC11):
 * 1) `.delete({` (literał) → `/\.(delete|deleteMany)\s*\(/` (regex, łapie też `.deleteMany`
 *    i dowolne białe znaki przed `(`),
 * 2) dodana osobna reguła na `$executeRaw`/`$executeRawUnsafe` zawierające `DELETE FROM`
 *    (case-insensitive) w najbliższym otoczeniu wywołania — surowy SQL omija model Prismy,
 *    więc stara reguła oparta na `.delete({` go nie widziała,
 * 3) `fnStart === -1` (brak dopasowania granicy funkcji, np. `export const x = async () => {}`
 *    nie pasujący do starych markerów) już NIE jest cichym `continue` — jest offenderem z
 *    komunikatem "sprawdź ręcznie", a lista markerów rozszerzona o `export const` i warianty
 *    `export default`, żeby ten kształt w ogóle miał szansę zostać poprawnie rozpoznany,
 * 4) zakres skanowania rozszerzony z samych plików `actions.ts` na wszystkie pliki `.ts` pod
 *    `apps/b2b-web/src` (poza testami) — nazwa pliku przestała być jedyną granicą bezpieczeństwa.
 * Wynik po wzmocnieniu MUSI pozostać identyczny jak przed nim: dokładnie dwóch offenderów
 * (`auditors/actions.ts`, `crews/actions.ts`, Fala B) — to oczekiwany, niezmieniony stan RED,
 * a nie regresja do naprawienia.
 */

const APPS_DIR = path.resolve(__dirname, '../../');
const B2B_SRC_DIR = path.resolve(__dirname, '../src');

function findSourceFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findSourceFiles(fullPath, results);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const b2bSourceFiles = findSourceFiles(B2B_SRC_DIR);
const nonTestSourceFiles = b2bSourceFiles.filter(
  (f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith('.test.ts'),
);
// Fala A/B: przed wzmocnieniem reguła patrzyła WYŁĄCZNIE na pliki `actions.ts` — zachowane
// tu tylko dla asercji kontroli pozytywnej zbioru poniżej, żeby nie stracić sygnału "czy w ogóle
// istnieją pliki tego kształtu w repo".
const actionsFiles = nonTestSourceFiles.filter((f) => f.endsWith(`${path.sep}actions.ts`));

/**
 * Znaczniki, po których cofamy się w poszukiwaniu granicy otaczającej funkcji. Rozszerzone o
 * `export const` (i warianty `export default`), bo AC11 ma chronić przed jutrzejszym kodem —
 * `export const deleteX = async (...) => { ... }` jest dziś równie legalnym kształtem eksportu
 * Server Action jak `export async function`, a stara reguła cichutko go pomijała (fnStart === -1
 * → `continue`), co jest dokładnie luką, którą audytor RLS znalazł.
 */
const FN_BOUNDARY_MARKERS = [
  'export async function',
  'export function',
  'export default async function',
  'export default function',
  'export const',
];

interface DeleteCandidate {
  idx: number;
  label: string;
  /** Czy ta ścieżka usuwania musi też siedzieć w `$transaction`, nie tylko mieć `auditLog.create`. */
  requireTransaction: boolean;
}

/**
 * Znajduje wszystkie miejsca w pliku, które wyglądają na usunięcie rekordu:
 * - `tx.<model>.delete(` / `prisma.<model>.delete(` / `...deleteMany(` na modelu Prismy
 *   (dowolna ilość białych znaków przed `(`). Wymóg prefiksu `tx.`/`prisma.<cokolwiek>.` (a nie
 *   goły `.delete(`) jest CELOWY: bez niego regex łapałby też niezwiązane z Prismą wywołania
 *   `.delete()` na `Map`/`Set`/`URLSearchParams` (np. `createCrewInFlight.delete(formData)` w
 *   `crews/actions.ts`, `redirectUrl.searchParams.delete('code')` w `auth/callback/route.ts`) —
 *   stwierdzone empirycznie przy rozszerzaniu zakresu na cały `src`, patrz WO.
 * - `$executeRaw(` / `$executeRawUnsafe(` zawierające w najbliższym otoczeniu (500 znaków)
 *   frazę `DELETE FROM` (case-insensitive) — surowy SQL, który omija warstwę modelu Prismy
 *   i przez to nie był widoczny dla starej reguły opartej na `.delete({`.
 */
function findDeleteCandidates(content: string): DeleteCandidate[] {
  const candidates: DeleteCandidate[] = [];

  const deleteRe = /\b(?:tx|prisma)\.\w+\.(delete|deleteMany)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = deleteRe.exec(content))) {
    candidates.push({ idx: m.index, label: m[0].trim(), requireTransaction: true });
  }

  const rawRe = /\$executeRawUnsafe\s*\(|\$executeRaw\s*\(/g;
  while ((m = rawRe.exec(content))) {
    const window = content.slice(m.index, m.index + 500);
    if (/delete\s+from/i.test(window)) {
      candidates.push({ idx: m.index, label: `${m[0].trim()} (DELETE FROM)`, requireTransaction: false });
    }
  }

  return candidates;
}

/**
 * Wyodrębnia treść funkcji otaczającej dany indeks w pliku, balansując nawiasy klamrowe od
 * najbliższego preceding markera z `FN_BOUNDARY_MARKERS`. Zwraca `null`, jeśli granicy nie da
 * się jednoznacznie wyznaczyć — to musi być traktowane przez wywołującego jako podejrzane, NIE
 * jako "pomiń" (stara reguła robiła tu cichy `continue`, co maskowało realny przypadek).
 */
function extractEnclosingBlock(content: string, idx: number): string | null {
  const beforeIdx = content.slice(0, idx);
  let fnStart = -1;
  for (const marker of FN_BOUNDARY_MARKERS) {
    const i = beforeIdx.lastIndexOf(marker);
    if (i > fnStart) fnStart = i;
  }
  if (fnStart === -1) return null;

  const braceOpen = content.indexOf('{', fnStart);
  if (braceOpen === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = braceOpen; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  return content.slice(fnStart, end + 1);
}

describe('AC11 — brak ścieżki usunięcia rekordu (Prisma .delete/.deleteMany albo surowy SQL DELETE FROM) bez auditLog.create w tej samej funkcji', () => {
  it('każdy plik actions.ts istnieje i jest skanowalny (kontrola pozytywna zbioru)', () => {
    expect(actionsFiles.length).toBeGreaterThan(0);
  });

  // @REQ: SEC-AUDIT-LOG-DELETE
  it('każde wystąpienie .delete(/.deleteMany( na modelu Prismy ORAZ każdy surowy $executeRaw z DELETE FROM, w dowolnym pliku .ts pod apps/b2b-web/src (nie tylko actions.ts), jest wewnątrz funkcji zawierającej auditLog.create (a dla wywołań modelowych — także $transaction)', () => {
    const offenders: string[] = [];

    for (const file of nonTestSourceFiles) {
      const content = readFileSync(file, 'utf-8');
      const candidates = findDeleteCandidates(content);

      for (const candidate of candidates) {
        const block = extractEnclosingBlock(content, candidate.idx);
        if (block === null) {
          offenders.push(
            `${path.relative(APPS_DIR, file)} — ${candidate.label}: nie udało się wyznaczyć granicy funkcji — sprawdź ręcznie`,
          );
          continue;
        }

        const hasTransaction = /\$transaction\s*\(\s*async/.test(block);
        const hasAuditLogCreate = /auditLog\.create\s*\(/.test(block);
        const missing: string[] = [];
        if (candidate.requireTransaction && !hasTransaction) missing.push('$transaction');
        if (!hasAuditLogCreate) missing.push('auditLog.create');

        if (missing.length > 0) {
          offenders.push(
            `${path.relative(APPS_DIR, file)} — funkcja zawierająca ${candidate.label} bez ${missing.join(' i ')}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("Przypadek brzegowy — resource='logistics' nigdy nie jest używane w kodzie (SEC-AUDIT-LOG-DELETE)", () => {
  // @REQ: SEC-AUDIT-LOG-DELETE
  it("literał resource: 'logistics' (albo \"logistics\") nie występuje w żadnym pliku .ts/.tsx spoza testów", () => {
    const offenders: string[] = [];
    const nonTestFiles = b2bSourceFiles.filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith('.test.ts'));

    for (const file of nonTestFiles) {
      const content = readFileSync(file, 'utf-8');
      if (/resource\s*:\s*['"]logistics['"]/.test(content)) {
        offenders.push(path.relative(APPS_DIR, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('AC10 — jedno źródło progu 10 i słownika legalBases, zero kopii schematu Zod', () => {
  const nonTestFiles = b2bSourceFiles.filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith('.test.ts'));

  // Sygnatura duplikatu słownika: wszystkie pięć wartości AUDIT_REQUIREMENTS.legalBases
  // zakodowane RAZEM jako literały w jednym pliku — odróżnia to od pojedynczych literałów
  // przypadkowo obecnych gdzie indziej (np. w komentarzu albo w danych testowych innego
  // modułu), a jednocześnie łapie dokładnie ten defekt, przed którym ostrzega WO: druga
  // lista obok kontraktu.
  const LEGAL_BASIS_LITERALS = [
    'RODO_ERASURE_REQUEST',
    'OPERATIONAL_ERROR',
    'DUPLICATE',
    'COURT_ORDER',
    'OTHER',
  ];

  // @REQ: SEC-AUDIT-LOG-DELETE
  it('żaden plik apps/b2b-web/src (poza generowanym kontraktem) nie zawiera własnej kopii pełnego słownika legalBases jako literałów', () => {
    const offenders: string[] = [];

    for (const file of nonTestFiles) {
      const content = readFileSync(file, 'utf-8');
      const containsAll = LEGAL_BASIS_LITERALS.every((v) => content.includes(`'${v}'`) || content.includes(`"${v}"`));
      // Import z kontraktu (`AUDIT_REQUIREMENTS.legalBases`) jest dozwolony — nie jest to
      // literał, tylko odwołanie do wartości; wykluczamy pliki, które WYŁĄCZNIE importują
      // (nie definiują) tę stałą.
      const isMereImportUsage = content.includes('AUDIT_REQUIREMENTS.legalBases') && containsAll === false;
      if (containsAll && !isMereImportUsage) {
        offenders.push(path.relative(APPS_DIR, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  // Nowy plik schematu współdzielonego z WO (`lib/audit/delete-justification-schema.ts` albo
  // odpowiednik nazwany przez implementera) MUSI istnieć i być JEDYNYM miejscem definiującym
  // `z.string().trim().min(10)` powiązane z `justification` w apps/b2b-web/src, POZA istniejącym
  // już (nietykanym, `CRM-CLIENT-ANONYMIZE-RODO`) `customers/anonymize-client-schema.ts`.
  // @REQ: SEC-AUDIT-LOG-DELETE
  it('co najwyżej jeden plik (poza anonymize-client-schema.ts) definiuje justification: z.string().trim().min(10)', () => {
    const offenders: string[] = [];

    for (const file of nonTestFiles) {
      if (file.endsWith(`${path.sep}anonymize-client-schema.ts`)) continue;
      const content = readFileSync(file, 'utf-8');
      if (/z\s*\.\s*string\s*\(\s*\)\s*\.\s*trim\s*\(\s*\)\s*\.\s*min\s*\(\s*10\s*\)/.test(content)) {
        offenders.push(path.relative(APPS_DIR, file));
      }
    }

    // Dziś (RED) oczekujemy DOKŁADNIE JEDNEGO takiego pliku: nowy schemat współdzielony z WO.
    // Zero plików = implementacja jeszcze nie istnieje (poprawny RED). Więcej niż jeden =
    // naruszenie AC10 (kopia zamiast współdzielenia).
    expect(offenders.length).toBeLessThanOrEqual(1);
  });
});
