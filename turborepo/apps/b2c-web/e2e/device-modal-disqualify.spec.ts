import { test, expect, type Page } from '@playwright/test';
import { ROOM_COUNT_EXPERT_THRESHOLD } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md — AC13 (D1), AC14 (D7).
 *
 * Jak w triage-disqualify.spec.ts: NIE uruchamiamy tego przez Playwright w fazie RED
 * (webServer wymaga działającego `next build`, patrz "Ryzyka i nieznane" pkt 1 w WO).
 * Czerwień zweryfikuje e2e-runner w fazie VERIFY.
 *
 * Wejście do DeviceModal: strona /katalog (apps/b2c-web/app/katalog/page.tsx) —
 * dokładnie ten sam wzorzec co w istniejącym apps/b2c-web/e2e/catalog.spec.ts
 * ("Zobacz szczegóły" otwiera modal). Na tej stronie DeviceModal NIE dostaje
 * `onReserveClick`, więc `handleAuditClick` zawsze buduje `/triage?series=...` i
 * nawiguje pełnym przeładowaniem (`window.location.href`) — dokładnie ścieżka opisana
 * w D7/AC14.
 *
 * Wzorzec dowolnej kwoty w złotówkach, tak jak formatuje ją `fmt()` w DeviceModal.tsx
 * (`n.toLocaleString("pl-PL") + " zł"`).
 */
const MONEY_PATTERN = /\d[\d\s]*\s*zł/;

const BELOW_THRESHOLD = ROOM_COUNT_EXPERT_THRESHOLD - 1;
const AT_THRESHOLD = ROOM_COUNT_EXPERT_THRESHOLD;

const openFirstDeviceModal = async (page: Page) => {
  // CookieConsent.tsx renderuje baner fixed bottom-4 left-4 po 1500ms, jeśli
  // `cookieConsent` jest puste w localStorage — zasłania sobą radio "Wiele pomieszczeń"
  // w sidebarze filtrów (ten sam róg ekranu), więc nawet `check({force:true})` nie trafia
  // (natywny hit-test przeglądarki łapie baner, nie input). Zapisujemy zgodę PRZED
  // nawigacją, odtwarzając stan "użytkownik już wcześniej zaakceptował ciasteczka" —
  // baner nigdy się nie pojawia.
  await page.addInitScript(() => localStorage.setItem('cookieConsent', 'accepted'));

  await page.goto('/katalog');
  await page.waitForLoadState('networkidle');

  // Filtr do Multi Split — bez niego "pierwszy produkt" (getCatalog.ts sortuje po
  // price_netto ascending) może być Single Split, a wtedy DeviceModal.tsx:318,445
  // (`!device?._raw?.is_multi_compatible && prev.length >= 1`) blokuje natywnym
  // `disabled` dodanie drugiego pokoju — test nigdy nie dotrze do
  // ROOM_COUNT_EXPERT_THRESHOLD. Sidebar filtrów jest widoczny domyślnie na Desktop
  // Chrome (playwright.config.ts), więc nie trzeba klikać przełącznika "Filtruj".
  await page.getByLabel('Wiele pomieszczeń').check({ force: true });
  await page.waitForTimeout(200);

  const firstProduct = page.locator('.group.relative').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.locator('button:has-text("Szczegóły urządzenia")').click();

  const modal = page.locator('div[role="dialog"]');
  await expect(modal).toBeVisible();
  return modal;
};

// Dodaje `count` pokoi w modalu i ustawia każdemu metraż "M" (etykieta "20–30 m²"),
// tak żeby konfiguracja była w pełni skompletowana (`isFullyConfigured`).
//
// `existingCount` — liczba pokoi już obecnych w modalu PRZED tym wywołaniem. Bez tego
// drugie wywołanie w tym samym teście (np. dodanie 4. pokoju po tym, jak 3 były już
// skonfigurowane) indeksowałoby `nth(i)` od zera i trafiałoby metrażem w pokój nr 1
// zamiast w nowo dodany. Dziś przechodzi to przypadkiem, bo cena w tym module zależy
// wyłącznie od `rooms.length`, a nie od tego, KTÓRY pokój ma ustawiony metraż — ale to
// cichy błąd czekający na przyszłą zmianę logiki cenowej.
const addConfiguredRooms = async (
  page: Page,
  modal: ReturnType<Page['locator']>,
  count: number,
  existingCount = 0,
) => {
  for (let i = 0; i < count; i++) {
    await modal.locator('button:has-text("Dodaj pokój")').click({ force: true });
    await page.waitForTimeout(200);

    // Ostatnio dodany wiersz pokoju — SizeSelector renderuje etykiety metrażu jako
    // przyciski wewnątrz wiersza; wybieramy "M" (20–30 m²) dla każdego pokoju.
    const roomRow = modal.locator('div.space-y-3 > div.rounded-2xl.border').nth(existingCount + i);
    await roomRow.locator('button:has-text("20–30 m²")').click({ force: true });
    await page.waitForTimeout(200);
  }
};

test.describe('DeviceModal — brak ceny przy rooms.length >= ROOM_COUNT_EXPERT_THRESHOLD (AC13, D1)', () => {
  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC13 (kontrola negatywna) — przy próg-1 pokojach blok ceny jest widoczny', async ({ page }) => {
    const modal = await openFirstDeviceModal(page);
    await addConfiguredRooms(page, modal, BELOW_THRESHOLD);

    // Poniżej progu to główny przypadek biznesowy — cena musi być widoczna, tak jak dziś.
    await expect(modal).toContainText(MONEY_PATTERN);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC13 — przy ROOM_COUNT_EXPERT_THRESHOLD pokojach blok ceny znika w całości', async ({ page }) => {
    const modal = await openFirstDeviceModal(page);
    await addConfiguredRooms(page, modal, AT_THRESHOLD);

    // Dziś `total = isFullyConfigured && matchedSet ? ... : (basePrice || 0)` (DeviceModal.tsx:343)
    // spada na `basePrice`, więc nawet bez dopasowania w bazie nadal pokazuje "Cena zaczyna się
    // od X zł" (WO, "Ryzyka" pkt 3) — to jest dokładnie luka, którą ten test dowodzi.
    await expect(modal).not.toContainText('Cena całkowita zestawu');
    await expect(modal).not.toContainText('Cena zaczyna się od');
    await expect(modal).not.toContainText(MONEY_PATTERN);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC13 — modal, kolejność zdarzeń: dodanie pokoju nr ROOM_COUNT_EXPERT_THRESHOLD PO tym, jak cena dla poprzednich była już widoczna, chowa cenę (nie zostaje z poprzedniego renderu)', async ({ page }) => {
    const modal = await openFirstDeviceModal(page);
    await addConfiguredRooms(page, modal, BELOW_THRESHOLD);
    await expect(modal).toContainText(MONEY_PATTERN);

    // Dodajemy pokój, który przekracza próg — ten sam modal, bez przeładowania.
    // `existingCount: BELOW_THRESHOLD` — indeksujemy od pokoju, który naprawdę jest
    // nowy (nth(BELOW_THRESHOLD)), a nie ponownie od pokoju nr 1.
    await addConfiguredRooms(page, modal, 1, BELOW_THRESHOLD);

    await expect(modal).not.toContainText(MONEY_PATTERN);
    await expect(modal).not.toContainText('Cena całkowita zestawu');
    await expect(modal).not.toContainText('Cena zaczyna się od');
  });
});

test.describe('DeviceModal — CTA prowadzi normalnie do /triage (AC14, D7)', () => {
  // @REQ: B2C-TRIAGE-DISQUALIFY
  test('AC14 — przy rooms.length >= ROOM_COUNT_EXPERT_THRESHOLD, CTA nadal nawiguje do /triage?series=...&roomsCount=N, bez własnej ścieżki kontaktowej', async ({ page }) => {
    const modal = await openFirstDeviceModal(page);
    await addConfiguredRooms(page, modal, AT_THRESHOLD);

    // Do momentu kliknięcia CTA w modalu nie pojawiła się żadna kwota (AC13 potwierdzone wyżej;
    // tu tylko strażnik przed regresją w tej samej ścieżce testowej).
    await expect(modal).not.toContainText(MONEY_PATTERN);

    // D7: żadnego osobnego ekranu "kontakt z Ekspertem" w modalu — ten sam CTA co dziś,
    // budujący `/triage?series=...&roomsCount=N&area_i=...` (DeviceModal.tsx, handleAuditClick).
    const cta = modal.locator('button:has-text("Wybieram ten zestaw")');
    await expect(cta).toBeEnabled();
    await cta.click({ force: true });

    await page.waitForURL(/\/triage\?.*roomsCount=/, { timeout: 15000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/triage');
    expect(url.searchParams.get('roomsCount')).toBe(String(AT_THRESHOLD));
    expect(url.searchParams.has('series')).toBe(true);
  });
});
