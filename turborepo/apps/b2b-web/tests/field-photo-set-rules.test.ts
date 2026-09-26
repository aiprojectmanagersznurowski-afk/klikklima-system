import { describe, it, expect } from 'vitest';
import {
  calculateRequiredPhotos,
  validateInstallationPhotoSet,
  PHOTO_KINDS,
  type PhotoItemInput,
} from '../src/lib/domain/install-path';

// @REQ: FLD-PHOTO-SET
// Wymaganie FLD-PHOTO-SET: reguła 4 + 2n dla dokumentacji fotograficznej montażu.
// 4 zdjęcia części stałej: jednostka zewnętrzna, tabliczka jedn. zewn., odpływ skroplin, manometr próby próżni.
// 2 zdjęcia per jednostka wewnętrzna: montaż jednostki oraz tabliczka znamionowa.

describe('FLD-PHOTO-SET: calculateRequiredPhotos', () => {
  it('wylicza 6 wymaganych zdjęć dla pojedynczego splitu (1 jednostka wewnętrzna: 4 + 2*1)', () => {
    const required = calculateRequiredPhotos(1);
    expect(required.length).toBe(6);
    expect(required).toEqual([
      { kind: PHOTO_KINDS.OUTDOOR_UNIT, description: 'Jednostka zewnętrzna' },
      { kind: PHOTO_KINDS.OUTDOOR_UNIT_NAMEPLATE, description: 'Tabliczka znamionowa jednostki zewnętrznej' },
      { kind: PHOTO_KINDS.CONDENSATE_DRAIN, description: 'Odpływ skroplin' },
      { kind: PHOTO_KINDS.VACUUM_TEST_GAUGE, description: 'Manometr próby próżni' },
      { kind: PHOTO_KINDS.INDOOR_UNIT_MOUNTED, indoorUnitIndex: 1, description: 'Montaż jednostki wewnętrznej 1' },
      { kind: PHOTO_KINDS.INDOOR_UNIT_NAMEPLATE, indoorUnitIndex: 1, description: 'Tabliczka znamionowa jednostki wewnętrznej 1' },
    ]);
  });

  it('wylicza 10 wymaganych zdjęć dla multi-split 3x (3 jednostki wewnętrzne: 4 + 2*3)', () => {
    const required = calculateRequiredPhotos(3);
    expect(required.length).toBe(10);
    const indoor1Mount = required.find((p) => p.kind === PHOTO_KINDS.INDOOR_UNIT_MOUNTED && p.indoorUnitIndex === 1);
    const indoor2Mount = required.find((p) => p.kind === PHOTO_KINDS.INDOOR_UNIT_MOUNTED && p.indoorUnitIndex === 2);
    const indoor3Mount = required.find((p) => p.kind === PHOTO_KINDS.INDOOR_UNIT_MOUNTED && p.indoorUnitIndex === 3);

    expect(indoor1Mount).toBeDefined();
    expect(indoor2Mount).toBeDefined();
    expect(indoor3Mount).toBeDefined();
  });

  it('odrzuca nieprawidłową liczbę jednostek wewnętrznych (mniej niż 1)', () => {
    expect(() => calculateRequiredPhotos(0)).toThrow('Liczba jednostek wewnętrznych musi wynosić co najmniej 1');
    expect(() => calculateRequiredPhotos(-2)).toThrow('Liczba jednostek wewnętrznych musi wynosić co najmniej 1');
  });
});

describe('FLD-PHOTO-SET: validateInstallationPhotoSet', () => {
  const completeSplitPhotos: PhotoItemInput[] = [
    { kind: PHOTO_KINDS.OUTDOOR_UNIT, storagePath: 'photos/outdoor.jpg' },
    { kind: PHOTO_KINDS.OUTDOOR_UNIT_NAMEPLATE, storagePath: 'photos/outdoor_plate.jpg' },
    { kind: PHOTO_KINDS.CONDENSATE_DRAIN, storagePath: 'photos/drain.jpg' },
    { kind: PHOTO_KINDS.VACUUM_TEST_GAUGE, storagePath: 'photos/vacuum.jpg' },
    { kind: PHOTO_KINDS.INDOOR_UNIT_MOUNTED, indoorUnitIndex: 1, storagePath: 'photos/indoor1.jpg' },
    { kind: PHOTO_KINDS.INDOOR_UNIT_NAMEPLATE, indoorUnitIndex: 1, storagePath: 'photos/indoor1_plate.jpg' },
  ];

  it('zwraca valid: true dla kompletnego zestawu zdjęć split (6 zdjęć)', () => {
    const result = validateInstallationPhotoSet(completeSplitPhotos, 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.missingItems).toHaveLength(0);
    expect(result.requiredCount).toBe(6);
    expect(result.providedCount).toBe(6);
  });

  it('odrzuca zestaw przy braku manometru próby próżni', () => {
    const photosWithoutVacuum = completeSplitPhotos.filter((p) => p.kind !== PHOTO_KINDS.VACUUM_TEST_GAUGE);
    const result = validateInstallationPhotoSet(photosWithoutVacuum, 1);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Brak wymaganego zdjęcia: Manometr próby próżni');
    expect(result.missingItems.some((m) => m.kind === PHOTO_KINDS.VACUUM_TEST_GAUGE)).toBe(true);
  });

  it('odrzuca zestaw przy braku tabliczki znamionowej jednostki zewnętrznej', () => {
    const photosWithoutPlate = completeSplitPhotos.filter((p) => p.kind !== PHOTO_KINDS.OUTDOOR_UNIT_NAMEPLATE);
    const result = validateInstallationPhotoSet(photosWithoutPlate, 1);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Brak wymaganego zdjęcia: Tabliczka znamionowa jednostki zewnętrznej');
  });

  it('odrzuca zestaw, gdy monter dostarczy 10 zdjęć tego samego typu zamiast wymaganych kategorii', () => {
    const duplicatePhotos: PhotoItemInput[] = Array.from({ length: 10 }).map((_, i) => ({
      kind: PHOTO_KINDS.OUTDOOR_UNIT,
      storagePath: `photos/outdoor_${i}.jpg`,
    }));

    const result = validateInstallationPhotoSet(duplicatePhotos, 1);
    expect(result.valid).toBe(false);
    expect(result.missingItems.length).toBeGreaterThan(0);
  });

  it('odrzuca zestaw dla multi-split 2x, gdy dla jednostki 2 brakuje tabliczki znamionowej', () => {
    const multiPhotos: PhotoItemInput[] = [
      ...completeSplitPhotos,
      { kind: PHOTO_KINDS.INDOOR_UNIT_MOUNTED, indoorUnitIndex: 2, storagePath: 'photos/indoor2.jpg' },
      // brakuje INDOOR_UNIT_NAMEPLATE dla jednostki 2
    ];

    const result = validateInstallationPhotoSet(multiPhotos, 2);
    expect(result.valid).toBe(false);
    expect(result.requiredCount).toBe(8);
    expect(result.providedCount).toBe(7);
    expect(result.missingItems.some((m) => m.kind === PHOTO_KINDS.INDOOR_UNIT_NAMEPLATE && m.indoorUnitIndex === 2)).toBe(true);
  });
});
