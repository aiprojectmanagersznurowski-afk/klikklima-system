import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * RUNDA 3 (2026-09-24): poprzednie uzasadnienie `it.todo` w tym pliku ("apps/b2c-web
 * nie ma paczki do renderowania komponentów w teście ani emulacji DOM") było BŁĘDNE —
 * `jsdom`, `@testing-library/react` i `@testing-library/user-event` są zainstalowane w
 * monorepo (deklarowane w `apps/b2b-web/package.json`, ale hoisted do korzeniowego
 * `node_modules/`, więc rozwiązywalne z każdego pakietu — zweryfikowane `require.resolve`
 * przed napisaniem tego pliku).
 *
 * DRUGA PRZESZKODA, RÓWNIEŻ REALNIE ZWERYFIKOWANA (nie założona): standardowa ścieżka —
 * pragma "at-vitest-environment jsdom" (mechanizm wbudowany w Vitest, używany gdzie
 * indziej w monorepo, np. apps/b2b-web) — W TEJ WERSJI (Vitest 4 / nowe Vite
 * Environment API) powoduje, że silnik rozwiązywania modułów tego środowiska odrzuca
 * import HomePageClient.tsx na aliasach @/... jeszcze PRZED zadziałaniem mockowania
 * modułów ("Failed to resolve import '@/components/ui/DeviceModal'"), mimo że te same
 * mocki na tych samych aliasach działają bez zarzutu w środowisku domyślnym (node) —
 * patrz `tests/catalog-filters.test.ts` w tym katalogu, gdzie identyczny wzorzec
 * mockowania aliasów działa. To jest różnica w silniku środowiska jsdom Vitesta, nie w
 * dostępności paczek. Korzeniowy `vitest.config.mts` (współdzielony w monorepo, poza
 * zakresem edycji `test-author`) nie deklaruje aliasu `@/*`, więc nie da się tego
 * naprawić bez dotykania współdzielonej konfiguracji.
 *
 * PUŁAPKA PRZY PISANIU TEGO KOMENTARZA (zapisana tu, żeby się nie powtórzyła): sam
 * literalny wzorzec tekstowy funkcji-mockującej-moduł z otwierającym nawiasem, wpisany
 * w treść komentarza JSDoc jako przykład kodu, wystarczył, żeby mechanizm podnoszenia
 * (hoistingu) wywołań mockujących w tym pliku się zepsuł — realne wywołania niżej w
 * pliku przestawały być podnoszone przed statycznymi importami, dając TĘ SAMĄ
 * sygnaturę błędu ("Failed to resolve import"), mimo że kod poniżej jest poprawny.
 * Zweryfikowane bisekcją: usunięcie tego wzorca z komentarza naprawiało import.
 *
 * ROZWIĄZANIE: zamiast wbudowanej pragmy środowiska jsdom, ten plik zostaje w
 * DOMYŚLNYM środowisku node (tam, gdzie mockowanie aliasów @/... działa) i RĘCZNIE
 * konstruuje `window`/`document` przez `new JSDOM(...)` + `vi.stubGlobal(...)`, PRZED
 * zaimportowaniem `HomePageClient` i modułów RTL. To wciąż ta sama biblioteka jsdom
 * (prawdziwe DOM API: `window.location`, `window.history`, `window.scrollTo`), tylko
 * podpięta ręcznie zamiast przez plugin środowiska Vitesta — omija WYŁĄCZNIE silnik
 * rozwiązywania modułów tego pluginu, nie samą emulację DOM.
 */

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
vi.stubGlobal('window', dom.window);
vi.stubGlobal('document', dom.window.document);
vi.stubGlobal('navigator', dom.window.navigator);
vi.stubGlobal('HTMLElement', dom.window.HTMLElement);

const { createElement } = await import('react');
const { render, screen, cleanup } = await import('@testing-library/react');
const userEvent = (await import('@testing-library/user-event')).default;

// `getFomoSlots`/`getBestsellers` są importowane przez HomePageClient.tsx jako WARTOŚCI
// (nie `import type`), więc ich moduły wykonują się przy imporcie i ciągną
// `@/lib/supabaseClient` — mockowanie zapobiega temu samemu problemowi, co przy
// `soft-lead.test.ts` w `tests/actions/`, tu na poziomie całego drzewa importów strony.
vi.mock('../app/actions/getFomoSlots', () => ({ getFomoSlots: vi.fn() }));
vi.mock('../app/actions/getBestsellers', () => ({ getBestsellers: vi.fn() }));

// Navbar/Footer nie biorą udziału w kontrakcie B2C-NAV-STATE (nawigacja/adres/scroll) —
// zastąpione `null`, żeby nie ciągnąć `next/navigation` (`usePathname`) bez prawdziwego
// routera Next.
vi.mock('@/components/layout/Navbar', () => ({ default: () => null }));
vi.mock('@/components/layout/Footer', () => ({ default: () => null }));

// ProductCard/DeviceModal są zastąpione minimalnymi atrapami, które wołają DOKŁADNIE te
// same propsy (`onOpenModal`, `onClose`), których używa PRAWDZIWY `HomePageClient` —
// test sprawdza logikę stanu/adresu W `HomePageClient`, nie wewnętrzną treść tych
// komponentów (ta jest pokryta gdzie indziej / przez E2E).
vi.mock('@/components/ui/ProductCard', () => ({
  ProductCard: ({
    product,
    onOpenModal,
  }: {
    product: { model: string };
    onOpenModal: (p: unknown) => void;
  }) => createElement('button', { onClick: () => onOpenModal(product) }, `open-${product.model}`),
  calcBrutto: () => 0,
}));
vi.mock('@/components/ui/DeviceModal', () => ({
  DeviceModal: ({ onClose }: { onClose: () => void }) =>
    createElement('button', { onClick: onClose }, 'close-modal'),
}));

const { default: HomePageClient } = await import('../app/HomePageClient');

const testProduct = {
  id: '1',
  brand: 'Fuji Electric',
  brandLogo: 'FE',
  model: 'KLTA-25',
  power: '2.5 kW',
  img: '',
  deviceNettoPrice: 1000,
  installNettoPrice: 1500,
};

describe('B2C-NAV-STATE — otwarcie/zamknięcie modala urządzenia (kryt. 2)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // @REQ: B2C-NAV-STATE
  it('otwarcie modala urządzenia dopisuje ?device=<model> do adresu i wpisu historii', async () => {
    const user = userEvent.setup();
    render(
      createElement(HomePageClient, {
        initialFomoData: null,
        initialDbProducts: [testProduct],
      }),
    );

    await user.click(screen.getByText('open-KLTA-25'));

    expect(new URL(window.location.href).searchParams.get('device')).toBe('KLTA-25');
    expect((window.history.state as { device?: string } | null)?.device).toBe('KLTA-25');
  });

  // @REQ: B2C-NAV-STATE
  it('zamknięcie modala przywraca adres sprzed otwarcia (usuwa ?device=) i NIE przewija strony', async () => {
    const user = userEvent.setup();
    render(
      createElement(HomePageClient, {
        initialFomoData: null,
        initialDbProducts: [testProduct],
      }),
    );

    await user.click(screen.getByText('open-KLTA-25'));
    expect(window.location.search).toContain('device=KLTA-25');

    // Spy zamiast realnej pozycji przewinięcia: jsdom nie implementuje layoutu, więc
    // `window.scrollY` jest zawsze 0 niezależnie od wywołań `scrollTo` (zweryfikowane
    // przed napisaniem tego testu) — asercja na samej wartości `scrollY` byłaby martwa.
    // Szpieg na `scrollTo` ma zęby: wykryje realne wywołanie, gdyby ktoś je dodał.
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await user.click(screen.getByText('close-modal'));

    expect(window.location.search).toBe('');
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

/**
 * Kryt. 1 (przywrócenie pozycji scrolla po nawigacji WSTECZ z Katalogu/Bazy Wiedzy) NIE
 * jest pokryte na tym poziomie — celowa, udokumentowana decyzja, nie przeoczenie.
 * `HomePageClient` nie ma własnej logiki przywracania scrolla (żadnego odwołania do
 * `sessionStorage`/zapamiętanej pozycji w tym pliku — zweryfikowane odczytem); kryt. 1
 * polega na DOMYŚLNYM zachowaniu przeglądarki (`history.scrollRestoration` / bfcache)
 * przy PRAWDZIWEJ nawigacji między załadowaniami stron. `jsdom` nie renderuje pojedynczej
 * strony jako część prawdziwej historii sesji przeglądarki z bfcache — nie da się tego
 * zasymulować w tym samym renderze bez fabrykowania testu, który i tak nie odróżniłby
 * poprawnego zachowania przeglądarki od błędnego. Pokrycie kryt. 1 pozostaje wyłącznie w
 * `apps/b2c-web/e2e/navigation.spec.ts` (`should restore scroll position when going back
 * from Catalog` / `... from Knowledge Base`).
 */
