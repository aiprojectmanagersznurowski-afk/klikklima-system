import { describe, it, expect } from 'vitest';

/**
 * WO: docs/workorders/SRV-SOURCE-OF-TRUTH-SERVICES-VIEW.md, "Przypadki brzegowe":
 * „Sortowanie i licznik dni do serwisu muszą dawać ten sam wynik dla obu typów
 * [service/forecast]; test na dacie granicznej (dziś o 23:30 czasu lokalnego /
 * Europe/Warsaw) — dziś differenceInDays w services-client.tsx:94 liczy na
 * new Date() bez normalizacji do północy."
 *
 * `next_service_date` jest `@db.Date` (data bez strefy), `data_realizacji` jest
 * `Timestamptz(6)` (moment w UTC). Licznik dni musi dawać SPÓJNY wynik dla obu,
 * normalizując do północy Europe/Warsaw, inaczej dwa wiersze z tym samym dniem
 * kalendarzowym pokazywalyby rozne "dni do serwisu" zaleznie od zrodla.
 *
 * KONTRAKT Z IMPLEMENTER-SERVER (analogiczny do buildAuditorFormData w
 * add-auditor-modal-formdata-boundary.test.ts) — REWIZJA PO REVIEW (BLOCKER):
 * poprzednia wersja tego testu wymagala, zeby `daysUntilService` (i pomocnicza
 * `zonedMidnightUtc`) byly eksportem `services/actions.ts`. Ten plik ma na
 * gorze dyrektywe `"use server"`, ktora w prawdziwym buildzie Next.js
 * (`next build`) obcina z modulu KAZDY eksport nie bedacy funkcja `async` —
 * Next.js traktuje plik "use server" jako granice Server Actions i statycznie
 * usuwa synchroniczne eksporty pomocnicze. `npx next build` faktycznie
 * wywala sie komunikatem "Export daysUntilService doesn't exist in target
 * module", mimo ze `vitest` (importujacy modul jako zwykly ESM, gdzie
 * dyrektywa jest martwym napisem) tego nie lapie. To byl zly kontrakt — testy
 * wymuszaly ksztalt, ktory nie kompiluje sie w produkcji.
 *
 * NOWY KONTRAKT Z IMPLEMENTER-SERVER: logika liczenia dni MA zostac wydzielona
 * do NOWEGO modulu `apps/b2b-web/src/lib/service-schedule.ts` (BEZ dyrektywy
 * "use server", obok istniejacego `apps/b2b-web/src/lib/format-date.ts`, z
 * ktorego juz dzis korzysta `APP_TIMEZONE`) z eksportami:
 *   - `export function daysUntilService(targetDate: Date, referenceDate?: Date): number`
 *   - `export function zonedMidnightUtc(date: Date): Date` (normalizacja do
 *     polnocy `APP_TIMEZONE` uzywana wewnatrz `daysUntilService`; eksportowana,
 *     bo ponizsze testy odwoluja sie do niej wprost przy nazwie funkcji w
 *     komentarzach diagnostycznych powyzej).
 * `services/actions.ts` (funkcje `async`) i `services-client.tsx` MAJA
 * importowac `daysUntilService` z `@/lib/service-schedule` (albo importem
 * wzglednym, jesli implementer uzna alias `@/*` za niedostepny w danym
 * pliku — to juz decyzja implementera, nie zakres tego testu).
 *
 * Powod, dla ktorego ten test IMPORTUJE WZGLEDNIE `../src/lib/service-schedule`
 * (a nie przez alias `@/*`): alias `@/*` NIE jest skonfigurowany w root
 * `vitest.config.mts`, a rola `test-author` nie ma prawa go tam dopisac
 * (`guard-paths` blokuje taki zapis - zweryfikowane empirycznie w tej turze).
 * `service-schedule.ts` nie importuje nic spod `@/`, wiec import wzgledny
 * dziala bez przeszkod, dokladnie jak w innych plikach tego katalogu.
 *
 * Dzisiejszy RED: plik `apps/b2b-web/src/lib/service-schedule.ts` jeszcze nie
 * istnieje — import padnie na braku modulu ("Cannot find module
 * '.../src/lib/service-schedule'"). To jest poprawny RED (brak zaplanowanego
 * pliku produktowego), analogicznie do `buildAuditorFormData.ts`.
 */

const { daysUntilService } = await import('../src/lib/service-schedule');

describe('daysUntilService — normalizacja do polnocy Europe/Warsaw', () => {
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('o 23:30 czasu lokalnego dzien przed terminem liczy sie jako "1 dzien", nie "0 dni"', () => {
    // 2026-09-01 23:30 Europe/Warsaw latem (CEST, UTC+2) = 2026-09-01T21:30:00Z.
    const referenceDate = new Date('2026-09-01T21:30:00.000Z');
    // next_service_date jako @db.Date -> Prisma zwraca polnoc UTC dnia kalendarzowego.
    const targetDate = new Date('2026-09-02T00:00:00.000Z');

    expect(daysUntilService(targetDate, referenceDate)).toBe(1);
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('o 23:30 czasu lokalnego W DNIU terminu liczy sie jako "0 dni", nie "-1" ani "1"', () => {
    const referenceDate = new Date('2026-09-01T21:30:00.000Z'); // 23:30 CEST
    const targetDate = new Date('2026-09-01T00:00:00.000Z');

    expect(daysUntilService(targetDate, referenceDate)).toBe(0);
  });

  // Granica zmiany czasu (ostatnia niedziela pazdziernika w Polsce: 2026-10-25,
  // przejscie CEST -> CET). Doba ma wtedy 25 godzin w UTC, wiec liczenie po
  // milisekundach/24h bez normalizacji do lokalnej polnocy dałoby bledny wynik.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('liczy poprawnie 1 dzien w poprzek zmiany czasu z CEST na CET (2026-10-25)', () => {
    // 2026-10-25 23:30 Europe/Warsaw to jeszcze CEST (UTC+2), bo zmiana czasu
    // nastepuje o 3:00 czasu letniego (01:00 UTC) w noc z 25 na 26.
    const referenceDate = new Date('2026-10-25T21:30:00.000Z');
    const targetDate = new Date('2026-10-26T00:00:00.000Z');

    expect(daysUntilService(targetDate, referenceDate)).toBe(1);
  });

  // AC (WO): licznik dni musi dawac TEN SAM wynik niezaleznie od tego, czy data
  // pochodzi z next_service_date (@db.Date, polnoc UTC) czy z data_realizacji
  // (Timestamptz, moment w ciagu dnia) — dla tego samego dnia kalendarzowego
  // Europe/Warsaw.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('next_service_date (polnoc UTC) i data_realizacji (godzina w ciagu dnia) tego samego dnia dają ten sam wynik', () => {
    const referenceDate = new Date('2026-09-01T08:00:00.000Z');
    const asDbDate = new Date('2026-09-10T00:00:00.000Z');
    const asTimestamptz = new Date('2026-09-10T14:45:00.000Z');

    expect(daysUntilService(asDbDate, referenceDate)).toBe(
      daysUntilService(asTimestamptz, referenceDate),
    );
  });

  // Przypadek przeterminowany: wynik ujemny, nie NaN ani wartosc bezwzgledna.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('termin w przeszlosci daje wartosc ujemna', () => {
    const referenceDate = new Date('2026-09-10T12:00:00.000Z');
    const targetDate = new Date('2026-09-05T00:00:00.000Z');

    expect(daysUntilService(targetDate, referenceDate)).toBe(-5);
  });
});
