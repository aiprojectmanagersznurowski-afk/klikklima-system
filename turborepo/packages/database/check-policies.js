import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const policies = await prisma.$queryRaw`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies;`;
  console.log(JSON.stringify(policies, null, 2));
}
main().finally(() => prisma.$disconnect());
