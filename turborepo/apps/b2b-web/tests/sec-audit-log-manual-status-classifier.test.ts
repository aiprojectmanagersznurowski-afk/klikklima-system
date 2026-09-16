import { describe, it, expect } from 'vitest';
import { TRANSITIONS, STATE_META } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-MANUAL-STATUS.md — Fala A (mechanizm klasyfikujący).
 * Wymaganie: `SEC-AUDIT-LOG-MANUAL-STATUS` (`contracts/requirements.contract.mjs`, AC4).
 *
 * Ten plik testuje WYŁĄCZNIE czystą funkcję klasyfikującą `isManualStatusChange`,
 * bez żadnych mocków — jest to funkcja czysta licząca się z `TRANSITIONS`
 * (`@klikklima/contracts`), nie z listy nazw funkcji w kodzie aplikacji (AC4).
 *
 * Kryteria (contracts/funnel.contract.mjs:67-79, D3 2026-09-04):
 *   K1 — actor przejścia ∉ {ADMIN, DISPATCHER} (operatorzy panelu B2B),
 *   K3 — STATE_META[from].kind === 'BUCKET' lub STATE_META[to].kind === 'BUCKET',
 *   K4 — `override: true` na przejściu.
 * K2 (brak pary from/to w TRANSITIONS) NIE dotyczy tej funkcji — przyjmuje ID
 * istniejącego przejścia, a nie parę (from, to); K2 jest kryterium dla
 * `advanceLeadStatus` (Fala C), które sprawdza pary spoza `TRANSITIONS` w ogóle.
 *
 * Funkcja NIE ISTNIEJE dziś w `apps/b2b-web/src` — import poniżej musi się wysypać
 * (brak modułu / brak eksportu), co jest poprawnym RED dla tej fazy.
 *
 * Ścieżka pliku produkcyjnego wybrana dla implementera (test-author, decyzja projektowa
 * WO): `apps/b2b-web/src/lib/audit/manual-status-classifier.ts`, żeby żyć obok
 * `delete-justification-schema.ts` i `role-change-schema.ts` w tym samym module `lib/audit`.
 */
import { isManualStatusChange } from '../src/lib/audit/manual-status-classifier';

/**
 * Oczekiwana klasyfikacja dla WSZYSTKICH 17 przejść z dzisiejszego kontraktu
 * (2026-09-04), wyliczona ręcznie z K1/K3/K4 — NIE z tego samego algorytmu co
 * implementacja, żeby test rzeczywiście dowodził czegoś, a nie odbijał się od
 * własnego lustra. Cztery przejścia są "normalną pracą operatora/procesu docelowego":
 * T01 (assignAuditor, ADMIN, STAGE→STAGE), T05 (assignCrew, ADMIN, STAGE→STAGE),
 * T06 (shipByCourier, DISPATCHER, STAGE→STAGE) — żadne z K1/K3/K4 ich nie łapie —
 * oraz T17 (completePhaseOne, patrz niżej, wyjęte spod K1 przez `manualEquivalent`).
 * Wszystkie pozostałe 12 są "ręczne" z co najmniej jednego powodu:
 *   T02 sendQuote — actor AUDITOR (K1)
 *   T03 acceptQuoteAndBook — actor CLIENT (K1)
 *   T04 expireQuote — actor SYSTEM (K1)
 *   T07 deliverWithCrew — override: true (K4), jako JEDYNE przejście złapane wyłącznie przez K4
 *   T08 markDelivered — actor SYSTEM formalnie spełnia K1, ale `manualEquivalent: true`
 *       (D4, 2026-09-04, WO SEC-AUDIT-LOG-MANUAL-STATUS-T08-FIX) anuluje WYŁĄCZNIE K1 dla
 *       TEGO przejścia — webhook kuriera i przycisk dyspozytora dzielą ten sam `action`,
 *       więc `markAsDelivered` ma pozostać wykluczone z audytu (potwierdzenie faktu
 *       fizycznego, nie obejście reguły). T08 nie łapie ani K3 (STAGE→STAGE), ani K4
 *       (brak `override`) — klasyfikuje się jako `false`.
 *   T09 completeInstallation — actor INSTALLER (K1)
 *   T10-T12 rollback — actor DISPATCHER, ale `to` = ROLLBACK_RESCHEDULING (BUCKET) → K3
 *   T13 rollback (z AWAITING_INSTALLATION) — actor CLIENT (K1) I `to` BUCKET (K3)
 *   T14 rebookInstallation — actor CLIENT (K1) I `from` ROLLBACK_RESCHEDULING (BUCKET) (K3)
 *   T15 returnToFunnel — `from` QUOTE_REJECTED (BUCKET) (K3)
 *   T16 archiveLost — `from` QUOTE_REJECTED (BUCKET) i `to` ARCHIVED_LOST (BUCKET) (K3)
 *
 * T17 completePhaseOne — actor INSTALLER formalnie spełnia K1, ale
 *   `manualEquivalent: true` (funnel.contract.mjs, decyzja C.4/D3 2026-09-16, WO
 *   FNL-2PHASE-BOOKING-MECHANICS) anuluje WYŁĄCZNIE K1, wzorem T08 (D4, 2026-09-04):
 *   zamknięcie etapu I przez operatora panelu B2B jest normalną pracą, nie ma
 *   zaszumiać audytu. from/to = AWAITING_INSTALLATION (STAGE→STAGE) nie łapie K3,
 *   brak `override` nie łapie K4 — klasyfikuje się jako `false`.
 */
const EXPECTED_CLASSIFICATION: Record<string, boolean> = {
  T01: false,
  T02: true,
  T03: true,
  T04: true,
  T05: false,
  T06: false,
  T07: true,
  T08: false,
  T09: true,
  T10: true,
  T11: true,
  T12: true,
  T13: true,
  T14: true,
  // T17 completePhaseOne — actor INSTALLER formalnie spełnia K1, ale
  // `manualEquivalent: true` (funnel.contract.mjs, decyzja C.4/D3 2026-09-16,
  // WO FNL-2PHASE-BOOKING-MECHANICS) anuluje WYŁĄCZNIE K1 dla TEGO przejścia —
  // wzorzec identyczny z T08 (D4, 2026-09-04): zamknięcie etapu I przez
  // operatora panelu B2B (dyspozytor/administrator) w normalnym przebiegu nie
  // ma być logowane jako `manual_status_change`. from/to = AWAITING_INSTALLATION
  // (STAGE→STAGE) nie łapie K3, brak `override` nie łapie K4 — klasyfikuje się
  // jako `false`. TEST-DEFECT (naprawione): wcześniejsze `true` było prawdziwe
  // PRZED dodaniem `manualEquivalent: true` do T17 w tej samej sesji.
  T17: false,
  T15: true,
  T16: true,
};

describe('isManualStatusChange — mechanizm klasyfikujący (SEC-AUDIT-LOG-MANUAL-STATUS, AC4)', () => {
  // AC4 — dowód, że tabela oczekiwań w tym pliku NIE jest cichą listą literałów
  // pozostawioną w tyle za kontraktem: jeśli ktoś dopisze 18. przejście do
  // TRANSITIONS bez aktualizacji tego pliku, ten test jest czerwony PIERWSZY
  // i wprost, zanim dojdzie do porównania klasyfikacji.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('tabela oczekiwań pokrywa DOKŁADNIE wszystkie przejścia dzisiejszego kontraktu (żadnego mniej, żadnego więcej)', () => {
    const idsFromContract = TRANSITIONS.map((t) => t.id).sort();
    const idsFromExpectations = Object.keys(EXPECTED_CLASSIFICATION).sort();
    expect(idsFromExpectations).toEqual(idsFromContract);
  });

  // AC4 — kontrola pozytywna: kontrakt musi zawierać zarówno przejścia normalne,
  // jak i ręczne, inaczej powyższa tabela nie dowodziłaby rozróżnienia.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('kontrola pozytywna — dzisiejszy kontrakt ma zarówno przejścia normalne, jak i ręczne', () => {
    const values = Object.values(EXPECTED_CLASSIFICATION);
    expect(values).toContain(true);
    expect(values).toContain(false);
  });

  // Test tabelaryczny właściwy (AC4) — dla KAŻDEGO z 17 przejść z dzisiejszego
  // kontraktu, licznik czytany z TRANSITIONS (nie z literału zliczonego z góry).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(TRANSITIONS.map((t) => [t.id, t.action, EXPECTED_CLASSIFICATION[t.id]] as const))(
    '%s (%s) → isManualStatusChange = %s',
    (id, _action, expected) => {
      expect(isManualStatusChange(id)).toBe(expected);
    },
  );

  // K1 — dowód niezależny od tabeli powyżej: KAŻDE przejście, którego aktor nie
  // jest operatorem panelu ({ADMIN, DISPATCHER}), jest klasyfikowane jako ręczne,
  // niezależnie od guardów, efektów czy pola `override` — Z WYJĄTKIEM przejść
  // oznaczonych `manualEquivalent: true` (D4, 2026-09-04), które są DOKŁADNIE
  // zaprojektowanym wyłomem od tej reguły (dziś: wyłącznie T08). Wykluczenie ich
  // z tego filtra nie jest obejściem testu — to jest granica samego kryterium K1,
  // udokumentowana w kontrakcie (contracts/funnel.contract.mjs).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('K1 — aktor spoza {ADMIN, DISPATCHER} zawsze klasyfikuje przejście jako ręczne (poza manualEquivalent)', () => {
    const nonOperatorTransitions = TRANSITIONS.filter(
      (t) => t.actor !== 'ADMIN' && t.actor !== 'DISPATCHER' && t.manualEquivalent !== true,
    );
    // Kontrola pozytywna kryterium: musi istnieć co najmniej jedno takie przejście
    // w dzisiejszym kontrakcie, inaczej K1 nie jest w ogóle ćwiczone.
    expect(nonOperatorTransitions.length).toBeGreaterThan(0);
    for (const t of nonOperatorTransitions) {
      expect(isManualStatusChange(t.id)).toBe(true);
    }
  });

  // K3 — dowód niezależny: KAŻDE przejście dotykające krawędzi bucketu (from LUB to
  // ma STATE_META.kind === 'BUCKET') jest klasyfikowane jako ręczne, niezależnie
  // od tego, czy aktor jest operatorem panelu.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('K3 — krawędź bucketu (from lub to) zawsze klasyfikuje przejście jako ręczne', () => {
    const bucketEdgeTransitions = TRANSITIONS.filter(
      (t) => STATE_META[t.from].kind === 'BUCKET' || STATE_META[t.to].kind === 'BUCKET',
    );
    expect(bucketEdgeTransitions.length).toBeGreaterThan(0);
    for (const t of bucketEdgeTransitions) {
      expect(isManualStatusChange(t.id)).toBe(true);
    }
  });

  // K4 — T07 jest, na dzień pisania testu, JEDYNYM przejściem złapanym WYŁĄCZNIE
  // przez `override: true` (aktor DISPATCHER właściwy, STAGE→STAGE, brak krawędzi
  // bucketu) — usunięcie K4 z implementacji zgubiłoby dokładnie ten jeden przypadek.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('K4 — T07 (deliverWithCrew, "Bypass") jest ręczne WYŁĄCZNIE dzięki polu override, nie K1 ani K3', () => {
    const t07 = TRANSITIONS.find((t) => t.id === 'T07')!;
    expect(t07.override).toBe(true);
    expect(t07.actor === 'ADMIN' || t07.actor === 'DISPATCHER').toBe(true); // K1 NIE łapie
    expect(STATE_META[t07.from].kind).toBe('STAGE'); // K3 NIE łapie (from)
    expect(STATE_META[t07.to].kind).toBe('STAGE'); // K3 NIE łapie (to)

    expect(isManualStatusChange('T07')).toBe(true);
  });

  // D4 (2026-09-04, WO SEC-AUDIT-LOG-MANUAL-STATUS-T08-FIX) — dowód niezależny: T08
  // jest wyjęte spod K1 WYŁĄCZNIE przez `manualEquivalent: true`, a nie dlatego, że
  // aktor formalnie spełnia K1 inaczej, ani dlatego, że K3/K4 akurat też go nie łapią
  // z jakiegoś innego powodu. Ten test pilnuje, żeby flaga `manualEquivalent` nie
  // zaczęła po cichu anulować czegoś więcej niż K1 — jeśli ktoś rozszerzy jej efekt
  // na K3 lub K4, albo cofnie flagę bez uzasadnienia, ten test staje się czerwony
  // pierwszy i wprost. Wzorowany na teście K4/T07 powyżej (linie 133-141).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('T08 (markDelivered) jest wyjęte z K1 WYŁĄCZNIE przez manualEquivalent — K3 i K4 go nie łapią', () => {
    const t08 = TRANSITIONS.find((t) => t.id === 'T08')!;
    expect(t08.manualEquivalent).toBe(true); // wyłom z K1, jedyny dziś w kontrakcie
    expect(t08.actor).toBe('SYSTEM'); // formalnie SPEŁNIA K1 — bez flagi byłby ręczny
    expect(STATE_META[t08.from].kind).toBe('STAGE'); // K3 NIE łapie (from)
    expect(STATE_META[t08.to].kind).toBe('STAGE'); // K3 NIE łapie (to)
    expect(t08.override).not.toBe(true); // K4 NIE łapie

    expect(isManualStatusChange('T08')).toBe(false);
  });

  // Kontrola negatywna jawna: T01, T05, T06 są "zwykłą pracą" (AC3) — żadne z K1/K3/K4
  // ich nie łapie. Wymienione z ID wprost (nie wyliczone filtrem), żeby przypadkowa
  // zmiana STATE_META albo actor w kontrakcie na jednym z nich była widoczna jako
  // regresja tego konkretnego testu, a nie zniknęła w ogólnym filtrze.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(['T01', 'T05', 'T06'] as const)('%s jest zwykłą pracą operatora — NIE jest ręczną zmianą statusu', (id) => {
    expect(isManualStatusChange(id)).toBe(false);
  });

  // Przypadek brzegowy: ID przejścia, którego kontrakt nie zna. Fail-closed —
  // klasyfikator NIE MOŻE po cichu zwrócić `false` (co ukryłoby operację przed
  // audytem), musi zasygnalizować błąd wywołującemu.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('przejście spoza kontraktu (nieznane ID) rzuca błąd zamiast fail-open zwrócić false', () => {
    expect(() => isManualStatusChange('T999-NIE-ISTNIEJE')).toThrow();
  });
});
