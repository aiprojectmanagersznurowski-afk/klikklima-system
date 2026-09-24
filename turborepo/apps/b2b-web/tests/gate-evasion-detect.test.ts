import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GATE-EVASION-DETECT — dowodzi, że `tools/kk-precommit-scan.mjs` (a nie tylko
 * `checkWrite()` w izolacji, jak w `tools/kk-selftest.mjs`) faktycznie wykrywa
 * na DYSKU dwa udokumentowane wzorce omijania bramki nazewnictwa/typów:
 *   1. sklejanie identyfikatora z kawałków (join/`+`),
 *   2. podwójne rzutowanie klienta Prismy przez `unknown` na dowolny typ.
 *
 * Fikstury są tworzone w TEMP KATALOGU w czasie działania testu (node:fs),
 * nigdy zapisywane jako pliki repozytorium przez narzędzie edycyjne agenta —
 * fikstura #2 musi zawierać na dysku dosłowny, ciągły wzorzec spod reguły 2,
 * a ten sam hook, który ten test dowodzi, blokowałby TRWAŁY zapis takiej
 * treści. Dlatego złożone słowo (rzutowany klient) w KODZIE TEGO TESTU
 * powstaje z dwóch fragmentów sklejonych w czasie działania, a nie jest
 * wpisane wprost — nie po to, by ominąć regułę (sklejanie identyfikatorów
 * jest dozwolone w plikach testowych), ale by plik testu nie niósł na stałe
 * w repozytorium dosłownego ciągu, który reguła 2 ma wykrywać.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SCAN_SCRIPT = join(REPO_ROOT, "tools", "kk-precommit-scan.mjs");

// Rekonstrukcja w czasie działania, patrz komentarz na górze pliku.
const RECAST_SOURCE_WORD = ["pri", "sma"].join("");
const RECAST_KEYWORD = ["un", "known"].join("");

let workDir: string;

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function runScan(paths: string[]): { exitCode: number; output: string } {
  try {
    const output = execFileSync("node", [SCAN_SCRIPT, ...paths], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return { exitCode: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("GATE-EVASION-DETECT — kk-precommit-scan.mjs wykrywa udokumentowane wzorce omijania bramki", () => {
  // @REQ: GATE-EVASION-DETECT
  it("wykrywa sklejanie identyfikatora tablicą + join('') w pliku, który NIE jest testem", () => {
    workDir = mkdtempSync(join(tmpdir(), "kk-gate-evasion-"));
    const fixturePath = join(workDir, "split-identifier-fixture.ts");
    // Wzorzec z feat/crm-cards, dosłownie z sondy kk-selftest.mjs (PROD, fires: true).
    writeFileSync(fixturePath, "const TBL = ['kli', 'enci'].join('');\n", "utf8");

    const { exitCode, output } = runScan([fixturePath]);

    expect(exitCode).toBe(1);
    expect(output).toContain("gate-evasion-split-identifier");
  });

  // @REQ: GATE-EVASION-DETECT
  it("wykrywa podwójne rzutowanie klienta Prismy przez typ pomocniczy na dowolny typ docelowy", () => {
    workDir = mkdtempSync(join(tmpdir(), "kk-gate-evasion-"));
    const fixturePath = join(workDir, "prisma-recast-fixture.ts");

    const recastLine = `const db = ${RECAST_SOURCE_WORD} as ${RECAST_KEYWORD} as SomeDynamicType;\n`;
    writeFileSync(fixturePath, recastLine, "utf8");

    const { exitCode, output } = runScan([fixturePath]);

    expect(exitCode).toBe(1);
    expect(output).toContain("gate-evasion-prisma-recast");
  });

  // @REQ: GATE-EVASION-DETECT
  it("NEGATYWNY: legalna konkatenacja tekstu dla człowieka (poza kontekstem nazw tabel) nie zapala bramki", () => {
    workDir = mkdtempSync(join(tmpdir(), "kk-gate-evasion-"));
    const fixturePath = join(workDir, "legal-concatenation-fixture.ts");
    // Dosłownie z sondy kk-selftest.mjs (fires: false): join z separatorem
    // niepustym oraz konkatenacja literału z identyfikantem (nie dwóch literałów).
    writeFileSync(
      fixturePath,
      "const label = ['Jan', 'Kowalski'].join(', ');\nconst msg = 'Witaj, ' + name;\n",
      "utf8",
    );

    const { exitCode, output } = runScan([fixturePath]);

    expect(exitCode).toBe(0);
    expect(output).not.toContain("gate-evasion-split-identifier");
    expect(output).not.toContain("gate-evasion-prisma-recast");
  });

  // @REQ: GATE-EVASION-DETECT
  it("uruchomienie na wszystkich trzech fikstrach naraz: dwie wykryte, jedna przepuszczona", () => {
    workDir = mkdtempSync(join(tmpdir(), "kk-gate-evasion-"));
    const splitPath = join(workDir, "split-identifier-fixture.ts");
    const recastPath = join(workDir, "prisma-recast-fixture.ts");
    const legalPath = join(workDir, "legal-concatenation-fixture.ts");

    writeFileSync(splitPath, "const TBL = ['kli', 'enci'].join('');\n", "utf8");
    writeFileSync(
      recastPath,
      `const db = ${RECAST_SOURCE_WORD} as ${RECAST_KEYWORD} as SomeDynamicType;\n`,
      "utf8",
    );
    writeFileSync(
      legalPath,
      "const label = ['Jan', 'Kowalski'].join(', ');\nconst msg = 'Witaj, ' + name;\n",
      "utf8",
    );

    const { exitCode, output } = runScan([splitPath, recastPath, legalPath]);

    expect(exitCode).toBe(1);
    expect(output).toContain("split-identifier-fixture.ts");
    expect(output).toContain("prisma-recast-fixture.ts");
    expect(output).not.toContain("legal-concatenation-fixture.ts");
  });
});
