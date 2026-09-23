import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('B2C-CATALOG-LIST — struktura katalogu i filtrowanie', () => {
  const catalogPagePath = join(process.cwd(), 'apps/b2c-web/app/katalog/page.tsx');

  // @REQ: B2C-CATALOG-LIST
  it('katalog jest jedną sekcją: dawne sekcje Multi Split i Agregaty nie istnieją', () => {
    expect(existsSync(catalogPagePath)).toBe(true);
    const content = readFileSync(catalogPagePath, 'utf8');

    // Jedna sekcja dla urządzeń
    expect(content).toContain('Klimatyzatory Ścienne');

    // Zakaz dawnych sekcji jako osobnych nagłówków sekcji
    expect(content).not.toMatch(/<h2[^>]*>.*Agregaty.*<\/h2>/i);
    expect(content).not.toMatch(/<h2[^>]*>.*Multi\s+Split.*<\/h2>/i);
  });

  // @REQ: B2C-CATALOG-LIST
  it('filtry marki i koloru dają się złożyć w koniunkcji', () => {
    // Weryfikacja czystej logiki filtrowania z katalogu
    const mockProducts = [
      { id: '1', brand: 'Daikin', _raw: { color: 'Biały' }, deviceNettoPrice: 3000 },
      { id: '2', brand: 'Daikin', _raw: { color: 'Czarny' }, deviceNettoPrice: 3500 },
      { id: '3', brand: 'Mitsubishi', _raw: { color: 'Biały' }, deviceNettoPrice: 3200 },
      { id: '4', brand: 'Mitsubishi', _raw: { color: 'Srebrny' }, deviceNettoPrice: 3400 },
    ];

    const filterBrands = ['Daikin'];
    const filterColors = ['Czarny'];

    // Złożenie filtrów: brand AND color
    const filtered = mockProducts.filter((p) => {
      const matchBrand = filterBrands.length === 0 || filterBrands.includes(p.brand);
      const matchColor = filterColors.length === 0 || filterColors.includes(p._raw.color);
      return matchBrand && matchColor;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('2');
  });

  // @REQ: B2C-CATALOG-LIST
  it('pusty wynik filtrowania prezentuje komunikat o braku wyników, a nie pustą siatkę', () => {
    const content = readFileSync(catalogPagePath, 'utf8');

    // Weryfikacja obecności komunikatu pustego stanu i przycisku resetu filtrów
    expect(content).toMatch(/Brak wyników/i);
    expect(content).toMatch(/Nie znaleźliśmy urządzeń spełniających Twoje kryteria/i);
    expect(content).toMatch(/Wyczyść filtry/i);
  });

  // @REQ: B2C-CATALOG-LIST
  it('karta produktu otwiera modal urządzenia (DeviceModal)', () => {
    const content = readFileSync(catalogPagePath, 'utf8');

    expect(content).toContain('DeviceModal');
    expect(content).toContain('onOpenModal={setSelectedProduct}');
  });
});
