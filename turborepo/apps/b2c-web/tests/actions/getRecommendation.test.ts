import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROOM_COUNT_EXPERT_THRESHOLD, DISQUALIFICATION_RULES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md — AC7, AC8, AC9.
 *
 * Umiejscowienie pliku: `apps/b2c-web/tests/actions/`, NIE `apps/b2c-web/app/actions/`
 * jak sugeruje tabela plików w WO. `guard-paths` ogranicza zapis roli `test-author`
 * do `tests/`, `e2e/`, `__tests__/`, `apps/(dowolny pakiet)/tests/`,
 * `packages/(dowolny pakiet)/tests/` — katalog obok Server Action jest poza
 * zakresem tej roli.
 *
 * `getRecommendation.ts` importuje `@/lib/supabaseClient` (alias `@/*` z
 * `apps/b2c-web/tsconfig.json`), którego `vitest.config.mts` w korzeniu repo
 * NIE zna (aliasuje wyłącznie `@klikklima/contracts`). Bez mocka poniżej import
 * pada na `Error: Cannot find package '@/lib/supabaseClient'` — błąd infrastruktury
 * testowej, nie logiki domenowej, czyli dokładnie ten "zły RED", którego bramka
 * zakazuje. `vi.mock` przechwytuje import po literale specyfikatora, więc działa
 * mimo braku aliasu (zweryfikowane empirycznie przed napisaniem tego pliku).
 * Mockujemy też `next/cache`, bo `unstable_noStore()` wymaga kontekstu żądania
 * Next.js, którego w vitest nie ma.
 */
const { fromSpy } = vi.hoisted(() => ({
  fromSpy: vi.fn(() => {
    throw new Error('getRecommendation: baza nie powinna być odpytana dla konfiguracji dyskwalifikującej');
  }),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: fromSpy } }));
vi.mock('next/cache', () => ({ unstable_noStore: () => {} }));

const { getRecommendation } = await import('../../app/actions/getRecommendation');

// `DISQUALIFICATION_OUTCOMES` opisane w contracts/triage.contract.mjs NIE trafiło do
// packages/contracts/src/generated/triage.ts — to luka w codegenie (poza zakresem tego
// WO, zgłoszona w podsumowaniu), więc sięgamy po ten sam ciąg przez pole `outcome`
// obecne na każdej regule w `DISQUALIFICATION_RULES`, które JEST wygenerowane.
const EXPERT_OUTCOME = DISQUALIFICATION_RULES[0].outcome; // 'EXPERT_SCREEN' — źródło: kontrakt, nie literał

const roomSizesFor = (count: number) => {
  const sizes: Record<number, string> = {};
  for (let i = 1; i <= count; i++) sizes[i] = 'Do 20 m²';
  return sizes;
};

const priceRelatedKeys = (obj: unknown): string[] => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).filter((k) => /price|netto|brutto|recommendation/i.test(k));
};

describe('getRecommendation — odrzucenie serwerowe dla konfiguracji dyskwalifikującej', () => {
  beforeEach(() => {
    fromSpy.mockClear();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('AC7 — roomCount >= ROOM_COUNT_EXPERT_THRESHOLD: odmowa EXPERT_SCREEN, bez pytania bazy i bez cen', async () => {
    const result = await getRecommendation(ROOM_COUNT_EXPERT_THRESHOLD, roomSizesFor(ROOM_COUNT_EXPERT_THRESHOLD));

    // Twardszy dowód niż brak ceny na ekranie (WO, "Mechanika D3" pkt 3): żadnego zapytania do bazy.
    expect(fromSpy).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain(EXPERT_OUTCOME);
    expect(result).not.toHaveProperty('recommendations');
    expect(priceRelatedKeys(result)).toEqual([]);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('AC8 — typ budynku COMMERCIAL: odmowa EXPERT_SCREEN nawet dla 1 pomieszczenia', async () => {
    // Sygnatura dziś NIE przyjmuje typu budynku (WO: "Wymaga przekazania typu budynku
    // do warstwy serwerowej — dziś go tam nie ma"). Wołamy z zakładanym rozszerzeniem
    // (roomCount, roomSizes, seriesLine, buildingType) — WO: "implementer-server":
    // "Sygnatura rozszerzona o typ budynku". Dodatkowy, dziś nieużywany argument
    // nie psuje wywołania (JS ignoruje nadmiarowe argumenty), a asercje poniżej
    // i tak dowodzą braku walidacji, niezależnie od finalnej nazwy/kolejności parametru.
    const result = await getRecommendation(1, roomSizesFor(1), null, 'COMMERCIAL');

    expect(fromSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain(EXPERT_OUTCOME);
    expect(result).not.toHaveProperty('recommendations');
    expect(priceRelatedKeys(result)).toEqual([]);
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('AC9 — roomCount jako łańcuch "5": odrzucone tak samo jak liczbowe, bez koercji furtki', async () => {
    // disqualifyingRules() z kontraktu wymaga typeof v === 'number' dla operatora GTE —
    // string przechodzi dziś przez walidację `!roomCount || roomCount < 1` przez
    // niejawną koercję JS i NIE jest odrzucany. To jest dokładnie furtka z WO (AC9).
    const roomCountFromNetwork = String(ROOM_COUNT_EXPERT_THRESHOLD + 1) as unknown as number;
    const result = await getRecommendation(roomCountFromNetwork, roomSizesFor(ROOM_COUNT_EXPERT_THRESHOLD + 1));

    expect(fromSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain(EXPERT_OUTCOME);
    expect(result).not.toHaveProperty('recommendations');
    expect(priceRelatedKeys(result)).toEqual([]);
  });

  // Kontrola negatywna (dziś zielona, ma zostać zielona po implementacji): próg-1
  // to główny przypadek biznesowy — żądanie MUSI dotrzeć do warstwy danych.
  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('kontrola negatywna: roomCount = próg-1 dociera do zapytania o cennik (nie jest dyskwalifikowany)', async () => {
    await getRecommendation(ROOM_COUNT_EXPERT_THRESHOLD - 1, roomSizesFor(ROOM_COUNT_EXPERT_THRESHOLD - 1));
    expect(fromSpy).toHaveBeenCalled();
  });

  // @REQ: B2C-TRIAGE-DISQUALIFY
  it('buildingType jako surowa etykieta PL ("Lokal komercyjny") jest odrzucany fail-closed, nie dopasowywany do BUILDING_TYPE', async () => {
    // Poprawka fail-closed (`BUILDING_TYPE_IDS.includes(...)`, getRecommendation.ts:38-40)
    // musi odrzucić etykietę store'a ('Lokal komercyjny'), a nie tylko rozpoznawać
    // poprawny identyfikator kontraktu ('COMMERCIAL', patrz test AC8 wyżej). Bez tej
    // asercji regresja polegająca na porównaniu z literałem PL zamiast z
    // BUILDING_TYPE_IDS przeszłaby niezauważona — 'Lokal komercyjny' nie jest równe
    // 'COMMERCIAL', więc naiwne `===` odrzuciłoby to poprawnie z zupełnie innego,
    // przypadkowego powodu (brak dopasowania do żadnej reguły) i mogłoby PRZEPUŚCIĆ
    // żądanie do bazy zamiast zwrócić EXPERT_SCREEN.
    const result = await getRecommendation(1, roomSizesFor(1), null, 'Lokal komercyjny');

    expect(fromSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain(EXPERT_OUTCOME);
  });
});
