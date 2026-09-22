import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve(__dirname, "../public");
const SRC_DIR = path.resolve(__dirname, "../src");

describe("Brand Logo - Dark Mode w panelu B2B i na stronie logowania", () => {
  it("fizyczny plik public/logo_dark.png istnieje i jest niepusty", () => {
    const logoDarkPath = path.join(PUBLIC_DIR, "logo_dark.png");
    expect(existsSync(logoDarkPath)).toBe(true);
    const stat = readFileSync(logoDarkPath);
    expect(stat.length).toBeGreaterThan(0);
  });

  it("fizyczny plik public/logo.png istnieje i jest niepusty", () => {
    const logoLightPath = path.join(PUBLIC_DIR, "logo.png");
    expect(existsSync(logoLightPath)).toBe(true);
    const stat = readFileSync(logoLightPath);
    expect(stat.length).toBeGreaterThan(0);
  });

  it("app-sidebar.tsx renderuje wersję light (/logo.png) i wersję dark (/logo_dark.png) z odpowiednimi klasami Tailwind", () => {
    const sidebarPath = path.join(
      SRC_DIR,
      "app/(dashboard)/_components/sidebar/app-sidebar.tsx",
    );
    const content = readFileSync(sidebarPath, "utf-8");

    // Weryfikacja obecności obu źródeł
    expect(content).toContain('src="/logo.png"');
    expect(content).toContain('src="/logo_dark.png"');

    // Weryfikacja klas Tailwind dla dark mode
    expect(content).toMatch(/src="\/logo\.png"[\s\S]*?dark:hidden/);
    expect(content).toMatch(/src="\/logo_dark\.png"[\s\S]*?dark:block/);
  });

  it("login/page.tsx renderuje wersję dark (/logo_dark.png) zarówno na ekranie powitalnym, jak i w formularzu", () => {
    const loginPagePath = path.join(SRC_DIR, "app/login/page.tsx");
    const content = readFileSync(loginPagePath, "utf-8");

    // Obie wersje muszą być używane co najmniej 2 razy (splash + karta logowania)
    const lightMatches = (content.match(/src="\/logo\.png"/g) || []).length;
    const darkMatches = (content.match(/src="\/logo_dark\.png"/g) || []).length;

    expect(lightMatches).toBeGreaterThanOrEqual(2);
    expect(darkMatches).toBeGreaterThanOrEqual(2);

    // Weryfikacja styli przełączających
    expect(content).toMatch(/src="\/logo\.png"[\s\S]*?dark:hidden/);
    expect(content).toMatch(/src="\/logo_dark\.png"[\s\S]*?dark:block/);
  });

  it("login/page.tsx posiada zintegrowany ThemeSwitcher do przełączania motywu", () => {
    const loginPagePath = path.join(SRC_DIR, "app/login/page.tsx");
    const content = readFileSync(loginPagePath, "utf-8");

    expect(content).toContain("ThemeSwitcher");
    expect(content).toContain("<ThemeSwitcher />");
  });
});
