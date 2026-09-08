import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Zadanie UI (polecenie bezpośrednie użytkownika, POZA rejestrem wymagań —
 * `contracts/requirements.contract.mjs` nie zawiera żadnego wpisu dotyczącego
 * tego formularza). `SettingsClient.tsx` hardkoduje `addAuthorizedUser(email, "admin")`
 * i renderuje `<select disabled>` z jedną, sztywną opcją "Administrator" w modalu
 * "Zaproś pracownika" — mimo że backend (`actions.ts`) już w pełni waliduje
 * dowolną rolę z `ROLES` (`@klikklima/contracts`). Zadanie: umożliwić wybór roli
 * w UI, wzorem `role-change-dialog.tsx`, który już buduje listę opcji z `ROLES`.
 * Dlatego znaczniki poniżej to `@TASK`, nie `@REQ` — nie ma wymagania w rejestrze,
 * do którego `kk-trace.mjs` mógłby to dopasować.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (ten sam wzorzec co
 * `leads-nav-submenu.test.ts` / `crews-client-admin-visibility.test.ts`): root
 * `vitest.config.mts` nie ma skonfigurowanego aliasu `@/*`, a `SettingsClient.tsx`
 * importuje moduły spod `@/...` (`@/components/ui/card`, `@/components/ui/button`,
 * `@/lib/utils`, …). Próba `await import(...)` tego pliku w tym pakiecie testów
 * pada na `Cannot find package '@/components/ui/card'` — zweryfikowane ręcznie
 * przed napisaniem tego pliku, żeby nie zostawić złego REDu (błąd
 * infrastrukturalny zamiast asercji domenowej). Dlatego plik jest tu czytany
 * jako tekst źródłowy (`readFileSync`) i parsowany statycznie — DOKŁADNIE ten
 * sam wzorzec dowodowy co w testach wymienionych wyżej.
 */

const SETTINGS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/settings');

function readSettingsClient(): string {
  return readFileSync(path.join(SETTINGS_DIR, 'SettingsClient.tsx'), 'utf-8');
}

/** Wyciąga treść ciała funkcji zaczynającej się przy `startIndex` (od pierwszego `{`), licząc głębokość nawiasów klamrowych — bezpieczne wobec zagnieżdżonych bloków. */
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

/** Wycina ciało funkcji `handleAddUser` z `SettingsClient.tsx` — potrzebne, żeby sprawdzić DRUGI argument wywołania `addAuthorizedUser(...)` niezależnie od reszty pliku (inne wywołania w pliku, np. w komentarzach, nie mają wpływać na wynik). */
function extractHandleAddUserBody(content: string): string {
  const marker = /const\s+handleAddUser\s*=\s*async\s*\(\)\s*=>\s*\{/.exec(content);
  if (!marker) {
    throw new Error('Nie znaleziono deklaracji "const handleAddUser = async () => {" w SettingsClient.tsx');
  }
  const openIndex = content.indexOf('{', marker.index);
  return extractBalancedBraces(content, openIndex);
}

/** Wycina blok JSX modalu "Zaproś pracownika" (od nagłówka CardTitle z tym tekstem do zamykającego ")}" bloku warunkowego `showInviteModal &&`) — żeby test dla selecta roli nie mógł przypadkiem złapać innego <select> w pliku. */
function extractInviteModalBlock(content: string): string {
  const modalStart = content.indexOf('showInviteModal &&');
  if (modalStart === -1) {
    throw new Error('Nie znaleziono bloku warunkowego "showInviteModal &&" w SettingsClient.tsx');
  }
  // Blok modalu jest zamknięty przez najbliższy </div> odpowiadający otwierającemu
  // <div className="fixed inset-0 ..."> tuż po markerze — używamy prostszego,
  // ale wystarczająco precyzyjnego wyznacznika: od markera do końca deklaracji
  // handleAddUser... zamiast tego przyjmujemy zakres do następnego bloku
  // `{deleteDialogUserId &&`, który zaczyna kolejną sekcję JSX w pliku.
  const nextSectionMarker = content.indexOf('deleteDialogUserId &&', modalStart);
  if (nextSectionMarker === -1) {
    throw new Error('Nie znaleziono końca sekcji modalu "Zaproś pracownika" (marker "deleteDialogUserId &&") w SettingsClient.tsx');
  }
  return content.slice(modalStart, nextSectionMarker);
}

/**
 * Wycina otwierający tag `<select ...>` selecta roli z wyciętego wcześniej
 * bloku modalu — czyli TYLKO atrybuty otwierającego tagu (`value=`, `onChange=`
 * itd.), bez treści `<option>` w środku. Potrzebne, żeby asercje na `value={role}`
 * i `onChange={... setRole(...)}` (dowód OKABLOWANIA kontrolki, mutanty M4/M5
 * z revieu reviewera) nie mogły przypadkiem trafić w coś innego w bloku modalu.
 */
function extractSelectRoleOpenTag(modalBlock: string): string {
  const tagStart = modalBlock.indexOf('<select');
  if (tagStart === -1) {
    throw new Error('Nie znaleziono tagu "<select" w bloku modalu "Zaproś pracownika".');
  }
  const tagEnd = findTagCloseAngleBracket(modalBlock, tagStart);
  return modalBlock.slice(tagStart, tagEnd + 1);
}

/**
 * Znajduje ">" zamykający otwierający tag JSX zaczynający się w `fromIndex`,
 * pomijając "=>" (strzałki funkcji w atrybutach typu `onChange={(e) => ...}`),
 * które naiwny `indexOf('>', ...)` błędnie bierze za koniec tagu.
 */
function findTagCloseAngleBracket(content: string, fromIndex: number): number {
  for (let i = fromIndex; i < content.length; i++) {
    if (content[i] === '>' && content[i - 1] !== '=') return i;
  }
  throw new Error('Nie znaleziono zamykającego ">" otwierającego tagu JSX (z pominięciem "=>").');
}

/**
 * Wycina otwierający tag przycisku "Dodaj dostęp" (ten z `onClick={handleAddUser}`)
 * — żeby sprawdzić jego `disabled=...` niezależnie od przycisku "Anuluj" w tym
 * samym modalu, który też ma `disabled={loading}`.
 */
function extractAddAccessButtonOpenTag(modalBlock: string): string {
  const onClickMarker = modalBlock.indexOf('onClick={handleAddUser}');
  if (onClickMarker === -1) {
    throw new Error('Nie znaleziono "onClick={handleAddUser}" w bloku modalu "Zaproś pracownika".');
  }
  const tagStart = modalBlock.lastIndexOf('<Button', onClickMarker);
  if (tagStart === -1) {
    throw new Error('Nie znaleziono otwierającego "<Button" poprzedzającego onClick={handleAddUser}.');
  }
  const tagEnd = findTagCloseAngleBracket(modalBlock, onClickMarker);
  return modalBlock.slice(tagStart, tagEnd + 1);
}

describe('SettingsClient.tsx — wybór roli w modalu "Zaproś pracownika" zamiast hardkodowanego "admin"', () => {
  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('handleAddUser nie wywołuje już addAuthorizedUser z zahardkodowanym literałem "admin" jako drugim argumentem', () => {
    const body = extractHandleAddUserBody(readSettingsClient());
    expect(body).not.toMatch(/addAuthorizedUser\(\s*email\s*,\s*"admin"\s*\)/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('handleAddUser przekazuje do addAuthorizedUser drugi argument pochodzący ze stanu komponentu (useState), nie literał', () => {
    const content = readSettingsClient();
    const body = extractHandleAddUserBody(content);

    const callMatch = /addAuthorizedUser\(\s*email\s*,\s*([^)]+)\)/.exec(body);
    expect(callMatch, 'Nie znaleziono wywołania addAuthorizedUser(email, <drugi argument>) w handleAddUser').not.toBeNull();
    const secondArg = callMatch![1].trim();

    expect(secondArg).not.toBe('"admin"');
    expect(secondArg).not.toBe("'admin'");

    // Drugi argument ma być zmienną stanu — musi istnieć DRUGI useState (obok
    // istniejącego `const [email, setEmail] = useState("")`), którego gettera
    // (pierwszy element destrukturyzacji) używa handleAddUser jako drugiego
    // argumentu wywołania.
    const useStateDeclRegex = new RegExp(
      `const\\s*\\[\\s*${secondArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*\\w+\\s*\\]\\s*=\\s*useState`
    );
    expect(
      content,
      `Oczekiwano deklaracji "const [${secondArg}, setX] = useState(...)" w SettingsClient.tsx, obok istniejącego stanu "email"`
    ).toMatch(useStateDeclRegex);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('select roli w modalu "Zaproś pracownika" nie jest już zablokowany (disabled)', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    expect(modalBlock).not.toMatch(/<select\s+disabled/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('lista opcji selecta roli jest budowana z ROLES importowanego z @klikklima/contracts (.map po ROLES), a nie ze statycznej, pojedynczej opcji "Administrator"', () => {
    const content = readSettingsClient();
    expect(content).toMatch(/import\s*\{[^}]*\bROLES\b[^}]*\}\s*from\s*["']@klikklima\/contracts["']/);

    const modalBlock = extractInviteModalBlock(content);
    // Statyczna, pojedyncza opcja z dzisiejszego stanu pliku ma zniknąć.
    expect(modalBlock).not.toMatch(/<option>\s*Administrator\s*<\/option>/);
    // W jej miejsce ma pojawić się iteracja po ROLES.
    expect(modalBlock).toMatch(/ROLES[^\n]*\.map\(/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('tekst informujący, że "wszystkie nowe konta otrzymują pełen dostęp administracyjny" (nieprawdziwy po umożliwieniu wyboru roli) został usunięty', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    expect(modalBlock).not.toContain('Obecnie wszystkie nowe konta otrzymują pełen dostęp administracyjny');
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('select roli ma atrybut value={role} — kontrolka jest kontrolowana przez stan komponentu', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    const selectTag = extractSelectRoleOpenTag(modalBlock);
    expect(selectTag).toMatch(/value=\{role\}/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('select roli ma podpięty onChange, który wywołuje setRole — bez tego kontrolka nie odpowiada na wybór użytkownika', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    const selectTag = extractSelectRoleOpenTag(modalBlock);
    expect(selectTag).toMatch(/onChange=\{[^}]*setRole\(/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('handleAddUser odrzuca wysyłkę formularza, gdy rola nie została wybrana (guard "if (!role)")', () => {
    const body = extractHandleAddUserBody(readSettingsClient());
    expect(body).toMatch(/if\s*\(\s*!role\s*\)\s*\{\s*setError\(\s*["'][^"']+["']\s*\)\s*;\s*return\s*;?\s*\}/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('przycisk "Dodaj dostęp" jest zablokowany zarówno podczas ładowania, jak i dopóki rola nie została wybrana (disabled={loading || !role})', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    const buttonTag = extractAddAccessButtonOpenTag(modalBlock);
    expect(buttonTag).toMatch(/disabled=\{(?:loading\s*\|\|\s*!role|!role\s*\|\|\s*loading)\}/);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('stan wybranej roli jest resetowany do "" po zamknięciu modalu przyciskiem X oraz przyciskiem "Anuluj" (dwa niezależne wystąpienia setRole(""))', () => {
    const modalBlock = extractInviteModalBlock(readSettingsClient());
    const resetInModal = modalBlock.match(/setRole\(""\)/g) ?? [];
    expect(resetInModal.length).toBe(2);
  });

  // @TASK: UI-SETTINGS-ADD-USER-ROLE-PICKER
  it('stan wybranej roli jest resetowany do "" po udanym dodaniu użytkownika (setRole("") w gałęzi sukcesu handleAddUser)', () => {
    const body = extractHandleAddUserBody(readSettingsClient());
    const successBranchMatch = /if\s*\(\s*result\.success\s*\)\s*\{([\s\S]*?)\}\s*else/.exec(body);
    expect(successBranchMatch, 'Nie znaleziono gałęzi "if (result.success) { ... } else" w handleAddUser').not.toBeNull();
    const successBranch = successBranchMatch![1];
    expect(successBranch).toMatch(/setRole\(""\)/);
  });
});
