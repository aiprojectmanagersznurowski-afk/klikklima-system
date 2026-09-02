// Fikstra AC12 (1/5): funkcja WYŁĄCZNIE odczytowa bez can() — skaner musi ją zgłosić.
import { prisma } from '@repo/database';

export async function getSecrets() {
  return prisma.sampleRecords.findMany();
}
