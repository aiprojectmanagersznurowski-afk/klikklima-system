const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`ALTER TABLE klienci DISABLE ROW LEVEL SECURITY;`;
  await prisma.$executeRaw`ALTER TABLE adresy DISABLE ROW LEVEL SECURITY;`;
  await prisma.$executeRaw`ALTER TABLE leady DISABLE ROW LEVEL SECURITY;`;
  console.log("RLS Disabled.");
}

main().finally(() => prisma.$disconnect());
