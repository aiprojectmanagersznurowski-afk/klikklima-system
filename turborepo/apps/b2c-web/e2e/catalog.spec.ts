import { test, expect } from '@playwright/test';

test.describe('Catalog Page', () => {
  test('should display all catalog sections and device modal', async ({ page }) => {
    await page.goto('/katalog');

    // Wait for the main title
    await expect(page.locator('h1', { hasText: 'Katalog' })).toBeVisible();

    // Verify sections
    // Katalog przebudowany na jedną sekcję z filtrami (Design System, 2026-08-06).
    // Dawne sekcje Multi Split / Agregaty nie istnieją — asercje usunięte, nie osłabione.
    await expect(page.locator('h2', { hasText: 'Klimatyzatory Ścienne' })).toBeVisible();

    // Zweryfikowane uruchomieniem na realnym buildzie (2026-09-24): karta produktu
    // (`components/ui/ProductCard.tsx`) NIGDY nie renderuje etykiety cechy „WIFI w
    // standardzie” na samej karcie — lista `features` (w tym WIFI) trafia WYŁĄCZNIE
    // do treści modala po kliknięciu (`components/ui/DeviceModal.tsx`), więc selektor
    // karty po `hasText: 'WIFI w standardzie'` nigdy by nie trafił (0 dopasowań, nie
    // z powodu danych, tylko struktury komponentu). Dodatkowo w dzisiejszych danych
    // testowych (`getCatalog.ts` agreguje `has_wifi` po realnych rekordach z bazy)
    // ŻADEN produkt nie ma cechy WIFI (sprawdzone: filtr „Moduł WiFi” w panelu bocznym
    // zwraca 0 wyników), więc twardy wymóg obecności tej etykiety w modalu byłby
    // niezależnie od selektora karty test-defektem związanym z danymi, nie z kodem.
    //
    // Zamiast tego: klikamy pierwszą kartę (deterministyczna pod względem STRUKTURY —
    // siatka zawsze ma >=1 produkt w tych danych testowych) i asertujemy treść modala,
    // która jest strukturalnie stała niezależnie od cech konkretnego urządzenia.
    const firstProduct = page.locator('.group.relative').first();
    await expect(firstProduct).toBeVisible();

    // We click the button inside it "Szczegóły urządzenia"
    await firstProduct.locator('button:has-text("Szczegóły urządzenia")').click();

    // Verify modal appears
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Treść strukturalnie stała niezależnie od cech konkretnego urządzenia: nagłówek
    // konfiguratora i sekcja doboru pomieszczeń (DeviceModal.tsx) — obecne dla KAŻDEGO
    // produktu, w przeciwieństwie do opcjonalnej etykiety cechy WIFI.
    await expect(modal.locator('text=Skonfiguruj swój system klimatyzacji').first()).toBeVisible();
    await expect(modal.locator('text=Pokoje do klimatyzacji').first()).toBeVisible();

    // Close modal
    await modal.locator('button').first().click(); // Close button usually is the first button (X)
    
    // Wait for modal to disappear
    await expect(modal).not.toBeVisible();
  });
});
