import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md - CRM-ZESP-AC2 (AC2.1-AC2.6)
 * + przypadek brzegowy #2 (wspolbieznosc, przypisanie ekipy), #5/#6 (granice
 * czasowe i strefa Europe/Warsaw), #7 (NULL-e).
 *
 * D6 (rozstrzygniete): zespol z sep_valid_until/fgaz_valid_until = NULL jest
 * NIEWAZNY (wariant bezpieczny). Guard sprawdza wzgledem DATY MONTAZU (nie
 * dzisiejszej daty). Sprawdzamy certyfikaty na poziomie zespolu, nie przedstawiciela.
 *
 * Zakladana docelowa sygnatura (WO, "Podzial pracy": "filtr certyfikatow w
 * getCrews() + walidacja serwerowa przy przypisaniu"):
 *   - `getCrews(installationDate: Date)` w apps/b2b-web/src/app/(dashboard)/leads/actions.ts
 *     - dzis przyjmuje 0 argumentow i filtruje wylacznie `aktywny: true`.
 *   - `assignCrewToLead(leadId: string, crewId: string): Promise<{ success: boolean; error?: string }>`
 *     w tym samym pliku - realizacja T05 (assignCrew) z contracts/funnel.contract.mjs,
 *     guard crewCertsValid. Ta akcja dzis NIE ISTNIEJE w ogole w bazie kodu (sprawdzone:
 *     `grep -rn "assignCrew" apps/b2b-web/src/app/(dashboard)/leads` = brak wynikow) -
 *     jesli implementer wybierze inna nazwe/plik, to TEST-DEFECT do zgloszenia w tej
 *     turze, nie powod do zmiany testu.
 *
 * Model Prisma jest po polsku (zespoly_monterskie, leady) - dlug KK-NAMING-BASELINE,
 * ADR-002 zamrozony. Mockujemy realny ksztalt @repo/database.
 */

const { crewFindManyMock, leadFindUniqueMock, revalidatePathMock } = vi.hoisted(() => ({
  crewFindManyMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    zespoly_monterskie: { findMany: crewFindManyMock },
    leady: { findUnique: leadFindUniqueMock, update: vi.fn() },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getCrews, assignCrewToLead } = await import(
  '../src/app/(dashboard)/leads/actions'
);

const INSTALLATION_DATE = new Date('2026-09-15T00:00:00.000Z');

const crewWithCerts = (overrides: Partial<{ aktywny: boolean; fgaz_valid_until: Date | null; sep_valid_until: Date | null }>) => ({
  id: 'crew-1',
  nazwa: 'Ekipa Testowa',
  aktywny: true,
  fgaz_valid_until: new Date('2027-01-01'),
  sep_valid_until: new Date('2027-01-01'),
  ...overrides,
});

describe('getCrews(installationDate) - pula E4 wyklucza zespoly z niewaznym certyfikatem (CRM-ZESP-AC2)', () => {
  beforeEach(() => {
    crewFindManyMock.mockReset();
    leadFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
  });

  // @REQ: CRM-ZESP-AC2
  it('AC2.1 - zespol z certyfikatem wygaslym wzgledem daty montazu nie pojawia sie na liscie', async () => {
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ fgaz_valid_until: new Date('2026-09-01') }), // wygasl przed montazem
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([]);
  });

  // @REQ: CRM-ZESP-AC2
  it('AC2.3 - granica: certyfikat wazny jeszcze jeden dzien po dacie montazu przechodzi', async () => {
    const dayAfterInstallation = new Date(INSTALLATION_DATE.getTime() + 24 * 60 * 60 * 1000);
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ fgaz_valid_until: dayAfterInstallation, sep_valid_until: dayAfterInstallation }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews.map((c: { id: string }) => c.id)).toEqual(['crew-1']);
  });

  // @REQ: CRM-ZESP-AC2
  it('AC2.3 - granica: ten sam zespol dzien PO wygasnieciu (przed data montazu) nie przechodzi', async () => {
    const dayBeforeInstallation = new Date(INSTALLATION_DATE.getTime() - 24 * 60 * 60 * 1000);
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ fgaz_valid_until: dayBeforeInstallation, sep_valid_until: new Date('2027-01-01') }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([]);
  });

  // D6: NULL = niewazny (wariant bezpieczny), nie "brak danych = przepuszczamy".
  // @REQ: CRM-ZESP-AC2
  it('przypadek NULL (D6) - brak uzupelnionej daty waznosci certyfikatu = zespol niewazny', async () => {
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ sep_valid_until: null }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([]);
  });

  // @REQ: CRM-ZESP-AC2
  it('AC2.4 - zespol nieaktywny pozostaje ukryty niezaleznie od waznosci certyfikatow', async () => {
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ aktywny: false }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([]);
  });

  // Kontrola negatywna: zespol aktywny z waznymi certyfikatami MUSI zostac na liscie -
  // inaczej filtr jest fail-closed w zla strone (chowa wszystkich, nie tylko niewaznych).
  // @REQ: CRM-ZESP-AC2
  it('kontrola negatywna - zespol aktywny z waznymi certyfikatami zostaje na liscie', async () => {
    crewFindManyMock.mockResolvedValue([crewWithCerts({})]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews.map((c: { id: string }) => c.id)).toEqual(['crew-1']);
  });

  // Przypadek brzegowy #6 (WO): fgaz_valid_until to @db.Date (bez czasu), data montazu
  // to @db.Timestamptz. Certyfikat wazny DOKLADNIE w dniu montazu (ta sama data
  // kalendarzowa w Europe/Warsaw) nie moze zostac odrzucony przez blad stref czasowych
  // przy porownaniu p'olnocy UTC z poludniem czasu polskiego.
  // @REQ: CRM-ZESP-AC2
  it('przypadek brzegowy - strefa czasowa: certyfikat wazny do dnia montazu wlacznie (Europe/Warsaw)', async () => {
    // Montaz 2026-09-15 o 14:00 czasu polskiego (CEST, UTC+2) = 12:00 UTC.
    const installationInWarsawAfternoon = new Date('2026-09-15T12:00:00.000Z');
    // Certyfikat wazny "do 2026-09-15" zapisany jako polnoc UTC tego dnia.
    const certValidUntilMidnightUtc = new Date('2026-09-15T00:00:00.000Z');

    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ fgaz_valid_until: certValidUntilMidnightUtc, sep_valid_until: certValidUntilMidnightUtc }),
    ]);

    const crews = await getCrews(installationInWarsawAfternoon);

    // W Europe/Warsaw to wciaz ten sam dzien kalendarzowy - certyfikat MUSI byc uznany
    // za wazny. Naiwne porownanie znacznikow czasu (UTC) odrzuciloby go blednie.
    expect(crews.map((c: { id: string }) => c.id)).toEqual(['crew-1']);
  });
});

describe('assignCrewToLead - walidacja serwerowa przy pominieciu UI (CRM-ZESP-AC2)', () => {
  beforeEach(() => {
    crewFindManyMock.mockReset();
    leadFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
  });

  // @REQ: CRM-ZESP-AC2
  it('AC2.2 - przypisanie zespolu z niewaznym certyfikatem jest odrzucone, status leada bez zmian', async () => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'AWAITING_CREW_ASSIGNMENT', data_rezerwacji: INSTALLATION_DATE });
    // Odczyt zespolu wewnatrz assignCrewToLead - ten sam ksztalt zapytania co getCrews,
    // wiec ten sam mock findMany moze posluzyc jako findUnique-like zrodlo danych.
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ fgaz_valid_until: new Date('2020-01-01') }),
    ]);

    const result = await assignCrewToLead('lead-1', 'crew-1');

    expect(result.success).toBe(false);
    // AC2.2: komunikat MUSI wskazywac, ktory certyfikat jest niewazny.
    expect(result.error ?? '').toMatch(/f-?gaz|fgaz|sep/i);
  });

  // Przypadek brzegowy #2 (WO): certyfikat wygasa MIEDZY wyswietleniem listy a
  // klikni?ciem "Przypisz" - serwer musi odrzucic mimo ze UI pokazywalo dostepnosc
  // w chwili renderu. Test symuluje to bezposrednim wywolaniem Server Action z
  // danymi juz przeterminowanego certyfikatu - UI nigdy nie jest pytane ponownie.
  // @REQ: CRM-ZESP-AC2
  it('przypadek brzegowy - certyfikat wygasa miedzy wyswietleniem listy a klikni?ciem: serwer odrzuca', async () => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'AWAITING_CREW_ASSIGNMENT', data_rezerwacji: INSTALLATION_DATE });
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ sep_valid_until: new Date(INSTALLATION_DATE.getTime() - 1) }),
    ]);

    const result = await assignCrewToLead('lead-1', 'crew-1');

    expect(result.success).toBe(false);
  });
});

// AC2.6: prog i logika waznosci certyfikatow nie zawieraja literalow dat/dni w kodzie
// aplikacji - musza pochodzic z @klikklima/contracts (guard crewCertsValid porownuje
// wylacznie dwie daty, wiec "literal" tutaj oznacza brak zahardkodowanych dni grace
// period / progow ostrzegawczych typu CERT_EXPIRY_WARNING w logice tego guardu).
describe('AC2.6 - brak literalow dat/dni w logice waznosci certyfikatow (skan statyczny)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = join(HERE, '..', '..', '..');
  const SCANNED_FILES = [
    join(REPO_ROOT, 'apps/b2b-web/src/app/(dashboard)/leads/actions.ts'),
  ];

  // @REQ: CRM-ZESP-AC2
  it('plik z logika przypisania ekipy nie zawiera zahardkodowanej liczby dni grace period', () => {
    for (const file of SCANNED_FILES) {
      if (!existsSync(file)) continue; // brak pliku dzis - to rowniez czesc RED
      const content = readFileSync(file, 'utf8');
      // Literal typu "+ 30" / "* 30" przy przeliczeniu dni progu ostrzegawczego.
      expect(content).not.toMatch(/\b30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000\b/);
    }
  });
});
