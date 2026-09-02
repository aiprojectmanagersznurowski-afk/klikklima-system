// Fikstra AC12 (5/5): mutacja bez bramki — zachowanie STARE (mutacje), musi zostać
// zgłaszane dokładnie tak jak przed rozszerzeniem skanera o odczyty.
import { prisma } from '@repo/database';

export async function deleteCustomerFixture(id: string) {
  return prisma.sampleRecords.delete({ where: { id } });
}
