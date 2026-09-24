import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MAJOR M5 (recenzja 2026-09-24): `triageStore.ts` (linie 131, 146, 151) porównuje
 * `state.data.location` z literałem PL wpisanym z ręki (`'Mieszkanie'`) w logice
 * warunkowej `nextStep`/`prevStep`, mimo że plik JUŻ importuje `BUILDING_TYPE_PL`
 * z `@klikklima/contracts` (linia 3-9) właśnie po to, żeby takie literały nie się
 * zdarzały (komentarz w pliku to wyjaśnia). Rozjazd: gdyby `BUILDING_TYPE_PL.APARTMENT`
 * zmieniło wartość w kontrakcie, warunek przeskoku kroków 4→6 przestałby rozpoznawać
 * mieszkania — a nic by o tym nie ostrzegło, bo literał `'Mieszkanie'` żyje własnym
 * życiem, niezależnym od kontraktu.
 *
 * Dowód: podmieniamy WYŁĄCZNIE `BUILDING_TYPE_PL.APARTMENT` (partial mock przez
 * `importOriginal`, ten sam wzorzec co RBAC capability spy w innych testach tego
 * repo) na inną wartość Z TEGO SAMEGO union'a `LocationType` (`'Dom'` — więc test nie
 * łamie typowania store'a i nie potrzebuje żadnego rzutowania). Jeżeli logika store'a
 * faktycznie czyta z `BUILDING_TYPE_PL.APARTMENT`, to `location: 'Dom'` powinno być
 * TERAZ traktowane jak mieszkanie (bo to jest zmapowana wartość APARTMENT) — krok 4
 * nie przeskakuje do 6, idzie do 5. Dzisiejsza implementacja porównuje z literałem
 * `'Mieszkanie'`, więc `'Dom' !== 'Mieszkanie'` i przeskakuje do 6 niezależnie od
 * mocka — to jest właściwy RED.
 */

vi.mock('@klikklima/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klikklima/contracts')>();
  return {
    ...actual,
    BUILDING_TYPE_PL: {
      ...actual.BUILDING_TYPE_PL,
      // 'Dom' jest już członkiem LocationType — żaden rzutowanie typu nie jest
      // potrzebne w store'ie ani w tym teście.
      APARTMENT: 'Dom',
    },
  };
});

const { useTriageStore } = await import('../../store/triageStore');

describe('B2C-TRIAGE-CONDITIONAL — nextStep/prevStep muszą czytać BUILDING_TYPE_PL.APARTMENT z kontraktu, nie literał \'Mieszkanie\'', () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('nextStep z kroku 4 rozpoznaje mieszkanie po ZMAPOWANEJ wartości BUILDING_TYPE_PL.APARTMENT, nie po literale \'Mieszkanie\'', () => {
    const store = useTriageStore.getState();

    // 'Dom' to dziś zmapowana wartość APARTMENT (mock powyżej) — poprawna implementacja
    // powinna więc iść ścieżką mieszkania (krok 5), nie pomijać Pokoi/Metrażu (krok 6).
    store.updateData({ location: 'Dom' });
    store.goToStep(4);
    useTriageStore.getState().nextStep();

    expect(useTriageStore.getState().step).toBe(5);
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('prevStep z kroku 6 NIE przeskakuje ścieżki mieszkania (5→4), jeśli lokalizacja to ZMAPOWANA wartość APARTMENT (symetria z nextStep)', () => {
    const store = useTriageStore.getState();

    store.updateData({ location: 'Dom' });
    store.goToStep(6);
    useTriageStore.getState().prevStep();

    // Ścieżka mieszkania (APARTMENT) z kroku 6 (loader) wraca domyślnie na krok 5
    // (Metraż/Stan lokalu), bez przeskoku do 4 — przeskok do 4 jest zarezerwowany dla
    // ścieżki NIE-mieszkania. Poprawna implementacja rozpoznaje 'Dom' jako zmapowaną
    // wartość APARTMENT i NIE wchodzi w warunek przeskoku. Dzisiejszy kod (linia 145-146)
    // porównuje z literałem 'Mieszkanie' — 'Dom' !== 'Mieszkanie' jest prawdą niezależnie
    // od mapowania kontraktu, więc błędnie ląduje na kroku 4.
    expect(useTriageStore.getState().step).toBe(5);
  });
});
