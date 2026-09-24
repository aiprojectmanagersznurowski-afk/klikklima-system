import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BestsellerProduct } from '../app/actions/getBestsellers';

/**
 * BLOCKER 5 (recenzja 2026-09-24): dawna wersja testu poniżej ('filtry marki i koloru...')
 * definiowała WŁASNĄ kopię logiki filtrowania (`matchBrand && matchColor` na lokalnej
 * tablicy `mockProducts`) i asertowała wynik swojej pętli — nigdy nie importowała ani nie
 * wywoływała kodu z `katalog/page.tsx`. Taki test przechodził niezależnie od tego, czy
 * implementacja filtrowania w aplikacji jest poprawna, błędna, czy usunięta — testował
 * sam siebie.
 *
 * RUNDA 3 (2026-09-24): `katalog/page.tsx` DZIŚ eksportuje czystą funkcję
 * `export function filterProducts(products, filters)`, wydzieloną z dawnego
 * `useMemo(...)` (zweryfikowane odczytem pliku) — więc test poniżej importuje i wywołuje
 * PRAWDZIWĄ implementację, nie jej kopię.
 *
 * Import samego `page.tsx` transytywnie ciągnie moduły `"use client"`/`"use server"` z
 * aliasami `@/...` (m.in. `@/lib/supabaseClient`, `@/components/ui/ProductCard`,
 * `@/components/ui/DeviceModal`, `@/components/layout/Navbar`, `@/components/layout/Footer`)
 * — korzeniowy `vitest.config.mts` (współdzielony w monorepo, poza zakresem edycji
 * `test-author`) nie ma skonfigurowanego aliasu `@/*`, więc bez interwencji import wywala
 * się na "Cannot find package '@/...'" (zweryfikowane próbą). `filterProducts` sama w
 * sobie nie dotyka żadnego z tych modułów (czysta funkcja na tablicy/obiekcie), więc
 * zamiast zmieniać współdzieloną konfigurację, te zależności są zamockowane `vi.mock` —
 * moduły nigdy nie są faktycznie importowane/renderowane, `filterProducts` jest wołana
 * bez modyfikacji. Ten sam trik (mockowanie modułu po nierozwiązywalnej ścieżce aliasu)
 * NIE wymaga jsdom/RTL — to wciąż czysty test funkcji, nie renderowanie komponentu.
 */

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/components/ui/ProductCard', () => ({ ProductCard: () => null, calcBrutto: () => 0 }));
vi.mock('@/components/ui/DeviceModal', () => ({ DeviceModal: () => null }));
vi.mock('@/components/layout/Navbar', () => ({ default: () => null }));
vi.mock('@/components/layout/Footer', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));

const { filterProducts } = await import('../app/katalog/page');

function makeProduct(overrides: Partial<BestsellerProduct> & { _raw?: any }): BestsellerProduct {
  return {
    id: overrides.id ?? 'id',
    brand: overrides.brand ?? 'Fuji Electric',
    brandLogo: 'FE',
    model: 'Model',
    power: '2.5 kW',
    img: 'https://example.test/img.jpg',
    deviceNettoPrice: overrides.deviceNettoPrice ?? 1000,
    installNettoPrice: 1500,
    _raw: { color: 'Biały', ...overrides._raw },
    ...overrides,
  };
}

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
  it('filtry marki i koloru składają się w koniunkcji (AND), nie w alternatywę (OR)', () => {
    const products: BestsellerProduct[] = [
      // Pasuje do OBU filtrów naraz — jedyny oczekiwany wynik.
      makeProduct({ id: 'fuji-bialy', brand: 'Fuji Electric', _raw: { color: 'Biały' } }),
      // Pasuje TYLKO do marki — złe koniunkcji zaakceptowałoby to jako "OR marka".
      makeProduct({ id: 'fuji-czarny', brand: 'Fuji Electric', _raw: { color: 'Czarny' } }),
      // Pasuje TYLKO do koloru — złe koniunkcji zaakceptowałoby to jako "OR kolor".
      makeProduct({ id: 'haier-bialy', brand: 'Haier', _raw: { color: 'Biały' } }),
      // Nie pasuje do żadnego z filtrów.
      makeProduct({ id: 'haier-czarny', brand: 'Haier', _raw: { color: 'Czarny' } }),
    ];

    const result = filterProducts(products, {
      roomType: 'all',
      brands: ['Fuji Electric'],
      colors: ['Biały'],
      area: 'all',
      features: { wifi: false, silent: false, presence: false },
    });

    expect(result.map((p) => p.id)).toEqual(['fuji-bialy']);
  });

  // @REQ: B2C-CATALOG-LIST
  it('brak zaznaczonych filtrów marki/koloru zwraca wszystkie produkty (bez zawężenia)', () => {
    const products: BestsellerProduct[] = [
      makeProduct({ id: 'a', brand: 'Fuji Electric', _raw: { color: 'Biały' } }),
      makeProduct({ id: 'b', brand: 'Haier', _raw: { color: 'Czarny' } }),
    ];

    const result = filterProducts(products, {
      roomType: 'all',
      brands: [],
      colors: [],
      area: 'all',
      features: { wifi: false, silent: false, presence: false },
    });

    expect(result.map((p) => p.id).sort()).toEqual(['a', 'b']);
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
