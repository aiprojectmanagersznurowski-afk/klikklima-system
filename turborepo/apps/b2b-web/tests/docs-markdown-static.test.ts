import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * NOWA FUNKCJA (decyzje Michała, 2026-09-17): przeglądarka dokumentacji projektu w panelu B2B
 * (`/dokumentacja`) — nacisk WO na "poprawne renderowanie tabel Markdown (GFM)", bo to główny
 * powód powstania ekranu. Narzędzie wewnętrzne, bez ID wymagania — testy bez `@REQ`.
 *
 * Test STATYCZNY na treści źródła (wzorzec `create-booking-dialog-static.test.ts` /
 * `feedback_react_ui_test_infra_limits` w pamięci agenta: root `vitest.config.mts` ma
 * `include: ['**\/*.test.ts']` — bez `.tsx`, bez jsdom, bez aliasu `@/*` — pełny render
 * Testing Library komponentu `"use client"` z `ReactMarkdown` nie jest tu wykonalny).
 *
 * ═══════════════════════ KONTRAKT Z IMPLEMENTEREM (implementer-ui) ═══════════════════════
 *
 * Nowy plik `apps/b2b-web/src/app/(dashboard)/dokumentacja/doc-markdown.tsx` (`"use client"`):
 *   - importuje `ReactMarkdown` z `react-markdown` (już w `apps/b2b-web/package.json`,
 *     `^10.1.0`).
 *   - importuje `remarkGfm` z `remark-gfm` (`^4.0.1`) i przekazuje go w propsie
 *     `remarkPlugins={[remarkGfm]}` na `<ReactMarkdown>` — BEZ TEGO tabele GFM (`| a | b |`)
 *     nie renderują się WCALE (`react-markdown` v10 nie ma GFM domyślnie), co jest właśnie
 *     powodem powstania tego ekranu (WO).
 *   - definiuje mapowanie `components` przekazane do `<ReactMarkdown components={...}>` z
 *     WŁASNYMI komponentami/klasami dla `table`, `thead`, `th`, `td` (żeby tabela miała
 *     obramowanie/czytelne odstępy — domyślny render `<table>` bez stylu jest nieczytelny).
 *     Klasy przez `className` (Tailwind, zgodnie z resztą repo) — bez hardkodowanych kolorów
 *     hex (CLAUDE.md, zakaz nienegocjowalny).
 *
 * Dzisiejszy RED: plik jeszcze nie istnieje — `readFileSync` na nieistniejącej ścieżce rzuca
 * `ENOENT` synchronicznie w każdym teście niżej (poprawny RED, analogiczny do "Cannot find
 * module" dla importu — dowód braku implementacji, nie usterka testu).
 */

const DOC_MARKDOWN_PATH = path.resolve(
  __dirname,
  '../src/app/(dashboard)/dokumentacja/doc-markdown.tsx',
);

function readDocMarkdown(): string {
  return readFileSync(DOC_MARKDOWN_PATH, 'utf-8');
}

describe('doc-markdown.tsx — użycie remark-gfm (bez niego tabele GFM się nie renderują)', () => {
  it('importuje remarkGfm z pakietu remark-gfm', () => {
    const content = readDocMarkdown();
    expect(content).toMatch(/import\s+remarkGfm\s+from\s*['"]remark-gfm['"]/);
  });

  it('przekazuje remarkGfm do remarkPlugins na <ReactMarkdown>', () => {
    const content = readDocMarkdown();
    expect(content).toMatch(/remarkPlugins\s*=\s*\{\s*\[[^\]]*remarkGfm[^\]]*\]\s*\}/);
  });

  it('importuje ReactMarkdown z react-markdown i faktycznie go renderuje (<ReactMarkdown)', () => {
    const content = readDocMarkdown();
    expect(content).toMatch(/import\s+ReactMarkdown\s+from\s*['"]react-markdown['"]/);
    expect(content).toMatch(/<ReactMarkdown[\s>]/);
  });
});

describe('doc-markdown.tsx — style/klasy dla elementów tabeli (table/thead/th/td czytelne)', () => {
  it('definiuje mapowanie components z wpisami dla table, thead, th i td', () => {
    const content = readDocMarkdown();
    const componentsMatch = content.match(/components\s*=\s*\{([\s\S]*?)\n\s*\}\s*\}/);
    expect(componentsMatch).not.toBeNull();

    for (const key of ['table', 'thead', 'th', 'td']) {
      expect(content).toMatch(new RegExp(`\\b${key}\\s*:`));
    }
  });

  it('elementy tabeli otrzymują className (styl czytelnej tabeli, nie surowy <table> bez stylu)', () => {
    const content = readDocMarkdown();
    // Każde z tych czterech słów kluczowych powinno współwystępować z className w
    // rozsądnej bliskości (definicja komponentu-wrappera renderującego element z klasą).
    for (const key of ['table', 'thead', 'th', 'td']) {
      const regex = new RegExp(`\\b${key}\\s*:[^,}]{0,400}className`, 's');
      expect(content).toMatch(regex);
    }
  });

  it('nie zawiera kolorów hex zaszytych w JSX (zakaz nienegocjowalny z CLAUDE.md)', () => {
    const content = readDocMarkdown();
    expect(content).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('nie importuje ikon spoza lucide-react (jeśli komponent używa ikon)', () => {
    const content = readDocMarkdown();
    const iconImportLines = content
      .split('\n')
      .filter((line) => /from\s*['"].*icons?['"]/.test(line) && !/lucide-react/.test(line));
    expect(iconImportLines).toEqual([]);
  });
});

describe('doc-markdown.tsx — nawigacja wstecz do listy dokumentów', () => {
  it('zawiera link powrotny do /dokumentacja z ikoną ArrowLeft i etykietą Wstecz', () => {
    const content = readDocMarkdown();
    expect(content).toMatch(/href\s*=\s*['"]\/dokumentacja['"]/);
    expect(content).toMatch(/ArrowLeft/);
    expect(content).toMatch(/Wstecz/);
  });
});
