import { createHash } from 'node:crypto';
import { prisma } from '@repo/database';
import type { FieldActor } from '../field-api/types';

// @REQ: FLD-CHECKLIST-PREINSTALL
// @REQ: FLD-PHOTO-SET
// @REQ: FLD-HANDOVER-PROTOCOL

export const PHOTO_KINDS = {
  OUTDOOR_UNIT: 'OUTDOOR_UNIT',
  OUTDOOR_UNIT_NAMEPLATE: 'OUTDOOR_UNIT_NAMEPLATE',
  CONDENSATE_DRAIN: 'CONDENSATE_DRAIN',
  VACUUM_TEST_GAUGE: 'VACUUM_TEST_GAUGE',
  INDOOR_UNIT_MOUNTED: 'INDOOR_UNIT_MOUNTED',
  INDOOR_UNIT_NAMEPLATE: 'INDOOR_UNIT_NAMEPLATE',
  PIPE_ROUTE_BEFORE_COVER: 'PIPE_ROUTE_BEFORE_COVER',
  NITROGEN_TEST_GAUGE: 'NITROGEN_TEST_GAUGE',
  AUDIT: 'AUDIT',
} as const;

export type PhotoKind = (typeof PHOTO_KINDS)[keyof typeof PHOTO_KINDS];

export const PREINSTALL_CHECKLIST_ITEMS = [
  {
    id: 'SITE_PROTECTION',
    label: 'Zabezpieczenie miejsca prac',
    description: 'Zabezpieczenie podłogi, mebli i wyposażenia w strefie montażu.',
  },
  {
    id: 'WALL_STRUCTURE_CHECK',
    label: 'Weryfikacja podłoża i instalacji ukrytych',
    description: 'Sprawdzenie nośności ściany i tras przewodów/rur detektorem.',
  },
  {
    id: 'POWER_SUPPLY_VERIFIED',
    label: 'Kontrola punktu zasilania',
    description: 'Weryfikacja zabezpieczenia prądowego i sprawności uziemienia.',
  },
  {
    id: 'EQUIPMENT_INTEGRITY',
    label: 'Stan techniczny urządzeń',
    description: 'Brak uszkodzeń opakowań i obudów jednostek zewnętrznej i wewnętrznych.',
  },
  {
    id: 'PASS_THROUGH_PLAN',
    label: 'Uzgodnienie trasy z klientem',
    description: 'Potwierdzenie z inwestorem miejsc montażu, trasy chłodniczej i odpływu skroplin.',
  },
] as const;

export interface PhotoItemInput {
  kind: string;
  indoorUnitIndex?: number | null;
  storagePath: string;
}

export interface PhotoRequirement {
  kind: string;
  indoorUnitIndex?: number;
  description: string;
}

export interface PhotoSetValidationResult {
  valid: boolean;
  requiredCount: number;
  providedCount: number;
  missingItems: PhotoRequirement[];
  errors: string[];
}

export interface ChecklistItemState {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  checkedAt: string | null;
  workerId: string | null;
  workerEmail: string | null;
}

export interface HandoverUnitItem {
  index?: number;
  model: string;
  serial_number: string;
}

export interface HandoverProtocolInput {
  nitrogen_test_bar: number;
  vacuum_test_mbar: number;
  test_duration_min: number;
  client_trained: boolean;
  outdoor_unit: HandoverUnitItem;
  indoor_units: HandoverUnitItem[];
}

/**
 * calculateRequiredPhotos — Wylicza dynamiczny skład kompletu zdjęć wg reguły 4 + 2n (FLD-PHOTO-SET).
 * 4 stałe: jednostka zewn., tabliczka jedn. zewn., odpływ skroplin, manometr próby próżni.
 * 2 na każdą jednostkę wewn.: montaż jednostki oraz tabliczka znamionowa.
 */
export function calculateRequiredPhotos(indoorUnitsCount: number): PhotoRequirement[] {
  if (!Number.isInteger(indoorUnitsCount) || indoorUnitsCount < 1) {
    throw new Error('Liczba jednostek wewnętrznych musi wynosić co najmniej 1');
  }

  const requirements: PhotoRequirement[] = [
    { kind: PHOTO_KINDS.OUTDOOR_UNIT, description: 'Jednostka zewnętrzna' },
    { kind: PHOTO_KINDS.OUTDOOR_UNIT_NAMEPLATE, description: 'Tabliczka znamionowa jednostki zewnętrznej' },
    { kind: PHOTO_KINDS.CONDENSATE_DRAIN, description: 'Odpływ skroplin' },
    { kind: PHOTO_KINDS.VACUUM_TEST_GAUGE, description: 'Manometr próby próżni' },
  ];

  for (let i = 1; i <= indoorUnitsCount; i++) {
    requirements.push({
      kind: PHOTO_KINDS.INDOOR_UNIT_MOUNTED,
      indoorUnitIndex: i,
      description: `Montaż jednostki wewnętrznej ${i}`,
    });
    requirements.push({
      kind: PHOTO_KINDS.INDOOR_UNIT_NAMEPLATE,
      indoorUnitIndex: i,
      description: `Tabliczka znamionowa jednostki wewnętrznej ${i}`,
    });
  }

  return requirements;
}

/**
 * validateInstallationPhotoSet — Weryfikuje serwerowo kompletność zdjęć (FLD-PHOTO-SET).
 */
export function validateInstallationPhotoSet(
  photos: PhotoItemInput[],
  indoorUnitsCount: number
): PhotoSetValidationResult {
  const requirements = calculateRequiredPhotos(indoorUnitsCount);
  const missingItems: PhotoRequirement[] = [];
  const errors: string[] = [];

  for (const req of requirements) {
    const matchingPhoto = photos.find((p) => {
      if (p.kind !== req.kind) return false;
      if (req.indoorUnitIndex !== undefined) {
        return p.indoorUnitIndex === req.indoorUnitIndex;
      }
      return true;
    });

    if (!matchingPhoto) {
      missingItems.push(req);
      errors.push(`Brak wymaganego zdjęcia: ${req.description}`);
    }
  }

  return {
    valid: errors.length === 0,
    requiredCount: requirements.length,
    providedCount: photos.length,
    missingItems,
    errors,
  };
}

// Lokalny magazyn stanu checklisty w pamięci procesu / pomocniczy dla operacji polowych
const inMemoryChecklistState = new Map<string, ChecklistItemState[]>();

/**
 * getInstallationChecklist — Pobiera stan checklisty przedmontażowej (FLD-CHECKLIST-PREINSTALL).
 */
export async function getInstallationChecklist(
  installationId: string,
  _actor: FieldActor
): Promise<{ success: boolean; checklist: ChecklistItemState[] }> {
  const existing = inMemoryChecklistState.get(installationId);
  if (existing) {
    return { success: true, checklist: existing };
  }

  const defaultChecklist: ChecklistItemState[] = PREINSTALL_CHECKLIST_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    checked: false,
    checkedAt: null,
    workerId: null,
    workerEmail: null,
  }));

  inMemoryChecklistState.set(installationId, defaultChecklist);
  return { success: true, checklist: defaultChecklist };
}

/**
 * updateInstallationChecklist — Aktualizuje stan pozycji checklisty (FLD-CHECKLIST-PREINSTALL).
 */
export async function updateInstallationChecklist(params: {
  installationId: string;
  actor: FieldActor;
  items: Array<{ id: string; checked: boolean }>;
}): Promise<{ success: boolean; checklist: ChecklistItemState[] }> {
  const { installationId, actor, items } = params;
  const current = (await getInstallationChecklist(installationId, actor)).checklist;
  const nowIso = new Date().toISOString();

  const updated: ChecklistItemState[] = current.map((existingItem) => {
    const updateInput = items.find((i) => i.id === existingItem.id);
    if (!updateInput) return existingItem;

    return {
      ...existingItem,
      checked: updateInput.checked,
      checkedAt: updateInput.checked ? (existingItem.checkedAt ?? nowIso) : null,
      workerId: updateInput.checked ? (existingItem.workerId ?? actor.entityId ?? null) : null,
      workerEmail: updateInput.checked ? (existingItem.workerEmail ?? actor.email) : null,
    };
  });

  inMemoryChecklistState.set(installationId, updated);
  return { success: true, checklist: updated };
}

/**
 * validateSerialNumber — Weryfikuje format numeru seryjnego z tabliczki (R9).
 */
export function validateSerialNumber(serialNumber: unknown): boolean {
  if (typeof serialNumber !== 'string') return false;
  const trimmed = serialNumber.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return false;
  // Format alfanumeryczny z dopuszczeniem myślnika i ukośnika
  return /^[A-Za-z0-9_\-\/]{3,50}$/.test(trimmed);
}

/**
 * submitHandoverProtocol — Waliduje i rejestruje protokół zdawczo-odbiorczy (FLD-HANDOVER-PROTOCOL).
 */
export async function submitHandoverProtocol(params: {
  installationId: string;
  actor: FieldActor;
  protocol: HandoverProtocolInput;
  prismaClient?: typeof prisma;
}): Promise<{ success: boolean; protocolId: string; error?: string }> {
  const { installationId, actor, protocol, prismaClient = prisma } = params;

  if (
    typeof protocol.nitrogen_test_bar !== 'number' ||
    protocol.nitrogen_test_bar <= 0 ||
    typeof protocol.vacuum_test_mbar !== 'number' ||
    protocol.vacuum_test_mbar <= 0 ||
    typeof protocol.test_duration_min !== 'number' ||
    protocol.test_duration_min <= 0
  ) {
    return {
      success: false,
      protocolId: '',
      error: 'Parametry prób ciśnienia i próżni muszą być dodatnimi liczbami',
    };
  }

  if (protocol.client_trained !== true) {
    return {
      success: false,
      protocolId: '',
      error: 'Wymagane jest potwierdzenie, że przeprowadzono instruktaż klienta',
    };
  }

  if (!validateSerialNumber(protocol.outdoor_unit?.serial_number)) {
    return {
      success: false,
      protocolId: '',
      error: 'Nieprawidłowy format lub brakujący numer seryjny jednostki zewnętrznej',
    };
  }

  if (!Array.isArray(protocol.indoor_units) || protocol.indoor_units.length === 0) {
    return {
      success: false,
      protocolId: '',
      error: 'Protokół musi zawierać co najmniej jedną jednostkę wewnętrzną',
    };
  }

  for (const indoor of protocol.indoor_units) {
    if (!validateSerialNumber(indoor.serial_number)) {
      return {
        success: false,
        protocolId: '',
        error: `Nieprawidłowy format lub brakujący numer seryjny dla jednostki wewnętrznej ${indoor.index ?? ''}`,
      };
    }
  }

  const payloadString = JSON.stringify({
    installationId,
    submittedBy: actor.email,
    submittedAt: new Date().toISOString(),
    protocol,
  });
  const contentHash = createHash('sha256').update(payloadString).digest('hex');
  const storagePath = `protocols/handover-${installationId}-${Date.now()}.json`;

  const document = await prismaClient.document.create({
    data: {
      kind: 'HANDOVER_PROTOCOL',
      sourceType: 'installations',
      sourceId: installationId,
      storagePath,
      contentHash,
      templateVersion: 'v1.0',
    },
  });

  return {
    success: true,
    protocolId: document.id,
  };
}
