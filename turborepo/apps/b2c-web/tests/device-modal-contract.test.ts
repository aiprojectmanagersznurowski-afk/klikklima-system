import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('B2C-DEVICE-MODAL — kontrakt i struktura modala urządzenia', () => {
  const modalPath = join(process.cwd(), 'apps/b2c-web/components/ui/DeviceModal.tsx');

  // @REQ: B2C-DEVICE-MODAL
  it('plik DeviceModal.tsx istnieje i jest komponentem klienckim', () => {
    expect(existsSync(modalPath)).toBe(true);
    const content = readFileSync(modalPath, 'utf8');
    expect(content).toContain('"use client"');
  });

  // @REQ: B2C-DEVICE-MODAL
  it('modal prezentuje dwa CTA: rezerwację z wybranym zestawem oraz powrót do przeglądania', () => {
    const content = readFileSync(modalPath, 'utf8');

    // Pierwsze CTA: rezerwacja / wybór zestawu
    expect(content).toMatch(/Wybieram ten zestaw|Umów termin audytu/i);

    // Drugie CTA: powrót do przeglądania (wymóg kontraktu: "dwa CTA: rezerwacja z wybranym urządzeniem oraz powrót do przeglądania")
    expect(content).toMatch(/Powrót do przeglądania|Wróć do przeglądania|Wróć do katalogu/i);
  });

  // @REQ: B2C-DEVICE-MODAL
  it('modal zawiera galerię, odznaki cech i pozycje standardowego zakresu montażu', () => {
    const content = readFileSync(modalPath, 'utf8');

    // Galeria zdjęć (wielkoekranowa lub podgląd)
    expect(content).toMatch(/galleryIndex|images/i);

    // Cechy w postaci odznak (FeatureChip / features)
    expect(content).toMatch(/FeatureChip|features/i);

    // Zakres montażu (Co zawiera standardowy pakiet montażowy)
    expect(content).toMatch(/standardowy pakiet montażowy|zakres montaż/i);
  });

  // @REQ: B2C-DEVICE-MODAL
  it('ikony w DeviceModal pochodzą wyłącznie z lucide-react (UI-ICONS-LUCIDE-ONLY)', () => {
    const content = readFileSync(modalPath, 'utf8');
    const importMatch = content.match(/import\s+\{[^}]+\}\s+from\s+['"]lucide-react['"]/);
    expect(importMatch).toBeTruthy();

    // Sprawdzenie, czy nie ma importów z react-icons ani innych bibliotek ikon
    expect(content).not.toMatch(/from\s+['"]react-icons/);
    expect(content).not.toMatch(/from\s+['"]@heroicons/);
  });

  // @REQ: B2C-DEVICE-MODAL
  it('otwarty modal posiada atrybut lub znacznik wstrzymujący Exit Intent', () => {
    const content = readFileSync(modalPath, 'utf8');
    expect(content).toMatch(/data-device-modal-open|role="dialog"|DialogPrimitive\.Root/i);
  });
});
