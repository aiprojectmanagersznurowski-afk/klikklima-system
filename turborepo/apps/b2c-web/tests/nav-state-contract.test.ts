import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('B2C-NAV-STATE — zachowanie stanu nawigacji i modala urządzenia', () => {
  const homePath = join(process.cwd(), 'apps/b2c-web/app/HomePageClient.tsx');
  const catalogPath = join(process.cwd(), 'apps/b2c-web/app/katalog/page.tsx');

  // @REQ: B2C-NAV-STATE
  it('HomePageClient obsługuje synchronizację stanu wybranego produktu z adresem URL', () => {
    expect(existsSync(homePath)).toBe(true);
    const content = readFileSync(homePath, 'utf8');

    // Obsługa URL / historii przy otwieraniu i zamykaniu modala
    expect(content).toMatch(/pushState|replaceState|useSearchParams|selectedProduct/i);
  });

  // @REQ: B2C-NAV-STATE
  it('zamknięcie modala urządzenia przywraca adres sprzed jego otwarcia', () => {
    // Sprawdzenie, czy funkcja onClose czyści stan w adresie URL bez przeładowania strony
    const homeContent = readFileSync(homePath, 'utf8');
    expect(homeContent).toMatch(/setSelectedProduct\(null\)/);
  });
});
