// Fikstra AC12 (4/5): odczyt WPROST z page.tsx, z pominięciem actions.ts — dokładnie
// kształt BLOCKERA znalezionego przez rls-security-auditor w customers/[id]/page.tsx.
// Stary skaner (ograniczony do plików actions.ts) nie widziałby tego w ogóle.
import { prisma } from '@repo/database';

export default async function CustomerDetailPageFixture({ params }: { params: { id: string } }) {
  const customer = await prisma.sampleRecords.findUnique({ where: { id: params.id } });
  return customer;
}
