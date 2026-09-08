import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CRM-LEAD-UPDATE-ADMIN-DISPATCHER — luka warstwy UI (przekazana przez
 * contract-steward po weryfikacji AC wobec `leads.update = ['admin', 'dyspozytor']`,
 * contracts/rbac.contract.mjs). Server Action (`updateLeadAuditor`, `updateLeadData`
 * w `apps/b2b-web/src/app/(dashboard)/leads/[id]/actions.ts`) sprawdza rolę, ale
 * ŻADEN plik w `apps/b2b-web/src/app/(dashboard)/leads/[id]/` (`page.tsx`,
 * `edit-lead-modal.tsx`, `assign-auditor.tsx`) nie sprawdza
 * `can(actorRole, "leads", "update")` — kontrolki edycji renderują się
 * bezwarunkowo. Audytor otwierający leada wariantem `audytor:own`
 * (`leads.read` dopuszcza `'own'`) widzi pełny formularz edycji i wybór
 * audytora, mimo że serwer i tak odrzuci zapis.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co
 * `crews-client-admin-visibility.test.ts` / `settings-add-user-role-picker.test.ts`):
 * root `vitest.config.mts` nie ma skonfigurowanego aliasu `@/*`, a `page.tsx`,
 * `edit-lead-modal.tsx` i `assign-auditor.tsx` importują moduły spod `@/...`
 * (`@/components/ui/button`, `@/components/ui/dialog`, ...) — pełny render nie
 * jest dziś wykonalny w tym pakiecie testów. Testy statyczne nad treścią
 * źródła, zweryfikowane ręcznie przed napisaniem (żeby nie zostawić złego
 * REDu — błędu infrastrukturalnego zamiast asercji domenowej).
 *
 * KONTRAKT Z IMPLEMENTER-UI (analogiczny do `canUpdateCrews` w
 * `crews-client.tsx` / `canChangeRole` w `SettingsClient.tsx` — ta sama
 * konwencja nazewnicza tego repozytorium, ustalona przez test-authora, bo
 * WO nie narzuca nazwy zmiennej):
 *
 *   1. `page.tsx` (Server Component) dociąga `actorRole` przez
 *      `getCurrentActorRole()` (wzorem `customers/page.tsx`, `crews/page.tsx`
 *      — `try { actorRole = await getCurrentActorRole(); } catch { ... }`)
 *      i przekazuje go jako prop `actorRole={actorRole}` DO OBU komponentów
 *      klienckich: `<EditLeadModal ... actorRole={actorRole} />` i
 *      `<AssignAuditor ... actorRole={actorRole} />`. Osobne zapytanie od
 *      `getLeadDetail()` celowo — `getLeadDetail()` już samo gate'uje
 *      `leads.read` (wariant `'own'`), `actorRole` tu służy WYŁĄCZNIE
 *      warstwie UI dla `leads.update`.
 *   2. `edit-lead-modal.tsx` przyjmuje `actorRole: Role | null` w
 *      `EditLeadModalProps`, importuje `can` z `@klikklima/contracts` i
 *      definiuje `canUpdateLead = !!actorRole && can(actorRole, "leads", "update") === "yes"`,
 *      którym owija `DialogTrigger` (przycisk "Edytuj dane").
 *   3. `assign-auditor.tsx` przyjmuje `actorRole: Role | null` w propsach,
 *      tę samą definicję `canUpdateLead`, którą owija kontrolki ZMIANY
 *      przypisania ("Zmień", "Przypisz audytora") — WYŚWIETLANIE aktualnie
 *      przypisanego audytora zostaje bez zmian (to część `leads.read`, nie
 *      `leads.update`, i pozostaje widoczne dla audytora `:own`).
 */

const LEAD_DETAIL_DIR = path.resolve(__dirname, '../src/app/(dashboard)/leads/[id]');

function readPage(): string {
  return readFileSync(path.join(LEAD_DETAIL_DIR, 'page.tsx'), 'utf-8');
}

function readEditLeadModal(): string {
  return readFileSync(path.join(LEAD_DETAIL_DIR, 'edit-lead-modal.tsx'), 'utf-8');
}

function readAssignAuditor(): string {
  return readFileSync(path.join(LEAD_DETAIL_DIR, 'assign-auditor.tsx'), 'utf-8');
}

/** Znajduje ">" zamykający otwierający tag JSX zaczynający się w `fromIndex`, pomijając "=>" w atrybutach (wzorem settings-add-user-role-picker.test.ts). */
function findTagCloseAngleBracket(content: string, fromIndex: number): number {
  for (let i = fromIndex; i < content.length; i++) {
    if (content[i] === '>' && content[i - 1] !== '=') return i;
  }
  throw new Error('Nie znaleziono zamykającego ">" otwierającego tagu JSX (z pominięciem "=>").');
}

/** Wycina cały tag (otwierający, do "/>" lub ">") zaczynający się od `<TagName` — obejmuje wszystkie atrybuty niezależnie od liczby linii. */
function extractOpeningTag(content: string, tagName: string): string {
  const tagStart = content.indexOf(`<${tagName}`);
  if (tagStart === -1) {
    throw new Error(`Nie znaleziono tagu "<${tagName}" w pliku.`);
  }
  const tagEnd = findTagCloseAngleBracket(content, tagStart);
  return content.slice(tagStart, tagEnd + 1);
}

/** Wycina ciało bloku interfejsu/typu `name { ... }` (np. `interface EditLeadModalProps { ... }`), licząc głębokość nawiasów klamrowych. */
function extractBalancedBraces(content: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(openIndex, i + 1);
    }
  }
  throw new Error('Nie znaleziono zamykającego "}" — niezbalansowane nawiasy klamrowe.');
}

describe('page.tsx — przekazuje actorRole do EditLeadModal i AssignAuditor (CRM-LEAD-UPDATE-ADMIN-DISPATCHER)', () => {
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('page.tsx importuje getCurrentActorRole i ustala actorRole przed renderem (wzorem customers/page.tsx, crews/page.tsx)', () => {
    const content = readPage();

    expect(content).toMatch(/import\s*\{[^}]*\bgetCurrentActorRole\b[^}]*\}\s*from\s*["'][^"']*utils\/supabase\/server["']/);
    expect(content).toMatch(/actorRole\s*=\s*await\s+getCurrentActorRole\(\)/);
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('<EditLeadModal ... /> jest wywoływany z actorRole={actorRole}', () => {
    const content = readPage();
    const tag = extractOpeningTag(content, 'EditLeadModal');

    expect(tag).toMatch(/actorRole=\{actorRole\}/);
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('<AssignAuditor ... /> jest wywoływany z actorRole={actorRole}', () => {
    const content = readPage();
    const tag = extractOpeningTag(content, 'AssignAuditor');

    expect(tag).toMatch(/actorRole=\{actorRole\}/);
  });
});

describe('edit-lead-modal.tsx — przycisk "Edytuj dane" ukryty dla ról bez leads.update (CRM-LEAD-UPDATE-ADMIN-DISPATCHER)', () => {
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('EditLeadModalProps przyjmuje actorRole', () => {
    const content = readEditLeadModal();
    const marker = /interface\s+EditLeadModalProps\s*\{/.exec(content);
    expect(marker, 'Nie znaleziono "interface EditLeadModalProps {" w edit-lead-modal.tsx').not.toBeNull();

    const openIndex = content.indexOf('{', marker!.index);
    const body = extractBalancedBraces(content, openIndex);

    expect(body).toMatch(/actorRole\s*:/);
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('komponent importuje can z @klikklima/contracts i definiuje canUpdateLead z macierzy RBAC leads.update, nie z literału roli', () => {
    const content = readEditLeadModal();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canUpdateLead\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]leads['"]\s*,\s*['"]update['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('DialogTrigger (przycisk "Edytuj dane") jest bezpośrednio owinięty {canUpdateLead && (...)}', () => {
    const content = readEditLeadModal();

    const triggerIndex = content.indexOf('<DialogTrigger');
    expect(triggerIndex, 'Nie znaleziono "<DialogTrigger" w edit-lead-modal.tsx').toBeGreaterThan(-1);

    const immediatelyBefore = content.slice(Math.max(0, triggerIndex - 80), triggerIndex);
    expect(immediatelyBefore.trimEnd()).toMatch(/\{\s*canUpdateLead\s*&&\s*\(\s*$/);
  });
});

describe('assign-auditor.tsx — kontrolki zmiany audytora ukryte dla ról bez leads.update (CRM-LEAD-UPDATE-ADMIN-DISPATCHER)', () => {
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('AssignAuditor przyjmuje actorRole w propsach (destrukturyzacja pierwszego argumentu funkcji)', () => {
    const content = readAssignAuditor();
    const marker = /export\s+function\s+AssignAuditor\s*\(\s*\{/.exec(content);
    expect(marker, 'Nie znaleziono "export function AssignAuditor({" w assign-auditor.tsx').not.toBeNull();

    const openIndex = content.indexOf('{', marker!.index);
    const propsDestructuring = extractBalancedBraces(content, openIndex);

    expect(propsDestructuring).toMatch(/actorRole/);
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('komponent importuje can z @klikklima/contracts i definiuje canUpdateLead z macierzy RBAC leads.update, nie z literału roli', () => {
    const content = readAssignAuditor();

    expect(content).toMatch(/import\s*\{[^}]*\bcan\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);
    expect(content).toMatch(
      /const\s+canUpdateLead\s*=\s*!!actorRole\s*&&\s*can\(\s*actorRole\s*,\s*['"]leads['"]\s*,\s*['"]update['"]\s*\)\s*===\s*['"]yes['"]/,
    );
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('przycisk "Zmień" (przełączenie w tryb edycji przypisanego audytora) jest owinięty {canUpdateLead && (...)}', () => {
    const content = readAssignAuditor();

    const buttonMarker = /onClick=\{\(\)\s*=>\s*setIsEditing\(true\)\}/.exec(content);
    expect(buttonMarker, 'Nie znaleziono "onClick={() => setIsEditing(true)}" (przycisk "Zmień") w assign-auditor.tsx').not.toBeNull();

    const buttonTagStart = content.lastIndexOf('<Button', buttonMarker!.index);
    expect(buttonTagStart).toBeGreaterThan(-1);

    const immediatelyBefore = content.slice(Math.max(0, buttonTagStart - 80), buttonTagStart);
    expect(immediatelyBefore.trimEnd()).toMatch(/\{\s*canUpdateLead\s*&&\s*\(\s*$/);
  });

  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('przycisk "Przypisz audytora" (podstawowa kontrolka wyboru audytora, brak przypisania) jest owinięty canUpdateLead && (...)', () => {
    const content = readAssignAuditor();

    const labelIndex = content.indexOf('Przypisz audytora');
    expect(labelIndex, 'Nie znaleziono tekstu "Przypisz audytora" w assign-auditor.tsx').toBeGreaterThan(-1);

    const buttonTagStart = content.lastIndexOf('<Button', labelIndex);
    expect(buttonTagStart).toBeGreaterThan(-1);

    const immediatelyBefore = content.slice(Math.max(0, buttonTagStart - 80), buttonTagStart);
    expect(immediatelyBefore.trimEnd()).toMatch(/\{?\s*canUpdateLead\s*&&\s*\(\s*$/);
  });

  // Kontrola negatywna statyczna: samo wyświetlanie aktualnie przypisanego
  // audytora (currentAuditorName) NIE ma zniknąć dla ról bez leads.update —
  // to część leads.read (dopuszcza wariant :own), nie leads.update. Bramka
  // ma otaczać WYŁĄCZNIE kontrolki zmiany, nie cały widok sidebaru.
  // @REQ: CRM-LEAD-UPDATE-ADMIN-DISPATCHER
  it('wyświetlanie aktualnie przypisanego audytora (currentAuditorName) nie jest owinięte canUpdateLead', () => {
    const content = readAssignAuditor();

    const nameSpanIndex = content.indexOf('{currentAuditorName}');
    expect(nameSpanIndex, 'Nie znaleziono "{currentAuditorName}" w assign-auditor.tsx').toBeGreaterThan(-1);

    const immediatelyBefore = content.slice(Math.max(0, nameSpanIndex - 200), nameSpanIndex);
    expect(immediatelyBefore).not.toMatch(/\{\s*canUpdateLead\s*&&\s*\(\s*$/);
  });
});
