import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16.
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, status TODO).
 *
 * Testy statyczne na treści źródła NOWEGO komponentu (WO, "Kształt zmiany"):
 * `apps/b2b-web/src/app/(dashboard)/leads/[id]/create-booking-dialog.tsx`. Wzorzec zastosowany
 * tutaj — `role-change-dialog-ui.test.ts` / `customers-anonymize-ui.test.ts` (memoria "React UI
 * test infra limits"): brak jsdom/aliasu `@/*` w root `vitest.config.mts` wyklucza pełny render
 * Testing Library dla komponentu klienckiego z hookami.
 *
 * RÓŻNICA wobec tamtych dwóch plików: TEN plik testuje komponent, który jeszcze NIE ISTNIEJE —
 * `readFileSync` na nieistniejącej ścieżce rzuca `ENOENT` synchronicznie. To jest poprawny,
 * czytelny RED tej tury (dowód braku implementacji), analogiczny do "Cannot find module" dla
 * importu — nie usterka testu. Po utworzeniu pliku przez `implementer-ui` te same testy zaczną
 * czytać treść i asercjonować na niej.
 *
 * Logika filtrowania/budowy payloadu, którą TEN komponent MUSI wołać, jest wyniesiona do
 * `apps/b2b-web/src/lib/schedule/basket-select.ts` i dowiedziona osobno, wykonywalnie, w
 * `booking-basket-select-logic.test.ts` — tu sprawdzamy wyłącznie to, czego statyczna analiza
 * treści pliku może dowieść: brak zaszytych literałów/kontrolek, obecność bramki RBAC, brak
 * `booking.update`.
 */

const DIALOG_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/leads/[id]/create-booking-dialog.tsx',
);

function readDialog(): string {
  return readFileSync(DIALOG_PATH, 'utf-8');
}

describe('create-booking-dialog.tsx — AC1 (brak kontrolki liczby godzin/minut)', () => {
  // WO, AC1 dosłownie: "nie ma żadnej kontrolki pozwalającej podać liczbę godzin ani minut" —
  // żadne pole liczbowe powiązane z czasem trwania (type="number" + minuty/godziny,
  // `durationMinutes` jako pole formularza edytowalne przez użytkownika).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło nie zawiera pola formularza durationMinutes (rejestrowanego przez register/name)', () => {
    const content = readDialog();
    expect(content).not.toMatch(/register\(\s*["']durationMinutes["']/);
    expect(content).not.toMatch(/name=["']durationMinutes["']/);
  });

  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło nie zawiera input type="number" w kontekście "minut"/"godzin" (kontrolka czasu trwania)', () => {
    const content = readDialog();
    const numberInputIndexes: number[] = [];
    const regex = /type="number"/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      numberInputIndexes.push(match.index);
    }
    for (const idx of numberInputIndexes) {
      const window = content.slice(Math.max(0, idx - 300), idx + 300).toLowerCase();
      expect(window).not.toMatch(/minut|godzin|duration/);
    }
  });
});

describe('create-booking-dialog.tsx — AC6 (żaden literał etykiety/czasu trwania koszyka)', () => {
  // WO, AC6 dosłownie: test statyczny nie znajduje "Audyt", "(2 h)", 120, 240, 480 w kontekście
  // listy koszyków. Etykiety i czas trwania muszą pochodzić WYŁĄCZNIE z propsów/danych
  // (`selectableBaskets` z `basket-select.ts`), nigdy z literału w JSX.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it.each(['"Audyt"', "'Audyt'", '(2 h)', '120', '240', '480'])(
    'literał %s nie występuje w treści komponentu',
    (literal) => {
      const content = readDialog();
      expect(content).not.toContain(literal);
    },
  );
});

describe('create-booking-dialog.tsx — AC9 (bramka RBAC widoczności ekranu/przycisku)', () => {
  // WO, AC9: rola bez bookings.create nie dostaje przycisku. Wzorzec identyczny z
  // `assign-auditor.tsx` (`canUpdateLead = ... can(actorRole, "leads", "update") === "yes"`).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło woła can(actorRole, "bookings", "create") do wyliczenia widoczności', () => {
    const content = readDialog();
    expect(content).toMatch(/can\(\s*actorRole\s*,\s*["']bookings["']\s*,\s*["']create["']\s*\)/);
  });

  // Bramka musi faktycznie GATOWAĆ render przycisku wywołującego dialog, nie być efektem
  // ubocznym bez wpływu na JSX (memoria "Ternary gate no-brace wrap" — sprawdzamy obecność
  // zmiennej gate w treści JSX, tolerując zarówno `{canCreate && (...)}`, jak i ternary).
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('zmienna wynikająca z bramki RBAC jest użyta w JSX do warunkowego renderu (nie tylko przeliczona i odrzucona)', () => {
    const content = readDialog();
    const canMatch = content.match(/const\s+(\w+)\s*=\s*[^;]*can\(\s*actorRole\s*,\s*["']bookings["']\s*,\s*["']create["']\s*\)/);
    expect(canMatch).not.toBeNull();
    const gateVar = canMatch![1];
    const usageRegex = new RegExp(`${gateVar}\\s*(&&|\\?|:)`);
    expect(content).toMatch(usageRegex);
  });
});

describe('create-booking-dialog.tsx — przypadek brzegowy 4 (podwójne kliknięcie „Rezerwuj")', () => {
  // WO: "jedno wywołanie akcji, jedna rezerwacja" — interfejs nie może generować drugiego
  // żądania. Wzorzec `assign-crew-dialog.tsx`/`CalendarSettingsClient.tsx`: `useTransition` +
  // `disabled={isPending || ...}` na przycisku zatwierdzenia.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło używa useTransition i disabled zależy od isPending na przycisku "Rezerwuj"', () => {
    const content = readDialog();
    expect(content).toMatch(/useTransition\s*\(\s*\)/);
    const reserveIdx = content.indexOf('Rezerwuj');
    expect(reserveIdx).toBeGreaterThan(-1);
    const window = content.slice(Math.max(0, reserveIdx - 500), reserveIdx + 50);
    expect(window).toMatch(/disabled=\{[^}]*isPending[^}]*\}/);
  });
});

describe('create-booking-dialog.tsx — przypadki brzegowe 1/2 (BASKET_INACTIVE / BASKET_NOT_FOUND) są pokazane, nie połknięte', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło odczytuje result.error.code i wyświetla komunikat (nie cichy return na błędzie)', () => {
    const content = readDialog();
    expect(content).toMatch(/result\.error/);
    // `role="alert"` — wzorzec z CalendarSettingsClient.tsx/AssignCrewDialog dla komunikatów błędu.
    expect(content).toContain('role="alert"');
  });
});

describe('create-booking-dialog.tsx — przypadek brzegowy 5 (alternatywy przy zajętym slocie nie są połknięte)', () => {
  // WO: wynik z propozycją alternatyw (`alternatives`) musi być pokazany, nie połknięty.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło odwołuje się do result.error.alternatives (SLOT_TAKEN)', () => {
    const content = readDialog();
    expect(content).toMatch(/alternatives/);
  });
});

describe('create-booking-dialog.tsx — przypadek brzegowy 7 (koszyk nie jest re-wyceniany po zawarciu rezerwacji)', () => {
  // WO: "ekran rezerwacji nie wykonuje żadnego booking.update" — kontrola negatywna, komponent
  // wywołuje wyłącznie createBookingAction (import), nigdy funkcję update/reassign na rezerwacji
  // już istniejącej.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło importuje createBookingAction z bookings/actions i NIE importuje żadnej funkcji update/reassign na rezerwacji', () => {
    const content = readDialog();
    expect(content).toMatch(/createBookingAction/);
    expect(content).not.toMatch(/updateBooking|reassignBookingAction|booking\.update/);
  });
});

describe('create-booking-dialog.tsx — bookedBy jest zawsze DISPATCHER (WO, "Kształt zmiany")', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło ustawia bookedBy: "DISPATCHER" (panel B2B, nigdy CLIENT)', () => {
    const content = readDialog();
    expect(content).toMatch(/bookedBy:\s*["']DISPATCHER["']/);
    expect(content).not.toMatch(/bookedBy:\s*["']CLIENT["']/);
  });
});

describe('create-booking-dialog.tsx — AC2 (payload jest budowany WYŁĄCZNIE przez buildCreateBookingPayload)', () => {
  // Ciąg dalszy domykania FLD-QUOTE-BASKET-SELECT (rozstrzygnięcie contract-steward,
  // 2026-09-16, dziura 1): `buildCreateBookingPayload` z `basket-select.ts` istnieje i jest
  // dowiedziona wykonywalnie w `booking-basket-select-logic.test.ts` (6 testów), ale przed tą
  // asercją ŻADEN test nie sprawdzał, że dialog faktycznie ją WOŁA — `onSubmit` mógł budować
  // payload inline ({ visitBasketId: values.visitBasketId, ... }), i podmiana
  // `value={basket.id}` na `value={basket.code}` w JSX przeszłaby cały pakiet, bo żadna
  // funkcja domenowa nie stoi między formularzem a `createBookingAction`.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('źródło importuje buildCreateBookingPayload z modułu basket-select', () => {
    const content = readDialog();
    const importMatch = content.match(
      /import\s*\{([^}]*)\}\s*from\s*["'][^"']*lib\/schedule\/basket-select["']/,
    );
    expect(importMatch).not.toBeNull();
    expect(importMatch![1]).toMatch(/\bbuildCreateBookingPayload\b/);
  });

  // Wołanie musi WCHODZIĆ w wywołanie createBookingAction — nie wystarczy sam import bez
  // użycia. Sprawdzamy, że argument przekazany do createBookingAction JEST wywołaniem
  // buildCreateBookingPayload(...), nie obiektem literalnym budowanym inline w handlerze.
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('createBookingAction jest wołane z wynikiem buildCreateBookingPayload(...), nie z obiektem budowanym inline w onSubmit', () => {
    const content = readDialog();
    const callIdx = content.indexOf('createBookingAction(');
    expect(callIdx).toBeGreaterThan(-1);
    const window = content.slice(callIdx, callIdx + 500);
    expect(window).toMatch(/createBookingAction\(\s*buildCreateBookingPayload\(/);
  });
});

describe('create-booking-dialog.tsx — ikony wyłącznie lucide-react (ADR-001/zakazy CLAUDE.md)', () => {
  // @REQ: FLD-QUOTE-BASKET-SELECT
  it('jedyny import ikon w pliku pochodzi z "lucide-react"', () => {
    const content = readDialog();
    const iconImportLines = content
      .split('\n')
      .filter((line) => /from ["'](?!lucide-react)[^"']*icons?[^"']*["']/i.test(line));
    expect(iconImportLines).toEqual([]);
  });
});
