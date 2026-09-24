import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROPERTY_CONDITION_IDS, PROPERTY_CONDITION_PL } from '@klikklima/contracts';

/**
 * MAJOR M3/M4 (recenzja 2026-09-24): `Step4State.tsx` ma WŁASNĄ kopię trzech etykiet
 * stanu lokalu wpisanych z ręki w JSX (`title="Wykończony / Zamieszkany"` itd.) i w
 * warunkach `selected={state.buildingState === 'Wykończony / Zamieszkany'}` — te same
 * literały służą jednocześnie jako treść UI i jako logika porównania. Kontrakt
 * (`packages/contracts/src/generated/triage.ts`) eksportuje dokładnie te trzy wartości
 * jako `PROPERTY_CONDITION_IDS` / `PROPERTY_CONDITION_PL`. Rozjazd: zmiana treści w
 * kontrakcie (np. literówka poprawiona w PL, albo dodanie czwartego stanu) nie
 * pojawi się w komponencie, dopóki ktoś nie zaktualizuje trzech miejsc w JSX ręcznie.
 *
 * Brak infrastruktury do renderowania (patrz nav-state-contract.test.ts) wyklucza test
 * na realnym drzewie DOM, więc pokrycie jest statyczne — ale w przeciwieństwie do
 * starego `nav-state-contract.test.ts` (BLOCKER 1-2) tutaj statyczna analiza REALNIE
 * odróżnia poprawną implementację (import z kontraktu, brak literału-porównania) od
 * błędnej (literał wpisany wprost) — to nie jest defekt tego samego rodzaju.
 */
describe('B2C-TRIAGE-CONDITIONAL — Step4State czyta stan lokalu z kontraktu, nie z własnego słownika', () => {
  const stepPath = join(
    process.cwd(),
    'apps/b2c-web/components/triage/steps/Step4State.tsx',
  );

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('plik Step4State.tsx istnieje', () => {
    expect(existsSync(stepPath)).toBe(true);
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('importuje PROPERTY_CONDITION_IDS i/lub PROPERTY_CONDITION_PL z @klikklima/contracts', () => {
    const content = readFileSync(stepPath, 'utf8');
    const importsFromContracts = content.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]@klikklima\/contracts['"]/,
    );

    expect(importsFromContracts).toBeTruthy();
    const importedNames = importsFromContracts![1];
    expect(importedNames).toMatch(/PROPERTY_CONDITION_IDS|PROPERTY_CONDITION_PL/);
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('nie porównuje stanu lokalu z etykietą PL wpisaną wprost jako literał (np. selected={... === \'Wykończony / Zamieszkany\'})', () => {
    const content = readFileSync(stepPath, 'utf8');

    // Każda z trzech etykiet kontraktu, użyta jako literał w porównaniu ===, jest
    // dokładnie wzorcem z M3 audytu: etykieta i literał porównania to ta sama wartość
    // wpisana z ręki, więc test nie odróżnia poprawnej pracy z kontraktem od kopii.
    for (const id of PROPERTY_CONDITION_IDS) {
      const pl = PROPERTY_CONDITION_PL[id];
      const literalComparison = new RegExp(
        `===\\s*['"]${pl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      );
      expect(content).not.toMatch(literalComparison);
    }
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('nie zawiera żadnej z trzech etykiet kontraktu wpisanej jako literał poza JSX tekstowym (np. w handleSelect wywołanym z literałem)', () => {
    const content = readFileSync(stepPath, 'utf8');

    // handleSelect(buildingState: BuildingState) wołane z literałem PL jest tym samym
    // problemem w innej postaci — kafelek działa "bo się zgaduje wartość", nie "bo
    // czyta z kontraktu". Kontrakt musi być JEDYNYM źródłem tych trzech ciągów.
    for (const id of PROPERTY_CONDITION_IDS) {
      const pl = PROPERTY_CONDITION_PL[id];
      const literalCall = new RegExp(
        `handleSelect\\(\\s*['"]${pl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*\\)`,
      );
      expect(content).not.toMatch(literalCall);
    }
  });
});
