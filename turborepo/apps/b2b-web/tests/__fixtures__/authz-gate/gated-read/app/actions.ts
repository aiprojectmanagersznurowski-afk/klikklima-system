// Fikstra AC12 (2/5): funkcja odczytowa z can() PRZED zapytaniem — skaner ma być cicho.
import { prisma } from '@repo/database';
import { can } from '@klikklima/contracts';
import { getCurrentActorRole } from '@/utils/supabase/server';

export async function getCustomersSafely() {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'clients', 'read') !== 'yes') return [];
  return prisma.sampleRecords.findMany();
}
