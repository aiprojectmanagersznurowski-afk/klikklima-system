import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SLA } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-PROPERTY-AREA-BAND.md
 * Wymaganie: @REQ: B2C-PROPERTY-AREA-BAND
 * AC1, AC2, AC3
 */

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
vi.stubGlobal('window', dom.window);
vi.stubGlobal('document', dom.window.document);
vi.stubGlobal('navigator', dom.window.navigator);
vi.stubGlobal('HTMLElement', dom.window.HTMLElement);

vi.mock('@/store/triageStore', async () => {
  return await import('../store/triageStore');
});

vi.mock('@/lib/utils', async () => {
  return await import('../lib/utils');
});

const { createElement } = await import('react');
const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
const { useTriageStore } = await import('../store/triageStore');
const { Step1Location } = await import('../components/triage/steps/Step1Location');

describe('B2C-PROPERTY-AREA-BAND — UI & Static Verification', () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC2 (test statyczny): Step1Location nie bada widoczności przez zahardkodowane porównanie z APARTMENT/HOUSE/Dom/Mieszkanie', () => {
    const step1Path = join(process.cwd(), 'apps/b2c-web/components/triage/steps/Step1Location.tsx');
    const content = readFileSync(step1Path, 'utf8');

    // Komponent MUSI importować i wołać isTriageFieldVisible z kontraktu
    expect(content).toContain('isTriageFieldVisible');

    // Zakaz warunków typu: state.location === 'Mieszkanie' || state.location === 'Dom'
    // w celu decydowania o widoczności pytania o metraż
    expect(content).not.toMatch(/location\s*===\s*['"]Mieszkanie['"]\s*\|\|\s*location\s*===\s*['"]Dom['"]/);
    expect(content).not.toMatch(/BUILDING_TYPE_PL\.APARTMENT\s*\|\|\s*.*BUILDING_TYPE_PL\.HOUSE/);
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC3 (test statyczny): w Step1Location nie ma pola typu input dla metrażu lokalu', () => {
    const step1Path = join(process.cwd(), 'apps/b2c-web/components/triage/steps/Step1Location.tsx');
    const content = readFileSync(step1Path, 'utf8');

    // Klient wybiera wyłącznie z kafelków — brak pól input dla powierzchni
    expect(content).not.toMatch(/<input[^>]*type=['"]number['"]/);
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: po wybraniu Mieszkania lub Domu pojawia się pytanie o metraż lokalu z dwoma kafelkami', () => {
    render(createElement(Step1Location));

    // Na początku nie ma kafelków metrażu
    const threshold = SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
    expect(screen.queryByText(`Do ${threshold} m²`)).toBeNull();

    // Wybieramy "Mieszkanie"
    const apartmentCard = screen.getByText('Mieszkanie');
    fireEvent.click(apartmentCard);

    // Pojawiają się kafelki metrażu
    expect(screen.getByText(`Do ${threshold} m²`)).toBeDefined();
    expect(screen.getByText(`Powyżej ${threshold} m²`)).toBeDefined();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: kliknięcie kafelka metrażu ustawia propertyAreaBand w store', () => {
    render(createElement(Step1Location));

    // Wybieramy "Dom"
    const houseCard = screen.getByText('Dom');
    fireEvent.click(houseCard);

    const threshold = SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
    const upToCard = screen.getByText(`Do ${threshold} m²`);
    fireEvent.click(upToCard);

    expect(useTriageStore.getState().data.propertyAreaBand).toBe('UP_TO_300');
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: dla Lokalu komercyjnego kafelki metrażu NIE pojawiają się', () => {
    render(createElement(Step1Location));

    const commercialCard = screen.getByText('Lokal komercyjny');
    fireEvent.click(commercialCard);

    const threshold = SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
    expect(screen.queryByText(`Do ${threshold} m²`)).toBeNull();
    expect(screen.queryByText(`Powyżej ${threshold} m²`)).toBeNull();
  });
});
