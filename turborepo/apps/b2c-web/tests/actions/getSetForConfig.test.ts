import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROOM_COUNT_EXPERT_THRESHOLD, DISQUALIFICATION_RULES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md — AC15.
 *
 * Umiejscowienie pliku: `apps/b2c-web/tests/actions/`, NIE `apps/b2c-web/app/actions/`
 * — patrz komentarz na górze `getRecommendation.test.ts` w tym samym katalogu,
 * ten sam powód (`guard-paths`, zakres zapisu roli `test-author`).
 *
 * Ta sama konieczność mockowania `@/lib/supabaseClient` i `next/cache` co w
 * `getRecommendation.test.ts` — `getSetForConfig.ts` importuje oba identycznie.
 */
const { fromSpy } = vi.hoisted(() => ({
  fromSpy: vi.fn(() => {
    throw new Error('getSetForConfig: baza nie powinna być odpytana dla konfiguracji dyskwalifikującej');
  }),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: fromSpy } }));
vi.mock('next/cache', () => ({ unstable_noStore: () => {} }));

const { getSetForConfig } = await import('../../app/actions/getSetForConfig');

const roomsOfLength = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `room-${i + 1}`, size: 'M' as const }));

// Ta sama luka codegenu co w getRecommendation.test.ts: DISQUALIFICATION_OUTCOMES
// z contracts/triage.contract.mjs nie trafiło do packages/contracts/src/generated/triage.ts.
// Sięgamy po `.outcome` z DISQUALIFICATION_RULES (wygenerowane, realne).
const EXPERT_OUTCOME = DISQUALIFICATION_RULES[0].outcome; // 'EXPERT_SCREEN' — źródło: kontrakt, nie literał

describe('getSetForConfig — odrzucenie serwerowe przy rooms.length >= próg (AC15)', () => {
  beforeEach(() => {
    fromSpy.mockClear();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('rooms.length === ROOM_COUNT_EXPERT_THRESHOLD: wynik odróżnialny od `null` i bez pól cenowych', async () => {
    const result = await getSetForConfig('Test Series', roomsOfLength(ROOM_COUNT_EXPERT_THRESHOLD));

    // Dziś każda ścieżka negatywna w getSetForConfig kończy się `return null` (WO,
    // "Ryzyka" pkt 3) — a `null` w DeviceModal czyta się jako "brak dopasowania"
    // i SPADA na fallback cenowy `basePrice` (DeviceModal.tsx:343), czyli i tak
    // pokazuje cenę "od". Odróżnialność od `null` jest więc sednem AC15, nie
    // szczegółem technicznym. `not.toBeNull()` samo w sobie przepuściłoby też
    // `{}` albo cokolwiek przypadkowego — sednem jest wynik ROZPOZNAWALNY jako
    // dyskwalifikacja (REVIEW: MAJOR).
    expect(result).toMatchObject({ disqualified: true, outcome: EXPERT_OUTCOME });

    expect(fromSpy).not.toHaveBeenCalled();

    if (result !== null) {
      expect(result).not.toHaveProperty('priceNetto');
      expect(result).not.toHaveProperty('installPrice');
      expect(result).not.toHaveProperty('totalPrice');
    }
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('rooms.length === 5 (górna granica RoomCount): to samo odrzucenie co przy progu', async () => {
    const result = await getSetForConfig('Test Series', roomsOfLength(ROOM_COUNT_EXPERT_THRESHOLD + 1));

    expect(result).toMatchObject({ disqualified: true, outcome: EXPERT_OUTCOME });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy z WO ("Przypadki brzegowe, które MUSZĄ mieć test"): lista
  // pokojów bez `size` u części elementów, ale o długości >= progu — długość
  // listy sama w sobie musi wystarczyć do odrzucenia, niezależnie od kompletności
  // konfiguracji.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('rooms.length >= próg z elementami bez size: odrzucone na długości listy, nie na kompletności', async () => {
    const incompleteRooms = Array.from({ length: ROOM_COUNT_EXPERT_THRESHOLD }, (_, i) => ({
      id: `room-${i + 1}`,
      size: undefined as unknown as 'S',
    }));

    const result = await getSetForConfig('Test Series', incompleteRooms);

    expect(result).toMatchObject({ disqualified: true, outcome: EXPERT_OUTCOME });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  // Przypadek pusty: lista długości 0 nie ma jak spełnić reguły GTE progu — nie
  // powinna być traktowana jak dyskwalifikacja, powinna zachować się jak dziś.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('przypadek pusty: rooms = [] nie jest dyskwalifikowany przez regułę liczby pomieszczeń', async () => {
    await getSetForConfig('Test Series', []);
    // Pusta konfiguracja nie ma progu do przekroczenia — zapytanie o dopasowanie
    // (i jego naturalna porażka na braku danych) pozostaje dziś niezmienione.
    expect(fromSpy).toHaveBeenCalled();
  });

  // Kontrola negatywna (dziś zielona, ma zostać zielona po implementacji): próg-1
  // to główny przypadek biznesowy — żądanie MUSI dotrzeć do warstwy danych.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('kontrola negatywna: rooms.length = próg-1 dociera do zapytania o dopasowanie (nie jest dyskwalifikowany)', async () => {
    await getSetForConfig('Test Series', roomsOfLength(ROOM_COUNT_EXPERT_THRESHOLD - 1));
    expect(fromSpy).toHaveBeenCalled();
  });
});
