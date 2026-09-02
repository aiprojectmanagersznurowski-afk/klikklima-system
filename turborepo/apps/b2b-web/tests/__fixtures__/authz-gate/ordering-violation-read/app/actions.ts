// Fikstra AC12 (3/5): can() JEST w ciele, ale PO pierwszym dotknięciu bazy —
// bramka po fakcie, kategoria "ordering", nie zwykły suspect.
import { prisma } from '@repo/database';
import { can } from '@klikklima/contracts';
import { getCurrentActorRole } from '@/utils/supabase/server';

export async function getCustomersOrderedWrong() {
  const rows = await prisma.sampleRecords.findMany();
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'clients', 'read') !== 'yes') return [];
  return rows;
}
