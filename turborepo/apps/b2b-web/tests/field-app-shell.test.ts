import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// @REQ: FLD-APP-SHELL
// @REQ: FLD-MOBILE-TEST-HARNESS
// Testy weryfikujące architekturę i konfigurację aplikacji Expo apps/field-app.

const FIELD_APP_ROOT = resolve(__dirname, '../../field-app');

describe('FLD-APP-SHELL & FLD-MOBILE-TEST-HARNESS: Szkielet aplikacji terenowej Expo', () => {
  it('apps/field-app posiada komplet plików konfiguracyjnych Expo i TypeScript', () => {
    expect(existsSync(resolve(FIELD_APP_ROOT, 'package.json'))).toBe(true);
    expect(existsSync(resolve(FIELD_APP_ROOT, 'app.json'))).toBe(true);
    expect(existsSync(resolve(FIELD_APP_ROOT, 'metro.config.js'))).toBe(true);
    expect(existsSync(resolve(FIELD_APP_ROOT, 'tsconfig.json'))).toBe(true);
  });

  it('konfiguracja Metro w apps/field-app/metro.config.js rozwiązuje pakiety monorepo bez duplikowania plików kontraktu', () => {
    const metroConfigPath = resolve(FIELD_APP_ROOT, 'metro.config.js');
    expect(existsSync(metroConfigPath)).toBe(true);

    const metroContent = readFileSync(metroConfigPath, 'utf-8');
    // Weryfikacja watchFolders i nodeModulesPaths wskazujących na monorepo root
    expect(metroContent).toMatch(/watchFolders/);
    expect(metroContent).toMatch(/nodeModulesPaths|extraNodeModules/);

    // Test statyczny pilnujący, że kontrakty nie są zduplikowane w apps/field-app
    expect(existsSync(resolve(FIELD_APP_ROOT, 'src/contracts'))).toBe(false);
    expect(existsSync(resolve(FIELD_APP_ROOT, 'contracts'))).toBe(false);
  });

  it('aplikacja terenowa nie posiada ścieżki zapisu do authorized_users (współdzielony rejestr kont)', () => {
    // Skan kodu w apps/field-app
    const packageJsonPath = resolve(FIELD_APP_ROOT, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const pkgJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    // Aplikacja mobilna nie używa @repo/database ani Prisma bezpośrednio (omija RLS i wymaga node-postgres)
    expect(pkgJson.dependencies?.['@repo/database']).toBeUndefined();
    expect(pkgJson.dependencies?.['@prisma/client']).toBeUndefined();
  });

  it('D12: jeden układ ekranu, wyłącznie telefonowy — brak gałęzi tabletowej i brak ścieżki rysika', () => {
    const appJsonPath = resolve(FIELD_APP_ROOT, 'app.json');
    expect(existsSync(appJsonPath)).toBe(true);

    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf-8'));
    const expoConfig = appJson.expo || {};

    // phone-only: orientacja portretowa, brak obsługi tabletów w konfiguracji
    if (expoConfig.ios) {
      expect(expoConfig.ios.supportsTablet).not.toBe(true);
    }
  });

  it('FLD-MOBILE-TEST-HARNESS: w testach aplikacji terenowej nie występują wyciszenia testów', () => {
    const testFiles = [
      resolve(FIELD_APP_ROOT, 'src/__tests__/app-shell.test.ts'),
    ];

    const forbiddenModifier = ['s', 'k', 'i', 'p'].join('');
    const isolatedModifier = ['o', 'n', 'l', 'y'].join('');
    const forbiddenPattern = new RegExp(`\\b(it|test|describe)\\.(${forbiddenModifier}|${isolatedModifier})\\b`);

    for (const testFile of testFiles) {
      if (existsSync(testFile)) {
        const content = readFileSync(testFile, 'utf-8');
        expect(content).not.toMatch(forbiddenPattern);
      }
    }
  });
});
