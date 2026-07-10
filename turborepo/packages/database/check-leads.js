const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.leady.findMany();
  console.log(`Found ${leads.length} leads.`);
  console.log(leads);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
