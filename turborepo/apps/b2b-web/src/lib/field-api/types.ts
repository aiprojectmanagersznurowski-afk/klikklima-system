import type { ROLES } from '@klikklima/contracts';
import type { Prisma } from '@repo/database';

export type FieldActorRole = (typeof ROLES)[number];

export interface FieldActor {
  email: string;
  role: FieldActorRole;
  entityId: string;
  isActive: boolean;
}

export type VerifyFieldActorResult =
  | { success: true; actor: FieldActor }
  | { success: false; status: 401 | 403; error: string };

export interface IdempotencyParams {
  idempotencyKey: string | null;
  actorEmail: string;
  endpoint: string;
  body: unknown;
  operation: (tx?: Prisma.TransactionClient) => Promise<{ status: number; body: unknown }>;
}

export interface SecurityEventParams {
  actorEmail: string | null;
  actorRole: string | null;
  resource: string;
  attemptedCapability: string;
  endpoint: string;
}
