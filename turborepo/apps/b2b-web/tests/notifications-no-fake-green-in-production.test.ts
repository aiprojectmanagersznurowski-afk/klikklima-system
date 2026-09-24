import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Wzorzec „fałszywej zieleni" znaleziony w recenzji gałęzi feat/ntf-gateway
 * (2026-09-24, .claude/agent-memory/reviewer/project_ntf_gateway_gemini_branch.md):
 * bramki SMSAPI/Mailtrap zwracają `{ success: true }` bez żadnego tokena, gdy
 * `NODE_ENV === "test"`, a dispatcher ma sztywną datę „teraz" dla tego samego
 * środowiska. Efekt: testy nie dowodzą NICZEGO o realnej integracji, bo kod
 * produkcyjny SAM SIĘ rozpoznaje jako testowy i zmienia zachowanie.
 *
 * Ten test jest STATYCZNY (skan tekstu, nie wykonanie) — naprawa (usunięcie tych
 * gałęzi) należy do implementera, nie do test-authora (CLAUDE.md, podział ról).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

const PRODUCTION_FILES = [
  "apps/b2b-web/src/lib/notifications/dispatcher.ts",
  "apps/b2b-web/src/lib/notifications/gateways/smsapi.ts",
  "apps/b2b-web/src/lib/notifications/gateways/mailtrap.ts",
];

// Dowolna forma porównania NODE_ENV z "test" albo "development" — obie wartości
// nie mają miejsca w kodzie produkcyjnym bramek/dispatchera (rozpoznawanie
// środowiska uruchomienia i zmiana efektu ubocznego na tej podstawie).
const ENV_BRANCH_RE = /NODE_ENV\s*===?\s*["'](test|development)["']/;

// Literał daty ISO wstawiony jako "teraz" (np. new Date("2026-06-15...")) — sztywne
// „teraz" w kodzie produkcyjnym jest tym samym problemem co środowiskowa gałąź:
// zachowanie produkcyjne różni się od testowego bez żadnego wstrzykiwanego zegara.
const HARDCODED_ISO_DATE_RE = /new Date\(\s*["']\d{4}-\d{2}-\d{2}T/;

describe("GATE-EVASION / fałszywa zieleń — bramki i dispatcher nie rozpoznają środowiska testowego", () => {
  for (const relPath of PRODUCTION_FILES) {
    // @REQ: GATE-EVASION-DETECT
    it(`${relPath} nie zawiera gałęzi NODE_ENV === "test"/"development"`, () => {
      const content = readFileSync(join(REPO_ROOT, relPath), "utf8");
      const match = ENV_BRANCH_RE.exec(content);
      expect(match, `znaleziono gałąź środowiskową: ${match?.[0]}`).toBeNull();
    });
  }

  // @REQ: GATE-EVASION-DETECT
  it("apps/b2b-web/src/lib/notifications/dispatcher.ts nie zawiera sztywnej daty ISO jako podstawy czasu bieżącego", () => {
    const content = readFileSync(
      join(REPO_ROOT, "apps/b2b-web/src/lib/notifications/dispatcher.ts"),
      "utf8",
    );
    const match = HARDCODED_ISO_DATE_RE.exec(content);
    expect(match, `znaleziono sztywną datę: ${match?.[0]}`).toBeNull();
  });
});
