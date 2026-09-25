import { prisma, type Prisma } from '@repo/database';
import { can, type Role } from '@klikklima/contracts';

export interface DomainActor {
  email: string;
  role: Role;
  entityId: string;
}

export interface SetSelfAvailabilityResult {
  success: boolean;
  error?: string;
  isAvailable?: boolean;
}

export interface GetEffectiveAvailabilityResult {
  success: boolean;
  error?: string;
  isAvailable?: boolean;
  rules?: unknown[];
}

/**
 * executeSetSelfAvailability — Wspólna funkcja domenowa dla panelu B2B i aplikacji terenowej (ADR-013).
 * Weryfikuje uprawnienie can() i wykonuje atomowy upsert w availability_declarations.
 */
export async function executeSetSelfAvailability(
  actor: DomainActor,
  isAvailable: boolean,
  txClient?: Prisma.TransactionClient
): Promise<SetSelfAvailabilityResult> {
  const access = can(actor.role, 'availability_declarations', 'update');
  if (access !== 'own' && access !== 'yes') {
    return { success: false, error: 'Brak uprawnień do zmiany własnej dostępności.' };
  }

  const db = txClient ?? prisma;

  if (actor.role === 'audytor') {
    const declaration = await db.availabilityDeclaration.upsert({
      where: { auditorId: actor.entityId },
      create: { auditorId: actor.entityId, isAvailable },
      update: { isAvailable },
    });
    return { success: true, isAvailable: declaration.isAvailable };
  } else if (actor.role === 'monter') {
    const declaration = await db.availabilityDeclaration.upsert({
      where: { crewId: actor.entityId },
      create: { crewId: actor.entityId, isAvailable },
      update: { isAvailable },
    });
    return { success: true, isAvailable: declaration.isAvailable };
  }

  return { success: false, error: 'Rola nie obsługuje deklaracji dostępności pracownika terenowego.' };
}

/**
 * executeGetEffectiveAvailability — Wspólna funkcja domenowa odczytu dostępności dla pracownika.
 */
export async function executeGetEffectiveAvailability(
  actor: DomainActor,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: { from?: Date; to?: Date }
): Promise<GetEffectiveAvailabilityResult> {
  const access = can(actor.role, 'availability_rules', 'read');
  if (access !== 'own' && access !== 'yes') {
    return { success: false, error: 'Brak uprawnień do odczytu dostępności.' };
  }

  let declaration = null;
  if (actor.role === 'audytor') {
    declaration = await prisma.availabilityDeclaration.findUnique({
      where: { auditorId: actor.entityId },
    });
  } else if (actor.role === 'monter') {
    declaration = await prisma.availabilityDeclaration.findUnique({
      where: { crewId: actor.entityId },
    });
  }

  return {
    success: true,
    isAvailable: declaration ? declaration.isAvailable : true,
    rules: [],
  };
}
